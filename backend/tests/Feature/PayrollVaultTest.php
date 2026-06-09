<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PayrollVaultTest extends TestCase
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

    private function unlockVault(User $admin, string $pin = '1234'): void
    {
        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/vault/unlock', [
                'payroll_pin' => $pin,
            ])
            ->assertOk();
    }

    public function test_first_employee_creation_requires_payroll_pin(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/team/create-employee', [
                'name' => 'First Employee',
                'email' => 'first@example.com',
                'password' => 'password123',
                'salary_type' => 'hourly',
                'hourly_rate' => 50,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payroll_pin']);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/team/create-employee', [
                'name' => 'First Employee',
                'email' => 'first@example.com',
                'password' => 'password123',
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

    public function test_salary_contracts_never_expose_numeric_salary_values(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/team/create-employee', [
                'name' => 'Employee',
                'email' => 'employee@example.com',
                'password' => 'password123',
                'salary_type' => 'hourly',
                'hourly_rate' => 80,
                'payroll_pin' => '1234',
                'payroll_pin_confirmation' => '1234',
            ])
            ->assertCreated();

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/payroll/salary-contracts')
            ->assertOk()
            ->assertJsonPath('contracts.0.hourly_rate', null)
            ->assertJsonPath('contracts.0.monthly_salary', null)
            ->assertJsonPath('contracts.0.has_salary', true)
            ->assertJsonPath('contracts.0.salary_type', 'hourly');

        $this->unlockVault($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/payroll/salary-contracts')
            ->assertOk()
            ->assertJsonPath('contracts.0.hourly_rate', null)
            ->assertJsonPath('contracts.0.monthly_salary', null)
            ->assertJsonPath('contracts.0.has_salary', true);
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
            ->assertJsonPath('vault_unlocked', false);

        $this->unlockVault($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/payroll/vault/status')
            ->assertOk()
            ->assertJsonPath('vault_unlocked', true);
    }

    public function test_admin_can_lock_payroll_vault(): void
    {
        $admin = User::factory()->admin()->create();
        $this->initializeVault($admin);
        $this->unlockVault($admin);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/vault/lock', [])
            ->assertOk()
            ->assertJsonPath('status.vault_unlocked', false);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/payroll/vault/status')
            ->assertOk()
            ->assertJsonPath('vault_unlocked', false);
    }

    public function test_admin_can_change_payroll_pin(): void
    {
        $admin = User::factory()->admin()->create();
        $this->initializeVault($admin, '1234');

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/vault/change-pin', [
                'current_pin' => '1234',
                'payroll_pin' => '4321',
                'payroll_pin_confirmation' => '4321',
            ])
            ->assertOk();

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/vault/unlock', [
                'payroll_pin' => '4321',
            ])
            ->assertOk();
    }
}
