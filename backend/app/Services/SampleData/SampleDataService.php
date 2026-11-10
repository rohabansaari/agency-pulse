<?php

namespace App\Services\SampleData;

use App\Enums\AdvanceRequestStatus;
use App\Enums\LeaveCategory;
use App\Enums\OrganizationMemberStatus;
use App\Enums\OvertimeRequestStatus;
use App\Enums\ProjectBillingType;
use App\Enums\ProjectStatus;
use App\Enums\SalaryType;
use App\Enums\TimeEntrySource;
use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Enums\UserRole;
use App\Models\EmployeeSalaryContract;
use App\Models\Invoice;
use App\Models\OrganizationMember;
use App\Models\OvertimeRequest;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\SalaryAdvanceRequest;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Auth\MembershipRoleSync;
use App\Services\Invoicing\InvoiceService;
use App\Services\Tenant\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Loads realistic sample data into the current organization, using its own
 * employees, and removes it again.
 *
 * Every row it creates is recorded in sample_data_records, so remove()
 * deletes exactly those rows. Data the organization created itself (people,
 * their existing contracts, teams and projects) is never touched.
 */
class SampleDataService
{
    public const DAYS_OF_HISTORY = 60;

    public const DESCRIPTION = 'Sample data. Remove it from Settings → Sample data.';

    /**
     * Record types, in the order remove() deletes them (children first).
     *
     * @var array<string, class-string<\Illuminate\Database\Eloquent\Model>>
     */
    private const TYPES = [
        'invoice' => Invoice::class,
        'time_entry' => TimeEntry::class,
        'overtime_request' => OvertimeRequest::class,
        'salary_advance' => SalaryAdvanceRequest::class,
        'project_assignment' => ProjectAssignment::class,
        'project' => Project::class,
        'team_member' => TeamMember::class,
        'team' => Team::class,
        'salary_contract' => EmployeeSalaryContract::class,
        // Sample people last: everything above may point at them.
        'organization_member' => OrganizationMember::class,
        'user' => User::class,
    ];

    /**
     * People created by "Use a sample team" for a company with nobody to log
     * sample work against: [name, role]. Their addresses are on a domain with
     * no mailboxes and they get random passwords, so they never sign in.
     */
    private const SAMPLE_PEOPLE = [
        ['Ayesha Khan', UserRole::Employee],
        ['Bilal Ahmed', UserRole::Employee],
        ['Sana Malik', UserRole::Employee],
        ['Usman Tariq', UserRole::Employee],
        ['Hira Shah', UserRole::Employee],
        ['Jane Smith', UserRole::Employee],
        ['Mark Wilson', UserRole::Manager],
    ];

    public const SAMPLE_EMAIL_DOMAIN = 'sample.agencypulse.in';

    /**
     * [name, client, billing type, bill rate, fixed fee, budget as a multiple of hours used, starts (days ago), due (days ahead)]
     * The budget multiples give each budget status something to show: Brand
     * Refresh runs over, SEO Audit is nearly used up, the rest have enough
     * room at the current pace to finish by their due dates.
     */
    private const PROJECTS = [
        ['Website Redesign', 'Acme Foods', ProjectBillingType::Hourly, 3500, null, 2.4, 40, 40],
        ['Brand Refresh', 'Globex Telecom', ProjectBillingType::Fixed, null, 450000, 0.8, 55, 15],
        ['Social Media Retainer', 'Initech Bank', ProjectBillingType::Hourly, 2800, null, 2.5, 45, 45],
        ['Mobile App MVP', 'Hooli Pay', ProjectBillingType::Fixed, null, 1200000, 4.0, 30, 75],
        ['SEO Audit', 'Umbrella Pharma', ProjectBillingType::Hourly, 2500, null, 1.08, 30, 10],
        ['Internal Tools', 'Internal', ProjectBillingType::NonBillable, null, null, null, null, null],
    ];

    /** @var array<string, list<int>> */
    private array $created = [];

    /**
     * @return array{loaded: bool, counts: array<string, int>, employees: int}
     */
    public function status(): array
    {
        $counts = DB::table('sample_data_records')
            ->where('organization_id', TenantContext::id())
            ->groupBy('record_type')
            ->selectRaw('record_type, COUNT(*) as total')
            ->pluck('total', 'record_type')
            ->map(fn ($total) => (int) $total)
            ->all();

        return [
            'loaded' => $counts !== [],
            'counts' => $counts,
            'employees' => $this->employees()->count(),
        ];
    }

