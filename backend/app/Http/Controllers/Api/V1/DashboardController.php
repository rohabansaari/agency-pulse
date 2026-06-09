<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\OrganizationMemberStatus;
use App\Enums\ProjectStatus;
use App\Enums\TimeEntryStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\ProjectResource;
use App\Http\Resources\TimeEntryResource;
use App\Models\OrganizationMember;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\TimeEntry;
use App\Services\Projects\ProjectAccessService;
use App\Services\Reporting\ReportingService;
use App\Services\Tenant\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use App\Support\ReportDateRange;

class DashboardController extends Controller
{
    public function __construct(
        private readonly ReportingService $reporting,
        private readonly ProjectAccessService $projectAccess
    ) {}

    public function show(Request $request): JsonResponse
    {
        $role = $request->user()->currentRole();
        [$rangeStart, $rangeEnd] = ReportDateRange::fromRequest($request);

        return match ($role) {
            UserRole::Admin => response()->json($this->adminDashboard($rangeStart, $rangeEnd)),
            UserRole::Manager => response()->json($this->managerDashboard($request, $rangeStart, $rangeEnd)),
            default => response()->json($this->employeeDashboard($request, $rangeStart, $rangeEnd)),
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function employeeDashboard(Request $request, \Illuminate\Support\Carbon $rangeStart, \Illuminate\Support\Carbon $rangeEnd): array
    {
        $user = $request->user();
        $startOfDay = Carbon::today();
        $endOfDay = Carbon::today()->endOfDay();

        $entries = TimeEntry::query()
            ->trackedTimers()
            ->with('project')
            ->where('user_id', $user->id)
            ->whereBetween('start_time', [$startOfDay, $endOfDay])
            ->orderByDesc('start_time')
            ->get();

        $activeTimer = $entries->first(fn (TimeEntry $e) => $e->status === TimeEntryStatus::Running);
        $totalDuration = (int) TimeEntry::query()
            ->countable()
            ->where('user_id', $user->id)
            ->whereBetween('start_time', [$startOfDay, $endOfDay])
            ->sum('duration');

        $assignedProjects = $this->projectAccess
            ->accessibleProjectsQuery($user)
            ->where('status', ProjectStatus::Active)
            ->orderBy('name')
            ->get();

        $workTeam = $user->workTeam()->first();
        $metrics = $this->reporting->employeeDashboardMetrics($user, $rangeStart, $rangeEnd);
        $personalReport = $this->reporting->employeePersonalReport($user, $rangeStart, $rangeEnd);

        return [
            'role' => UserRole::Employee->value,
            'date_range' => ReportDateRange::meta($rangeStart, $rangeEnd),
            'team' => $workTeam ? [
                'id' => $workTeam->id,
                'name' => $workTeam->name,
            ] : null,
            'personal_report' => $personalReport,
            'active_timer' => $activeTimer ? new TimeEntryResource($activeTimer) : null,
            'today_total_seconds' => $totalDuration,
            'week_total_seconds' => $metrics['week_total_seconds'],
            'week_utilization_percent' => $metrics['week_utilization_percent'],
            'range_total_seconds' => $metrics['range_total_seconds'],
            'range_utilization_percent' => $metrics['range_utilization_percent'],
            'overtime_summary' => $personalReport['overtime_summary'] ?? null,
            'recent_sessions' => TimeEntryResource::collection(
                $entries->where('status', TimeEntryStatus::Stopped)->take(5)->values()
            ),
            'assigned_projects' => ProjectResource::collection($assignedProjects),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function managerDashboard(Request $request, \Illuminate\Support\Carbon $rangeStart, \Illuminate\Support\Carbon $rangeEnd): array
    {
        $report = $this->reporting->managerReport($request->user(), $rangeStart, $rangeEnd);

        $totalHoursToday = collect($report['teams'])->sum('hours_today_seconds');
        $totalHoursInRange = collect($report['teams'])->sum('hours_in_range_seconds');
        $avgUtilization = collect($report['teams'])->avg('range_utilization_percent') ?? 0;

        return [
            'role' => UserRole::Manager->value,
            'date_range' => $report['date_range'],
            'team_count' => $report['team_count'],
            'teams' => $report['teams'],
            'summary' => [
                'hours_today_seconds' => $totalHoursToday,
                'hours_in_range_seconds' => $totalHoursInRange,
                'team_utilization_percent' => round($avgUtilization, 1),
                'active_projects' => collect($report['teams'])->sum('active_projects'),
                'active_timers' => collect($report['teams'])->sum('active_timers'),
            ],
            'overtime_summary' => $report['overtime_summary'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function adminDashboard(\Illuminate\Support\Carbon $rangeStart, \Illuminate\Support\Carbon $rangeEnd): array
    {
        $orgId = TenantContext::id();
        $report = $this->reporting->organizationReport($rangeStart, $rangeEnd);

        $teams = Team::query()
            ->with(['manager', 'members'])
            ->withCount('members')
            ->where('organization_id', $orgId)
            ->orderBy('name')
            ->get();

        $workforceMemberCount = OrganizationMember::query()
            ->where('organization_id', $orgId)
            ->where('status', OrganizationMemberStatus::Active)
            ->whereIn('role', [UserRole::Employee, UserRole::Manager])
            ->count();

        $unassignedWorkforce = OrganizationMember::query()
            ->where('organization_id', $orgId)
            ->where('status', OrganizationMemberStatus::Active)
            ->whereIn('role', [UserRole::Employee, UserRole::Manager])
            ->whereNotIn('user_id', TeamMember::query()->select('user_id'))
            ->count();

        return [
            'role' => UserRole::Admin->value,
            'date_range' => $report['date_range'],
            'team_count' => $teams->count(),
            'employee_count' => $workforceMemberCount,
            'unassigned_employees' => $unassignedWorkforce,
            'active_projects' => $report['active_projects'],
            'active_employees' => $report['active_employees'],
            'today_tracked_seconds' => $report['hours_today_seconds'],
            'week_tracked_seconds' => $report['hours_week_seconds'],
            'month_tracked_seconds' => $report['hours_month_seconds'],
            'range_tracked_seconds' => $report['hours_in_range_seconds'],
            'running_timers' => $report['active_timers'],
            'organization_utilization_percent' => $report['organization_utilization_percent'],
            'range_utilization_percent' => $report['range_utilization_percent'],
            'team_utilization' => $report['team_utilization'],
            'employee_breakdown' => $report['employee_breakdown'],
            'overtime_summary' => $report['overtime_summary'],
            'teams' => $teams->map(fn (Team $team) => [
                'id' => $team->id,
                'name' => $team->name,
                'manager_name' => $team->manager?->name,
                'members_count' => $team->members_count,
            ])->values(),
        ];
    }
}
