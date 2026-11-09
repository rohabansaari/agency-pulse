<?php

namespace App\Services\Demo;

use App\Enums\AdvanceRequestStatus;
use App\Enums\LeaveCategory;
use App\Enums\OrganizationMemberStatus;
use App\Enums\OrganizationStatus;
use App\Enums\OvertimeRequestStatus;
use App\Enums\ProjectBillingType;
use App\Enums\ProjectStatus;
use App\Enums\SalaryType;
use App\Enums\TimeEntrySource;
use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Enums\UserRole;
use App\Models\EmployeeSalaryContract;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\OvertimeRequest;
use App\Models\Project;
use App\Models\SalaryAdvanceRequest;
use App\Models\Team;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Auth\MembershipRoleSync;
use App\Services\Tenant\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Builds a self-contained demo agency ("Northwind Creative") with realistic
 * people, salaries, projects, budgets and about two months of work, so every
 * screen has data to show. Everything lives in its own organization, so
 * remove() deletes it without touching real companies.
 *
 * It uses plain models (no factories or Faker) so it runs in production images
 * installed without dev dependencies.
 */
class DemoAgencySeeder
{
    public const SLUG = 'northwind-creative-demo';

    public const EMAIL_DOMAIN = 'northwind-demo.test';

    public const DAYS_OF_HISTORY = 60;

    /** [name, email prefix, salary type, amount] */
    private const PEOPLE = [
        ['Ayesha Khan', 'ayesha', SalaryType::Monthly, 260000],
        ['Bilal Ahmed', 'bilal', SalaryType::Monthly, 210000],
        ['Sana Malik', 'sana', SalaryType::Hourly, 1100],
        ['Usman Tariq', 'usman', SalaryType::Monthly, 180000],
        ['Hira Shah', 'hira', SalaryType::Hourly, 850],
        ['Faraz Iqbal', 'faraz', SalaryType::Monthly, 150000],
        ['Zara Hussain', 'zara', SalaryType::Monthly, 300000],
        ['Omar Sheikh', 'omar', null, null], // New hire, no salary contract yet.
    ];

    /** [name, client, billing, bill rate, fixed fee, budget hours, starts (days ago), due (days ahead), team member indexes, extra hours per day] */
    private const PROJECTS = [
        ['Website Redesign', 'Acme Foods', ProjectBillingType::Hourly, 3500, null, 220, 40, 40, [0, 2, 4], 0.0],
        ['Brand Refresh', 'Globex Telecom', ProjectBillingType::Fixed, null, 450000, 260, 55, 20, [1, 3, 6], 1.5],
        ['Social Retainer', 'Initech Bank', ProjectBillingType::Hourly, 2800, null, 200, 40, 50, [5, 4, 7], 0.0],
        ['Mobile App MVP', 'Hooli Pay', ProjectBillingType::Fixed, null, 1200000, 480, 25, 80, [0, 2, 6], 0.0],
        ['SEO Audit', 'Umbrella Pharma', ProjectBillingType::Hourly, 2500, null, 60, 30, 10, [3], 0.0],
        ['Internal Tools', 'Northwind Creative', ProjectBillingType::NonBillable, null, null, null, null, null, [1, 5], 0.0],
    ];

    public function __construct(
        private readonly MembershipRoleSync $roleSync,
    ) {}

    public function exists(): bool
    {
        return Organization::query()->where('slug', self::SLUG)->exists();
    }

