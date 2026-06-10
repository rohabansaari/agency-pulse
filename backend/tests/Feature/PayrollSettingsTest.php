<?php

namespace Tests\Feature;

use App\Models\OrganizationPayrollSettings;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PayrollSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    private function headers(User $user, string $pin = '1234'): array
    {
        return [
            'X-Organization-Id' => (string) $user->organization_id,
            'X-Payroll-Pin' => $pin,
        ];
    }

    private function unlockVault(User $admin): void
    {
        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/vault/initialize', [
                'payroll_pin' => '1234',
                'payroll_pin_confirmation' => '1234',
            ])
            ->assertCreated();

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/vault/unlock', ['payroll_pin' => '1234'])
            ->assertOk();
    }

    public function test_admin_can_view_default_payroll_settings(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);
        $this->unlockVault($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/payroll/settings')
            ->assertOk()
            ->assertJsonPath('working_days_per_month', OrganizationPayrollSettings::DEFAULT_WORKING_DAYS_PER_MONTH)
            ->assertJsonPath('working_hours_per_day', OrganizationPayrollSettings::DEFAULT_WORKING_HOURS_PER_DAY)
            ->assertJsonPath('expected_monthly_hours', 176)
            ->assertJsonPath('deduction_mode', 'percentage')
            ->assertJsonPath('income_tax_percent', '0.00');
    }

    public function test_admin_can_update_payroll_settings(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);
        $this->unlockVault($admin);

        $this->withHeaders($this->headers($admin))
            ->patchJson('/api/v1/payroll/settings', [
                'working_days_per_month' => 26,
                'working_hours_per_day' => 9,
                'income_tax_percent' => 10,
                'eobi_percent' => 1,
                'social_security_percent' => 2,
                'custom_deduction_percent' => 0.5,
            ])
            ->assertOk()
            ->assertJsonPath('settings.working_days_per_month', 26)
            ->assertJsonPath('settings.working_hours_per_day', 9)
            ->assertJsonPath('settings.expected_monthly_hours', 234)
            ->assertJsonPath('settings.income_tax_percent', '10.00');

        $this->assertDatabaseHas('organization_payroll_settings', [
            'organization_id' => $admin->organization_id,
            'working_days_per_month' => 26,
            'income_tax_percent' => 10,
        ]);
    }

    public function test_manager_cannot_update_payroll_settings(): void
    {
        $manager = User::factory()->manager()->create();
        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->patchJson('/api/v1/payroll/settings', [
                'income_tax_percent' => 5,
            ])
            ->assertForbidden();
    }

    public function test_fbr_slab_mode_is_rejected_until_implemented(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);
        $this->unlockVault($admin);

        $this->withHeaders($this->headers($admin))
            ->patchJson('/api/v1/payroll/settings', [
                'deduction_mode' => 'fbr_slabs',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['deduction_mode']);
    }
}
