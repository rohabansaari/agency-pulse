<?php

namespace App\Services\Time;

use App\Enums\OrganizationMemberStatus;
use App\Enums\ProjectStatus;
use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Enums\UserRole;
use App\Models\OrganizationMember;
use App\Models\Project;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Payroll\PayrollPeriodLockService;
use App\Services\Projects\ProjectAccessService;
use App\Services\Tenant\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class ManualTimeEntryService
{
    public function __construct(
        private readonly ProjectAccessService $projectAccess,
        private readonly PayrollPeriodLockService $payrollLock
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function contextForEmployee(User $employee): array
    {
        $team = $this->resolveEmployeeTeam($employee);

        if (! $team) {
            return [
                'can_create' => false,
                'reason' => 'You must belong to a team with an assigned manager to submit manual time.',
                'team' => null,
                'managers' => [],
                'projects' => [],
            ];
        }

        if (! $team->manager_id) {
            return [
                'can_create' => false,
                'reason' => 'Your team does not have an assigned manager yet.',
                'team' => $this->teamPayload($team),
                'managers' => [],
                'projects' => [],
            ];
        }

        $projects = $this->accessibleProjectsForEmployee($employee);

        if ($projects->isEmpty()) {
            return [
                'can_create' => false,
                'reason' => 'You must be assigned to at least one project before submitting manual time.',
                'team' => $this->teamPayload($team),
                'managers' => $this->managersForTeam($team),
                'projects' => [],
            ];
        }

        return [
            'can_create' => true,
            'reason' => null,
            'team' => $this->teamPayload($team),
            'managers' => $this->managersForTeam($team),
            'projects' => $projects->map(fn (Project $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'client_name' => $p->client_name,
            ])->values()->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createForEmployee(User $employee, array $data): TimeEntry
    {
        if ($employee->currentRole() !== UserRole::Employee) {
            throw ValidationException::withMessages([
                'authorization' => ['Only employees can submit manual time entries through this endpoint.'],
            ]);
        }

        $team = $this->resolveEmployeeTeam($employee);

        if (! $team) {
            throw ValidationException::withMessages([
                'team' => ['You must belong to a team to submit manual time entries.'],
            ]);
        }

        if (! $team->manager_id) {
            throw ValidationException::withMessages([
                'team' => ['Your team must have an assigned manager before you can submit manual time.'],
            ]);
        }

        $projects = $this->accessibleProjectsForEmployee($employee);

        if ($projects->isEmpty()) {
            throw ValidationException::withMessages([
                'project_id' => ['You must be assigned to at least one project before submitting manual time.'],
            ]);
        }

        $project = Project::query()->find($data['project_id'] ?? null);

        if (! $project || ! $this->projectAccess->userCanAccessProject($employee, $project)) {
            throw ValidationException::withMessages([
                'project_id' => ['The selected project is not accessible to you.'],
            ]);
        }

        if ((int) $data['manager_id'] !== (int) $team->manager_id) {
            throw ValidationException::withMessages([
                'manager_id' => ['The selected manager must be your team manager.'],
            ]);
        }

        if (empty($data['description'])) {
            throw ValidationException::withMessages([
                'description' => ['Description is required.'],
            ]);
        }

        $date = Carbon::parse($data['date'])->startOfDay();
        $this->payrollLock->assertDateModifiable($date);

        return TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => TenantContext::id(),
            'type' => TimeEntryType::Manual,
            'team_id' => $team->id,
            'project_id' => $project->id,
            'manager_id' => (int) $data['manager_id'],
            'start_time' => $date,
            'end_time' => $date->copy()->addSeconds((int) $data['duration']),
            'duration' => (int) $data['duration'],
            'description' => $data['description'],
            'status' => TimeEntryStatus::Pending,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function contextForManager(User $manager): array
    {
        $teams = Team::query()
            ->with(['members'])
            ->where('organization_id', TenantContext::id())
            ->where('manager_id', $manager->id)
            ->orderBy('name')
            ->get();

        $members = [];
        $seen = [];

        foreach ($teams as $team) {
            foreach ($team->members as $member) {
                if (isset($seen[$member->id])) {
                    continue;
                }

                $seen[$member->id] = true;
                $projects = $this->accessibleProjectsForEmployee($member);

                $members[] = [
                    'id' => $member->id,
                    'name' => $member->name,
                    'team_id' => $team->id,
                    'team_name' => $team->name,
                    'projects' => $projects->map(fn (Project $p) => [
                        'id' => $p->id,
                        'name' => $p->name,
                        'client_name' => $p->client_name,
                    ])->values()->all(),
                ];
            }
        }

        $selfProjects = $this->accessibleProjectsForManager($manager);
        $canCreateSelf = $selfProjects->isNotEmpty();

        if ($members === []) {
            return [
                'can_create' => false,
                'reason' => 'You must manage a team with members to record manual time for employees.',
                'can_create_self' => $canCreateSelf,
                'reason_self' => $canCreateSelf
                    ? null
                    : 'You need access to at least one project before submitting manual time for yourself.',
                'self_projects' => $this->projectOptions($selfProjects),
                'team_members' => [],
            ];
        }

        $hasProjectAccess = collect($members)->contains(
            fn (array $member) => $member['projects'] !== []
        );

        if (! $hasProjectAccess) {
            return [
                'can_create' => false,
                'reason' => 'Team members must be assigned to at least one project before manual time can be recorded.',
                'can_create_self' => $canCreateSelf,
                'reason_self' => $canCreateSelf
                    ? null
                    : 'You need access to at least one project before submitting manual time for yourself.',
                'self_projects' => $this->projectOptions($selfProjects),
                'team_members' => $members,
            ];
        }

        return [
            'can_create' => true,
            'reason' => null,
            'can_create_self' => $canCreateSelf,
            'reason_self' => $canCreateSelf
                ? null
                : 'You need access to at least one project before submitting manual time for yourself.',
            'self_projects' => $this->projectOptions($selfProjects),
            'team_members' => $members,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function contextForAdmin(): array
    {
        $employees = OrganizationMember::query()
            ->with('user')
            ->where('organization_id', TenantContext::id())
            ->where('status', OrganizationMemberStatus::Active)
            ->where('role', UserRole::Employee)
            ->get()
            ->map(fn (OrganizationMember $member) => [
                'id' => $member->user_id,
                'name' => $member->user->name,
            ])
            ->values()
            ->all();

        $projects = Project::query()
            ->where('organization_id', TenantContext::id())
            ->where('status', ProjectStatus::Active)
            ->orderBy('name')
            ->get()
            ->map(fn (Project $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'client_name' => $p->client_name,
            ])
            ->values()
            ->all();

        return [
            'can_create' => true,
            'reason' => null,
            'employees' => $employees,
            'projects' => $projects,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createForManagerSelf(User $manager, array $data): TimeEntry
    {
        if ($manager->currentRole() !== UserRole::Manager) {
            abort(403, 'Only managers can submit manual time for themselves through this endpoint.');
        }

        $project = Project::query()->find($data['project_id'] ?? null);

        if (! $project || ! $this->projectAccess->userCanAccessProject($manager, $project)) {
            throw ValidationException::withMessages([
                'project_id' => ['The selected project is not accessible to you.'],
            ]);
        }

        if (empty($data['description'])) {
            throw ValidationException::withMessages([
                'description' => ['Description is required.'],
            ]);
        }

        $date = Carbon::parse($data['date'])->startOfDay();
        $this->payrollLock->assertDateModifiable($date);

        $managedTeam = Team::query()
            ->where('organization_id', TenantContext::id())
            ->where('manager_id', $manager->id)
            ->orderBy('name')
            ->first();

        return TimeEntry::create([
            'user_id' => $manager->id,
            'organization_id' => TenantContext::id(),
            'type' => TimeEntryType::Manual,
            'team_id' => $managedTeam?->id,
            'project_id' => $project->id,
            'manager_id' => null,
            'start_time' => $date,
            'end_time' => $date->copy()->addSeconds((int) $data['duration']),
            'duration' => (int) $data['duration'],
            'description' => $data['description'],
            'status' => TimeEntryStatus::Pending,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createForTeamMemberByManager(User $manager, array $data): TimeEntry
    {
        if ($manager->currentRole() !== UserRole::Manager) {
            abort(403, 'Only managers can create manual time entries for team members.');
        }

        $employee = User::query()->findOrFail($data['user_id']);
        $this->ensureActiveOrgMember($employee->id);

        $team = $this->resolveTeamForManagedMember($manager, $employee);

        if (! $team) {
            throw ValidationException::withMessages([
                'user_id' => ['Employee must belong to one of your managed teams.'],
            ]);
        }

        $project = Project::query()->find($data['project_id'] ?? null);

        if (! $project || ! $this->projectAccess->userCanAccessProject($employee, $project)) {
            throw ValidationException::withMessages([
                'project_id' => ['The selected project is not accessible to this employee.'],
            ]);
        }

        if (empty($data['description'])) {
            throw ValidationException::withMessages([
                'description' => ['Description is required.'],
            ]);
        }

        $date = Carbon::parse($data['date'])->startOfDay();
        $this->payrollLock->assertDateModifiable($date);
        $requireApproval = $data['require_approval'] ?? false;
        $autoApprove = ! $requireApproval;

        return TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => TenantContext::id(),
            'type' => TimeEntryType::Manual,
            'team_id' => $team->id,
            'project_id' => $project->id,
            'manager_id' => $manager->id,
            'start_time' => $date,
            'end_time' => $date->copy()->addSeconds((int) $data['duration']),
            'duration' => (int) $data['duration'],
            'description' => $data['description'],
            'status' => $autoApprove ? TimeEntryStatus::Approved : TimeEntryStatus::Pending,
            'approved_by' => $autoApprove ? $manager->id : null,
            'approved_at' => $autoApprove ? now() : null,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createForEmployeeByAdmin(User $admin, User $employee, array $data): TimeEntry
    {
        if ($admin->currentRole() !== UserRole::Admin) {
            abort(403, 'Only admins can create manual time entries on behalf of employees.');
        }

        $this->ensureActiveOrgMember($employee->id);

        $team = isset($data['team_id'])
            ? Team::query()->where('organization_id', TenantContext::id())->find($data['team_id'])
            : $this->resolveEmployeeTeam($employee);

        if (! $team) {
            throw ValidationException::withMessages([
                'team_id' => ['Employee must belong to a team.'],
            ]);
        }

        $managerId = $data['manager_id'] ?? $team->manager_id;

        if (! $managerId || (int) $managerId !== (int) $team->manager_id) {
            throw ValidationException::withMessages([
                'manager_id' => ['Manager must match the selected team manager.'],
            ]);
        }

        $project = Project::query()->findOrFail($data['project_id']);

        if ($project->organization_id !== TenantContext::id()) {
            abort(404);
        }

        $date = Carbon::parse($data['date'])->startOfDay();
        $this->payrollLock->assertDateModifiable($date);
        $autoApprove = $data['auto_approve'] ?? true;

        return TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => TenantContext::id(),
            'type' => TimeEntryType::Manual,
            'team_id' => $team->id,
            'project_id' => $project->id,
            'manager_id' => $managerId,
            'start_time' => $date,
            'end_time' => $date->copy()->addSeconds((int) $data['duration']),
            'duration' => (int) $data['duration'],
            'description' => $data['description'] ?? null,
            'status' => $autoApprove ? TimeEntryStatus::Approved : TimeEntryStatus::Pending,
            'approved_by' => $autoApprove ? $admin->id : null,
            'approved_at' => $autoApprove ? now() : null,
        ]);
    }

    /**
     * @return Collection<int, TimeEntry>
     */
    public function pendingForManager(User $manager): Collection
    {
        $memberIds = $this->managedTeamMemberIds($manager);

        if ($memberIds->isEmpty()) {
            return collect();
        }

        return TimeEntry::query()
            ->manualEntries()
            ->with(['user', 'project', 'team'])
            ->where('organization_id', TenantContext::id())
            ->where('status', TimeEntryStatus::Pending)
            ->where('manager_id', $manager->id)
            ->whereIn('user_id', $memberIds)
            ->where('user_id', '!=', $manager->id)
            ->orderByDesc('start_time')
            ->get();
    }

    /**
     * @return Collection<int, TimeEntry>
     */
    public function pendingForAdmin(): Collection
    {
        return TimeEntry::query()
            ->manualEntries()
            ->with(['user', 'project', 'team', 'assignedManager'])
            ->where('organization_id', TenantContext::id())
            ->where('status', TimeEntryStatus::Pending)
            ->orderByDesc('start_time')
            ->get();
    }

    public function approve(TimeEntry $entry, User $actor): TimeEntry
    {
        $this->ensureCanReview($entry, $actor);
        $this->payrollLock->assertTimeEntryModifiable($entry);

        if ($entry->status !== TimeEntryStatus::Pending) {
            throw ValidationException::withMessages([
                'status' => ['Only pending manual entries can be approved.'],
            ]);
        }

        $entry->update([
            'status' => TimeEntryStatus::Approved,
            'approved_by' => $actor->id,
            'approved_at' => now(),
        ]);

        return $entry->fresh(['user', 'project', 'approver', 'assignedManager', 'team']);
    }

    public function reject(TimeEntry $entry, User $actor): TimeEntry
    {
        $this->ensureCanReview($entry, $actor);
        $this->payrollLock->assertTimeEntryModifiable($entry);

        if ($entry->status !== TimeEntryStatus::Pending) {
            throw ValidationException::withMessages([
                'status' => ['Only pending manual entries can be rejected.'],
            ]);
        }

        $entry->update([
            'status' => TimeEntryStatus::Rejected,
            'approved_by' => $actor->id,
            'approved_at' => now(),
        ]);

        return $entry->fresh(['user', 'project', 'approver', 'assignedManager', 'team']);
    }

    private function ensureCanReview(TimeEntry $entry, User $actor): void
    {
        if ($entry->organization_id !== TenantContext::id()) {
            abort(404);
        }

        if ($entry->type !== TimeEntryType::Manual) {
            throw ValidationException::withMessages([
                'type' => ['Only manual time entries can be reviewed.'],
            ]);
        }

        $role = $actor->currentRole();

        if ($role === UserRole::Admin) {
            return;
        }

        if ($role === UserRole::Manager) {
            if ((int) $entry->user_id === (int) $actor->id) {
                throw ValidationException::withMessages([
                    'authorization' => ['You cannot approve or reject your own manual time entries.'],
                ]);
            }

            $memberIds = $this->managedTeamMemberIds($actor);

            if ((int) $entry->manager_id === (int) $actor->id
                && $memberIds->contains($entry->user_id)) {
                return;
            }
        }

        throw ValidationException::withMessages([
            'authorization' => ['You are not allowed to review this manual time entry.'],
        ]);
    }

    private function resolveEmployeeTeam(User $employee): ?Team
    {
        return $employee->workTeam()
            ->with('manager')
            ->where('teams.organization_id', TenantContext::id())
            ->first();
    }

    /**
     * @return Collection<int, Project>
     */
    private function accessibleProjectsForEmployee(User $employee): Collection
    {
        return $this->projectAccess
            ->accessibleProjectsQuery($employee)
            ->where('status', ProjectStatus::Active)
            ->orderBy('name')
            ->get();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function managersForTeam(Team $team): array
    {
        $team->loadMissing('manager');

        if (! $team->manager) {
            return [];
        }

        return [[
            'id' => $team->manager->id,
            'name' => $team->manager->name,
        ]];
    }

    /**
     * @return array<string, mixed>
     */
    private function teamPayload(Team $team): array
    {
        return [
            'id' => $team->id,
            'name' => $team->name,
        ];
    }

    private function ensureActiveOrgMember(int $userId): void
    {
        $exists = OrganizationMember::query()
            ->where('organization_id', TenantContext::id())
            ->where('user_id', $userId)
            ->where('status', OrganizationMemberStatus::Active)
            ->exists();

        if (! $exists) {
            throw ValidationException::withMessages([
                'user_id' => ['User is not an active member of this organization.'],
            ]);
        }
    }

    /**
     * @return Collection<int, int>
     */
    private function managedTeamMemberIds(User $manager): Collection
    {
        $managedTeamIds = Team::query()
            ->where('organization_id', TenantContext::id())
            ->where('manager_id', $manager->id)
            ->pluck('id');

        return TeamMember::query()
            ->whereIn('team_id', $managedTeamIds)
            ->pluck('user_id');
    }

    private function resolveTeamForManagedMember(User $manager, User $employee): ?Team
    {
        return Team::query()
            ->where('organization_id', TenantContext::id())
            ->where('manager_id', $manager->id)
            ->whereHas('members', fn ($query) => $query->where('users.id', $employee->id))
            ->first();
    }

    /**
     * @return Collection<int, Project>
     */
    private function accessibleProjectsForManager(User $manager): Collection
    {
        $teamProjectIds = $this->projectAccess->teamAccessibleProjectIds($manager);

        return Project::query()
            ->where('organization_id', TenantContext::id())
            ->where('status', ProjectStatus::Active)
            ->where(function ($query) use ($manager, $teamProjectIds) {
                $query->whereHas('members', fn ($memberQuery) => $memberQuery->where('users.id', $manager->id));

                if ($teamProjectIds->isNotEmpty()) {
                    $query->orWhereIn('id', $teamProjectIds);
                }
            })
            ->orderBy('name')
            ->get();
    }

    /**
     * @param  Collection<int, Project>  $projects
     * @return list<array<string, mixed>>
     */
    private function projectOptions(Collection $projects): array
    {
        return $projects->map(fn (Project $project) => [
            'id' => $project->id,
            'name' => $project->name,
            'client_name' => $project->client_name,
        ])->values()->all();
    }
}