    /**
     * @return array<string, int> rows created per type
     */
    public function load(User $admin, bool $withSampleTeam = false): array
    {
        if ($this->status()['loaded']) {
            throw ValidationException::withMessages([
                'sample_data' => ['Sample data is already loaded. Remove it before loading it again.'],
            ]);
        }

        $this->created = [];
        $people = [];

        if ($withSampleTeam) {
            $people = DB::transaction(fn () => $this->samplePeople());
        }

        $employees = $this->employees();

        if ($employees->isEmpty()) {
            throw ValidationException::withMessages([
                'sample_data' => ['Add at least one employee first. Sample data is logged against your own employees.'],
            ]);
        }

        // Same sample every time for the same people.
        mt_srand(20261109 + $employees->count());

        DB::transaction(function () use ($admin, $employees) {
            $this->contracts($employees);
            $managerFor = $this->teams($employees);
            $projects = $this->projects($employees);
            $this->work($admin, $projects, $managerFor);
            $this->pendingApprovals($projects, $managerFor);
            $this->setBudgets($projects);
            $this->leave($admin, $employees, $managerFor);
            $this->overtime($admin, $employees, $projects, $managerFor);
            $this->advances($admin, $employees);
            $this->invoices($admin, $projects);
            $this->record();
        });

        return [...$people, ...array_map('count', $this->created)];
    }

    /**
     * @return int rows removed
     */
    public function remove(): int
    {
        $organizationId = TenantContext::id();
        $removed = 0;

        DB::transaction(function () use ($organizationId, &$removed) {
            // Role assignments of sample people (a polymorphic pivot with no foreign key).
            DB::table('model_has_roles')
                ->where('model_type', User::class)
                ->whereIn('model_id', DB::table('sample_data_records')
                    ->where('organization_id', $organizationId)
                    ->where('record_type', 'user')
                    ->pluck('record_id'))
                ->delete();

            // Invoices someone made from sample work go too, so none point at deleted projects.
            $sampleProjects = DB::table('sample_data_records')
                ->where('organization_id', $organizationId)
                ->where('record_type', 'project')
                ->pluck('record_id');
            $removed += Invoice::query()
                ->withoutGlobalScopes()
                ->where('organization_id', $organizationId)
                ->whereHas('lines', fn ($query) => $query->whereIn('project_id', $sampleProjects))
                ->delete();

            foreach (self::TYPES as $type => $model) {
                $ids = DB::table('sample_data_records')
                    ->where('organization_id', $organizationId)
                    ->where('record_type', $type)
                    ->pluck('record_id');

                foreach ($ids->chunk(500) as $chunk) {
                    $removed += $model::query()
                        ->withoutGlobalScopes()
                        ->whereIn('id', $chunk)
                        ->delete();
                }
            }

            DB::table('sample_data_records')->where('organization_id', $organizationId)->delete();
        });

        return $removed;
    }

    /**
     * Active employees of this organization (the people whose time is logged).
     *
     * @return Collection<int, User>
     */
    private function employees(): Collection
    {
        $userIds = OrganizationMember::query()
            ->where('organization_id', TenantContext::id())
            ->where('status', OrganizationMemberStatus::Active)
            ->where('role', UserRole::Employee)
            ->pluck('user_id');

        return User::query()->whereIn('id', $userIds)->orderBy('id')->get();
    }

