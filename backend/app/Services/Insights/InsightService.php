<?php

namespace App\Services\Insights;

use App\Enums\OvertimeRequestStatus;
use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Enums\UserRole;
use App\Models\InsightSummary;
use App\Models\OvertimeRequest;
use App\Models\Team;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Reporting\ProfitabilityService;
use App\Services\Screenshots\ActivityService;
use App\Services\Tenant\TenantContext;
use App\Support\WorkforceMembers;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Dashboard insights: rule-based alerts (free, always on) and a weekly
 * briefing written by AI from the same facts. Admins see the whole company
 * including project money; a manager sees the people on their teams.
 */
class InsightService
{
    /** Activity this many points below a person's usual level is worth a check-in. */
    public const ACTIVITY_DROP_POINTS = 20;

    /** Only compare activity when the usual level is meaningful. */
    public const ACTIVITY_BASELINE_MIN = 40;

    public const OVERTIME_MONTH_HOURS = 20;

    public const KEPT_IDLE_WEEK_HOURS = 5;

    public const APPROVAL_WAIT_DAYS = 3;

    /** A new briefing at most this often per scope, to keep AI costs predictable. */
    public const SUMMARY_COOLDOWN_MINUTES = 10;

    public function __construct(
        private readonly ActivityService $activity,
        private readonly ProfitabilityService $profitability,
        private readonly SummaryWriter $writer,
    ) {}

    /** @return array<string, mixed> */
    public function overview(User $viewer): array
    {
        $latest = $this->latestSummary($viewer);

        return [
            'alerts' => $this->alerts($viewer),
            'summary' => $latest ? $this->presentSummary($latest) : null,
            'ai_available' => $this->writer->available(),
        ];
    }

    /** @return array<string, mixed> */
    public function generateSummary(User $viewer): array
    {
        if (! $this->writer->available()) {
            throw ValidationException::withMessages([
                'summary' => ['AI summaries are not set up yet. Add an Anthropic API key to turn them on.'],
            ]);
        }

        $latest = $this->latestSummary($viewer);
        if ($latest && $latest->created_at->greaterThan(now()->subMinutes(self::SUMMARY_COOLDOWN_MINUTES))) {
            throw ValidationException::withMessages([
                'summary' => ['A summary was just written. You can ask for a new one in a few minutes.'],
            ]);
        }

        [$start, $end] = $this->week();
        $facts = $this->facts($viewer, $start, $end);

        try {
            $summary = $this->writer->write($facts);
        } catch (\RuntimeException $e) {
            throw ValidationException::withMessages(['summary' => [$e->getMessage()]]);
        }

        $record = InsightSummary::create([
            'organization_id' => TenantContext::id(),
            'scope' => $this->scope($viewer),
            'period_start' => $start->toDateString(),
            'period_end' => $end->toDateString(),
            'summary' => $summary,
            'model' => $this->writer->model(),
            'generated_by' => $viewer->id,
        ]);

        return $this->presentSummary($record);
    }