    /**
     * @return array{organization: Organization, admin: User, entries: int}
     */
    public function seed(string $adminEmail, string $adminPassword, string $payrollPin): array
    {
        if (strlen($adminPassword) < 12) {
            throw new InvalidArgumentException('The demo admin password must be at least 12 characters.');
        }

        if (! preg_match('/^\d{4,6}$/', $payrollPin)) {
            throw new InvalidArgumentException('The demo payroll PIN must be 4 to 6 digits.');
        }

        if ($this->exists()) {
            throw new InvalidArgumentException('The demo agency already exists. Remove it first.');
        }

        if (User::query()->where('email', strtolower($adminEmail))->exists()) {
            throw new InvalidArgumentException("{$adminEmail} is already used by another account.");
        }

        // Fixed seed: the same demo every time.
        mt_srand(20261109);

        return DB::transaction(function () use ($adminEmail, $adminPassword, $payrollPin) {
            $organization = Organization::create([
                'name' => 'Northwind Creative',
                'slug' => self::SLUG,
                'status' => OrganizationStatus::Active,
                'onboarding_completed' => true,
                'onboarding_step' => 6,
                'timezone' => config('app.timezone'),
                'website' => 'https://northwind.example',
                'payroll_pin' => $payrollPin,
                'payroll_pin_created_at' => now(),
            ]);

            TenantContext::set($organization);

            $admin = $this->user($organization, 'Rohab Ansari', strtolower($adminEmail), UserRole::Admin, $adminPassword);
            $manager = $this->user($organization, 'Maya Qureshi', 'maya@'.self::EMAIL_DOMAIN, UserRole::Manager);

            $people = [];
            foreach (self::PEOPLE as [$name, $prefix, $salaryType, $amount]) {
                $person = $this->user($organization, $name, "{$prefix}@".self::EMAIL_DOMAIN, UserRole::Employee);
                $people[] = $person;

                if ($salaryType !== null) {
                    EmployeeSalaryContract::create([
                        'organization_id' => $organization->id,
                        'user_id' => $person->id,
                        'salary_type' => $salaryType,
                        'hourly_rate' => $salaryType === SalaryType::Hourly ? (string) $amount : null,
                        'monthly_salary' => $salaryType === SalaryType::Monthly ? (string) $amount : null,
                        'effective_from' => now()->subYear()->startOfMonth()->toDateString(),
                        'is_active' => true,
                    ]);
                }
            }

            $team = Team::create(['organization_id' => $organization->id, 'name' => 'Studio', 'manager_id' => $manager->id]);
            $team->members()->attach(array_map(fn (User $person) => $person->id, $people));

            $today = Carbon::today();
            $entries = 0;

            foreach (self::PROJECTS as [$name, $client, $billing, $rate, $fee, $budget, $startsAgo, $dueIn, $memberIndexes, $extra]) {
                $project = Project::create([
                    'organization_id' => $organization->id,
                    'name' => $name,
                    'client_name' => $client,
                    'description' => "Demo project for {$client}.",
                    'hourly_rate' => $rate,
                    'billing_type' => $billing,
                    'budget_hours' => $budget,
                    'budget_amount' => $fee,
                    'starts_on' => $startsAgo === null ? null : $today->copy()->subDays($startsAgo)->toDateString(),
                    'due_on' => $dueIn === null ? null : $today->copy()->addDays($dueIn)->toDateString(),
                    'status' => ProjectStatus::Active,
                ]);

                foreach ($memberIndexes as $index) {
                    $project->members()->attach($people[$index]->id, ['role_in_project' => 'worker']);
                }

                $entries += $this->workHistory($organization, $team, $manager, $project, $memberIndexes, $people, $extra, $today);
            }

            $this->leave($organization, $team, $manager, $people, $today);
            $this->overtime($organization, $manager, $people, $today);
            $this->advances($organization, $admin, $people);

            return ['organization' => $organization, 'admin' => $admin, 'entries' => $entries];
        });
    }

    /**
     * Deletes the demo organization, its people and everything they logged.
     *
     * @return int users removed
     */
    public function remove(): int
    {
        $organization = Organization::query()->where('slug', self::SLUG)->first();

        if ($organization === null) {
            return 0;
        }

        return DB::transaction(function () use ($organization) {
            $userIds = User::query()->where('organization_id', $organization->id)->pluck('id');

            DB::table('model_has_roles')->whereIn('model_id', $userIds)->where('model_type', User::class)->delete();
            DB::table('personal_access_tokens')->whereIn('tokenable_id', $userIds)->where('tokenable_type', User::class)->delete();

            // Child rows cascade from organization_id; users are deleted explicitly.
            $organization->delete();
            User::query()->whereIn('id', $userIds)->delete();

            return $userIds->count();
        });
    }

