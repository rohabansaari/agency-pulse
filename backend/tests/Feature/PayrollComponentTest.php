<?php

namespace Tests\Feature;

use App\Models\PayrollComponent;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PayrollComponentTest extends TestCase
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

    private function initializeVault(User $admin, string $pin = '1234'): void
    {
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin, $pin))
            ->postJson('/api/v1/payroll/vault/initialize', [
                'payroll_pin' => $pin,
                'payroll_pin_confirmation' => $pin,
            ])
            ->assertCreated();
    }

    public function test_admin_can_crud_payroll_components(): void
    {
        $admin = User::factory()->admin()->create();
        $this->initializeVault($admin);
        Sanctum::actingAs($admin);

        $create = $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/components', [
                'name' => 'Tax',
                'type' => 'deduction',
                'value_mode' => 'percentage',
                'value' => 5,
                'is_active' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('component.name', 'Tax');

        $componentId = $create->json('component.id');

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/payroll/components')
            ->assertOk()
            ->assertJsonCount(1);

        $this->withHeaders($this->headers($admin))
            ->patchJson("/api/v1/payroll/components/{$componentId}", [
                'name' => 'Income Tax',
                'is_active' => false,
            ])
            ->assertOk()
            ->assertJsonPath('component.name', 'Income Tax');

        $this->withHeaders($this->headers($admin))
            ->deleteJson("/api/v1/payroll/components/{$componentId}")
            ->assertOk();

        $this->assertDatabaseMissing('payroll_components', ['id' => $componentId]);
    }

    public function test_component_totals_apply_during_payroll_calculation(): void
    {
        $admin = User::factory()->admin()->create();
        $this->initializeVault($admin);

        PayrollComponent::create([
            'organization_id' => $admin->organization_id,
            'name' => 'Bonus',
            'type' => 'increment',
            'value_mode' => 'fixed',
            'value' => 100,
            'is_active' => true,
        ]);

        PayrollComponent::create([
            'organization_id' => $admin->organization_id,
            'name' => 'Late Penalty',
            'type' => 'deduction',
            'value_mode' => 'fixed',
            'value' => 25,
            'is_active' => true,
        ]);

        $service = app(\App\Services\Payroll\PayrollComponentService::class);
        $totals = $service->totalsForGross(1000, $admin->organization_id);

        $this->assertSame(25.0, $totals['deductions']);
        $this->assertSame(100.0, $totals['increments']);
    }
}
