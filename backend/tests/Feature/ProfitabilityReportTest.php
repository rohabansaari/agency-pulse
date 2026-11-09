<?php

namespace Tests\Feature;

use App\Enums\ProjectBillingType;
use App\Enums\SalaryType;
use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Models\EmployeeSalaryContract;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProfitabilityReportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
        Mail::fake();
        Carbon::setTestNow(Carbon::parse('2026-11-20 12:00:00'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function headers(User $user, ?string $pin = '1234'): array
    {
        $headers = ['X-Organization-Id' => (string) $user->organization_id];

        if ($pin !== null) {
            $headers['X-Payroll-Pin'] = $pin;
        }

        return $headers;
    }

    private function work(User $user, Project $project, float $hours, string $start, TimeEntryType $type = TimeEntryType::Tracked, TimeEntryStatus $status = TimeEntryStatus::Stopped): void
    {
        $startTime = Carbon::parse($start);

        TimeEntry::create([
            'user_id' => $user->id,
            'organization_id' => $user->organization_id,
            'type' => $type,
            'project_id' => $project->id,
            'duration' => (int) round($hours * 3600),
            'description' => $type === TimeEntryType::Manual ? 'Client workshop' : null,
            'status' => $status,
            'start_time' => $startTime,
            'end_time' => $startTime->copy()->addSeconds((int) round($hours * 3600)),
        ]);
    }

    /**
     * Two employees (hourly Rs. 500, monthly Rs. 176,000 = Rs. 1,000/h over 176h)
     * on an hourly project, a fixed-fee project and an internal project.
     *
     * @return array{admin: User, ali: User, sara: User, alpha: Project, beta: Project, internal: Project}
     */
    private function fixture(): array
    {
        $admin = User::factory()->admin()->create();
        $orgId = $admin->organization_id;
        $ali = User::factory()->create(['organization_id' => $orgId, 'name' => 'Ali']);
        $sara = User::factory()->create(['organization_id' => $orgId, 'name' => 'Sara']);

        EmployeeSalaryContract::create([
            'organization_id' => $orgId,
            'user_id' => $ali->id,
            'salary_type' => SalaryType::Hourly,
            'hourly_rate' => '500',
            'effective_from' => '2026-01-01',
            'is_active' => true,
        ]);

        EmployeeSalaryContract::create([
            'organization_id' => $orgId,
            'user_id' => $sara->id,
            'salary_type' => SalaryType::Monthly,
            'monthly_salary' => '176000',
            'effective_from' => '2026-01-01',
            'is_active' => true,
        ]);

        $alpha = Project::factory()->create([
            'organization_id' => $orgId,
            'name' => 'Alpha Website',
            'client_name' => 'Acme',
            'billing_type' => ProjectBillingType::Hourly,
            'hourly_rate' => 1500,
        ]);

        $beta = Project::factory()->create([
            'organization_id' => $orgId,
            'name' => 'Beta Rebrand',
            'client_name' => 'Globex',
            'billing_type' => ProjectBillingType::Fixed,
            'hourly_rate' => null,
            'budget_amount' => 20000,
            'budget_hours' => 40,
        ]);

        $internal = Project::factory()->create([
            'organization_id' => $orgId,
            'name' => 'Internal Tools',
            'client_name' => 'In-house',
            'billing_type' => ProjectBillingType::NonBillable,
        ]);

        $this->work($ali, $alpha, 10, '2026-11-03 09:00');
        $this->work($sara, $alpha, 5, '2026-11-04 09:00', TimeEntryType::Manual, TimeEntryStatus::Approved);
        // Pending manual time never counts.
        $this->work($sara, $alpha, 5, '2026-11-05 09:00', TimeEntryType::Manual, TimeEntryStatus::Pending);
        // 20h on Beta last month, then 30h this month: only 20h of the 40h budget is left to earn.
        $this->work($sara, $beta, 20, '2026-10-10 09:00');
        $this->work($sara, $beta, 30, '2026-11-10 09:00');
        $this->work($ali, $internal, 2, '2026-11-06 09:00');

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/vault/initialize', [
                'payroll_pin' => '1234',
                'payroll_pin_confirmation' => '1234',
            ])
            ->assertCreated();

        return compact('admin', 'ali', 'sara', 'alpha', 'beta', 'internal');
    }

    public function test_report_computes_revenue_cost_and_margin(): void
    {
        ['admin' => $admin] = $this->fixture();

        $response = $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/reports/profitability?start_date=01/11/2026&end_date=30/11/2026')
            ->assertOk();

        $projects = collect($response->json('projects'))->keyBy('name');

        // Hourly: 15h × 1,500 revenue; 10h × 500 + 5h × 1,000 cost.
        $alpha = $projects['Alpha Website'];
        $this->assertEqualsWithDelta(15, $alpha['hours'], 0.001);
        $this->assertEqualsWithDelta(22500, $alpha['revenue'], 0.01);
        $this->assertEqualsWithDelta(10000, $alpha['cost'], 0.01);
        $this->assertEqualsWithDelta(12500, $alpha['profit'], 0.01);
        $this->assertEqualsWithDelta(55.6, $alpha['margin_percent'], 0.05);

        // Fixed fee 20,000 over 40h: only 20h of this month's 30h still earn (500/h).
        $beta = $projects['Beta Rebrand'];
        $this->assertEqualsWithDelta(30, $beta['hours'], 0.001);
        $this->assertEqualsWithDelta(10000, $beta['revenue'], 0.01);
        $this->assertEqualsWithDelta(30000, $beta['cost'], 0.01);
        $this->assertSame('over_budget', $beta['budget']['status']);
        $this->assertEqualsWithDelta(125, $beta['budget']['burn_percent'], 0.05);

        $internal = $projects['Internal Tools'];
        $this->assertEqualsWithDelta(0, $internal['revenue'], 0.01);
        $this->assertEqualsWithDelta(1000, $internal['cost'], 0.01);
        $this->assertNull($internal['margin_percent']);

        $totals = $response->json('totals');
        $this->assertEqualsWithDelta(32500, $totals['revenue'], 0.01);
        $this->assertEqualsWithDelta(41000, $totals['cost'], 0.01);
        $this->assertEqualsWithDelta(-8500, $totals['profit'], 0.01);
        $this->assertEqualsWithDelta(47, $totals['hours'], 0.001);
        $this->assertEqualsWithDelta(45, $totals['billable_hours'], 0.001);
        $this->assertSame(1, $totals['projects_over_budget']);

        $clients = collect($response->json('clients'))->keyBy('client_name');
        $this->assertEqualsWithDelta(12500, $clients['Acme']['profit'], 0.01);
        $this->assertEqualsWithDelta(-20000, $clients['Globex']['profit'], 0.01);

        // Revenue follows each person's share of hours on a project.
        $employees = collect($response->json('employees'))->keyBy('name');
        $this->assertEqualsWithDelta(15000, $employees['Ali']['revenue'], 0.01);
        $this->assertEqualsWithDelta(6000, $employees['Ali']['cost'], 0.01);
        $this->assertEqualsWithDelta(17500, $employees['Sara']['revenue'], 0.01);
        $this->assertEqualsWithDelta(35000, $employees['Sara']['cost'], 0.01);
        $this->assertEqualsWithDelta(1000, $employees['Sara']['cost_per_hour'], 0.01);

        $titles = collect($response->json('insights'))->pluck('title');
        $this->assertContains('Beta Rebrand is over budget', $titles);
        $this->assertContains('Globex is losing money', $titles);
        // Internal work is overhead, not a losing client.
        $this->assertNotContains('In-house is losing money', $titles);
        $this->assertTrue($clients['In-house']['internal']);
        $this->assertContains('Alpha Website is your most profitable project', $titles);
    }

    public function test_hours_without_a_salary_contract_are_flagged(): void
    {
        ['admin' => $admin, 'alpha' => $alpha] = $this->fixture();
        $newHire = User::factory()->create(['organization_id' => $admin->organization_id, 'name' => 'New Hire']);
        $this->work($newHire, $alpha, 4, '2026-11-12 09:00');

        $response = $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/reports/profitability?start_date=01/11/2026&end_date=30/11/2026')
            ->assertOk();

        $this->assertEqualsWithDelta(4, $response->json('totals.unpriced_hours'), 0.001);
        $employee = collect($response->json('employees'))->firstWhere('name', 'New Hire');
        $this->assertFalse($employee['has_salary_contract']);
        $this->assertNull($employee['cost_per_hour']);
        $this->assertContains('Some hours have no salary cost', collect($response->json('insights'))->pluck('title'));
    }

    public function test_budget_forecast_flags_projects_running_out_before_due_date(): void
    {
        ['admin' => $admin, 'ali' => $ali] = $this->fixture();

        $gamma = Project::factory()->create([
            'organization_id' => $admin->organization_id,
            'name' => 'Gamma App',
            'client_name' => 'Initech',
            'hourly_rate' => 2000,
            'budget_hours' => 100,
            'starts_on' => '2026-11-01',
            'due_on' => '2026-12-31',
        ]);

        // 28h in the last 14 days = 2h/day; 72h left lasts 36 days (26 Dec), before 31 Dec.
        $this->work($ali, $gamma, 28, '2026-11-15 09:00');

        $response = $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/reports/profitability?start_date=01/11/2026&end_date=30/11/2026')
            ->assertOk();

        $budget = collect($response->json('projects'))->firstWhere('name', 'Gamma App')['budget'];
        $this->assertSame('at_risk', $budget['status']);
        $this->assertSame('2026-12-26', $budget['forecast_exhausted_on']);
        $this->assertEqualsWithDelta(28, $budget['burn_percent'], 0.05);
    }

    public function test_report_requires_payroll_pin(): void
    {
        ['admin' => $admin] = $this->fixture();

        // withHeaders() persists across requests, so drop the PIN the fixture sent.
        $this->withoutHeader('X-Payroll-Pin')
            ->withHeaders($this->headers($admin, null))
            ->getJson('/api/v1/reports/profitability')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payroll_vault']);
    }

    public function test_only_admins_can_view_profitability(): void
    {
        ['admin' => $admin] = $this->fixture();

        foreach (['manager', 'subAdmin', 'employee'] as $role) {
            $user = User::factory()->{$role}()->create(['organization_id' => $admin->organization_id]);
            Sanctum::actingAs($user);

            $this->withHeaders($this->headers($user))
                ->getJson('/api/v1/reports/profitability')
                ->assertForbidden();
        }
    }

    public function test_admin_can_set_budget_fields_and_managers_cannot_set_fees(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $project = $this->withHeaders($this->headers($admin, null))
            ->postJson('/api/v1/projects', [
                'name' => 'Launch Campaign',
                'client_name' => 'Hooli',
                'billing_type' => 'fixed',
                'budget_amount' => 250000,
                'budget_hours' => 120,
                'starts_on' => '2026-11-01',
                'due_on' => '2026-12-15',
            ])
            ->assertCreated()
            ->assertJsonPath('project.billing_type', 'fixed')
            ->assertJsonPath('project.budget_hours', '120.00')
            ->assertJsonPath('project.budget_amount', '250000.00')
            ->assertJsonPath('project.due_on', '2026-12-15')
            ->json('project');

        $manager = User::factory()->manager()->create(['organization_id' => $admin->organization_id]);
        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager, null))
            ->putJson("/api/v1/projects/{$project['id']}", ['budget_hours' => 150])
            ->assertOk()
            ->assertJsonPath('project.budget_hours', '150.00')
            ->assertJsonMissingPath('project.budget_amount');

        $this->withHeaders($this->headers($manager, null))
            ->putJson("/api/v1/projects/{$project['id']}", ['budget_amount' => 1])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['budget_amount']);
    }

    public function test_due_date_cannot_be_before_start_date(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin, null))
            ->postJson('/api/v1/projects', [
                'name' => 'Backwards',
                'client_name' => 'Hooli',
                'starts_on' => '2026-12-01',
                'due_on' => '2026-11-01',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['due_on']);
    }
}
