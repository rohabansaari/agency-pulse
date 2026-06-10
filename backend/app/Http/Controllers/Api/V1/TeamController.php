<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\OrganizationMemberStatus;
use App\Enums\SalaryType;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\TeamMemberResource;
use App\Models\OrganizationMember;
use App\Models\User;
use App\Http\Resources\EmployeeProfileResource;
use App\Services\Auth\MembershipRoleSync;
use App\Services\Employee\EmployeeDirectoryService;
use App\Services\Payroll\AdminPayrollService;
use App\Services\Payroll\PayrollVaultService;
use App\Services\Tenant\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class TeamController extends Controller
{
    public function __construct(
        private readonly MembershipRoleSync $membershipRoleSync,
        private readonly AdminPayrollService $adminPayroll,
        private readonly PayrollVaultService $payrollVault,
        private readonly EmployeeDirectoryService $employeeDirectory
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
            'password' => ['required', 'string', Password::defaults()],
            'salary_type' => ['sometimes', Rule::enum(SalaryType::class)],
            'hourly_rate' => ['required_if:salary_type,hourly', 'nullable', 'numeric', 'min:0'],
            'monthly_salary' => ['required_if:salary_type,monthly', 'nullable', 'numeric', 'min:0'],
            'effective_from' => ['sometimes', 'date'],
            'payroll_pin' => [
                Rule::requiredIf(fn () => $this->payrollVault->requiresPinOnEmployeeCreate()),
                'nullable',
                'string',
                'regex:/^\d{4,8}$/',
                'confirmed',
            ],
        ]);

        $membership = DB::transaction(function () use ($validated, $request) {
            if (OrganizationMember::query()
                ->where('organization_id', TenantContext::id())
                ->whereHas('user', fn ($q) => $q->where('email', $validated['email']))
                ->exists()) {
                throw ValidationException::withMessages([
                    'email' => ['This email is already a member of the organization.'],
                ]);
            }

            $user = User::create([
                'organization_id' => TenantContext::id(),
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => $validated['password'],
                'role' => UserRole::Employee,
            ]);

            $membership = OrganizationMember::create([
                'organization_id' => TenantContext::id(),
                'user_id' => $user->id,
                'role' => UserRole::Employee,
                'status' => OrganizationMemberStatus::Active,
                'joined_at' => now(),
            ]);

            $this->membershipRoleSync->syncFromMembership($membership);

            if (! empty($validated['salary_type'])) {
                $this->adminPayroll->createInitialContract($user, $validated, $request->user());
            }

            if (! empty($validated['payroll_pin'])) {
                $this->payrollVault->setPinOnFirstEmployee($request->user(), $validated['payroll_pin']);
            }

            return $membership->load('user');
        });

        return response()->json([
            'message' => empty($validated['salary_type'])
                ? 'Employee account created. Configure salary under Payroll when ready.'
                : 'Employee account created with salary contract.',
            'member' => new TeamMemberResource($membership),
        ], 201);
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $this->ensureUserInTenant($user);

        $validated = $request->validate([
            'new_password' => ['required', 'string', Password::defaults()],
        ]);

        $user->forceFill([
            'password' => Hash::make($validated['new_password']),
        ])->save();

        return response()->json([
            'message' => 'Password updated successfully.',
        ]);
    }

    public function invite(Request $request): JsonResponse
    {
        $this->authorizeTeamManagement($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'role' => ['required', Rule::enum(UserRole::class)],
        ]);

        if (in_array($validated['role'], [UserRole::Admin->value, UserRole::SubAdmin->value], true)) {
            $this->ensureCanAssignPrivilegedRole($request, $validated['role']);
        }

        $membership = DB::transaction(function () use ($validated) {
            $user = User::query()->where('email', $validated['email'])->first();

            if (! $user) {
                $user = User::create([
                    'organization_id' => TenantContext::id(),
                    'name' => $validated['name'],
                    'email' => $validated['email'],
                    'password' => Hash::make(Str::password(16)), // legacy invite flow
                    'role' => $validated['role'],
                ]);
            }

            if (OrganizationMember::query()
                ->where('organization_id', TenantContext::id())
                ->where('user_id', $user->id)
                ->exists()) {
                throw ValidationException::withMessages([
                    'email' => ['This user is already a member of the organization.'],
                ]);
            }

            $membership = OrganizationMember::create([
                'organization_id' => TenantContext::id(),
                'user_id' => $user->id,
                'role' => $validated['role'],
                'status' => OrganizationMemberStatus::Invited,
                'invited_at' => now(),
            ]);

            $user->forceFill([
                'organization_id' => TenantContext::id(),
                'role' => $validated['role'],
            ])->saveQuietly();

            $this->membershipRoleSync->syncFromMembership($membership);

            return $membership->load('user');
        });

        return response()->json([
            'message' => 'Employee invited.',
            'member' => new TeamMemberResource($membership),
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
                throw ValidationException::withMessages([
                    'role' => ['Sub admins cannot change member roles.'],
                ]);
            }

            if (in_array($member->role, [UserRole::Admin, UserRole::SubAdmin], true)) {
                throw ValidationException::withMessages([
                    'authorization' => ['Sub admins cannot modify admin accounts.'],
                ]);
            }

            $validated = $request->validate([
                'status' => ['sometimes', Rule::enum(OrganizationMemberStatus::class)],
                'name' => ['sometimes', 'string', 'max:255'],
            ]);
        } else {
            $validated = $request->validate([
                'role' => ['sometimes', Rule::enum(UserRole::class)],
                'status' => ['sometimes', Rule::enum(OrganizationMemberStatus::class)],
                'name' => ['sometimes', 'string', 'max:255'],
            ]);

            if (isset($validated['role'])) {
                $this->ensureCanAssignPrivilegedRole($request, $validated['role']);
            }
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

    private function ensureCanAssignPrivilegedRole(Request $request, ?string $role = null): void
    {
        $targetRole = $role ?? UserRole::Admin->value;

        if (! in_array($targetRole, [UserRole::Admin->value, UserRole::SubAdmin->value], true)) {
            return;
        }

        if ($request->user()?->currentRole() !== UserRole::Admin) {
            throw ValidationException::withMessages([
                'role' => ['Only organization admins can assign admin or sub admin roles.'],
            ]);
        }
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
}