    /**
     * Gives employees without a salary contract one, so their hours have a cost.
     *
     * @param  Collection<int, User>  $employees
     */
    private function contracts(Collection $employees): void
    {
        $withContract = EmployeeSalaryContract::query()
            ->where('organization_id', TenantContext::id())
            ->whereIn('user_id', $employees->pluck('id'))
            ->where('is_active', true)
            ->pluck('user_id')
            ->all();

        $salaries = [[SalaryType::Monthly, 180000], [SalaryType::Hourly, 950], [SalaryType::Monthly, 240000], [SalaryType::Monthly, 150000], [SalaryType::Hourly, 1200]];

        foreach ($employees->values() as $index => $employee) {
            if (in_array($employee->id, $withContract, true)) {
                continue;
            }

            [$type, $amount] = $salaries[$index % count($salaries)];

            $this->track('salary_contract', EmployeeSalaryContract::create([
                'organization_id' => TenantContext::id(),
                'user_id' => $employee->id,
                'salary_type' => $type,
                'hourly_rate' => $type === SalaryType::Hourly ? (string) $amount : null,
                'monthly_salary' => $type === SalaryType::Monthly ? (string) $amount : null,
                'effective_from' => now()->subYear()->startOfMonth()->toDateString(),
                'is_active' => true,
            ]));
        }
    }

    /**
     * Each employee's approving manager. Employees not in a team join a sample
     * team led by an existing manager, when there is one.
     *
     * @param  Collection<int, User>  $employees
     * @return array<int, int|null> manager user id keyed by employee id
     */
    private function teams(Collection $employees): array
    {
        $memberships = TeamMember::query()
            ->whereIn('user_id', $employees->pluck('id'))
            ->with('team:id,manager_id')
            ->get()
            ->keyBy('user_id');

        $managerFor = [];
        $unteamed = [];

        foreach ($employees as $employee) {
            $membership = $memberships->get($employee->id);
            $managerFor[$employee->id] = $membership?->team?->manager_id;

            if ($membership === null) {
                $unteamed[] = $employee->id;
            }
        }

        $managerId = OrganizationMember::query()
            ->where('organization_id', TenantContext::id())
            ->where('status', OrganizationMemberStatus::Active)
            ->where('role', UserRole::Manager)
            ->orderBy('id')
            ->value('user_id');

        if ($unteamed === [] || $managerId === null) {
            return $managerFor;
        }

        $team = Team::create([
            'organization_id' => TenantContext::id(),
            'name' => 'Studio (sample)',
            'manager_id' => $managerId,
        ]);
        $this->track('team', $team);

        foreach ($unteamed as $userId) {
            $this->track('team_member', TeamMember::create(['team_id' => $team->id, 'user_id' => $userId]));
            $managerFor[$userId] = $managerId;
        }

        return $managerFor;
    }

    /**
     * @param  Collection<int, User>  $employees
     * @return list<array{project: Project, members: list<User>, budget_factor: float|null}>
     */
    private function projects(Collection $employees): array
    {
        $today = Carbon::today();
        $people = $employees->values()->all();
        $perProject = min(3, count($people));
        $result = [];

        foreach (self::PROJECTS as $index => [$name, $client, $billing, $rate, $fee, $budgetFactor, $startsAgo, $dueIn]) {
            $project = Project::create([
                'organization_id' => TenantContext::id(),
                'name' => $name,
                'client_name' => $client,
                'description' => self::DESCRIPTION,
                'hourly_rate' => $rate,
                'billing_type' => $billing,
                'budget_amount' => $fee,
                'starts_on' => $startsAgo === null ? null : $today->copy()->subDays($startsAgo)->toDateString(),
                'due_on' => $dueIn === null ? null : $today->copy()->addDays($dueIn)->toDateString(),
                'status' => ProjectStatus::Active,
            ]);
            $this->track('project', $project);

            // Rotate people across projects so everyone has work on two or three.
            $members = [];
            for ($i = 0; $i < $perProject; $i++) {
                $members[] = $people[($index + $i) % count($people)];
            }
            $members = array_values(array_unique($members, SORT_REGULAR));

            foreach ($members as $member) {
                $this->track('project_assignment', ProjectAssignment::create([
                    'project_id' => $project->id,
                    'user_id' => $member->id,
                    'role_in_project' => 'worker',
                ]));
            }

            $result[] = ['project' => $project, 'members' => $members, 'budget_factor' => $budgetFactor];
        }

        return $result;
    }

