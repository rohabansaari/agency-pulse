<?php

namespace App\Services\Employee;

use App\Enums\OvertimeRequestStatus;
use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Models\OrganizationMember;
use App\Models\OvertimeRequest;
use App\Models\Team;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Tenant\TenantContext;
use App\Support\DisplayDate;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class EmployeeDirectoryService
{
    /**
     * @return Collection<int, OrganizationMember>
     */
    public function membersWithDirectoryMeta(): Collection
    {
        $orgId = TenantContext::id();
        $monthStart = now()->startOfMonth();
        $monthEnd = now()->endOfMonth();

        $members = OrganizationMember::query()
            ->with('user')
            ->where('organization_id', $orgId)
            ->orderBy('created_at')
            ->get();

        if ($members->isEmpty()) {
            return $members;
        }

        $userIds = $members->pluck('user_id');

        $projectCounts = DB::table('project_assignments')
            ->join('projects', 'projects.id', '=', 'project_assignments.project_id')
            ->where('projects.organization_id', $orgId)
            ->whereIn('project_assignments.user_id', $userIds)
            ->select('project_assignments.user_id', DB::raw('count(*) as assigned_projects_count'))
            ->groupBy('project_assignments.user_id')
            ->pluck('assigned_projects_count', 'user_id');

        $teamRows = DB::table('team_members')
            ->join('teams', 'teams.id', '=', 'team_members.team_id')
            ->leftJoin('users as managers', 'managers.id', '=', 'teams.manager_id')
            ->where('teams.organization_id', $orgId)
            ->whereIn('team_members.user_id', $userIds)
            ->select(
                'team_members.user_id',
                'teams.id as team_id',
                'teams.name as team_name',
                'teams.manager_id',
                'managers.name as manager_name'
            )
            ->get()
            ->keyBy('user_id');

        $lastActivity = TimeEntry::query()
            ->where('organization_id', $orgId)
            ->whereIn('user_id', $userIds)
            ->select('user_id', DB::raw('max(COALESCE(end_time, start_time)) as last_activity_at'))
            ->groupBy('user_id')
            ->pluck('last_activity_at', 'user_id');

        $activeTimers = TimeEntry::query()
            ->where('organization_id', $orgId)
            ->whereIn('user_id', $userIds)
            ->where('status', TimeEntryStatus::Running)
            ->pluck('id', 'user_id');

        $monthSeconds = TimeEntry::query()
            ->countable()
            ->where('organization_id', $orgId)
            ->whereIn('user_id', $userIds)
            ->whereBetween('start_time', [$monthStart, $monthEnd])
            ->select('user_id', DB::raw('sum(duration) as total_seconds'))
            ->groupBy('user_id')
            ->pluck('total_seconds', 'user_id');

        $leaveSeconds = TimeEntry::query()
            ->where('organization_id', $orgId)
            ->whereIn('user_id', $userIds)
            ->where('type', TimeEntryType::Leave)
            ->where('status', TimeEntryStatus::Approved)
            ->where('is_paid', true)
            ->select('user_id', DB::raw('sum(duration) as leave_seconds'))
            ->groupBy('user_id')
            ->pluck('leave_seconds', 'user_id');

        $overtimeCounts = OvertimeRequest::query()
            ->where('organization_id', $orgId)
            ->whereIn('user_id', $userIds)
            ->select('user_id', DB::raw('count(*) as overtime_count'))
            ->groupBy('user_id')
            ->pluck('overtime_count', 'user_id');

        $members->each(function (OrganizationMember $member) use (
            $projectCounts,
            $teamRows,
            $lastActivity,
            $activeTimers,
            $monthSeconds,
            $leaveSeconds,
            $overtimeCounts
        ): void {
            $userId = $member->user_id;
            $team = $teamRows->get($userId);

            $member->assigned_projects_count = (int) ($projectCounts[$userId] ?? 0);
            $member->team_id = $team?->team_id;
            $member->team_name = $team?->team_name;
            $member->manager_id = $team?->manager_id;
            $member->manager_name = $team?->manager_name;
            $member->last_activity_at = $lastActivity[$userId] ?? null;
            $member->has_active_timer = isset($activeTimers[$userId]);
            $member->time_tracked_month_seconds = (int) ($monthSeconds[$userId] ?? 0);
            $member->approved_leave_seconds = (int) ($leaveSeconds[$userId] ?? 0);
            $member->overtime_requests_count = (int) ($overtimeCounts[$userId] ?? 0);
        });

        return $members;
    }

    /**
     * @return array<string, mixed>
     */
    public function profileForUser(User $employee): array
    {
        $orgId = TenantContext::id();

        $membership = OrganizationMember::query()
            ->with('user')
            ->where('organization_id', $orgId)
            ->where('user_id', $employee->id)
            ->firstOrFail();

        $team = Team::query()
            ->where('organization_id', $orgId)
            ->whereHas('members', fn ($q) => $q->where('user_id', $employee->id))
            ->with('manager')
            ->first();

        $monthStart = now()->startOfMonth();
        $monthEnd = now()->endOfMonth();

        $leaveHistory = TimeEntry::query()
            ->where('organization_id', $orgId)
            ->where('user_id', $employee->id)
            ->where('type', TimeEntryType::Leave)
            ->orderByDesc('start_time')
            ->limit(20)
            ->get()
            ->map(fn (TimeEntry $entry) => [
                'id' => $entry->id,
                'start_date' => DisplayDate::format($entry->start_time),
                'end_date' => DisplayDate::format($entry->end_time ?? $entry->start_time),
                'duration_seconds' => $entry->duration,
                'status' => $entry->status->value,
                'is_paid' => $entry->is_paid,
                'description' => $entry->description,
            ]);

        $overtimeHistory = OvertimeRequest::query()
            ->where('organization_id', $orgId)
            ->where('user_id', $employee->id)
            ->orderByDesc('work_date')
            ->limit(20)
            ->get()
            ->map(fn (OvertimeRequest $request) => [
                'id' => $request->id,
                'work_date' => DisplayDate::format($request->work_date),
                'duration_seconds' => $request->duration_seconds,
                'status' => $request->status->value,
                'reason' => $request->reason,
            ]);

        $assignedProjects = DB::table('project_assignments')
            ->join('projects', 'projects.id', '=', 'project_assignments.project_id')
            ->where('projects.organization_id', $orgId)
            ->where('project_assignments.user_id', $employee->id)
            ->select('projects.id', 'projects.name', 'projects.status')
            ->orderBy('projects.name')
            ->get();

        $timeSummary = [
            'month_seconds' => (int) TimeEntry::query()
                ->countable()
                ->where('organization_id', $orgId)
                ->where('user_id', $employee->id)
                ->whereBetween('start_time', [$monthStart, $monthEnd])
                ->sum('duration'),
            'approved_leave_seconds' => (int) TimeEntry::query()
                ->where('organization_id', $orgId)
                ->where('user_id', $employee->id)
                ->where('type', TimeEntryType::Leave)
                ->where('status', TimeEntryStatus::Approved)
                ->where('is_paid', true)
                ->sum('duration'),
        ];

        $activeTimer = TimeEntry::query()
            ->where('organization_id', $orgId)
            ->where('user_id', $employee->id)
            ->where('status', TimeEntryStatus::Running)
            ->first();

        return [
            'membership' => $membership,
            'team' => $team ? [
                'id' => $team->id,
                'name' => $team->name,
                'manager' => $team->manager ? [
                    'id' => $team->manager->id,
                    'name' => $team->manager->name,
                ] : null,
            ] : null,
            'assigned_projects' => $assignedProjects,
            'leave_history' => $leaveHistory,
            'overtime_history' => $overtimeHistory,
            'time_summary' => $timeSummary,
            'has_active_timer' => $activeTimer !== null,
            'last_activity_at' => TimeEntry::query()
                ->where('organization_id', $orgId)
                ->where('user_id', $employee->id)
                ->max(DB::raw('COALESCE(end_time, start_time)')),
        ];
    }
}
