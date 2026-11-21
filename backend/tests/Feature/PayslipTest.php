<?php

namespace Tests\Feature;

use App\Enums\SalaryType;
use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Mail\PayslipReadyMail;
use App\Models\EmployeeSalaryContract;
use App\Models\PayrollRunEmployeeRecord;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PayslipTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
        Mail::fake();
    }

    private function headers(User $user, ?string $pin = null): array
    {
        return array_filter([
            'X-Organization-Id' => (string) $user->organization_id,
            'X-Payroll-Pin' => $pin,
        ]);
    }

    /**
     * Admin with an unlocked payroll vault, an hourly employee (Rs. 100/h) with
     * 3 approved hours this month, 5% income tax, and a draft run for the month.
     *
     * @return array{admin: User, employee: User, runId: int}
     */
    private function draftRun(): array
    {
        $this->travelTo(Carbon::create(2026, 11, 20, 12));

        $admin = User::factory()->admin()->create();
        $employee = User::factory()->employee()->create(['organization_id' => $admin->organization_id]);
        $project = Project::factory()->create(['organization_id' => $admin->organization_id]);

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
            'duration' => 3 * 3600,
            'status' => TimeEntryStatus::Stopped,
            'start_time' => Carbon::today()->setTime(9, 0),
            'end_time' => Carbon::today()->setTime(12, 0),
        ]);

        Sanctum::actingAs($admin);
        $this->withHeaders($this->headers($admin))->postJson('/api/v1/payroll/vault/initialize', [
            'payroll_pin' => '1234',
            'payroll_pin_confirmation' => '1234',
        ])->assertCreated();
        $this->withHeaders($this->headers($admin, '1234'))
            ->patchJson('/api/v1/payroll/settings', ['income_tax_percent' => 5])
            ->assertOk();

        $runId = $this->withHeaders($this->headers($admin, '1234'))->postJson('/api/v1/payroll-runs', [
            'period_start' => '01/11/2026',
            'period_end' => '30/11/2026',
        ])->assertCreated()->json('payroll_run.id');

        return compact('admin', 'employee', 'runId');
    }

    private function finalize(User $admin, int $runId)
    {
        Sanctum::actingAs($admin);

        return $this->withHeaders($this->headers($admin, '1234'))
            ->postJson("/api/v1/payroll-runs/{$runId}/finalize")
            ->assertOk();
    }

    public function test_finalizing_emails_each_employee_a_link_without_amounts(): void
    {
        ['admin' => $admin, 'employee' => $employee, 'runId' => $runId] = $this->draftRun();

        $this->finalize($admin, $runId)->assertJsonPath('payslips_emailed', 1);

        $recordId = PayrollRunEmployeeRecord::query()->where('payroll_run_id', $runId)->value('id');

        Mail::assertSent(PayslipReadyMail::class, function (PayslipReadyMail $mail) use ($employee, $recordId) {
            $html = $mail->render();

            // Gross 300.00 and net 285.00 must not appear (the link itself has port 3000).
            return $mail->hasTo($employee->email)
                && $mail->periodLabel === 'November 2026'
                && str_ends_with($mail->payslipUrl, "/payslips/{$recordId}")
                && ! str_contains($html, '285')
                && ! str_contains($html, '300.00');
        });
    }

    public function test_employee_sees_their_payslip_once_payroll_is_finalized(): void
    {
        ['admin' => $admin, 'employee' => $employee, 'runId' => $runId] = $this->draftRun();

        Sanctum::actingAs($employee);
        $this->withHeaders($this->headers($employee))->getJson('/api/v1/payslips')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->finalize($admin, $runId);
        $recordId = PayrollRunEmployeeRecord::query()->where('payroll_run_id', $runId)->value('id');

        Sanctum::actingAs($employee);
        $this->withHeaders($this->headers($employee))->getJson('/api/v1/payslips')
            ->assertOk()
            ->assertJsonPath('data.0.id', $recordId)
            ->assertJsonPath('data.0.period_label', 'November 2026')
            ->assertJsonPath('data.0.net_pay', 285);

        $payslip = $this->withHeaders($this->headers($employee))->getJson("/api/v1/payslips/{$recordId}")
            ->assertOk()
            ->assertJsonPath('data.employee.name', $employee->name)
            ->assertJsonPath('data.earnings.0.name', 'Hours worked (3 h)')
            ->assertJsonPath('data.total_earnings', 300)
            ->assertJsonPath('data.total_deductions', 15)
            ->assertJsonPath('data.net_pay', 285)
            ->json('data');

        $this->assertContains(['name' => 'Income tax', 'amount' => 15], $payslip['deductions']);
    }

    public function test_draft_payroll_has_no_payslips(): void
    {
        ['employee' => $employee, 'runId' => $runId] = $this->draftRun();
        $recordId = PayrollRunEmployeeRecord::query()->where('payroll_run_id', $runId)->value('id');

        Sanctum::actingAs($employee);
        $this->withHeaders($this->headers($employee))->getJson("/api/v1/payslips/{$recordId}")->assertNotFound();
    }

    public function test_employees_cannot_open_someone_elses_payslip(): void
    {
        ['admin' => $admin, 'runId' => $runId] = $this->draftRun();
        $this->finalize($admin, $runId);
        $recordId = PayrollRunEmployeeRecord::query()->where('payroll_run_id', $runId)->value('id');

        $colleague = User::factory()->employee()->create(['organization_id' => $admin->organization_id]);
        Sanctum::actingAs($colleague);

        $this->withHeaders($this->headers($colleague))->getJson("/api/v1/payslips/{$recordId}")->assertNotFound();
    }

    public function test_admin_needs_the_payroll_pin_to_open_a_payslip(): void
    {
        ['admin' => $admin, 'runId' => $runId] = $this->draftRun();
        $this->finalize($admin, $runId);
        $recordId = PayrollRunEmployeeRecord::query()->where('payroll_run_id', $runId)->value('id');

        $this->withHeaders(['X-Payroll-Pin' => ''])
            ->withHeaders($this->headers($admin))
            ->getJson("/api/v1/payslips/{$recordId}")
            ->assertNotFound();

        $this->withHeaders($this->headers($admin, '1234'))
            ->getJson("/api/v1/payslips/{$recordId}")
            ->assertOk()
            ->assertJsonPath('data.net_pay', 285);
    }

    public function test_payslips_from_another_company_are_not_found(): void
    {
        ['admin' => $admin, 'runId' => $runId] = $this->draftRun();
        $this->finalize($admin, $runId);
        $recordId = PayrollRunEmployeeRecord::query()->where('payroll_run_id', $runId)->value('id');

        $outsider = User::factory()->employee()->create();
        Sanctum::actingAs($outsider);

        $this->withHeaders($this->headers($outsider))->getJson("/api/v1/payslips/{$recordId}")->assertNotFound();
    }
}