    /**
     * @return list<array{type: string, severity: string, title: string, detail: string, user_id?: int, project_id?: int}>
     */
    public function alerts(User $viewer): array
    {
        $people = $this->people($viewer);
        $ids = $people->keys()->all();
        $alerts = [];

        // Projects and money are for admins only.
        if ($viewer->currentRole() === UserRole::Admin) {
            $report = $this->profitability->report(now()->startOfMonth(), now());
            foreach ($report['insights'] ?? [] as $insight) {
                if (in_array($insight['severity'], ['critical', 'warning'], true)) {
                    $alerts[] = array_filter([
                        'type' => 'project',
                        'severity' => $insight['severity'],
                        'title' => $insight['title'],
                        'detail' => $insight['detail'],
                        'project_id' => $insight['project_id'] ?? null,
                    ], fn ($value) => $value !== null);
                }
            }
        }

        if ($ids === []) {
            return $alerts;
        }

        // Activity well below the person's own usual level.
        $orgId = TenantContext::id();
        $recent = $this->activity->percentByUser($orgId, now()->subDays(7)->startOfDay(), now(), $ids);
        $usual = $this->activity->percentByUser($orgId, now()->subDays(35)->startOfDay(), now()->subDays(7)->startOfDay(), $ids);
        foreach ($recent as $userId => $percent) {
            $baseline = $usual[$userId] ?? null;
            if ($baseline !== null && $baseline >= self::ACTIVITY_BASELINE_MIN && $percent <= $baseline - self::ACTIVITY_DROP_POINTS) {
                $alerts[] = [
                    'type' => 'activity_drop',
                    'severity' => 'warning',
                    'title' => "{$people[$userId]}'s activity dropped",
                    'detail' => "{$percent}% this week against a usual {$baseline}%. Worth a friendly check-in: calls and meetings also read as low activity.",
                    'user_id' => $userId,
                ];
            }
        }

        // Overtime piling up this month.
        $overtime = OvertimeRequest::query()
            ->whereIn('user_id', $ids)
            ->whereIn('status', [OvertimeRequestStatus::Approved, OvertimeRequestStatus::Pending])
            ->whereBetween('work_date', [now()->startOfMonth()->toDateString(), now()->toDateString()])
            ->groupBy('user_id')
            ->selectRaw('user_id, SUM(duration_seconds) AS seconds')
            ->pluck('seconds', 'user_id');
        foreach ($overtime as $userId => $seconds) {
            $hours = round($seconds / 3600, 1);
            if ($hours > self::OVERTIME_MONTH_HOURS) {
                $alerts[] = [
                    'type' => 'overtime',
                    'severity' => 'warning',
                    'title' => "{$people[$userId]} has {$hours} h of overtime this month",
                    'detail' => 'Above '.self::OVERTIME_MONTH_HOURS.' h, including pending requests. Check the workload before it adds to payroll.',
                    'user_id' => (int) $userId,
                ];
            }
        }

        // Lots of idle time kept this week.
        $keptIdle = TimeEntry::query()
            ->whereIn('user_id', $ids)
            ->where('idle_kept', true)
            ->where('start_time', '>=', now()->subDays(7)->startOfDay())
            ->groupBy('user_id')
            ->selectRaw('user_id, SUM(duration) AS seconds')
            ->pluck('seconds', 'user_id');
        foreach ($keptIdle as $userId => $seconds) {
            $hours = round($seconds / 3600, 1);
            if ($hours > self::KEPT_IDLE_WEEK_HOURS) {
                $alerts[] = [
                    'type' => 'idle_kept',
                    'severity' => 'info',
                    'title' => "{$people[$userId]} kept {$hours} h of idle time this week",
                    'detail' => 'Time away from the keyboard that they marked as work, such as calls or meetings.',
                    'user_id' => (int) $userId,
                ];
            }
        }

        // Requests waiting too long for a decision.
        $cutoff = now()->subDays(self::APPROVAL_WAIT_DAYS);
        $waiting = TimeEntry::query()
            ->whereIn('user_id', $ids)
            ->whereIn('type', [TimeEntryType::Manual, TimeEntryType::Leave])
            ->where('status', TimeEntryStatus::Pending)
            ->where('created_at', '<', $cutoff)
            ->count()
            + OvertimeRequest::query()
                ->whereIn('user_id', $ids)
                ->where('status', OvertimeRequestStatus::Pending)
                ->where('created_at', '<', $cutoff)
                ->count();
        if ($waiting > 0) {
            $alerts[] = [
                'type' => 'approvals',
                'severity' => 'warning',
                'title' => $waiting === 1 ? '1 request is waiting for approval' : "{$waiting} requests are waiting for approval",
                'detail' => 'Manual time, leave or overtime waiting more than '.self::APPROVAL_WAIT_DAYS.' days.',
            ];
        }

        $rank = ['critical' => 0, 'warning' => 1, 'info' => 2];
        usort($alerts, fn ($a, $b) => $rank[$a['severity']] <=> $rank[$b['severity']]);

        return $alerts;
    }