    /**
     * Weekday work: mostly timer entries, some approved manual time, and the
     * last three days' manual entries left pending for the approval queue.
     *
     * @param  list<array{project: Project, members: list<User>, budget_factor: float|null}>  $projects
     * @param  array<int, int|null>  $managerFor
     */
    private function work(User $admin, array $projects, array $managerFor): void
    {
        $today = Carbon::today();

        foreach ($projects as ['project' => $project, 'members' => $members]) {
            $first = $project->starts_on !== null && $project->starts_on->gt($today->copy()->subDays(self::DAYS_OF_HISTORY))
                ? $project->starts_on->copy()
                : $today->copy()->subDays(self::DAYS_OF_HISTORY);
            $extra = $project->name === 'Brand Refresh' ? 1.5 : 0.0;

            for ($day = $first; $day->lt($today); $day = $day->copy()->addDay()) {
                if ($day->isWeekend()) {
                    continue;
                }

                foreach ($members as $member) {
                    if (mt_rand(0, 99) < 35) {
                        continue;
                    }

                    $seconds = (int) round((mt_rand(10, 40) / 10 + $extra) * 3600);
                    $start = $day->copy()->setTime(9 + mt_rand(0, 4), [0, 15, 30, 45][mt_rand(0, 3)]);
                    $manual = mt_rand(0, 99) < 15;
                    $managerId = $managerFor[$member->id] ?? null;
                    $pending = $manual && $managerId !== null && $day->diffInDays($today) <= 3;

                    $this->track('time_entry', TimeEntry::create([
                        'user_id' => $member->id,
                        'organization_id' => TenantContext::id(),
                        'type' => $manual ? TimeEntryType::Manual : TimeEntryType::Tracked,
                        'project_id' => $project->id,
                        'manager_id' => $manual ? $managerId : null,
                        'start_time' => $start,
                        'end_time' => $start->copy()->addSeconds($seconds),
                        'duration' => $seconds,
                        'description' => $manual ? $this->manualReason($project) : null,
                        'source' => $manual ? TimeEntrySource::Employee : null,
                        'status' => match (true) {
                            ! $manual => TimeEntryStatus::Stopped,
                            $pending => TimeEntryStatus::Pending,
                            default => TimeEntryStatus::Approved,
                        },
                        'approved_by' => $manual && ! $pending ? ($managerId ?? $admin->id) : null,
                        'approved_at' => $manual && ! $pending ? $start->copy()->addDay() : null,
                    ]));
                }
            }
        }
    }

    /**
     * A few manual entries from the last working day waiting for approval, so
     * the approval queue always has something in it (when there's a manager).
     *
     * @param  list<array{project: Project, members: list<User>, budget_factor: float|null}>  $projects
     * @param  array<int, int|null>  $managerFor
     */
    private function pendingApprovals(array $projects, array $managerFor): void
    {
        $day = Carbon::yesterday();
        while ($day->isWeekend()) {
            $day = $day->subDay();
        }

        $added = 0;
        foreach ($projects as ['project' => $project, 'members' => $members]) {
            if ($project->billingType() === ProjectBillingType::NonBillable || $added >= 3) {
                continue;
            }

            $member = $members[$added % count($members)];
            $managerId = $managerFor[$member->id] ?? null;

            if ($managerId === null) {
                continue;
            }

            $start = $day->copy()->setTime(17, 30);
            $this->track('time_entry', TimeEntry::create([
                'user_id' => $member->id,
                'organization_id' => TenantContext::id(),
                'type' => TimeEntryType::Manual,
                'project_id' => $project->id,
                'manager_id' => $managerId,
                'start_time' => $start,
                'end_time' => $start->copy()->addMinutes(90),
                'duration' => 90 * 60,
                'description' => $this->manualReason($project),
                'source' => TimeEntrySource::Employee,
                'status' => TimeEntryStatus::Pending,
            ]));
            $added++;
        }
    }

    /**
     * Budgets are set from the hours actually generated, so the statuses are
     * the same however many employees the organization has.
     *
     * @param  list<array{project: Project, members: list<User>, budget_factor: float|null}>  $projects
     */
    private function setBudgets(array $projects): void
    {
        foreach ($projects as ['project' => $project, 'budget_factor' => $factor]) {
            if ($factor === null) {
                continue;
            }

            $hours = (float) TimeEntry::query()
                ->where('project_id', $project->id)
                ->whereIn('status', [TimeEntryStatus::Stopped, TimeEntryStatus::Approved])
                ->sum('duration') / 3600;

            $project->update(['budget_hours' => max(10, round($hours * $factor / 5) * 5)]);
        }
    }

