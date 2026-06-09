<?php

namespace Tests\Feature;

use App\Enums\SalaryType;
use App\Models\EmployeeSalaryContract;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SalaryContractTest extends TestCase
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

    private function employeePayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'New Employee',
            'email' => 'employee@example.com',
            'password' => 'password123',
            'salary_type' => SalaryType::Hourly->value,
            'hourly_rate' => 75,
            'payroll_pin' => '1234',
            'payroll_pin_confirmation' => '1234',
        ], $overrides);
    }

    public function test_admin_must_assign_salary_when_creating_employee(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/team/create-employee', [
                'name' => 'No Salary',
                'email' => 'nosalary@example.com',
                'password' => 'password123',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['salary_type']);
    }

    public function test_admin_can_create_employee_with_hourly_salary_contract(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/team/create-employee', $this->employeePayload())
            ->assertCreated();

        $employee = User::query()->where('email', 'employee@example.com')->first();
        $this->assertNotNull($employee);

        $contract = EmployeeSalaryContract::query()
            ->where('user_id', $employee->id)
            ->where('is_active', true)
            ->first();

        $this->assertNotNull($contract);
        $this->assertSame(SalaryType::Hourly, $contract->salary_type);
        $this->assertSame('75', (string) $contract->hourly_rate);

        $raw = DB::table('employee_salary_contracts')
            ->where('id', $contract->id)
            ->value('hourly_rate');

        $this->assertNotSame('75', $raw);
    }

    public function test_salary_update_versions_contract_instead_of_overwriting(): void
    {
        $admin = User::factory()->admin()->create();

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/team/create-employee', $this->employeePayload([
                'email' => 'versioned@example.com',
            ]));

        $employee = User::query()->where('email', 'versioned@example.com')->first();
        $original = EmployeeSalaryContract::query()->where('user_id', $employee->id)->first();

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/vault/unlock', ['payroll_pin' => '1234'])
            ->assertOk();

        $this->withHeaders($this->headers($admin))
            ->postJson("/api/v1/payroll/salary-contracts/{$employee->id}", [
                'salary_type' => SalaryType::Hourly->value,
                'hourly_rate' => 95,
                'effective_from' => now()->addDay()->format('d/m/Y'),
            ])
            ->assertCreated()
            ->assertJsonPath('contract.hourly_rate', '95.00');

        $original->refresh();
        $this->assertFalse($original->is_active);
        $this->assertNotNull($original->effective_to);

        $this->assertDatabaseHas('employee_salary_contracts', [
            'user_id' => $employee->id,
            'is_active' => true,
        ]);

        $this->assertSame(2, EmployeeSalaryContract::query()->where('user_id', $employee->id)->count());
    }

    public function test_manager_cannot_access_salary_contracts(): void
    {
        $manager = User::factory()->manager()->create();
        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->getJson('/api/v1/payroll/salary-contracts')
            ->assertForbidden();
    }
}
