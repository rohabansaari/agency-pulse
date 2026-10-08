<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PayrollVaultTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
        Mail::fake();
    }

    private function headers(User $user, ?string $payrollPin = null): array
    {
        $headers = ['X-Organization-Id' => (string) $user->organization_id];

        if ($payrollPin !== null) {
            $headers['X-Payroll-Pin'] = $payrollPin;
        }

        return $headers;
    }

    private function initializeVault(User $admin, string $pin = '1234'): void
    {
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/vault/initialize', [
                'payroll_pin' => $pin,
                'payroll_pin_confirmation' => $pin,
            ])
            ->assertCreated();
    }

    public function test_first_employee_creation_requires_payroll_pin(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/team/create-employee', [
                'name' => 'First Employee',
                'email' => 'first@example.com',
                'role' => 'employee',
                'salary_type' => 'hourly',
                'hourly_rate' => 50,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payroll_pin']);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/team/create-employee', [
                'name' => 'First Employee',
                'email' => 'first@example.com',
                'role' => 'employee',
                'salary_type' => 'hourly',
                'hourly_rate' => 50,
                'payroll_pin' => '5678',
                'payroll_pin_confirmation' => '5678',
            ])
            ->assertCreated();

        $organization = Organization::query()->find($admin->organization_id);
        $this->assertNotNull($organization?->payroll_pin_created_at);

        $raw = DB::table('organizations')
            ->where('id', $admin->organization_id)
            ->value('payroll_pin');

        $this->assertNotSame('5678', $raw);
    }

    public function test_salary_status_never_exposes_numeric_salary_values(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/team/create-employee', [
                'name' => 'Employee',
                'email' => 'employee@example.com',
                'role' => 'employee',
                'salary_type' => 'hourly',
                'hourly_rate' => 80,
                'payroll_pin' => '1234',
                'payroll_pin_confirmation' => '1234',
            ])
            ->assertCreated();

        $employee = User::query()->where('email', 'employee@example.com')->first();

        $this->withHeaders($this->headers($admin))
            ->getJson("/api/v1/payroll/salary-contracts/{$employee->id}/status")
            ->assertOk()
            ->assertJsonPath('has_salary', true)
            ->assertJsonPath('salary_type', 'hourly')
            ->assertJsonMissingPath('hourly_rate')
            ->assertJsonMissingPath('monthly_salary');
    }

    public function test_incorrect_pin_does_not_unlock_vault(): void
    {
        $admin = User::factory()->admin()->create();
        $this->initializeVault($admin);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/vault/unlock', [
                'payroll_pin' => '9999',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payroll_pin']);
    }

    public function test_admin_can_view_vault_status(): void
    {
        $admin = User::factory()->admin()->create();
        $this->initializeVault($admin);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/payroll/vault/status')
            ->assertOk()
            ->assertJsonPath('pin_configured', true)
            ->assertJsonPath('vault_unlocked', false)
            ->assertJsonPath('requires_pin_each_access', true);
    }

    public function test_payroll_pin_header_unlocks_financial_endpoints_per_request(): void
    {
        $admin = User::factory()->admin()->create();
        $this->initializeVault($admin);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/payroll/settings')
            ->assertOk()
            ->assertJsonPath('financial_data_masked', true)
            ->assertJsonPath('income_tax_percent', null);

        $this->withHeaders($this->headers($admin, '1234'))
            ->getJson('/api/v1/payroll/settings')
            ->assertOk()
            ->assertJsonPath('financial_data_masked', false);

        // withHeaders() persists across requests; drop the PIN before the locked write.
        $this->flushHeaders();

        $this->withHeaders($this->headers($admin))
            ->patchJson('/api/v1/payroll/settings', ['income_tax_percent' => 5])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payroll_vault']);
    }

    public function test_admin_can_change_payroll_pin(): void
    {
        $admin = User::factory()->admin()->create();
        $this->initializeVault($admin, '1234');

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin, '1234'))
            ->postJson('/api/v1/payroll/vault/change-pin', [
                'current_pin' => '1234',
                'payroll_pin' => '4321',
                'payroll_pin_confirmation' => '4321',
            ])
            ->assertOk();

        $this->withHeaders($this->headers($admin, '4321'))
            ->postJson('/api/v1/payroll/vault/unlock', [
                'payroll_pin' => '4321',
            ])
            ->assertOk();
    }
}