    private function manualReason(Project $project): string
    {
        $reasons = [
            "Client call with {$project->client_name}; the timer wasn't running",
            'Design review at the client office',
            'Workshop prep while travelling, no internet',
            'Forgot to start the timer after lunch',
            "Urgent fixes requested by {$project->client_name}",
        ];

        return $reasons[mt_rand(0, count($reasons) - 1)];
    }

    /**
     * @param  Collection<int, User>  $employees
     * @param  array<int, int|null>  $managerFor
     */
    private function leave(User $admin, Collection $employees, array $managerFor): void
    {
        $today = Carbon::today();
        $people = $employees->values();
        $plan = [
            [0, 12, LeaveCategory::Annual, true],
            [1, 20, LeaveCategory::Medical, true],
            [2, 33, LeaveCategory::Casual, true],
            [0, -5, LeaveCategory::Annual, false],
        ];

        foreach ($plan as [$index, $daysAgo, $category, $approved]) {
            $employee = $people[$index % $people->count()];
            $managerId = $managerFor[$employee->id] ?? null;

            if (! $approved && $managerId === null) {
                continue; // Pending leave needs a manager to approve it.
            }

            $day = $today->copy()->subDays($daysAgo);
            $day = $day->isWeekend() ? $day->next(Carbon::MONDAY) : $day;
            $start = $day->copy()->setTime(9, 0);

            $this->track('time_entry', TimeEntry::create([
                'user_id' => $employee->id,
                'organization_id' => TenantContext::id(),
                'type' => TimeEntryType::Leave,
                'manager_id' => $managerId,
                'start_time' => $start,
                'end_time' => $start->copy()->addHours(8),
                'duration' => 8 * 3600,
                'description' => ucfirst($category->value).' leave',
                'is_paid' => true,
                'leave_category' => $category,
                'source' => TimeEntrySource::Employee,
                'status' => $approved ? TimeEntryStatus::Approved : TimeEntryStatus::Pending,
                'approved_by' => $approved ? ($managerId ?? $admin->id) : null,
                'approved_at' => $approved ? $start->copy()->subDays(3) : null,
            ]));
        }
    }

    /**
     * @param  Collection<int, User>  $employees
     * @param  list<array{project: Project, members: list<User>, budget_factor: float|null}>  $projects
     * @param  array<int, int|null>  $managerFor
     */
    private function overtime(User $admin, Collection $employees, array $projects, array $managerFor): void
    {
        $brandRefresh = collect($projects)->first(fn (array $p) => $p['project']->name === 'Brand Refresh');
        $people = $brandRefresh['members'];
        $plan = [
            [0, 9, 3, 'Launch-week revisions for Globex', OvertimeRequestStatus::Approved],
            [1, 3, 2, 'Final logo exports before the board meeting', OvertimeRequestStatus::Pending],
        ];

        foreach ($plan as [$index, $daysAgo, $hours, $reason, $status]) {
            $employee = $people[$index % count($people)];
            $managerId = $managerFor[$employee->id] ?? null;

            $this->track('overtime_request', OvertimeRequest::create([
                'organization_id' => TenantContext::id(),
                'user_id' => $employee->id,
                'project_id' => $brandRefresh['project']->id,
                'manager_id' => $managerId,
                'work_date' => Carbon::today()->subDays($daysAgo)->toDateString(),
                'duration_seconds' => $hours * 3600,
                'reason' => $reason,
                'status' => $status,
                'reviewed_by' => $status === OvertimeRequestStatus::Approved ? ($managerId ?? $admin->id) : null,
                'reviewed_at' => $status === OvertimeRequestStatus::Approved ? now()->subDays($daysAgo - 1) : null,
            ]));
        }
    }

    /**
     * @param  Collection<int, User>  $employees
     */
    private function advances(User $admin, Collection $employees): void
    {
        $people = $employees->values();

        $this->track('salary_advance', SalaryAdvanceRequest::create([
            'organization_id' => TenantContext::id(),
            'user_id' => $people[0]->id,
            'amount' => 40000,
            'reason' => 'Family wedding expenses',
            'status' => AdvanceRequestStatus::Pending,
        ]));

        $this->track('salary_advance', SalaryAdvanceRequest::create([
            'organization_id' => TenantContext::id(),
            'user_id' => $people[1 % $people->count()]->id,
            'reviewed_by' => $admin->id,
            'amount' => 25000,
            'reason' => 'Medical bill',
            'status' => AdvanceRequestStatus::Approved,
            'reviewed_at' => now()->subDays(6),
        ]));
    }