    /**
     * The fact sheet the AI writes from: aggregates only.
     *
     * @return array<string, mixed>
     */
    public function facts(User $viewer, Carbon $start, Carbon $end): array
    {
        $people = $this->people($viewer);
        $ids = $people->keys()->all();
        $orgId = TenantContext::id();
        $previousStart = $start->copy()->subWeek();
        $previousEnd = $end->copy()->subWeek();

        $hours = $this->hoursByUser($ids, $start, $end);
        $previousHours = $this->hoursByUser($ids, $previousStart, $previousEnd);
        $activity = $this->activity->percentByUser($orgId, $start, $end, $ids);

        $topProjects = TimeEntry::query()
            ->countable()
            ->whereIn('user_id', $ids)
            ->whereNotNull('project_id')
            ->whereBetween('start_time', [$start, $end])
            ->with('project:id,name')
            ->get(['user_id', 'project_id', 'duration'])
            ->groupBy('user_id')
            ->map(fn (Collection $entries) => $entries
                ->groupBy('project_id')
                ->map(fn (Collection $group) => ['name' => $group->first()->project?->name, 'seconds' => $group->sum('duration')])
                ->sortByDesc('seconds')
                ->first()['name'] ?? null);

        $keptIdle = TimeEntry::query()
            ->whereIn('user_id', $ids)
            ->where('idle_kept', true)
            ->whereBetween('start_time', [$start, $end])
            ->groupBy('user_id')
            ->selectRaw('user_id, SUM(duration) AS seconds')
            ->pluck('seconds', 'user_id');

        $peopleFacts = $people->map(fn (string $name, int $userId) => [
            'name' => $name,
            'hours' => round(($hours[$userId] ?? 0) / 3600, 1),
            'hours_week_before' => round(($previousHours[$userId] ?? 0) / 3600, 1),
            'activity_percent' => $activity[$userId] ?? null,
            'main_project' => $topProjects[$userId] ?? null,
            'idle_time_kept_hours' => round(($keptIdle[$userId] ?? 0) / 3600, 1),
        ])->values()->all();

        return [
            'company' => TenantContext::get()->name,
            'audience' => $viewer->currentRole() === UserRole::Admin ? 'company owner or admin' : 'team manager',
            'week' => ['from' => $start->toDateString(), 'to' => $end->toDateString()],
            'totals' => [
                'people' => count($ids),
                'hours' => round(array_sum($hours) / 3600, 1),
                'hours_week_before' => round(array_sum($previousHours) / 3600, 1),
            ],
            'people' => $peopleFacts,
            'open_alerts' => array_map(fn (array $alert) => $alert['title'].'. '.$alert['detail'], $this->alerts($viewer)),
        ];
    }

    /** The last 7 full days, ending yesterday. @return array{0: Carbon, 1: Carbon} */
    private function week(): array
    {
        return [now()->subDays(7)->startOfDay(), now()->subDay()->endOfDay()];
    }

    /**
     * Active people this viewer oversees, id => name.
     *
     * @return Collection<int, string>
     */
    private function people(User $viewer): Collection
    {
        $orgId = TenantContext::id();

        $ids = $viewer->currentRole() === UserRole::Manager
            ? Team::query()
                ->where('manager_id', $viewer->id)
                ->with('members')
                ->get()
                ->flatMap(fn (Team $team) => $team->members->pluck('id'))
                ->unique()
                ->intersect(WorkforceMembers::activeMemberUserIds($orgId))
            : WorkforceMembers::activeMemberUserIds($orgId);

        return User::query()->whereIn('id', $ids->values()->all())->orderBy('name')->pluck('name', 'id');
    }

    /** @return array<int, int> user_id => seconds */
    private function hoursByUser(array $ids, Carbon $start, Carbon $end): array
    {
        if ($ids === []) {
            return [];
        }

        return TimeEntry::query()
            ->countable()
            ->whereIn('user_id', $ids)
            ->whereIn('type', [TimeEntryType::Tracked, TimeEntryType::Manual])
            ->whereBetween('start_time', [$start, $end])
            ->groupBy('user_id')
            ->selectRaw('user_id, SUM(duration) AS seconds')
            ->pluck('seconds', 'user_id')
            ->map(fn ($seconds) => (int) $seconds)
            ->all();
    }

    private function scope(User $viewer): string
    {
        return $viewer->currentRole() === UserRole::Manager ? "manager:{$viewer->id}" : 'organization';
    }

    private function latestSummary(User $viewer): ?InsightSummary
    {
        return InsightSummary::query()
            ->where('scope', $this->scope($viewer))
            ->latest('id')
            ->first();
    }

    /** @return array<string, mixed> */
    private function presentSummary(InsightSummary $summary): array
    {
        return [
            ...$summary->summary,
            'period_start' => $summary->period_start->toDateString(),
            'period_end' => $summary->period_end->toDateString(),
            'generated_at' => $summary->created_at->toIso8601String(),
        ];
    }
}
