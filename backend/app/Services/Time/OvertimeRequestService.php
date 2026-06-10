<?php

namespace App\Services\Time;

use App\Enums\OrganizationMemberStatus;
use App\Enums\OvertimeRequestStatus;
use App\Enums\ProjectStatus;
use App\Enums\UserRole;
use App\Models\OrganizationMember;
use App\Models\OvertimeRequest;
use App\Models\Project;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use App\Services\Payroll\PayrollPeriodLockService;
use App\Services\Payroll\PayrollSettingsService;
use App\Services\Projects\ProjectAccessService;
use App\Services\Tenant\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class OvertimeRequestService
{
    public function __construct(
        private readonly ProjectAccessService $projectAccess,
        private readonly PayrollPeriodLockService $payrollLock,
        private readonly PayrollSettingsService $payrollSettings
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function contextForEmployee(User $employee): array
    {
        $this->assertOvertimeEnabled();

        $team = $this->resolveEmployeeTeam($employee);

        if (! $team?->manager_id) {
            return [
                'can_create' => false,
                'reason' => 'You must belong to a team with an assigned manager to request overtime.',
                'projects' => [],
            ];
        }

        $projects = $this->accessibleProjectsForUser($employee);

        if ($projects->isEmpty()) {
            return [
                'can_create' => false,
                'reason' => 'You must be assigned to at least one project before requesting overtime.',
                'projects' => [],
            ];
        }

        return [
            'can_create' => true,
            'reason' => null,
            'team' => ['id' => $team->id, 'name' => $team->name],
            'manager' => ['id' => $team->manager_id, 'name' => $team->manager?->name],
            'projects' => $this->projectOptions($projects),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function contextForManager(User $manager): array
    {
        $this->assertOvertimeEnabled();

        $selfProjects = $this->accessibleProjectsForUser($manager);
        $canCreateSelf = $selfProjects->isNotEmpty();

        return [
            'can_create_self' => $canCreateSelf,
            'reason_self' => $canCreateSelf
                ? null
                : 'You need access to at least one project before requesting overtime for yourself.',
            'self_projects' => $this->projectOptions($selfProjects),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createForEmployee(User $employee, array $data): OvertimeRequest
    {
        $this->assertOvertimeEnabled();

        if ($employee->currentRole() !== UserRole::Employee) {
            abort(403, 'Only employees can submit overtime through this endpoint.');
        }

        $team = $this->resolveEmployeeTeam($employee);

        if (! $team?->manager_id) {
            throw ValidationException::withMessages([
                'team' => ['You must belong to a team with an assigned manager.'],
            ]);
        }

        $project = $this->resolveAccessibleProject($employee, (int) $data['project_id']);
        $workDate = Carbon::parse($data['date'])->startOfDay();
        $this->payrollLock->assertDateModifiable($workDate);

        return OvertimeRequest::create([
            'organization_id' => TenantContext::id(),
            'user_id' => $employee->id,
            'project_id' => $project->id,
            'manager_id' => $team->manager_id,
            'work_date' => $workDate,
            'duration_seconds' => (int) $data['duration'],
            'reason' => $data['reason'],
            'status' => OvertimeRequestStatus::Pending,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createForManagerSelf(User $manager, array $data): OvertimeRequest
    {
        $this->assertOvertimeEnabled();

        if ($manager->currentRole() !== UserRole::Manager) {
            abort(403, 'Only managers can submit overtime for themselves through this endpoint.');
        }

        $project = $this->resolveAccessibleProject($manager, (int) $data['project_id']);
        $workDate = Carbon::parse($data['date'])->startOfDay();
        $this->payrollLock->assertDateModifiable($workDate);

        return OvertimeRequest::create([
            'organization_id' => TenantContext::id(),
            'user_id' => $manager->id,
            'project_id' => $project->id,
            'manager_id' => null,
            'work_date' => $workDate,
            'duration_seconds' => (int) $data['duration'],
            'reason' => $data['reason'],
            'status' => OvertimeRequestStatus::Pending,
        ]);
    }

    /**
     * @return Collection<int, OvertimeRequest>
     */
    public function listForUser(User $user): Collection
    {
        return OvertimeRequest::query()
            ->with(['project', 'reviewer', 'assignedManager'])
            ->where('organization_id', TenantContext::id())
            ->where('user_id', $user->id)
            ->orderByDesc('work_date')
            ->get();
    }

    /**
     * @return Collection<int, OvertimeRequest>
     */
    public function pendingForManager(User $manager): Collection
    {
        $memberIds = $this->managedTeamMemberIds($manager);

        if ($memberIds->isEmpty()) {
            return collect();
        }

        return OvertimeRequest::query()
            ->with(['user', 'project'])
            ->where('organization_id', TenantContext::id())
            ->where('status', OvertimeRequestStatus::Pending)
            ->where('manager_id', $manager->id)
            ->whereIn('user_id', $memberIds)
            ->where('user_id', '!=', $manager->id)
            ->orderByDesc('work_date')
            ->get();
    }

    /**
     * @return Collection<int, OvertimeRequest>
     */
    public function pendingManagerRequestsForAdmin(): Collection
    {
        $managerUserIds = OrganizationMember::query()
            ->where('organization_id', TenantContext::id())
            ->where('status', OrganizationMemberStatus::Active)
            ->where('role', UserRole::Manager)
            ->pluck('user_id');

        return OvertimeRequest::query()
            ->with(['user', 'project'])
            ->where('organization_id', TenantContext::id())
            ->where('status', OvertimeRequestStatus::Pending)
            ->whereNull('manager_id')
            ->whereIn('user_id', $managerUserIds)
            ->orderByDesc('work_date')
            ->get();
    }

    public function approve(OvertimeRequest $request, User $actor): OvertimeRequest
    {
        $this->ensureCanReview($request, $actor);
        $this->payrollLock->assertDateModifiable($request->work_date->copy()->startOfDay());

        if ($request->status !== OvertimeRequestStatus::Pending) {
            throw ValidationException::withMessages([
                'status' => ['Only pending overtime requests can be approved.'],
            ]);
        }

        $request->update([
            'status' => OvertimeRequestStatus::Approved,
            'reviewed_by' => $actor->id,
            'reviewed_at' => now(),
            'rejection_reason' => null,
        ]);

        return $request->fresh(['user', 'project', 'reviewer', 'assignedManager']);
    }

    public function reject(OvertimeRequest $request, User $actor, ?string $reason = null): OvertimeRequest
    {
        $this->ensureCanReview($request, $actor);
        $this->payrollLock->assertDateModifiable($request->work_date->copy()->startOfDay());

        if ($request->status !== OvertimeRequestStatus::Pending) {
            throw ValidationException::withMessages([
                'status' => ['Only pending overtime requests can be rejected.'],
            ]);
        }

        $request->update([
            'status' => OvertimeRequestStatus::Rejected,
            'reviewed_by' => $actor->id,
            'reviewed_at' => now(),
            'rejection_reason' => $reason,
        ]);

        return $request->fresh(['user', 'project', 'reviewer', 'assignedManager']);
    }

    /**
     * @return Collection<int, OvertimeRequest>
     */
    public function approvedForPeriod(Carbon $periodStart, Carbon $periodEnd): Collection
    {
        return OvertimeRequest::query()
            ->where('organization_id', TenantContext::id())
            ->where('status', OvertimeRequestStatus::Approved)
            ->whereBetween('work_date', [
                $periodStart->toDateString(),
                $periodEnd->toDateString(),
            ])
            ->get();
    }

    private function assertOvertimeEnabled(): void
    {
        $settings = $this->payrollSettings->forOrganization();

        if (! $settings->overtime_enabled) {
            throw ValidationException::withMessages([
                'overtime' => ['Overtime is not enabled for this organization.'],
            ]);
        }
    }

    private function ensureCanReview(OvertimeRequest $request, User $actor): void
    {
        if ($request->organization_id !== TenantContext::id()) {
            abort(404);
        }

        $role = $actor->currentRole();

        if (in_array($role, [UserRole::Admin, UserRole::SubAdmin], true)) {
            if ($request->manager_id !== null) {
                throw ValidationException::withMessages([
                    'authorization' => ['Employee overtime requests are reviewed by the assigned manager.'],
                ]);
            }

            return;
        }

        if ($role === UserRole::Manager) {
            if ($request->user_id === $actor->id) {
                throw ValidationException::withMessages([
                    'authorization' => ['You cannot approve or reject your own overtime request.'],
                ]);
            }

            if ($request->manager_id !== $actor->id) {
                throw ValidationException::withMessages([
                    'authorization' => ['This overtime request is not assigned to you for review.'],
                ]);
            }

            return;
        }

        abort(403);
    }

    private function resolveEmployeeTeam(User $employee): ?Team
    {
        return Team::query()
            ->with('manager')
            ->where('organization_id', TenantContext::id())
            ->whereHas('members', fn ($q) => $q->where('user_id', $employee->id))
            ->orderBy('name')
            ->first();
    }

    /**
     * @return Collection<int, int>
     */
    private function managedTeamMemberIds(User $manager): Collection
    {
        return TeamMember::query()
            ->whereIn('team_id', Team::query()
                ->where('organization_id', TenantContext::id())
                ->where('manager_id', $manager->id)
                ->select('id'))
            ->pluck('user_id')
            ->unique();
    }

    /**
     * @return Collection<int, Project>
     */
    private function accessibleProjectsForUser(User $user): Collection
    {
        $projects = $this->projectAccess
            ->accessibleProjectsQuery($user)
            ->where('status', ProjectStatus::Active)
            ->orderBy('name')
            ->get();

        if ($user->currentRole() === UserRole::Employee) {
            return $projects;
        }

        return $projects
            ->filter(fn (Project $project) => $this->projectAccess->userCanAccessProject($user, $project))
            ->values();
    }

    private function resolveAccessibleProject(User $user, int $projectId): Project
    {
        $project = Project::query()->find($projectId);

        if (! $project || ! $this->projectAccess->userCanAccessProject($user, $project)) {
            throw ValidationException::withMessages([
                'project_id' => ['The selected project is not accessible to you.'],
            ]);
        }

        return $project;
    }

    /**
     * @param  Collection<int, Project>  $projects
     * @return list<array<string, mixed>>
     */
    private function projectOptions(Collection $projects): array
    {
        return $projects->map(fn (Project $p) => [
            'id' => $p->id,
            'name' => $p->name,
            'client_name' => $p->client_name,
        ])->values()->all();
    }
}
