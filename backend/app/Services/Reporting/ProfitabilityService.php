<?php

namespace App\Services\Reporting;

use App\Enums\ProjectBillingType;
use App\Enums\ProjectStatus;
use App\Enums\TimeEntryType;
use App\Models\EmployeeSalaryContract;
use App\Models\OrganizationPayrollSettings;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Payroll\PayrollCalculationService;
use App\Services\Payroll\PayrollSettingsService;
use App\Services\Tenant\TenantContext;
use App\Support\ReportDateRange;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Revenue, cost and margin per project, client and employee.
 *
 * Revenue
 * - Hourly projects: approved hours × the project's hourly (bill) rate.
 * - Fixed-fee projects: the fee is recognised as work is logged. With a
 *   budget in hours, each hour earns fee ÷ budget hours until the budget is
 *   used up; without one, the fee is spread over all hours logged so far.
 * - Non-billable projects earn nothing.
 *
 * Cost: each hour × the employee's effective hourly rate from the salary
 * contract in force on the day the work was done (monthly salaries are
 * divided by the organization's expected monthly hours, as payroll does).
 *
 * Only countable work counts: stopped timer entries and approved manual
 * entries. Leave is excluded because it isn't project work.
 */
class ProfitabilityService
{
    public const AT_RISK_BURN_PERCENT = 80.0;

    /** Burn may run this many points ahead of elapsed time before it counts as at risk. */
    public const BURN_AHEAD_TOLERANCE = 15.0;

    public const FORECAST_WINDOW_DAYS = 14;

    public const LOW_MARGIN_PERCENT = 20.0;

    public function __construct(
        private readonly PayrollCalculationService $payroll,
        private readonly PayrollSettingsService $payrollSettings,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function report(Carbon $rangeStart, Carbon $rangeEnd): array
    {
        $settings = $this->payrollSettings->forOrganization();
        $now = Carbon::now();

        $entries = $this->projectWork()
            ->whereBetween('start_time', [$rangeStart, $rangeEnd])
            ->get(['id', 'user_id', 'project_id', 'duration', 'start_time']);

        $projectIdsWithWork = $entries->pluck('project_id')->unique()->values()->all();

        $projects = Project::query()
            ->where('organization_id', TenantContext::id())
            ->where(function (Builder $query) use ($projectIdsWithWork) {
                $query->where('status', '!=', ProjectStatus::Archived);

                if ($projectIdsWithWork !== []) {
                    $query->orWhereIn('id', $projectIdsWithWork);
                }
            })
            ->orderBy('name')
            ->get()
            ->keyBy('id');

        $projectIds = $projects->keys()->all();
        $lifetimeSeconds = $this->secondsByProject($projectIds, null, $now);
        $secondsBeforeRange = $this->secondsByProject($projectIds, null, $rangeStart->copy()->subSecond());
        $recentSeconds = $this->secondsByProject(
            $projectIds,
            $now->copy()->subDays(self::FORECAST_WINDOW_DAYS)->startOfDay(),
            $now,
        );

        $userIds = $entries->pluck('user_id')->unique()->values()->all();
        $rateFor = $this->hourlyCostResolver($userIds, $settings);
        $users = User::query()->whereIn('id', $userIds)->get(['id', 'name'])->keyBy('id');

        /** @var array<int, array{seconds: int, cost: float, unpriced_seconds: int, by_user: array<int, array{seconds: int, cost: float}>}> $byProject */
        $byProject = [];
        /** @var array<int, array{seconds: int, cost: float, unpriced_seconds: int}> $byUser */
        $byUser = [];

        foreach ($entries as $entry) {
            $seconds = (int) $entry->duration;

            if ($seconds <= 0 || ! $projects->has($entry->project_id)) {
                continue;
            }

            $rate = $rateFor((int) $entry->user_id, Carbon::parse($entry->start_time));
            $cost = $rate === null ? 0.0 : ($seconds / 3600) * $rate;

            $project = &$byProject[$entry->project_id];
            $project ??= ['seconds' => 0, 'cost' => 0.0, 'unpriced_seconds' => 0, 'by_user' => []];
            $project['seconds'] += $seconds;
            $project['cost'] += $cost;
            $project['unpriced_seconds'] += $rate === null ? $seconds : 0;
            $project['by_user'][$entry->user_id] ??= ['seconds' => 0, 'cost' => 0.0];
            $project['by_user'][$entry->user_id]['seconds'] += $seconds;
            $project['by_user'][$entry->user_id]['cost'] += $cost;
            unset($project);

            $user = &$byUser[$entry->user_id];
            $user ??= ['seconds' => 0, 'cost' => 0.0, 'unpriced_seconds' => 0];
            $user['seconds'] += $seconds;
            $user['cost'] += $cost;
            $user['unpriced_seconds'] += $rate === null ? $seconds : 0;
            unset($user);
        }

        $userRevenue = [];
        $projectRows = [];

        foreach ($projects as $project) {
            $work = $byProject[$project->id] ?? ['seconds' => 0, 'cost' => 0.0, 'unpriced_seconds' => 0, 'by_user' => []];
            $revenue = $this->recognisedRevenue(
                $project,
                $work['seconds'],
                $secondsBeforeRange[$project->id] ?? 0,
                $lifetimeSeconds[$project->id] ?? 0,
            );

            foreach ($work['by_user'] as $userId => $share) {
                $userRevenue[$userId] = ($userRevenue[$userId] ?? 0.0)
                    + ($work['seconds'] > 0 ? $revenue * $share['seconds'] / $work['seconds'] : 0.0);
            }

            $projectRows[] = $this->projectRow(
                $project,
                $work,
                $revenue,
                $lifetimeSeconds[$project->id] ?? 0,
                $recentSeconds[$project->id] ?? 0,
                $now,
            );
        }

        $employeeRows = collect($byUser)
            ->map(fn (array $work, int $userId) => $this->employeeRow(
                $userId,
                $users->get($userId)?->name ?? 'Former employee',
                $work,
                $userRevenue[$userId] ?? 0.0,
            ))
            ->sortByDesc('profit')
            ->values()
            ->all();

        $clientRows = $this->clientRows($projectRows);
        $totals = $this->totals($projectRows);

        return [
            'range' => ReportDateRange::meta($rangeStart, $rangeEnd),
            'currency' => 'PKR',
            'totals' => $totals,
            'insights' => $this->insights($projectRows, $clientRows, $totals),
            'projects' => $projectRows,
            'clients' => $clientRows,
            'employees' => $employeeRows,
        ];
    }

    /**
     * Countable, project-linked work in the current organization.
     */
    private function projectWork(): Builder
    {
        return TimeEntry::query()
            ->where('organization_id', TenantContext::id())
            ->countable()
            ->whereIn('type', [TimeEntryType::Tracked, TimeEntryType::Manual])
            ->whereNotNull('project_id');
    }

    /**
     * @param  list<int>  $projectIds
     * @return array<int, int> seconds keyed by project id
     */
    private function secondsByProject(array $projectIds, ?Carbon $from, Carbon $to): array
    {
        if ($projectIds === []) {
            return [];
        }

        return $this->projectWork()
            ->whereIn('project_id', $projectIds)
            ->when($from, fn (Builder $query) => $query->where('start_time', '>=', $from))
            ->where('start_time', '<=', $to)
            ->groupBy('project_id')
            ->selectRaw('project_id, SUM(duration) as seconds')
            ->pluck('seconds', 'project_id')
            ->map(fn ($seconds) => (int) $seconds)
            ->all();
    }

    /**
     * Returns a function giving a user's hourly cost on a date, or null when no
     * salary contract covers that date (and the user has no active contract).
     *
     * @param  list<int>  $userIds
     * @return callable(int, Carbon): (float|null)
     */
    private function hourlyCostResolver(array $userIds, OrganizationPayrollSettings $settings): callable
    {
        $contractsByUser = $userIds === []
            ? collect()
            : EmployeeSalaryContract::query()
                ->where('organization_id', TenantContext::id())
                ->whereIn('user_id', $userIds)
                ->orderByDesc('effective_from')
                ->get()
                ->groupBy('user_id');

        /** @var array<int, float|null> $rateByContract */
        $rateByContract = [];

        $rateOf = function (EmployeeSalaryContract $contract) use (&$rateByContract, $settings): ?float {
            return $rateByContract[$contract->id] ??= $this->payroll->effectiveHourlyRate($contract, $settings);
        };

        return function (int $userId, Carbon $on) use ($contractsByUser, $rateOf): ?float {
            /** @var Collection<int, EmployeeSalaryContract> $contracts */
            $contracts = $contractsByUser->get($userId, collect());
            $day = $on->toDateString();

            $covering = $contracts->first(fn (EmployeeSalaryContract $contract) => $contract->effective_from->toDateString() <= $day
                && ($contract->effective_to === null || $contract->effective_to->toDateString() >= $day));

            $contract = $covering ?? $contracts->firstWhere('is_active', true);

            return $contract === null ? null : $rateOf($contract);
        };
    }

    private function recognisedRevenue(Project $project, int $rangeSeconds, int $secondsBefore, int $lifetimeSeconds): float
    {
        return match ($project->billingType()) {
            ProjectBillingType::NonBillable => 0.0,
            ProjectBillingType::Hourly => ($rangeSeconds / 3600) * (float) ($project->hourly_rate ?? 0),
            ProjectBillingType::Fixed => $this->recognisedFixedFee($project, $rangeSeconds, $secondsBefore, $lifetimeSeconds),
        };
    }

    private function recognisedFixedFee(Project $project, int $rangeSeconds, int $secondsBefore, int $lifetimeSeconds): float
    {
        $fee = (float) ($project->budget_amount ?? 0);

        if ($fee <= 0 || $rangeSeconds <= 0) {
            return 0.0;
        }

        $budgetSeconds = (float) ($project->budget_hours ?? 0) * 3600;

        if ($budgetSeconds > 0) {
            $earnedSeconds = min($secondsBefore + $rangeSeconds, $budgetSeconds) - min($secondsBefore, $budgetSeconds);

            return $fee * max(0.0, $earnedSeconds) / $budgetSeconds;
        }

        return $lifetimeSeconds > 0 ? $fee * min(1.0, $rangeSeconds / $lifetimeSeconds) : 0.0;
    }

    /**
     * @param  array{seconds: int, cost: float, unpriced_seconds: int}  $work
     * @return array<string, mixed>
     */
    private function projectRow(
        Project $project,
        array $work,
        float $revenue,
        int $lifetimeSeconds,
        int $recentSeconds,
        Carbon $now,
    ): array {
        $billingType = $project->billingType();
        $hours = $work['seconds'] / 3600;
        $profit = $revenue - $work['cost'];

        return [
            'id' => $project->id,
            'name' => $project->name,
            'client_name' => $project->client_name,
            'status' => $project->status->value,
            'billing_type' => $billingType->value,
            'bill_rate' => $project->hourly_rate === null ? null : (float) $project->hourly_rate,
            'fixed_fee' => $project->budget_amount === null ? null : (float) $project->budget_amount,
            'missing_bill_rate' => $billingType === ProjectBillingType::Hourly
                && (float) ($project->hourly_rate ?? 0) <= 0
                && $work['seconds'] > 0,
            'hours' => round($hours, 2),
            'unpriced_hours' => round($work['unpriced_seconds'] / 3600, 2),
            'revenue' => round($revenue, 2),
            'cost' => round($work['cost'], 2),
            'profit' => round($profit, 2),
            'margin_percent' => $this->marginPercent($revenue, $profit),
            'revenue_per_hour' => $hours > 0 ? round($revenue / $hours, 2) : null,
            'cost_per_hour' => $hours > 0 ? round($work['cost'] / $hours, 2) : null,
            'budget' => $this->budgetHealth($project, $lifetimeSeconds, $recentSeconds, $now),
        ];
    }

    /**
     * Lifetime budget burn (not limited to the report range).
     *
     * @return array<string, mixed>
     */
    private function budgetHealth(Project $project, int $lifetimeSeconds, int $recentSeconds, Carbon $now): array
    {
        $budgetHours = $project->budget_hours === null ? null : (float) $project->budget_hours;
        $usedHours = $lifetimeSeconds / 3600;
        $elapsedPercent = $this->elapsedPercent($project, $now);

        if ($budgetHours === null || $budgetHours <= 0) {
            return [
                'budget_hours' => null,
                'used_hours' => round($usedHours, 2),
                'burn_percent' => null,
                'elapsed_percent' => $elapsedPercent,
                'forecast_exhausted_on' => null,
                'starts_on' => $project->starts_on?->toDateString(),
                'due_on' => $project->due_on?->toDateString(),
                'status' => 'no_budget',
            ];
        }

        $burnPercent = $usedHours / $budgetHours * 100;
        $dailyHours = ($recentSeconds / 3600) / self::FORECAST_WINDOW_DAYS;
        $remainingHours = $budgetHours - $usedHours;
        $forecast = null;

        if ($remainingHours > 0 && $dailyHours > 0) {
            $forecast = $now->copy()->addDays((int) ceil($remainingHours / $dailyHours))->toDateString();
        }

        $status = match (true) {
            $burnPercent >= 100 => 'over_budget',
            $burnPercent >= self::AT_RISK_BURN_PERCENT,
            $elapsedPercent !== null && $burnPercent > $elapsedPercent + self::BURN_AHEAD_TOLERANCE,
            $forecast !== null && $project->due_on !== null && $forecast < $project->due_on->toDateString() => 'at_risk',
            default => 'on_track',
        };

        return [
            'budget_hours' => round($budgetHours, 2),
            'used_hours' => round($usedHours, 2),
            'burn_percent' => round($burnPercent, 1),
            'elapsed_percent' => $elapsedPercent,
            'forecast_exhausted_on' => $forecast,
            'starts_on' => $project->starts_on?->toDateString(),
            'due_on' => $project->due_on?->toDateString(),
            'status' => $status,
        ];
    }

    private function elapsedPercent(Project $project, Carbon $now): ?float
    {
        if ($project->starts_on === null || $project->due_on === null) {
            return null;
        }

        $totalDays = $project->starts_on->diffInDays($project->due_on);

        if ($totalDays <= 0) {
            return $now->gte($project->due_on) ? 100.0 : 0.0;
        }

        $elapsed = $project->starts_on->diffInDays($now->copy()->startOfDay(), false);

        return round(max(0.0, min(100.0, $elapsed / $totalDays * 100)), 1);
    }

    /**
     * @param  array{seconds: int, cost: float, unpriced_seconds: int}  $work
     * @return array<string, mixed>
     */
    private function employeeRow(int $userId, string $name, array $work, float $revenue): array
    {
        $hours = $work['seconds'] / 3600;
        $profit = $revenue - $work['cost'];

        return [
            'user_id' => $userId,
            'name' => $name,
            'hours' => round($hours, 2),
            'unpriced_hours' => round($work['unpriced_seconds'] / 3600, 2),
            'revenue' => round($revenue, 2),
            'cost' => round($work['cost'], 2),
            'profit' => round($profit, 2),
            'margin_percent' => $this->marginPercent($revenue, $profit),
            'cost_per_hour' => $hours > 0 && $work['unpriced_seconds'] < $work['seconds']
                ? round($work['cost'] / (($work['seconds'] - $work['unpriced_seconds']) / 3600), 2)
                : null,
            'has_salary_contract' => $work['unpriced_seconds'] < $work['seconds'],
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $projectRows
     * @return list<array<string, mixed>>
     */
    private function clientRows(array $projectRows): array
    {
        return collect($projectRows)
            ->filter(fn (array $row) => $row['hours'] > 0 || $row['revenue'] > 0)
            ->groupBy(fn (array $row) => $row['client_name'] ?: 'No client')
            ->map(function (Collection $rows, string $client) {
                $revenue = (float) $rows->sum('revenue');
                $cost = (float) $rows->sum('cost');
                $profit = $revenue - $cost;

                return [
                    'client_name' => $client,
                    // Only internal (non-billable) projects: a cost centre, not a client.
                    'internal' => $rows->every(fn (array $row) => $row['billing_type'] === ProjectBillingType::NonBillable->value),
                    'projects_count' => $rows->count(),
                    'hours' => round((float) $rows->sum('hours'), 2),
                    'revenue' => round($revenue, 2),
                    'cost' => round($cost, 2),
                    'profit' => round($profit, 2),
                    'margin_percent' => $this->marginPercent($revenue, $profit),
                ];
            })
            ->sortByDesc('profit')
            ->values()
            ->all();
    }

    /**
     * @param  list<array<string, mixed>>  $projectRows
     * @return array<string, mixed>
     */
    private function totals(array $projectRows): array
    {
        $rows = collect($projectRows);
        $revenue = (float) $rows->sum('revenue');
        $cost = (float) $rows->sum('cost');
        $profit = $revenue - $cost;
        $hours = (float) $rows->sum('hours');
        $billableHours = (float) $rows
            ->where('billing_type', '!=', ProjectBillingType::NonBillable->value)
            ->sum('hours');

        return [
            'revenue' => round($revenue, 2),
            'cost' => round($cost, 2),
            'profit' => round($profit, 2),
            'margin_percent' => $this->marginPercent($revenue, $profit),
            'hours' => round($hours, 2),
            'billable_hours' => round($billableHours, 2),
            'billable_percent' => $hours > 0 ? round($billableHours / $hours * 100, 1) : null,
            'unpriced_hours' => round((float) $rows->sum('unpriced_hours'), 2),
            'projects_over_budget' => $rows->where('budget.status', 'over_budget')->count(),
            'projects_at_risk' => $rows->where('budget.status', 'at_risk')->count(),
        ];
    }

    /**
     * Plain-language findings, most urgent first.
     *
     * @param  list<array<string, mixed>>  $projectRows
     * @param  list<array<string, mixed>>  $clientRows
     * @param  array<string, mixed>  $totals
     * Each insight carries an `impact` (what is at stake, so the page can rank
     * and label it): money in rupees, or hours over / left on a budget.
     *
     * @return list<array{severity: string, title: string, detail: string, project_id?: int, impact?: array{type: string, value: float}}>
     */
    private function insights(array $projectRows, array $clientRows, array $totals): array
    {
        $insights = [];
        $projects = collect($projectRows);

        foreach ($projects->where('budget.status', 'over_budget') as $row) {
            $insights[] = [
                'severity' => 'critical',
                'title' => "{$row['name']} is over budget",
                'detail' => sprintf(
                    '%s of %s budgeted hours used (%s%%).',
                    $this->hours($row['budget']['used_hours']),
                    $this->hours($row['budget']['budget_hours']),
                    $row['budget']['burn_percent'],
                ),
                'project_id' => $row['id'],
                'impact' => [
                    'type' => 'hours_over',
                    'value' => round((float) $row['budget']['used_hours'] - (float) $row['budget']['budget_hours'], 1),
                ],
            ];
        }

        foreach ($clientRows as $client) {
            if (! $client['internal'] && $client['profit'] < 0 && $client['cost'] > 0) {
                $insights[] = [
                    'severity' => 'critical',
                    'title' => "{$client['client_name']} is losing money",
                    'detail' => sprintf(
                        'It cost %s more than it earned in this period.',
                        $this->money(abs($client['profit'])),
                    ),
                    'impact' => ['type' => 'money', 'value' => round((float) $client['profit'], 2)],
                ];
            }
        }

        foreach ($projects->where('budget.status', 'at_risk') as $row) {
            $budget = $row['budget'];
            $detail = sprintf('%s%% of the budget is used', $budget['burn_percent']);

            if ($budget['elapsed_percent'] !== null) {
                $detail .= sprintf(' with %s%% of the time gone', $budget['elapsed_percent']);
            }

            if ($budget['forecast_exhausted_on'] !== null) {
                $detail .= sprintf('. At the current pace it runs out on %s', $this->date($budget['forecast_exhausted_on']));

                if ($budget['due_on'] !== null && $budget['forecast_exhausted_on'] < $budget['due_on']) {
                    $detail .= sprintf(', before the %s due date', $this->date($budget['due_on']));
                }
            }

            $insights[] = [
                'severity' => 'warning',
                'title' => "{$row['name']} is burning budget fast",
                'detail' => $detail.'.',
                'project_id' => $row['id'],
                'impact' => [
                    'type' => 'hours_left',
                    'value' => round(max(0, (float) $budget['budget_hours'] - (float) $budget['used_hours']), 1),
                ],
            ];
        }

        $lowMargin = $projects
            ->filter(fn (array $row) => $row['revenue'] > 0
                && $row['margin_percent'] !== null
                && $row['margin_percent'] >= 0
                && $row['margin_percent'] < self::LOW_MARGIN_PERCENT)
            ->sortBy('margin_percent')
            ->first();

        if ($lowMargin !== null) {
            $insights[] = [
                'severity' => 'warning',
                'title' => "{$lowMargin['name']} has a thin margin",
                'detail' => sprintf(
                    'Only %s%% margin: it earns %s an hour and costs %s an hour.',
                    $lowMargin['margin_percent'],
                    $this->money($lowMargin['revenue_per_hour'] ?? 0),
                    $this->money($lowMargin['cost_per_hour'] ?? 0),
                ),
                'project_id' => $lowMargin['id'],
                'impact' => ['type' => 'money', 'value' => round((float) $lowMargin['profit'], 2)],
            ];
        }

        $missingRates = $projects->where('missing_bill_rate', true)->count();

        if ($missingRates > 0) {
            $insights[] = [
                'severity' => 'info',
                'title' => $missingRates === 1 ? '1 hourly project has no bill rate' : "{$missingRates} hourly projects have no bill rate",
                'detail' => 'Their hours show no revenue. Add a bill rate on the project to fix this.',
            ];
        }

        if ($totals['unpriced_hours'] > 0) {
            $insights[] = [
                'severity' => 'info',
                'title' => 'Some hours have no salary cost',
                'detail' => sprintf(
                    '%s were logged by people without a salary contract, so cost and profit are overstated.',
                    $this->hours($totals['unpriced_hours']),
                ),
            ];
        }

        $best = $projects
            ->filter(fn (array $row) => $row['profit'] > 0)
            ->sortByDesc('profit')
            ->first();

        if ($best !== null) {
            $insights[] = [
                'severity' => 'positive',
                'title' => "{$best['name']} is your most profitable project",
                'detail' => sprintf(
                    '%s profit at a %s%% margin.',
                    $this->money($best['profit']),
                    $best['margin_percent'],
                ),
                'project_id' => $best['id'],
                'impact' => ['type' => 'money', 'value' => round((float) $best['profit'], 2)],
            ];
        }

        return $insights;
    }

    private function marginPercent(float $revenue, float $profit): ?float
    {
        return $revenue > 0 ? round($profit / $revenue * 100, 1) : null;
    }

    private function money(float $amount): string
    {
        return 'Rs. '.number_format($amount, 0);
    }

    private function hours(float $hours): string
    {
        $rounded = round($hours, 1);

        return ($rounded == (int) $rounded ? (string) (int) $rounded : (string) $rounded).'h';
    }

    private function date(string $isoDate): string
    {
        return Carbon::parse($isoDate)->format('j M Y');
    }
}
