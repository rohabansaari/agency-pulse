<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\OrganizationMemberStatus;
use App\Enums\SalaryType;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\TeamMemberResource;
use App\Models\InvitationToken;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use App\Http\Resources\EmployeeProfileResource;
use App\Services\Auth\InvitationService;
use App\Services\Auth\MembershipRoleSync;
use App\Services\Auth\RoleMutationGuard;
use App\Services\Employee\EmployeeDirectoryService;
use App\Services\Onboarding\OnboardingEmployeeService;
use App\Services\Payroll\AdminPayrollService;
use App\Services\Payroll\PayrollVaultService;
use App\Services\Tenant\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TeamController extends TenantAppController
{
    public function __construct(
        private readonly MembershipRoleSync $membershipRoleSync,
        private readonly AdminPayrollService $adminPayroll,
        private readonly PayrollVaultService $payrollVault,
        private readonly EmployeeDirectoryService $employeeDirectory,
        private readonly OnboardingEmployeeService $employeeImport,
        private readonly InvitationService $invitations,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        if (! $request->user()?->currentRole()?->isOperationalAdmin()) {
            abort(403);
        }

        return TeamMemberResource::collection(
            $this->employeeDirectory->membersWithDirectoryMeta()
        );
    }

    public function profile(User $user): EmployeeProfileResource
    {
        if (! request()->user()?->currentRole()?->isOperationalAdmin()) {
            abort(403);
        }

        $this->ensureUserInTenant($user);

        return new EmployeeProfileResource(
            $this->employeeDirectory->profileForUser($user)
        );
    }

    public function createEmployee(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['prohibited'],
            'salary_type' => ['required', Rule::enum(SalaryType::class)],
            'hourly_rate' => ['required_if:salary_type,hourly', 'nullable', 'numeric', 'min:0.01'],
            'monthly_salary' => ['required_if:salary_type,monthly', 'nullable', 'numeric', 'min:0.01'],
            'effective_from' => ['sometimes', 'date'],
            'payroll_pin' => [
                Rule::requiredIf(fn () => $this->payrollVault->requiresPinOnEmployeeCreate()),
                'nullable',
                'string',
                'regex:/^\d{4,8}$/',
                'confirmed',
            ],
            'role' => [
                'required',
                Rule::enum(UserRole::class),
                Rule::notIn([UserRole::SuperAdmin->value, UserRole::Admin->value]),
            ],
        ]);

        $assignedRole = UserRole::from($validated['role']);
        RoleMutationGuard::assertCreationRoleAllowed($assignedRole);
        RoleMutationGuard::assertPrivilegedRoleAssignable($request->user(), $assignedRole);

        $organization = Organization::query()->findOrFail(TenantContext::id());

        $bundle = DB::transaction(function () use ($validated, $request, $assignedRole, $organization) {
            $pending = $this->invitations->createPendingMember(
                $organization,
                $validated['name'],
                $validated['email'],
                $assignedRole,
            );

            $this->adminPayroll->createInitialContract($pending['user'], $validated, $request->user());

            if (! empty($validated['payroll_pin'])) {
                $this->payrollVault->setPinOnFirstEmployee($request->user(), $validated['payroll_pin']);
            }

            $plainToken = $this->invitations->issueToken($pending['user'], $organization, resent: false);

            return [
                'membership' => $pending['membership'],
                'plain_token' => $plainToken,
            ];
        });

        $emailSent = $this->invitations->trySendInvitationEmail(
            $bundle['membership']->user,
            $organization,
            $bundle['plain_token'],
        );

        $message = $emailSent
            ? 'Employee invited. An activation email was sent.'
            : 'Employee invited. The activation email could not be sent — resend the invitation from the team page.';

        return response()->json([
            'message' => $message,
            'member' => new TeamMemberResource($bundle['membership']),
            'invitation_email_sent' => $emailSent,
        ], 201);
    }

    public function resendInvitation(Request $request, User $user): JsonResponse
    {
        $this->ensureUserInTenant($user);

        $organization = Organization::query()->findOrFail(TenantContext::id());
        $membership = OrganizationMember::query()
            ->where('organization_id', $organization->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $this->invitations->resend(
            $user,
            $organization,
            $membership->role === UserRole::Admin,
        );

        return response()->json([
            'message' => 'Invitation email resent.',
            'member' => new TeamMemberResource($membership->fresh()->load('user')),
        ]);
    }

    public function invite(Request $request): JsonResponse
    {
        $this->authorizeTeamManagement($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['prohibited'],
            'role' => ['required', Rule::enum(UserRole::class), Rule::notIn([UserRole::SuperAdmin->value])],
        ]);

        $role = UserRole::from($validated['role']);

        if (in_array($validated['role'], [UserRole::Admin->value, UserRole::SubAdmin->value], true)) {
            RoleMutationGuard::assertPrivilegedRoleAssignable($request->user(), $role);
        }

        $organization = Organization::query()->findOrFail(TenantContext::id());

        $result = $this->invitations->createInvitedMember(
            $organization,
            $validated['name'],
            $validated['email'],
            $role,
        );

        $message = $result['invitation_email_sent']
            ? 'Invitation sent.'
            : 'Member invited. The invitation email could not be sent — resend it from the team page.';

        return response()->json([
            'message' => $message,
            'member' => new TeamMemberResource($result['membership']),
            'invitation_email_sent' => $result['invitation_email_sent'],
        ], 201);
    }

    public function update(Request $request, OrganizationMember $member): JsonResponse
    {
        $actorRole = $request->user()?->currentRole();

        if (! $actorRole?->isOperationalAdmin()) {
            throw ValidationException::withMessages([
                'authorization' => ['You are not allowed to update team members.'],
            ]);
        }

        $this->ensureMemberInTenant($member);

        if ($actorRole === UserRole::SubAdmin) {
            if ($request->has('role')) {
                abort(403, 'Sub admins cannot change member roles.');
            }

            if (in_array($member->role, [UserRole::Admin, UserRole::SubAdmin], true)) {
                abort(403, 'Sub admins cannot modify admin accounts.');
            }

            $validated = $request->validate([
                'status' => ['sometimes', Rule::enum(OrganizationMemberStatus::class)],
                'name' => ['sometimes', 'string', 'max:255'],
            ]);
        } else {
            $validated = $request->validate([
                'role' => ['sometimes', Rule::enum(UserRole::class), Rule::notIn([UserRole::SuperAdmin->value])],
                'status' => ['sometimes', Rule::enum(OrganizationMemberStatus::class)],
                'name' => ['sometimes', 'string', 'max:255'],
            ]);

            if (isset($validated['role'])) {
                RoleMutationGuard::assertRoleChangeAllowed(
                    $request->user(),
                    $member,
                    UserRole::from($validated['role']),
                );
            }
        }

        if (isset($validated['status'])) {
            RoleMutationGuard::assertStatusChangeAllowed($member);
        }

        if (isset($validated['status']) && $request->user()->id === $member->user_id) {
            throw ValidationException::withMessages([
                'status' => ['You cannot change your own membership status.'],
            ]);
        }

        if (isset($validated['status']) && $validated['status'] === OrganizationMemberStatus::Active->value) {
            $validated['joined_at'] = $member->joined_at ?? now();
        }

        if (isset($validated['name'])) {
            $member->user->forceFill(['name' => $validated['name']])->saveQuietly();
            unset($validated['name']);
        }

        $member->update($validated);

        if (isset($validated['role'])) {
            $member->user->forceFill(['role' => $validated['role']])->saveQuietly();
            $this->membershipRoleSync->syncFromMembership($member->fresh());
        }

        return response()->json([
            'message' => 'Team member updated.',
            'member' => new TeamMemberResource($member->fresh()->load('user')),
        ]);
    }

    private function authorizeTeamAccess(Request $request): void
    {
        $role = $request->user()?->currentRole();

        if (! in_array($role, [UserRole::Admin, UserRole::Manager], true)) {
            throw ValidationException::withMessages([
                'authorization' => ['You are not allowed to view the team.'],
            ]);
        }
    }

    private function authorizeTeamManagement(Request $request): void
    {
        $role = $request->user()?->currentRole();

        if ($role === UserRole::Admin) {
            return;
        }

        if ($role === UserRole::Manager) {
            return;
        }

        throw ValidationException::withMessages([
            'authorization' => ['You are not allowed to manage the team.'],
        ]);
    }

    private function ensureMemberInTenant(OrganizationMember $member): void
    {
        if ($member->organization_id !== TenantContext::id()) {
            abort(404);
        }
    }

    private function ensureUserInTenant(User $user): void
    {
        if (! OrganizationMember::query()
            ->where('organization_id', TenantContext::id())
            ->where('user_id', $user->id)
            ->exists()) {
            abort(404);
        }
    }

    public function importEmployees(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:2048'],
        ]);

        $csvContent = (string) file_get_contents($validated['file']->getRealPath());
        $result = $this->employeeImport->importCsv($csvContent, $request->user());

        return response()->json([
            'message' => $result['message'],
            'created' => $result['created'],
            'failed_count' => $result['failed_count'],
            'total' => $result['total'],
            'failed' => $result['failed'],
            'results' => $result['results'],
        ]);
    }

    public function sampleCsv(): StreamedResponse
    {
        $headers = ['name', 'email', 'salary', 'salary_type', 'role'];
        $rows = [
            ['John Doe', 'john@example.com', '100000', 'monthly', 'employee'],
            ['Jane Smith', 'jane@example.com', '1200', 'hourly', 'manager'],
            ['Mark Wilson', 'mark@example.com', '85000', 'monthly', 'sub_admin'],
        ];

        return response()->streamDownload(function () use ($headers, $rows): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $headers);
            foreach ($rows as $row) {
                fputcsv($handle, $row);
            }
            fclose($handle);
        }, 'employee-import-sample.csv', [
            'Content-Type' => 'text/csv',
        ]);
    }
}
