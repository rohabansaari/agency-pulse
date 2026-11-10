<?php

namespace Tests\Feature;

use App\Enums\SalaryType;
use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Models\EmployeeSalaryContract;
use App\Models\Project;
use App\Models\Team;
use App\Models\TimeEntry;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SampleDataTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    /** @var list<User> */
    private array $employees;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);

        $this->admin = User::factory()->admin()->create();
        $orgId = $this->admin->organization_id;
        $this->employees = [
            User::factory()->create(['organization_id' => $orgId, 'name' => 'John Doe']),
            User::factory()->create(['organization_id' => $orgId, 'name' => 'Rachel']),
            User::factory()->create(['organization_id' => $orgId, 'name' => 'Jane Smith']),
        ];
        User::factory()->manager()->create(['organization_id' => $orgId, 'name' => 'Maya Manager']);

        Sanctum::actingAs($this->admin);
    }

    private function headers(?string $pin = null): array
    {
        $headers = ['X-Organization-Id' => (string) $this->admin->organization_id];
        if ($pin) {
            $headers['X-Payroll-Pin'] = $pin;
        }

        return $headers;
    }

    public function test_load_fills_the_company_with_work_for_its_own_employees(): void
    {
        $this->withHeaders($this->headers())->getJson('/api/v1/sample-data')
            ->assertOk()
            ->assertJsonPath('loaded', false)
            ->assertJsonPath('employees', 3);

        $this->withHeaders($this->headers())->postJson('/api/v1/sample-data')
            ->assertCreated()
            ->assertJsonPath('loaded', true);

        $orgId = $this->admin->organization_id;
        $this->assertSame(6, Project::query()->where('organization_id', $orgId)->count());
        $this->assertSame(3, EmployeeSalaryContract::query()->where('organization_id', $orgId)->count());

        $employeeIds = collect($this->employees)->pluck('id');
        $entries = TimeEntry::query()->where('organization_id', $orgId);
        $this->assertGreaterThan(100, (clone $entries)->where('type', TimeEntryType::Tracked)->count());
        $this->assertSame(0, (clone $entries)->whereNotIn('user_id', $employeeIds)->count());
        $this->assertGreaterThan(0, (clone $entries)->where('type', TimeEntryType::Manual)->where('status', TimeEntryStatus::Pending)->count());

        // Unteamed employees joined a sample team led by the existing manager.
        $team = Team::query()->where('organization_id', $orgId)->firstOrFail();
        $this->assertSame(3, $team->members()->count());

        // Every budget status has something to show.
        $statuses = collect($this->profitability()->json('projects'))->pluck('budget.status');
        $this->assertContains('over_budget', $statuses);
        $this->assertContains('on_track', $statuses);
    }

    public function test_dashboard_reports_and_profitability_have_data(): void
    {
        $this->withHeaders($this->headers())->postJson('/api/v1/sample-data')->assertCreated();

        $this->withHeaders($this->headers())->getJson('/api/v1/dashboard')->assertOk();
        $this->withHeaders($this->headers())->getJson('/api/v1/reports/organization')->assertOk();

        $report = $this->profitability();
        $this->assertGreaterThan(0, $report->json('totals.revenue'));
        $this->assertGreaterThan(0, $report->json('totals.cost'));
        $this->assertNotEmpty($report->json('insights'));
    }

    public function test_remove_deletes_only_sample_rows(): void
    {
        $orgId = $this->admin->organization_id;
        $realProject = Project::factory()->create(['organization_id' => $orgId, 'name' => 'Real Client Work']);
        $realEntry = TimeEntry::create([
            'user_id' => $this->employees[0]->id,
            'organization_id' => $orgId,
            'type' => TimeEntryType::Tracked,
            'project_id' => $realProject->id,
            'duration' => 3600,
            'status' => TimeEntryStatus::Stopped,
            'start_time' => now()->subDay(),
            'end_time' => now()->subDay()->addHour(),
        ]);
        $realContract = EmployeeSalaryContract::create([
            'organization_id' => $orgId,
            'user_id' => $this->employees[0]->id,
            'salary_type' => SalaryType::Monthly,
            'monthly_salary' => '99000',
            'effective_from' => '2026-01-01',
            'is_active' => true,
        ]);

        $this->withHeaders($this->headers())->postJson('/api/v1/sample-data')->assertCreated();
        // The employee who already had a contract keeps it; only the other two get sample ones.
        $this->assertSame(3, EmployeeSalaryContract::query()->where('organization_id', $orgId)->count());

        $this->withHeaders($this->headers())->deleteJson('/api/v1/sample-data')
            ->assertOk()
            ->assertJsonPath('loaded', false);

        $this->assertSame(['Real Client Work'], Project::query()->where('organization_id', $orgId)->pluck('name')->all());
        $this->assertSame([$realEntry->id], TimeEntry::query()->where('organization_id', $orgId)->pluck('id')->all());
        $this->assertSame([$realContract->id], EmployeeSalaryContract::query()->where('organization_id', $orgId)->pluck('id')->all());
        $this->assertSame(0, Team::query()->where('organization_id', $orgId)->count());
        $this->assertSame(0, DB::table('sample_data_records')->count());
        $this->assertSame(5, User::query()->where('organization_id', $orgId)->count());
    }

    public function test_cannot_load_twice_or_without_employees(): void
    {
        $this->withHeaders($this->headers())->postJson('/api/v1/sample-data')->assertCreated();
        $this->withHeaders($this->headers())->postJson('/api/v1/sample-data')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['sample_data']);

        $empty = User::factory()->admin()->create();
        Sanctum::actingAs($empty);
        $this->withHeaders(['X-Organization-Id' => (string) $empty->organization_id])
            ->postJson('/api/v1/sample-data')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['sample_data']);
    }

    public function test_works_without_a_manager(): void
    {
        User::query()->where('name', 'Maya Manager')->first()->delete();

        $this->withHeaders($this->headers())->postJson('/api/v1/sample-data')->assertCreated();

        $orgId = $this->admin->organization_id;
        $this->assertSame(0, Team::query()->where('organization_id', $orgId)->count());
        // Without a manager nothing is left waiting for approval.
        $this->assertSame(0, TimeEntry::query()->where('organization_id', $orgId)->where('status', TimeEntryStatus::Pending)->count());
    }

    public function test_only_admins_can_use_it_and_other_companies_are_untouched(): void
    {
        $other = User::factory()->admin()->create();
        User::factory()->create(['organization_id' => $other->organization_id]);

        $this->withHeaders($this->headers())->postJson('/api/v1/sample-data')->assertCreated();
        $this->assertSame(0, Project::query()->where('organization_id', $other->organization_id)->count());

        foreach (['manager', 'subAdmin', 'employee'] as $role) {
            $user = User::factory()->{$role}()->create(['organization_id' => $this->admin->organization_id]);
            Sanctum::actingAs($user);
            $this->withHeaders($this->headers())->deleteJson('/api/v1/sample-data')->assertForbidden();
        }
    }

    private function profitability(): \Illuminate\Testing\TestResponse
    {
        if (! $this->admin->organization->payroll_pin) {
            $this->withHeaders($this->headers())->postJson('/api/v1/payroll/vault/initialize', [
                'payroll_pin' => '1234',
                'payroll_pin_confirmation' => '1234',
            ])->assertCreated();
        }

        return $this->withHeaders($this->headers('1234'))
            ->getJson('/api/v1/reports/profitability')
            ->assertOk();
    }

    public function test_command_loads_sample_data_once_for_the_named_company(): void
    {
        $orgId = $this->admin->organization_id;

        $this->artisan('sample-data:load', ['organization' => (string) $orgId])
            ->expectsOutputToContain('Loaded sample data')
            ->assertExitCode(0);
        $this->assertSame(6, Project::query()->where('organization_id', $orgId)->count());

        // A second run (the next deploy with the flag still set) changes nothing.
        $this->artisan('sample-data:load', ['organization' => (string) $orgId])
            ->expectsOutputToContain('already loaded')
            ->assertExitCode(0);
        $this->assertSame(6, Project::query()->where('organization_id', $orgId)->count());

        $this->artisan('sample-data:load', ['organization' => 'No Such Company'])->assertExitCode(1);
    }

    public function test_sample_data_includes_a_paid_and_an_overdue_invoice_and_removes_them(): void
    {
        $this->withHeaders($this->headers())->postJson('/api/v1/sample-data')->assertCreated();

        $response = $this->withHeaders($this->headers())->getJson('/api/v1/invoices')->assertOk();
        $statuses = collect($response->json('invoices'))->map(fn ($invoice) => $invoice['status'].($invoice['overdue'] ? '+overdue' : ''))->sort()->values()->all();
        $this->assertSame(['paid', 'sent+overdue'], $statuses);
        $this->assertGreaterThan(0, $response->json('summary.unbilled'), 'Recent work is left to invoice.');

        // An invoice made by hand from sample work is removed with the sample data.
        $client = $this->withHeaders($this->headers())->getJson('/api/v1/invoices/unbilled')->json('clients.0.client_name');
        $this->withHeaders($this->headers())->postJson('/api/v1/invoices', ['client_name' => $client])->assertCreated();

        $this->withHeaders($this->headers())->deleteJson('/api/v1/sample-data')->assertOk();
        $this->assertSame([], $this->withHeaders($this->headers())->getJson('/api/v1/invoices')->json('invoices'));
    }
}