    private function user(Organization $organization, string $name, string $email, UserRole $role, ?string $password = null): User
    {
        $user = User::create([
            'organization_id' => $organization->id,
            'name' => $name,
            'email' => $email,
            // Demo staff can't sign in: their password is random and never shown.
            'password' => Hash::make($password ?? Str::random(40)),
            'role' => $role,
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();

        $membership = OrganizationMember::create([
            'organization_id' => $organization->id,
            'user_id' => $user->id,
            'role' => $role,
            'status' => OrganizationMemberStatus::Active,
            'joined_at' => now()->subMonths(6),
        ]);

        $this->roleSync->syncFromMembership($membership);

        return $user;
    }

    /**
     * Weekday work on a project: mostly timer entries, some approved manual
     * time, and a few manual entries from the last days still awaiting review.
     *
     * @param  list<int>  $memberIndexes
     * @param  list<User>  $people
     */
    private function workHistory(
        Organization $organization,
        Team $team,
        User $manager,
        Project $project,
        array $memberIndexes,
        array $people,
        float $extraHours,
        Carbon $today,
    ): int {
        $count = 0;
        $firstDay = $project->starts_on?->greaterThan($today->copy()->subDays(self::DAYS_OF_HISTORY))
            ? $project->starts_on->copy()
            : $today->copy()->subDays(self::DAYS_OF_HISTORY);

        for ($day = $firstDay->copy(); $day->lt($today); $day->addDay()) {
            if ($day->isWeekend()) {
                continue;
            }

            foreach ($memberIndexes as $index) {
                if (mt_rand(0, 99) < 30) {
                    continue;
                }

                $hours = mt_rand(10, 45) / 10 + $extraHours;
                $seconds = (int) round($hours * 3600);
                $start = $day->copy()->setTime(9 + mt_rand(0, 4), [0, 15, 30, 45][mt_rand(0, 3)]);
                $roll = mt_rand(0, 99);
                $recent = $day->diffInDays($today) <= 3;
                $manual = $roll < 15;

                TimeEntry::create([
                    'user_id' => $people[$index]->id,
                    'organization_id' => $organization->id,
                    'type' => $manual ? TimeEntryType::Manual : TimeEntryType::Tracked,
                    'project_id' => $project->id,
                    'team_id' => $team->id,
                    'manager_id' => $manual ? $manager->id : null,
                    'start_time' => $start,
                    'end_time' => $start->copy()->addSeconds($seconds),
                    'duration' => $seconds,
                    'description' => $manual ? $this->manualReason($project) : null,
                    'source' => $manual ? TimeEntrySource::Employee : null,
                    'status' => $manual
                        ? ($recent ? TimeEntryStatus::Pending : TimeEntryStatus::Approved)
                        : TimeEntryStatus::Stopped,
                    'approved_by' => $manual && ! $recent ? $manager->id : null,
                    'approved_at' => $manual && ! $recent ? $start->copy()->addDay() : null,
                ]);
                $count++;
            }
        }

        return $count;
    }

    private function manualReason(Project $project): string
    {
        $reasons = [
            "Client call with {$project->client_name} — timer wasn't running",
            'Offline design review at the client office',
            'Workshop prep on the train, no internet',
            'Forgot to start the timer after lunch',
            "Weekend fixes requested by {$project->client_name}",
        ];

        return $reasons[mt_rand(0, count($reasons) - 1)];
    }

    /**
     * @param  list<User>  $people
     */
    private function leave(Organization $organization, Team $team, User $manager, array $people, Carbon $today): void
    {
        $days = [
            [0, 12, LeaveCategory::Annual, TimeEntryStatus::Approved],
            [0, 11, LeaveCategory::Annual, TimeEntryStatus::Approved],
            [3, 20, LeaveCategory::Medical, TimeEntryStatus::Approved],
            [5, 33, LeaveCategory::Casual, TimeEntryStatus::Approved],
            [2, -4, LeaveCategory::Annual, TimeEntryStatus::Pending],
            [6, -6, LeaveCategory::Casual, TimeEntryStatus::Pending],
        ];

        foreach ($days as [$index, $daysAgo, $category, $status]) {
            $day = $today->copy()->subDays($daysAgo);
            if ($day->isWeekend()) {
                $day = $day->next(Carbon::MONDAY);
            }
            $start = $day->copy()->setTime(9, 0);

            TimeEntry::create([
                'user_id' => $people[$index]->id,
                'organization_id' => $organization->id,
                'type' => TimeEntryType::Leave,
                'team_id' => $team->id,
                'manager_id' => $manager->id,
                'start_time' => $start,
                'end_time' => $start->copy()->addHours(8),
                'duration' => 8 * 3600,
                'description' => ucfirst($category->value).' leave',
                'is_paid' => true,
                'leave_category' => $category,
                'source' => TimeEntrySource::Employee,
                'status' => $status,
                'approved_by' => $status === TimeEntryStatus::Approved ? $manager->id : null,
                'approved_at' => $status === TimeEntryStatus::Approved ? $start->copy()->subDays(3) : null,
            ]);
        }
    }

    /**
     * @param  list<User>  $people
     */
    private function overtime(Organization $organization, User $manager, array $people, Carbon $today): void
    {
        $brandRefresh = Project::query()->where('organization_id', $organization->id)->where('name', 'Brand Refresh')->value('id');
        $requests = [
            [1, 9, 3, 'Launch-week revisions for Globex', OvertimeRequestStatus::Approved],
            [3, 5, 2, 'Final logo exports before the board meeting', OvertimeRequestStatus::Pending],
            [6, 2, 4, 'Brand guidelines deadline', OvertimeRequestStatus::Pending],
        ];

        foreach ($requests as [$index, $daysAgo, $hours, $reason, $status]) {
            OvertimeRequest::create([
                'organization_id' => $organization->id,
                'user_id' => $people[$index]->id,
                'project_id' => $brandRefresh,
                'manager_id' => $manager->id,
                'work_date' => $today->copy()->subDays($daysAgo)->toDateString(),
                'duration_seconds' => $hours * 3600,
                'reason' => $reason,
                'status' => $status,
                'reviewed_by' => $status === OvertimeRequestStatus::Approved ? $manager->id : null,
                'reviewed_at' => $status === OvertimeRequestStatus::Approved ? now()->subDays($daysAgo - 1) : null,
            ]);
        }
    }

    /**
     * @param  list<User>  $people
     */
    private function advances(Organization $organization, User $admin, array $people): void
    {
        SalaryAdvanceRequest::create([
            'organization_id' => $organization->id,
            'user_id' => $people[3]->id,
            'amount' => 40000,
            'reason' => 'Family wedding expenses',
            'status' => AdvanceRequestStatus::Pending,
        ]);

        SalaryAdvanceRequest::create([
            'organization_id' => $organization->id,
            'user_id' => $people[5]->id,
            'reviewed_by' => $admin->id,
            'amount' => 25000,
            'reason' => 'Medical bill',
            'status' => AdvanceRequestStatus::Approved,
            'reviewed_at' => now()->subDays(6),
        ]);
    }
}