    /**
     * Two invoices from older hourly work: one paid, one sent and overdue, so
     * the Invoices page has something to show. Newer work stays unbilled.
     *
     * @param  list<array{project: Project, members: Collection<int, User>, budget_factor: float|null}>  $projects
     */
    private function invoices(User $admin, array $projects): void
    {
        $clients = collect($projects)
            ->pluck('project')
            ->filter(fn (Project $project) => $project->billingType() === ProjectBillingType::Hourly)
            ->pluck('client_name')
            ->unique()
            ->values();

        $service = app(InvoiceService::class);
        $today = Carbon::today();
        $plans = [
            // [client index, billed up to (days ago), issued (days ago), due (days ago), paid (days ago) or null]
            [0, 30, 28, 14, 3],
            [1, 20, 19, 5, null],
        ];

        foreach ($plans as [$index, $billedTo, $issuedAgo, $dueAgo, $paidAgo]) {
            $client = $clients->get($index);

            if ($client === null) {
                continue;
            }

            try {
                $invoice = $service->createFromWork($client, null, $today->copy()->subDays($billedTo)->endOfDay(), $admin);
            } catch (ValidationException) {
                continue;
            }

            $invoice->update([
                'issue_date' => $today->copy()->subDays($issuedAgo),
                'due_date' => $today->copy()->subDays($dueAgo),
                'notes' => 'Thank you for your business.',
            ]);
            $invoice = $service->markSent($invoice);
            $invoice->update(['sent_at' => $today->copy()->subDays($issuedAgo)->setTime(10, 0)]);

            if ($paidAgo !== null) {
                $service->recordPayment($invoice, (float) $invoice->total, $today->copy()->subDays($paidAgo));
            }

            $this->track('invoice', $invoice);
        }
    }

    /**
     * Six sample employees and, if the company has no manager, a sample one,
     * so a brand-new workspace can be explored before anyone is invited.
     */
    /**
     * @return array<string, int> people created per type
     */
    private function samplePeople(): array
    {
        $organizationId = TenantContext::id();
        $hasManager = OrganizationMember::query()
            ->where('organization_id', $organizationId)
            ->where('status', OrganizationMemberStatus::Active)
            ->where('role', UserRole::Manager)
            ->exists();
        $sync = app(MembershipRoleSync::class);

        foreach (self::SAMPLE_PEOPLE as [$name, $role]) {
            if ($role === UserRole::Manager && $hasManager) {
                continue;
            }

            $email = Str::slug($name, '.').'.'.$organizationId.'@'.self::SAMPLE_EMAIL_DOMAIN;

            if (User::query()->where('email', $email)->exists()) {
                continue;
            }

            $user = User::query()->create([
                'organization_id' => $organizationId,
                'name' => $name,
                'email' => $email,
                'password' => Str::random(40),
                'role' => $role,
            ]);
            $membership = OrganizationMember::query()->create([
                'organization_id' => $organizationId,
                'user_id' => $user->id,
                'role' => $role,
                'status' => OrganizationMemberStatus::Active,
                'joined_at' => Carbon::now(),
            ]);
            $sync->syncFromMembership($membership);

            $this->track('user', $user);
            $this->track('organization_member', $membership);
        }

        // Record them now, so a failed load can still be cleaned up by "Remove".
        $this->record();
        $counts = array_map('count', $this->created);
        $this->created = [];

        return $counts;
    }

    private function track(string $type, \Illuminate\Database\Eloquent\Model $model): void
    {
        $this->created[$type][] = (int) $model->getKey();
    }

    private function record(): void
    {
        $now = now();
        $rows = [];

        foreach ($this->created as $type => $ids) {
            foreach ($ids as $id) {
                $rows[] = [
                    'organization_id' => TenantContext::id(),
                    'record_type' => $type,
                    'record_id' => $id,
                    'created_at' => $now,
                ];
            }
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('sample_data_records')->insert($chunk);
        }
    }
}
