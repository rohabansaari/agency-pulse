<?php

namespace App\Services\Time;

use App\Enums\OrganizationMemberStatus;
use App\Enums\TimeEntrySource;
use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Enums\UserRole;
use App\Models\OrganizationMember;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Payroll\PayrollPeriodLockService;
use App\Services\Reporting\UtilizationCalculator;
use App\Services\Tenant\TenantContext;
use App\Support\DisplayDate;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class LeaveTimeEntryService
{
    public function __construct(
        private readonly PayrollPeriodLockService $payrollLock,
        private readonly LeaveBalanceService $leaveBalances,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function contextForEmployee(User $employee): array
    {
        $team = $this->resolveEmployeeTeam($employee);

        if (! $team) {
            return [
                'can_request' => false,
                'reason' => 'You must belong to a team to request leave.',
                'team' => null,
                'manager' => null,
            ];
        }

        if (! $team->manager_id) {
            return [
                'can_request' => false,
                'reason' => 'Your team does not have an assigned manager yet.',
                'team' => $this->teamPayload($team),
                'manager' => null,
            ];
        }

        $team->loadMissing('manager');

        $balance = $this->leaveBalances->balanceForUser($employee);

        return [
            'can_request' => true,
            'reason' => null,
            'team' => $this->teamPayload($team),
            'manager' => [
                'id' => $team->manager->id,
                'name' => $team->manager->name,
            ],
            'leave_balance' => [
                'annual_limit_days' => $balance->annual_limit_days,
                'used_days' => (float) $balance->used_days,
                'remaining_days' => $balance->remainingDays(),
            ],
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

        return [
            'can_manage' => true,
            'employees' => $employees,
        ];
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

        $members = $teams->flatMap(function (Team $team) {
            return $team->members->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'team_id' => $team->id,
                'team_name' => $team->name,
            ]);
        })->unique('id')->values()->all();

        return [
            'teams' => $teams->map(fn (Team $t) => $this->teamPayload($t))->values()->all(),
            'team_members' => $members,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return Collection<int, TimeEntry>
     */
    public function requestByEmployee(User $employee, array $data): Collection
    {
        if ($employee->currentRole() !== UserRole::Employee) {
            throw ValidationException::withMessages([
                'authorization' => ['Only employees can request leave through this flow.'],
            ]);
        }

        $team = $this->resolveEmployeeTeam($employee);

        if (! $team) {
            throw ValidationException::withMessages([
                'team' => ['You must belong to a team to request leave.'],
            ]);
        }

        if (! $team->manager_id) {
            throw ValidationException::withMessages([
                'team' => ['Your team must have an assigned manager before you can request leave.'],
            ]);
        }

        [$startDate, $endDate] = $this->parseDateRange($data);
        $this->ensureEmployeeLeaveDatesNotInPast($startDate);
        $this->assertDateRangeModifiable($startDate, $endDate);

        $requestedDays = $startDate->copy()->startOfDay()->diffInDays($endDate->copy()->startOfDay()) + 1;
        $balance = $this->leaveBalances->balanceForUser($employee);
        if ($balance->remainingDays() < $requestedDays) {
            throw ValidationException::withMessages([
                'start_date' => ['Insufficient leave balance. You have '.$balance->remainingDays().' days remaining.'],
            ]);
        }

        return $this->createLeaveEntries(
            employee: $employee,
            team: $team,
            startDate: $startDate,
            endDate: $endDate,
            reason: $data['reason'],
            source: TimeEntrySource::Employee,
            status: TimeEntryStatus::Pending,
            managerId: $team->manager_id,
        );
    }

    /**
     * @param  array<string, mixed>  $data
     * @return Collection<int, TimeEntry>
     */
    public function createForTeamMemberByManager(User $manager, array $data): Collection
    {
        if ($manager->currentRole() !== UserRole::Manager) {
            abort(403, 'Only managers can create leave for team members.');
        }

        $employee = User::query()->findOrFail($data['user_id']);
        $this->ensureActiveOrgMember($employee->id);

        $team = $this->resolveTeamForManagedMember($manager, $employee);

        if (! $team) {
            throw ValidationException::withMessages([
                'user_id' => ['Employee must belong to one of your managed teams.'],
            ]);
        }

        [$startDate, $endDate] = $this->parseDateRange($data);
        $this->assertDateRangeModifiable($startDate, $endDate);
        $requireApproval = $data['require_approval'] ?? false;
        $status = $requireApproval ? TimeEntryStatus::Pending : TimeEntryStatus::Approved;

        return $this->createLeaveEntries(
            employee: $employee,
            team: $team,
            startDate: $startDate,
            endDate: $endDate,
            reason: $data['reason'],
            source: TimeEntrySource::Manager,
            status: $status,
            managerId: $team->manager_id,
            approvedBy: $status === TimeEntryStatus::Approved ? $manager->id : null,
        );
    }

    /**
     * @param  array<string, mixed>  $data
     * @return Collection<int, TimeEntry>
     */
    public function createByAdmin(User $admin, array $data): Collection
    {
        if ($admin->currentRole() !== UserRole::Admin) {
            abort(403, 'Only admins can create leave on behalf of any employee.');
        }

        $employee = User::query()->findOrFail($data['user_id']);
        $this->ensureActiveOrgMember($employee->id);

        $team = isset($data['team_id'])
            ? Team::query()->where('organization_id', TenantContext::id())->find($data['team_id'])
            : $this->resolveEmployeeTeam($employee);

        if (! $team) {
            throw ValidationException::withMessages([
                'team_id' => ['Employee must belong to a team.'],
            ]);
        }

        [$startDate, $endDate] = $this->parseDateRange($data);
        $this->assertDateRangeModifiable($startDate, $endDate);

        return $this->createLeaveEntries(
            employee: $employee,
            team: $team,
            startDate: $startDate,
            endDate: $endDate,
            reason: $data['reason'],
            source: TimeEntrySource::Admin,
            status: TimeEntryStatus::Approved,
            managerId: $team->manager_id,
            approvedBy: $admin->id,
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateByAdmin(TimeEntry $entry, User $admin, array $data): TimeEntry
    {
        if ($admin->currentRole() !== UserRole::Admin) {
            abort(403);
        }

        $this->ensureLeaveEntry($entry);
        $this->payrollLock->assertTimeEntryModifiable($entry);

        $updates = [];

        if (isset($data['reason'])) {
            $updates['description'] = $data['reason'];
        }

        if (isset($data['status'])) {
            $status = TimeEntryStatus::from($data['status']);
            $updates['status'] = $status;

            if ($status === TimeEntryStatus::Approved) {
                $updates['approved_by'] = $admin->id;
                $updates['approved_at'] = now();
            } elseif ($status === TimeEntryStatus::Rejected) {
                $updates['approved_by'] = $admin->id;
                $updates['approved_at'] = now();
            } elseif ($status === TimeEntryStatus::Pending) {
                $updates['approved_by'] = null;
                $updates['approved_at'] = null;
            }
        }

        if (isset($data['date'])) {
            $date = DisplayDate::parse($data['date']);
            $this->payrollLock->assertDateModifiable($date);
            $updates['start_time'] = $date;
            $updates['end_time'] = $date->copy()->addSeconds(
                $data['duration'] ?? $entry->duration ?? UtilizationCalculator::SECONDS_PER_WORK_DAY
            );
        }

        if (isset($data['duration'])) {
            $updates['duration'] = (int) $data['duration'];
            if (isset($updates['start_time'])) {
                $updates['end_time'] = $updates['start_time']->copy()->addSeconds((int) $data['duration']);
            } elseif ($entry->start_time) {
                $updates['end_time'] = $entry->start_time->copy()->addSeconds((int) $data['duration']);
            }
        }

        if (isset($data['manager_id'])) {
            $updates['manager_id'] = $data['manager_id'];
        }

        if (isset($data['user_id'])) {
            $employee = User::query()->findOrFail($data['user_id']);
            $this->ensureActiveOrgMember($employee->id);
            $updates['user_id'] = $employee->id;
        }

        $entry->update($updates);

        return $entry->fresh(['user', 'team', 'assignedManager', 'approver']);
    }

    /**
     * @return Collection<int, TimeEntry>
     */
    public function listForEmployee(User $employee): Collection
    {
        return TimeEntry::query()
            ->leaveEntries()
            ->with(['team', 'assignedManager', 'approver'])
            ->where('organization_id', TenantContext::id())
            ->where('user_id', $employee->id)
            ->orderByDesc('start_time')
            ->get();
    }

    /**
     * @return Collection<int, TimeEntry>
     */
    public function listForManager(User $manager): Collection
    {
        $memberIds = $this->managedTeamMemberIds($manager);

        if ($memberIds->isEmpty()) {
            return collect();
        }

        return TimeEntry::query()
            ->leaveEntries()
            ->with(['user', 'team', 'assignedManager', 'approver'])
            ->where('organization_id', TenantContext::id())
            ->whereIn('user_id', $memberIds)
            ->orderByDesc('start_time')
            ->get();
    }

    /**
     * @return Collection<int, TimeEntry>
     */
    public function listForAdmin(): Collection
    {
        return TimeEntry::query()
            ->leaveEntries()
            ->with(['user', 'team', 'assignedManager', 'approver'])
            ->where('organization_id', TenantContext::id())
            ->orderByDesc('start_time')
            ->get();
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
            ->leaveEntries()
            ->with(['user', 'team'])
            ->where('organization_id', TenantContext::id())
            ->where('status', TimeEntryStatus::Pending)
            ->where('manager_id', $manager->id)
            ->whereIn('user_id', $memberIds)
            ->orderByDesc('start_time')
            ->get();
    }

    /**
     * @return Collection<int, TimeEntry>
     */
    public function pendingForAdmin(): Collection
    {
        return TimeEntry::query()
            ->leaveEntries()
            ->with(['user', 'team', 'assignedManager'])
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
                'status' => ['Only pending leave entries can be approved.'],
            ]);
        }

        $entry->update([
            'status' => TimeEntryStatus::Approved,
            'approved_by' => $actor->id,
            'approved_at' => now(),
        ]);

        $this->leaveBalances->consumeDays($entry->user, 1);

        return $entry->fresh(['user', 'team', 'approver', 'assignedManager']);
    }

    public function reject(TimeEntry $entry, User $actor): TimeEntry
    {
        $this->ensureCanReview($entry, $actor);
        $this->payrollLock->assertTimeEntryModifiable($entry);

        if ($entry->status !== TimeEntryStatus::Pending) {
            throw ValidationException::withMessages([
                'status' => ['Only pending leave entries can be rejected.'],
            ]);
        }

        $entry->update([
            'status' => TimeEntryStatus::Rejected,
            'approved_by' => $actor->id,
            'approved_at' => now(),
        ]);

        return $entry->fresh(['user', 'team', 'approver', 'assignedManager']);
    }

    /**
     * @return Collection<int, TimeEntry>
     */
    private function createLeaveEntries(
        User $employee,
        Team $team,
        Carbon $startDate,
        Carbon $endDate,
        string $reason,
        TimeEntrySource $source,
        TimeEntryStatus $status,
        ?int $managerId,
        ?int $approvedBy = null,
    ): Collection {
        if (empty(trim($reason))) {
            throw ValidationException::withMessages([
                'reason' => ['Reason is required.'],
            ]);
        }

        $entries = collect();
        $cursor = $startDate->copy()->startOfDay();
        $end = $endDate->copy()->startOfDay();

        while ($cursor->lte($end)) {
            $entries->push(TimeEntry::create([
                'user_id' => $employee->id,
                'organization_id' => TenantContext::id(),
                'type' => TimeEntryType::Leave,
                'team_id' => $team->id,
                'manager_id' => $managerId,
                'project_id' => null,
                'start_time' => $cursor->copy(),
                'end_time' => $cursor->copy()->addSeconds(UtilizationCalculator::SECONDS_PER_WORK_DAY),
                'duration' => UtilizationCalculator::SECONDS_PER_WORK_DAY,
                'description' => $reason,
                'is_paid' => true,
                'source' => $source,
                'status' => $status,
                'approved_by' => $approvedBy,
                'approved_at' => $approvedBy ? now() : null,
            ]));

            $cursor->addDay();
        }

        if ($status === TimeEntryStatus::Approved) {
            $this->leaveBalances->consumeDays($employee, $entries->count());
        }

        return $entries;
    }

    private function assertDateRangeModifiable(Carbon $startDate, Carbon $endDate): void
    {
        $cursor = $startDate->copy()->startOfDay();
        $end = $endDate->copy()->startOfDay();

        while ($cursor->lte($end)) {
            $this->payrollLock->assertDateModifiable($cursor);
            $cursor->addDay();
        }
    }

    private function ensureEmployeeLeaveDatesNotInPast(Carbon $startDate): void
    {
        if ($startDate->lt(Carbon::today()->startOfDay())) {
            throw ValidationException::withMessages([
                'date' => ['Past dates are not allowed for leave requests'],
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{0: Carbon, 1: Carbon}
     */
    private function parseDateRange(array $data): array
    {
        $startDate = DisplayDate::parse(
            (string) ($data['start_date'] ?? $data['date']),
            isset($data['start_date']) ? 'start_date' : 'date'
        );
        $endDate = DisplayDate::parse(
            (string) ($data['end_date'] ?? $data['date']),
            isset($data['end_date']) ? 'end_date' : 'date'
        );

        if ($endDate->lt($startDate)) {
            throw ValidationException::withMessages([
                'end_date' => ['End date must be on or after start date.'],
            ]);
        }

        $maxDays = 90;
        if ($startDate->diffInDays($endDate) + 1 > $maxDays) {
            throw ValidationException::withMessages([
                'end_date' => ["Leave range cannot exceed {$maxDays} days."],
            ]);
        }

        return [$startDate, $endDate];
    }

    private function ensureLeaveEntry(TimeEntry $entry): void
    {
        if ($entry->organization_id !== TenantContext::id()) {
            abort(404);
        }

        if ($entry->type !== TimeEntryType::Leave) {
            throw ValidationException::withMessages([
                'type' => ['Only leave entries can be managed through this endpoint.'],
            ]);
        }
    }

    private function ensureCanReview(TimeEntry $entry, User $actor): void
    {
        $this->ensureLeaveEntry($entry);

        $role = $actor->currentRole();

        if ($role === UserRole::Admin) {
            return;
        }

        if ($role === UserRole::Manager) {
            $memberIds = $this->managedTeamMemberIds($actor);

            if ((int) $entry->manager_id === (int) $actor->id
                && $memberIds->contains($entry->user_id)) {
                return;
            }
        }

        throw ValidationException::withMessages([
            'authorization' => ['You are not allowed to review this leave entry.'],
        ]);
    }

    private function resolveEmployeeTeam(User $employee): ?Team
    {
        return $employee->workTeam()
            ->with('manager')
            ->where('teams.organization_id', TenantContext::id())
            ->first();
    }

    private function resolveTeamForManagedMember(User $manager, User $employee): ?Team
    {
        return Team::query()
            ->where('organization_id', TenantContext::id())
            ->where('manager_id', $manager->id)
            ->whereHas('members', fn ($q) => $q->where('users.id', $employee->id))
            ->first();
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
}
