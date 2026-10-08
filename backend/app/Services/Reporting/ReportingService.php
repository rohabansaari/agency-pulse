<?php

namespace App\Services\Reporting;

use App\Enums\OvertimeRequestStatus;
use App\Enums\OrganizationMemberStatus;
use App\Enums\ProjectStatus;
use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Enums\UserRole;
use App\Models\OrganizationMember;
use App\Models\OvertimeRequest;
use App\Models\Project;
use App\Models\Team;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Payroll\PayrollSettingsService;
use App\Services\Projects\ProjectAccessService;
use App\Services\Tenant\TenantContext;
use App\Support\WorkforceMembers;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ReportingService
{
    public function __construct(
        private readonly UtilizationCalculator $utilization,
        private readonly ProjectAccessService $projectAccess,
        private readonly PayrollSettingsService $payrollSettings
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function organizationReport(?Carbon $rangeStart = null, ?Carbon $rangeEnd = null): array
    {
        $orgId = TenantContext::id();
        [$todayStart, $todayEnd] = $this->utilization->periodBounds('today');
        [$weekStart, $weekEnd] = $this->utilization->periodBounds('week');
        [$monthStart, $monthEnd] = $this->utilization->periodBounds('month');

        $filterStart = $rangeStart ?? $weekStart;
        $filterEnd = $rangeEnd ?? $weekEnd;

        $activeEmployeeIds = $this->activeWorkforceMemberIds($orgId);
        $employeeCount = $activeEmployeeIds->count();
        $workforceUserIds = $activeEmployeeIds->all();

        $hoursToday = $this->sumTrackedSeconds($orgId, $todayStart, $todayEnd, $workforceUserIds);
        $hoursWeek = $this->sumTrackedSeconds($orgId, $weekStart, $weekEnd, $workforceUserIds);
        $hoursMonth = $this->sumTrackedSeconds($orgId, $monthStart, $monthEnd, $workforceUserIds);
        $hoursInRange = $this->sumTrackedSeconds($orgId, $filterStart, $filterEnd, $workforceUserIds);

        $expectedMonth = $this->utilization->expectedSeconds(
            $employeeCount,
            $monthStart,
            $monthEnd
        );
        $expectedInRange = $this->utilization->expectedSeconds(
            $employeeCount,
            $filterStart,
            $filterEnd
        );

        $teams = Team::query()
            ->with(['members', 'manager'])
            ->where('organization_id', $orgId)
            ->orderBy('name')
            ->get();

        $trackingUserIds = TimeEntry::query()
            ->trackedTimers()
            ->where('organization_id', $orgId)
            ->whereIn('user_id', $workforceUserIds)
            ->where('status', TimeEntryStatus::Running)
            ->pluck('user_id')
            ->unique();

        $teamUtilization = $teams->map(function (Team $team) use ($orgId, $filterStart, $filterEnd) {
            $participantIds = $team->participantUserIds();
            $tracked = $this->sumTrackedSeconds($orgId, $filterStart, $filterEnd, $participantIds->all());
            $expected = $this->utilization->expectedSeconds($participantIds->count(), $filterStart, $filterEnd);

            return [
                'team_id' => $team->id,
                'team_name' => $team->name,
                'tracked_seconds' => $tracked,
                'expected_seconds' => $expected,
                'utilization_percent' => $this->utilization->utilizationPercent($tracked, $expected),
            ];
        })->values()->all();

        return [
            'date_range' => [
                'start_date' => \App\Support\DisplayDate::format($filterStart),
                'end_date' => \App\Support\DisplayDate::format($filterEnd),
            ],
            'hours_today_seconds' => $hoursToday,
            'hours_week_seconds' => $hoursWeek,
            'hours_month_seconds' => $hoursMonth,
            'hours_in_range_seconds' => $hoursInRange,
            'active_timers' => $this->countRunningTimers($orgId, $workforceUserIds),
            'active_employees' => $employeeCount,
            'active_projects' => Project::query()
                ->where('organization_id', $orgId)
                ->where('status', ProjectStatus::Active)
                ->count(),
            'organization_utilization_percent' => $this->utilization->utilizationPercent(
                $hoursMonth,
                $expectedMonth
            ),
            'range_utilization_percent' => $this->utilization->utilizationPercent(
                $hoursInRange,
                $expectedInRange
            ),
            'team_utilization' => $teamUtilization,
            'employee_breakdown' => $this->employeeBreakdownForOrganization(
                $orgId,
                $filterStart,
                $filterEnd,
                $trackingUserIds
            ),
            'leave_breakdown' => [
                'today' => $this->leaveBreakdownForPeriod($orgId, $todayStart, $todayEnd),
                'week' => $this->leaveBreakdownForPeriod($orgId, $weekStart, $weekEnd),
                'month' => $this->leaveBreakdownForPeriod($orgId, $monthStart, $monthEnd),
                'range' => $this->leaveBreakdownForPeriod($orgId, $filterStart, $filterEnd),
            ],
            'overtime_summary' => $this->overtimeSummaryForPeriod($orgId, $filterStart, $filterEnd),
            'overtime_settings' => $this->overtimeSettingsMeta(),
            'employee_overtime_breakdown' => $this->employeeOvertimeBreakdown($orgId, $filterStart, $filterEnd),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function managerReport(User $manager, ?Carbon $rangeStart = null, ?Carbon $rangeEnd = null): array
    {
        $orgId = TenantContext::id();
        [$todayStart, $todayEnd] = $this->utilization->periodBounds('today');
        [$weekStart, $weekEnd] = $this->utilization->periodBounds('week');
        $filterStart = $rangeStart ?? $weekStart;
        $filterEnd = $rangeEnd ?? $weekEnd;

        $teams = Team::query()
            ->with(['manager', 'members'])
            ->where('organization_id', $orgId)
            ->where('manager_id', $manager->id)
            ->orderBy('name')
            ->get();

        $teamReports = $teams->map(function (Team $team) use (
            $orgId,
            $todayStart,
            $todayEnd,
            $weekStart,
            $weekEnd,
            $filterStart,
            $filterEnd
        ) {
            $participantIds = $team->participantUserIds();
            $hoursToday = $this->sumTrackedSeconds($orgId, $todayStart, $todayEnd, $participantIds->all());
            $hoursWeek = $this->sumTrackedSeconds($orgId, $weekStart, $weekEnd, $participantIds->all());
            $hoursInRange = $this->sumTrackedSeconds($orgId, $filterStart, $filterEnd, $participantIds->all());
            $expectedWeek = $this->utilization->expectedSeconds($participantIds->count(), $weekStart, $weekEnd);
            $expectedInRange = $this->utilization->expectedSeconds($participantIds->count(), $filterStart, $filterEnd);

            $trackingUserIds = TimeEntry::query()
                ->trackedTimers()
                ->where('organization_id', $orgId)
                ->whereIn('user_id', $participantIds)
                ->where('status', TimeEntryStatus::Running)
                ->pluck('user_id')
                ->unique();

            $teamProjects = $this->projectAccess->activeProjectsForTeam($team);

            return [
                'team_id' => $team->id,
                'team_name' => $team->name,
                'hours_today_seconds' => $hoursToday,
                'hours_week_seconds' => $hoursWeek,
                'hours_in_range_seconds' => $hoursInRange,
                'utilization_percent' => $this->utilization->utilizationPercent($hoursWeek, $expectedWeek),
                'range_utilization_percent' => $this->utilization->utilizationPercent($hoursInRange, $expectedInRange),
                'active_timers' => $this->countRunningTimers($orgId, $participantIds->all()),
                'active_projects' => $teamProjects->count(),
                'leave_breakdown' => [
                    'today' => $this->leaveBreakdownForPeriod(
                        $orgId,
                        $todayStart,
                        $todayEnd,
                        $participantIds->all()
                    ),
                    'week' => $this->leaveBreakdownForPeriod(
                        $orgId,
                        $weekStart,
                        $weekEnd,
                        $participantIds->all()
                    ),
                    'range' => $this->leaveBreakdownForPeriod(
                        $orgId,
                        $filterStart,
                        $filterEnd,
                        $participantIds->all()
                    ),
                ],
                'member_breakdown' => $this->memberBreakdown(
                    $team,
                    $orgId,
                    $todayStart,
                    $todayEnd,
                    $filterStart,
                    $filterEnd,
                    $trackingUserIds
                ),
            ];
        })->values()->all();

        return [
            'date_range' => [
                'start_date' => \App\Support\DisplayDate::format($filterStart),
                'end_date' => \App\Support\DisplayDate::format($filterEnd),
            ],
            'teams' => $teamReports,
            'team_count' => count($teamReports),
            'overtime_summary' => $this->overtimeSummaryForPeriod(
                $orgId,
                $filterStart,
                $filterEnd,
                $this->managedMemberIdsForManager($manager)
            ),
        ];
    }

    /**
     * Personal-only totals for employees (tracked + approved manual).
     *
     * @return array<string, mixed>
     */
    public function employeePersonalReport(User $user, ?Carbon $rangeStart = null, ?Carbon $rangeEnd = null): array
    {
        $orgId = TenantContext::id();
        [$todayStart, $todayEnd] = $this->utilization->periodBounds('today');
        [$weekStart, $weekEnd] = $this->utilization->periodBounds('week');
        [$monthStart, $monthEnd] = $this->utilization->periodBounds('month');
        $filterStart = $rangeStart ?? $weekStart;
        $filterEnd = $rangeEnd ?? $weekEnd;

        return [
            'date_range' => [
                'start_date' => \App\Support\DisplayDate::format($filterStart),
                'end_date' => \App\Support\DisplayDate::format($filterEnd),
            ],
            'hours_today_seconds' => $this->sumTrackedSeconds($orgId, $todayStart, $todayEnd, [$user->id]),
            'hours_week_seconds' => $this->sumTrackedSeconds($orgId, $weekStart, $weekEnd, [$user->id]),
            'hours_month_seconds' => $this->sumTrackedSeconds($orgId, $monthStart, $monthEnd, [$user->id]),
            'hours_in_range_seconds' => $this->sumTrackedSeconds($orgId, $filterStart, $filterEnd, [$user->id]),
            'leave_breakdown' => [
                'today' => $this->leaveBreakdownForPeriod($orgId, $todayStart, $todayEnd, [$user->id]),
                'week' => $this->leaveBreakdownForPeriod($orgId, $weekStart, $weekEnd, [$user->id]),
                'month' => $this->leaveBreakdownForPeriod($orgId, $monthStart, $monthEnd, [$user->id]),
                'range' => $this->leaveBreakdownForPeriod($orgId, $filterStart, $filterEnd, [$user->id]),
            ],
            'overtime_summary' => $this->overtimeSummaryForPeriod(
                $orgId,
                $filterStart,
                $filterEnd,
                [$user->id]
            ),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function projectReport(Project $project, ?Carbon $rangeStart = null, ?Carbon $rangeEnd = null): array
    {
        $orgId = TenantContext::id();
        [$todayStart, $todayEnd] = $this->utilization->periodBounds('today');
        [$weekStart, $weekEnd] = $this->utilization->periodBounds('week');
        [$monthStart, $monthEnd] = $this->utilization->periodBounds('month');
        $filterStart = $rangeStart ?? $weekStart;
        $filterEnd = $rangeEnd ?? $weekEnd;

        $baseQuery = fn () => TimeEntry::query()
            ->countable()
            ->where('organization_id', $orgId)
            ->where('project_id', $project->id);

        $totalSeconds = (int) (clone $baseQuery())->sum('duration');
        $weekSeconds = (int) (clone $baseQuery())
            ->whereBetween('start_time', [$weekStart, $weekEnd])
            ->sum('duration');
        $monthSeconds = (int) (clone $baseQuery())
            ->whereBetween('start_time', [$monthStart, $monthEnd])
            ->sum('duration');

        $rangeSeconds = (int) (clone $baseQuery())
            ->whereBetween('start_time', [$filterStart, $filterEnd])
            ->sum('duration');

        $employeeContributions = DB::table('time_entries')
            ->join('users', 'users.id', '=', 'time_entries.user_id')
            ->where('time_entries.organization_id', $orgId)
            ->where('time_entries.project_id', $project->id)
            ->whereBetween('time_entries.start_time', [$filterStart, $filterEnd])
            ->where(function ($q) {
                $q->where(function ($inner) {
                    $inner->where('time_entries.type', 'tracked')
                        ->where('time_entries.status', TimeEntryStatus::Stopped->value);
                })->orWhere(function ($inner) {
                    $inner->where('time_entries.type', 'manual')
                        ->where('time_entries.status', TimeEntryStatus::Approved->value);
                })->orWhere(function ($inner) {
                    $inner->where('time_entries.type', TimeEntryType::Leave->value)
                        ->where('time_entries.status', TimeEntryStatus::Approved->value)
                        ->where('time_entries.is_paid', true);
                });
            })
            ->groupBy('users.id', 'users.name')
            ->select('users.id as user_id', 'users.name', DB::raw('SUM(time_entries.duration) as total_seconds'))
            ->orderByDesc('total_seconds')
            ->get()
            ->map(function ($row) {
                $row->total_seconds = (int) $row->total_seconds;

                return $row;
            });

        $assigneeIds = $project->members()->pluck('users.id');

        $teamContributions = Team::query()
            ->with(['members', 'manager'])
            ->where('organization_id', $orgId)
            ->get()
            ->filter(fn (Team $team) => $team->participantUserIds()->intersect($assigneeIds)->isNotEmpty())
            ->map(function (Team $team) use ($orgId, $project) {
                $participantIds = $team->participantUserIds();
                $seconds = (int) TimeEntry::query()
                    ->where('organization_id', $orgId)
                    ->where('project_id', $project->id)
                    ->whereIn('user_id', $participantIds)
                    ->countable()
                    ->sum('duration');

                return [
                    'team_id' => $team->id,
                    'team_name' => $team->name,
                    'total_seconds' => $seconds,
                ];
            })
            ->filter(fn ($row) => $row['total_seconds'] > 0)
            ->values()
            ->all();

        $expectedMonth = $this->utilization->expectedSeconds(
            $assigneeIds->count(),
            $monthStart,
            $monthEnd
        );
        $expectedInRange = $this->utilization->expectedSeconds(
            $assigneeIds->count(),
            $filterStart,
            $filterEnd
        );

        return [
            'date_range' => [
                'start_date' => \App\Support\DisplayDate::format($filterStart),
                'end_date' => \App\Support\DisplayDate::format($filterEnd),
            ],
            'project_id' => $project->id,
            'project_name' => $project->name,
            'total_tracked_seconds' => $totalSeconds,
            'hours_week_seconds' => $weekSeconds,
            'hours_month_seconds' => $monthSeconds,
            'hours_in_range_seconds' => $rangeSeconds,
            'hours_today_seconds' => (int) (clone $baseQuery())
                ->whereBetween('start_time', [$todayStart, $todayEnd])
                ->sum('duration'),
            'utilization_percent' => $this->utilization->utilizationPercent($monthSeconds, $expectedMonth),
            'range_utilization_percent' => $this->utilization->utilizationPercent($rangeSeconds, $expectedInRange),
            'team_contributions' => $teamContributions,
            'employee_contributions' => $employeeContributions,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function employeeDashboardMetrics(User $user, ?Carbon $rangeStart = null, ?Carbon $rangeEnd = null): array
    {
        $orgId = TenantContext::id();
        [$weekStart, $weekEnd] = $this->utilization->periodBounds('week');
        $filterStart = $rangeStart ?? $weekStart;
        $filterEnd = $rangeEnd ?? $weekEnd;

        $weekSeconds = (int) TimeEntry::query()
            ->countable()
            ->where('organization_id', $orgId)
            ->where('user_id', $user->id)
            ->whereBetween('start_time', [$weekStart, $weekEnd])
            ->sum('duration');

        $rangeSeconds = (int) TimeEntry::query()
            ->countable()
            ->where('organization_id', $orgId)
            ->where('user_id', $user->id)
            ->whereBetween('start_time', [$filterStart, $filterEnd])
            ->sum('duration');

        $expectedWeek = $this->utilization->expectedSeconds(1, $weekStart, $weekEnd);
        $expectedInRange = $this->utilization->expectedSeconds(1, $filterStart, $filterEnd);

        return [
            'week_total_seconds' => $weekSeconds,
            'week_utilization_percent' => $this->utilization->utilizationPercent($weekSeconds, $expectedWeek),
            'range_total_seconds' => $rangeSeconds,
            'range_utilization_percent' => $this->utilization->utilizationPercent($rangeSeconds, $expectedInRange),
        ];
    }

    public function managerCanViewProject(User $manager, Project $project): bool
    {
        if ($project->organization_id !== TenantContext::id()) {
            return false;
        }

        $managedParticipantIds = Team::query()
            ->where('organization_id', TenantContext::id())
            ->where('manager_id', $manager->id)
            ->with(['members', 'manager'])
            ->get()
            ->flatMap(fn (Team $t) => $t->participantUserIds());

        if ($managedParticipantIds->isEmpty()) {
            return false;
        }

        return $project->members()
            ->whereIn('users.id', $managedParticipantIds)
            ->exists();
    }

    /**
     * @param  list<int>|null  $userIds
     */
    public function sumTrackedSeconds(
        int $orgId,
        Carbon $start,
        Carbon $end,
        ?array $userIds = null
    ): int {
        $query = TimeEntry::query()
            ->countable()
            ->where('organization_id', $orgId)
            ->whereBetween('start_time', [$start, $end]);

        if ($userIds !== null) {
            if ($userIds === []) {
                return 0;
            }

            $query->whereIn('user_id', $userIds);
        }

        return (int) $query->sum('duration');
    }

    /**
     * @param  list<int>|null  $userIds
     */
    public function countRunningTimers(int $orgId, ?array $userIds = null): int
    {
        $query = TimeEntry::query()
            ->trackedTimers()
            ->where('organization_id', $orgId)
            ->where('status', TimeEntryStatus::Running);

        if ($userIds !== null) {
            if ($userIds === []) {
                return 0;
            }

            $query->whereIn('user_id', $userIds);
        }

        return $query->count();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function memberBreakdown(
        Team $team,
        int $orgId,
        Carbon $todayStart,
        Carbon $todayEnd,
        Carbon $rangeStart,
        Carbon $rangeEnd,
        Collection $trackingUserIds
    ): array {
        return $team->participants()->map(function (User $user) use (
            $orgId,
            $todayStart,
            $todayEnd,
            $rangeStart,
            $rangeEnd,
            $trackingUserIds
        ) {
            $hoursInRange = $this->sumTrackedSeconds(
                $orgId,
                $rangeStart,
                $rangeEnd,
                [$user->id]
            );
            $expectedInRange = $this->utilization->expectedSeconds(1, $rangeStart, $rangeEnd);

            return [
                'user_id' => $user->id,
                'name' => $user->name,
                'hours_today_seconds' => $this->sumTrackedSeconds(
                    $orgId,
                    $todayStart,
                    $todayEnd,
                    [$user->id]
                ),
                'hours_in_range_seconds' => $hoursInRange,
                'hours_week_seconds' => $hoursInRange,
                'utilization_percent' => $this->utilization->utilizationPercent($hoursInRange, $expectedInRange),
                'has_active_timer' => $trackingUserIds->contains($user->id),
            ];
        })->values()->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function employeeBreakdownForOrganization(
        int $orgId,
        Carbon $rangeStart,
        Carbon $rangeEnd,
        Collection $trackingUserIds
    ): array {
        $employees = User::query()
            ->whereIn('id', $this->activeWorkforceMemberIds($orgId))
            ->with('workTeam')
            ->orderBy('name')
            ->get();

        return $employees->map(function (User $user) use (
            $orgId,
            $rangeStart,
            $rangeEnd,
            $trackingUserIds
        ) {
            $hoursInRange = $this->sumTrackedSeconds(
                $orgId,
                $rangeStart,
                $rangeEnd,
                [$user->id]
            );
            $expectedInRange = $this->utilization->expectedSeconds(1, $rangeStart, $rangeEnd);
            $team = $user->workTeam->first();

            return [
                'user_id' => $user->id,
                'name' => $user->name,
                'team_id' => $team?->id,
                'team_name' => $team?->name,
                'hours_in_range_seconds' => $hoursInRange,
                'utilization_percent' => $this->utilization->utilizationPercent($hoursInRange, $expectedInRange),
                'has_active_timer' => $trackingUserIds->contains($user->id),
            ];
        })->values()->all();
    }

    /**
     * @param  list<int>|null  $userIds
     * @return array{paid_seconds: int, pending_seconds: int, rejected_seconds: int}
     */
    public function leaveBreakdownForPeriod(
        int $orgId,
        Carbon $start,
        Carbon $end,
        ?array $userIds = null
    ): array {
        $base = TimeEntry::query()
            ->leaveEntries()
            ->where('organization_id', $orgId)
            ->where('is_paid', true)
            ->whereBetween('start_time', [$start, $end]);

        if ($userIds !== null) {
            if ($userIds === []) {
                return [
                    'paid_seconds' => 0,
                    'pending_seconds' => 0,
                    'rejected_seconds' => 0,
                ];
            }

            $base->whereIn('user_id', $userIds);
        }

        return [
            'paid_seconds' => (int) (clone $base)
                ->where('status', TimeEntryStatus::Approved)
                ->sum('duration'),
            'pending_seconds' => (int) (clone $base)
                ->where('status', TimeEntryStatus::Pending)
                ->sum('duration'),
            'rejected_seconds' => (int) (clone $base)
                ->where('status', TimeEntryStatus::Rejected)
                ->sum('duration'),
        ];
    }

    /**
     * @param  list<int>|null  $userIds
     * @return array{approved_seconds: int, pending_count: int, pending_seconds: int}
     */
    public function overtimeSummaryForPeriod(
        int $orgId,
        Carbon $start,
        Carbon $end,
        ?array $userIds = null
    ): array {
        $approvedQuery = OvertimeRequest::query()
            ->where('organization_id', $orgId)
            ->where('status', OvertimeRequestStatus::Approved)
            ->whereBetween('work_date', [$start->toDateString(), $end->toDateString()]);

        $pendingQuery = OvertimeRequest::query()
            ->where('organization_id', $orgId)
            ->where('status', OvertimeRequestStatus::Pending);

        if ($userIds !== null) {
            if ($userIds === []) {
                return ['approved_seconds' => 0, 'pending_count' => 0, 'pending_seconds' => 0];
            }

            $approvedQuery->whereIn('user_id', $userIds);
            $pendingQuery->whereIn('user_id', $userIds);
        }

        return [
            'approved_seconds' => (int) $approvedQuery->sum('duration_seconds'),
            'pending_count' => $pendingQuery->count(),
            'pending_seconds' => (int) $pendingQuery->sum('duration_seconds'),
        ];
    }

    /**
     * @return array{enabled: bool, rate_percentage: string|null}
     */
    private function overtimeSettingsMeta(): array
    {
        $settings = $this->payrollSettings->forOrganization();

        return [
            'enabled' => (bool) $settings->overtime_enabled,
            'rate_percentage' => $settings->overtime_rate_percentage !== null
                ? number_format((float) $settings->overtime_rate_percentage, 2, '.', '')
                : null,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function employeeOvertimeBreakdown(int $orgId, Carbon $start, Carbon $end): array
    {
        $approved = OvertimeRequest::query()
            ->select('user_id')
            ->selectRaw('SUM(duration_seconds) as approved_seconds')
            ->where('organization_id', $orgId)
            ->where('status', OvertimeRequestStatus::Approved)
            ->whereBetween('work_date', [$start->toDateString(), $end->toDateString()])
            ->groupBy('user_id')
            ->get()
            ->keyBy('user_id');

        $pending = OvertimeRequest::query()
            ->select('user_id')
            ->selectRaw('SUM(duration_seconds) as pending_seconds')
            ->where('organization_id', $orgId)
            ->where('status', OvertimeRequestStatus::Pending)
            ->groupBy('user_id')
            ->get()
            ->keyBy('user_id');

        $userIds = $approved->keys()->merge($pending->keys())->unique();

        return User::query()
            ->whereIn('id', $userIds)
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'user_id' => $user->id,
                'name' => $user->name,
                'approved_seconds' => (int) ($approved->get($user->id)?->approved_seconds ?? 0),
                'pending_seconds' => (int) ($pending->get($user->id)?->pending_seconds ?? 0),
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<int>
     */
    private function managedMemberIdsForManager(User $manager): array
    {
        return Team::query()
            ->where('organization_id', TenantContext::id())
            ->where('manager_id', $manager->id)
            ->with(['members', 'manager'])
            ->get()
            ->flatMap(fn (Team $team) => $team->participantUserIds())
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Active employees and managers (workforce). Admins excluded.
     *
     * @return Collection<int, int>
     */
    private function activeWorkforceMemberIds(int $orgId): Collection
    {
        return WorkforceMembers::activeMemberUserIds($orgId);
    }
}
