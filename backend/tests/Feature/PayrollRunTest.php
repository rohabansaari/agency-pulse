<?php

namespace Tests\Feature;

use App\Enums\PayrollRunStatus;
use App\Enums\TimeEntrySource;
use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Models\AuditLog;
use App\Enums\SalaryType;
use App\Models\EmployeeSalaryContract;
use App\Enums\OvertimeRequestStatus;
use App\Models\OrganizationPayrollSettings;
use App\Models\OvertimeRequest;
use App\Models\PayrollRun;
use App\Models\Project;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Reporting\UtilizationCalculator;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PayrollRunTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    private function headers(User $user): array
    {
        return ['X-Organization-Id' => (string) $user->organization_id];
    }

    private function displayDate(Carbon $date): string
    {
        return $date->format('d/m/Y');
    }

    /**
     * @return array{admin: User, employee: User, project: Project}
     */
    private function setupPayrollFixture(): array
    {
        $admin = User::factory()->admin()->create();
        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);
        $project = Project::factory()->create([
            'organization_id' => $admin->organization_id,
            'hourly_rate' => 100,
        ]);
        $project->members()->attach($employee->id, ['role_in_project' => 'worker']);

        $team = Team::factory()->create([
            'organization_id' => $admin->organization_id,
            'manager_id' => User::factory()->manager()->create(['organization_id' => $admin->organization_id])->id,
        ]);
        $team->members()->attach($employee->id);

        EmployeeSalaryContract::create([
            'organization_id' => $admin->organization_id,
            'user_id' => $employee->id,
            'salary_type' => SalaryType::Hourly,
            'hourly_rate' => '100',
            'effective_from' => Carbon::today()->subMonth(),
            'is_active' => true,
        ]);

        TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $admin->organization_id,
            'type' => TimeEntryType::Tracked,
            'project_id' => $project->id,
            'duration' => 3600,
            'status' => TimeEntryStatus::Stopped,
            'start_time' => Carbon::today()->addHours(9),
            'end_time' => Carbon::today()->addHours(10),
        ]);

        TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $admin->organization_id,
            'type' => TimeEntryType::Manual,
            'project_id' => $project->id,
            'duration' => 1800,
            'description' => 'Approved manual',
            'status' => TimeEntryStatus::Approved,
            'start_time' => Carbon::today()->addHours(11),
            'end_time' => Carbon::today()->addHours(11)->addMinutes(30),
        ]);

        TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $admin->organization_id,
            'type' => TimeEntryType::Leave,
            'duration' => UtilizationCalculator::SECONDS_PER_WORK_DAY,
            'description' => 'Approved leave',
            'is_paid' => true,
            'source' => TimeEntrySource::Manager,
            'status' => TimeEntryStatus::Approved,
            'start_time' => Carbon::today()->addDay()->startOfDay(),
            'end_time' => Carbon::today()->addDay()->addHours(8),
        ]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/vault/initialize', [
                'payroll_pin' => '1234',
                'payroll_pin_confirmation' => '1234',
            ])
            ->assertCreated();

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/vault/unlock', ['payroll_pin' => '1234'])
            ->assertOk();

        return compact('admin', 'employee', 'project');
    }

    public function test_admin_can_list_payroll_runs(): void
    {
        ['admin' => $admin] = $this->setupPayrollFixture();

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll-runs', [
                'period_start' => $this->displayDate(Carbon::today()),
                'period_end' => $this->displayDate(Carbon::today()->addDay()),
            ])
            ->assertCreated();

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/payroll-runs')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.status', PayrollRunStatus::Draft->value)
            ->assertJsonPath('0.total_pay_snapshot', '950.00');
    }

    public function test_admin_can_view_payroll_run_with_employee_records(): void
    {
        ['admin' => $admin, 'employee' => $employee] = $this->setupPayrollFixture();

        $create = $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll-runs', [
                'period_start' => $this->displayDate(Carbon::today()),
                'period_end' => $this->displayDate(Carbon::today()->addDay()),
            ])
            ->assertCreated();

        $runId = $create->json('payroll_run.id');

        $this->withHeaders($this->headers($admin))
            ->getJson("/api/v1/payroll-runs/{$runId}")
            ->assertOk()
            ->assertJsonPath('id', $runId)
            ->assertJsonPath('employee_records.0.user_id', $employee->id)
            ->assertJsonPath('employee_records.0.gross_salary_snapshot', '950.00')
            ->assertJsonCount(3, 'entries');
    }

    public function test_payroll_financial_data_masked_when_vault_locked(): void
    {
        ['admin' => $admin] = $this->setupPayrollFixture();

        $create = $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll-runs', [
                'period_start' => $this->displayDate(Carbon::today()),
                'period_end' => $this->displayDate(Carbon::today()),
            ])
            ->assertCreated();

        $runId = $create->json('payroll_run.id');

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/vault/lock', [])
            ->assertOk();

        $this->withHeaders($this->headers($admin))
            ->getJson("/api/v1/payroll-runs/{$runId}")
            ->assertOk()
            ->assertJsonPath('financial_data_masked', true)
            ->assertJsonPath('total_pay_snapshot', null)
            ->assertJsonPath('employee_records.0.gross_salary_snapshot', null);
    }

    public function test_admin_can_create_payroll_run_snapshot(): void
    {
        ['admin' => $admin] = $this->setupPayrollFixture();

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll-runs', [
                'period_start' => $this->displayDate(Carbon::today()),
                'period_end' => $this->displayDate(Carbon::today()->addDay()),
            ])
            ->assertCreated()
            ->assertJsonPath('payroll_run.status', PayrollRunStatus::Draft->value)
            ->assertJsonPath('payroll_run.total_hours_snapshot', 3600 + 1800 + UtilizationCalculator::SECONDS_PER_WORK_DAY)
            ->assertJsonPath('payroll_run.total_pay_snapshot', '950.00')
            ->assertJsonPath('payroll_run.total_net_snapshot', '950.00');

        $this->assertDatabaseHas('payroll_runs', [
            'organization_id' => $admin->organization_id,
            'status' => PayrollRunStatus::Draft->value,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'organization_id' => $admin->organization_id,
            'event' => 'payroll_run.created',
        ]);
    }

    public function test_payroll_run_creates_employee_records_with_deductions(): void
    {
        ['admin' => $admin, 'employee' => $employee] = $this->setupPayrollFixture();

        $this->withHeaders($this->headers($admin))
            ->patchJson('/api/v1/payroll/settings', [
                'income_tax_percent' => 10,
                'eobi_percent' => 1,
                'social_security_percent' => 2,
                'custom_deduction_percent' => 0.5,
            ])
            ->assertOk();

        $response = $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll-runs', [
                'period_start' => $this->displayDate(Carbon::today()),
                'period_end' => $this->displayDate(Carbon::today()->addDay()),
            ])
            ->assertCreated();

        $gross = 950.0;
        $incomeTax = round($gross * 0.10, 2);
        $eobi = round($gross * 0.01, 2);
        $social = round($gross * 0.02, 2);
        $custom = round($gross * 0.005, 2);
        $net = round($gross - $incomeTax - $eobi - $social - $custom, 2);

        $response
            ->assertJsonPath('payroll_run.total_pay_snapshot', number_format($gross, 2, '.', ''))
            ->assertJsonPath('payroll_run.total_net_snapshot', number_format($net, 2, '.', ''));

        $this->assertDatabaseHas('payroll_run_employee_records', [
            'user_id' => $employee->id,
            'gross_salary_snapshot' => number_format($gross, 2, '.', ''),
            'income_tax_snapshot' => number_format($incomeTax, 2, '.', ''),
            'net_salary_snapshot' => number_format($net, 2, '.', ''),
        ]);
    }

    public function test_finalized_payroll_employee_records_remain_unchanged(): void
    {
        ['admin' => $admin] = $this->setupPayrollFixture();

        $this->withHeaders($this->headers($admin))
            ->patchJson('/api/v1/payroll/settings', ['income_tax_percent' => 5])
            ->assertOk();

        $create = $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll-runs', [
                'period_start' => $this->displayDate(Carbon::today()),
                'period_end' => $this->displayDate(Carbon::today()->addDay()),
            ])
            ->assertCreated();

        $runId = $create->json('payroll_run.id');
        $record = \App\Models\PayrollRunEmployeeRecord::query()->where('payroll_run_id', $runId)->firstOrFail();
        $snapshotTax = $record->income_tax_snapshot;

        $this->withHeaders($this->headers($admin))
            ->postJson("/api/v1/payroll-runs/{$runId}/finalize")
            ->assertOk();

        $this->withHeaders($this->headers($admin))
            ->patchJson('/api/v1/payroll/settings', ['income_tax_percent' => 50])
            ->assertOk();

        $record->refresh();
        $this->assertSame((string) $snapshotTax, (string) $record->income_tax_snapshot);
    }

    public function test_monthly_salary_contract_calculates_proportional_pay_from_hourly_base(): void
    {
        ['admin' => $admin, 'employee' => $employee, 'project' => $project] = $this->setupPayrollFixture();

        $contract = EmployeeSalaryContract::query()->where('user_id', $employee->id)->firstOrFail();
        $contract->update([
            'salary_type' => SalaryType::Monthly,
            'hourly_rate' => null,
            'monthly_salary' => '100000',
        ]);

        TimeEntry::query()->where('user_id', $employee->id)->delete();

        TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $admin->organization_id,
            'type' => TimeEntryType::Tracked,
            'project_id' => $project->id,
            'duration' => 4500,
            'status' => TimeEntryStatus::Stopped,
            'start_time' => Carbon::today()->addHours(9),
            'end_time' => Carbon::today()->addHours(10)->addMinutes(15),
        ]);

        $expectedPay = round((4500 / 3600) * (100000 / 176), 2);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll-runs', [
                'period_start' => $this->displayDate(Carbon::today()),
                'period_end' => $this->displayDate(Carbon::today()),
            ])
            ->assertCreated()
            ->assertJsonPath('payroll_run.total_hours_snapshot', 4500)
            ->assertJsonPath('payroll_run.total_pay_snapshot', number_format($expectedPay, 2, '.', ''));
    }

    public function test_manager_cannot_create_payroll_run(): void
    {
        $manager = User::factory()->manager()->create();

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->postJson('/api/v1/payroll-runs', [
                'period_start' => $this->displayDate(Carbon::today()),
                'period_end' => $this->displayDate(Carbon::today()),
            ])
            ->assertForbidden();
    }

    public function test_finalize_and_lock_payroll_run_lifecycle(): void
    {
        ['admin' => $admin] = $this->setupPayrollFixture();

        Sanctum::actingAs($admin);

        $create = $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll-runs', [
                'period_start' => $this->displayDate(Carbon::today()),
                'period_end' => $this->displayDate(Carbon::today()->addDay()),
            ])
            ->assertCreated();

        $runId = $create->json('payroll_run.id');

        $this->withHeaders($this->headers($admin))
            ->postJson("/api/v1/payroll-runs/{$runId}/finalize")
            ->assertOk()
            ->assertJsonPath('payroll_run.status', PayrollRunStatus::Finalized->value);

        $this->withHeaders($this->headers($admin))
            ->postJson("/api/v1/payroll-runs/{$runId}/lock")
            ->assertOk()
            ->assertJsonPath('payroll_run.status', PayrollRunStatus::Locked->value);

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'payroll_run.finalized',
            'auditable_id' => $runId,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'event' => 'payroll_run.locked',
            'auditable_id' => $runId,
        ]);
    }

    public function test_finalized_payroll_blocks_leave_updates_in_period(): void
    {
        ['admin' => $admin, 'employee' => $employee] = $this->setupPayrollFixture();
        $manager = User::factory()->manager()->create(['organization_id' => $admin->organization_id]);

        $team = Team::query()->where('organization_id', $admin->organization_id)->first();
        $team->update(['manager_id' => $manager->id]);

        $entry = TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $admin->organization_id,
            'type' => TimeEntryType::Leave,
            'team_id' => $team->id,
            'manager_id' => $manager->id,
            'duration' => UtilizationCalculator::SECONDS_PER_WORK_DAY,
            'is_paid' => true,
            'source' => TimeEntrySource::Employee,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHours(8),
        ]);

        Sanctum::actingAs($admin);
        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll-runs', [
                'period_start' => $this->displayDate(Carbon::today()),
                'period_end' => $this->displayDate(Carbon::today()),
            ])
            ->assertCreated();

        $run = PayrollRun::query()->first();
        $this->withHeaders($this->headers($admin))
            ->postJson("/api/v1/payroll-runs/{$run->id}/finalize")
            ->assertOk();

        Sanctum::actingAs($manager);
        $this->withHeaders($this->headers($manager))
            ->postJson("/api/v1/time/leave/{$entry->id}/approve")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payroll_period']);
    }

    public function test_admin_can_unlock_payroll_and_allow_edits_again(): void
    {
        ['admin' => $admin, 'employee' => $employee] = $this->setupPayrollFixture();
        $manager = User::factory()->manager()->create(['organization_id' => $admin->organization_id]);
        $team = Team::query()->where('organization_id', $admin->organization_id)->first();
        $team->update(['manager_id' => $manager->id]);

        $entry = TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $admin->organization_id,
            'type' => TimeEntryType::Leave,
            'team_id' => $team->id,
            'manager_id' => $manager->id,
            'duration' => UtilizationCalculator::SECONDS_PER_WORK_DAY,
            'is_paid' => true,
            'source' => TimeEntrySource::Employee,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHours(8),
        ]);

        Sanctum::actingAs($admin);
        $create = $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll-runs', [
                'period_start' => $this->displayDate(Carbon::today()),
                'period_end' => $this->displayDate(Carbon::today()),
            ])
            ->assertCreated();

        $runId = $create->json('payroll_run.id');

        $this->withHeaders($this->headers($admin))
            ->postJson("/api/v1/payroll-runs/{$runId}/finalize")
            ->assertOk();

        $this->withHeaders($this->headers($admin))
            ->postJson("/api/v1/payroll-runs/{$runId}/unlock")
            ->assertOk()
            ->assertJsonPath('payroll_run.status', PayrollRunStatus::Draft->value);

        Sanctum::actingAs($manager);
        $this->withHeaders($this->headers($manager))
            ->postJson("/api/v1/time/leave/{$entry->id}/approve")
            ->assertOk();
    }

    public function test_approved_overtime_included_in_payroll_snapshot(): void
    {
        ['admin' => $admin, 'employee' => $employee, 'project' => $project] = $this->setupPayrollFixture();

        OrganizationPayrollSettings::query()->updateOrCreate(
            ['organization_id' => $admin->organization_id],
            [
                'overtime_enabled' => true,
                'overtime_rate_percentage' => 150,
            ]
        );

        $managerId = Team::query()
            ->where('organization_id', $admin->organization_id)
            ->value('manager_id');

        OvertimeRequest::create([
            'organization_id' => $admin->organization_id,
            'user_id' => $employee->id,
            'project_id' => $project->id,
            'manager_id' => $managerId,
            'work_date' => Carbon::today(),
            'duration_seconds' => 3600,
            'reason' => 'Release support',
            'status' => OvertimeRequestStatus::Approved,
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
        ]);

        OvertimeRequest::create([
            'organization_id' => $admin->organization_id,
            'user_id' => $employee->id,
            'project_id' => $project->id,
            'manager_id' => $managerId,
            'work_date' => Carbon::today(),
            'duration_seconds' => 1800,
            'reason' => 'Pending should be excluded',
            'status' => OvertimeRequestStatus::Pending,
        ]);

        $create = $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll-runs', [
                'period_start' => $this->displayDate(Carbon::today()),
                'period_end' => $this->displayDate(Carbon::today()->addDay()),
            ])
            ->assertCreated();

        $runId = $create->json('payroll_run.id');

        $this->withHeaders($this->headers($admin))
            ->getJson("/api/v1/payroll-runs/{$runId}")
            ->assertOk()
            ->assertJsonPath('employee_records.0.regular_hours_seconds', 3600 + 1800 + UtilizationCalculator::SECONDS_PER_WORK_DAY)
            ->assertJsonPath('employee_records.0.overtime_hours_seconds', 3600)
            ->assertJsonPath('employee_records.0.regular_pay_snapshot', '950.00')
            ->assertJsonPath('employee_records.0.overtime_pay_snapshot', '150.00')
            ->assertJsonPath('employee_records.0.overtime_rate_percent_snapshot', '150.00')
            ->assertJsonPath('employee_records.0.gross_salary_snapshot', '1100.00')
            ->assertJsonPath('total_pay_snapshot', '1100.00');
    }
}
