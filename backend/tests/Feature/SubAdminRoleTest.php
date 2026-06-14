<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SubAdminRoleTest extends TestCase
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

    public function test_sub_admin_cannot_access_payroll_runs(): void
    {
        $subAdmin = User::factory()->subAdmin()->create();
        Sanctum::actingAs($subAdmin);

        $this->withHeaders($this->headers($subAdmin))
            ->getJson('/api/v1/payroll-runs')
            ->assertForbidden();
    }

    public function test_sub_admin_cannot_access_payroll_vault_status(): void
    {
        $subAdmin = User::factory()->subAdmin()->create();
        Sanctum::actingAs($subAdmin);

        $this->withHeaders($this->headers($subAdmin))
            ->getJson('/api/v1/payroll/vault/status')
            ->assertForbidden();
    }

    public function test_sub_admin_cannot_create_employees(): void
    {
        $subAdmin = User::factory()->subAdmin()->create();
        Sanctum::actingAs($subAdmin);

        $this->withHeaders($this->headers($subAdmin))
            ->postJson('/api/v1/team/create-employee', [
                'name' => 'Blocked Employee',
                'email' => 'blocked@example.com',
            ])
            ->assertForbidden();
    }

    public function test_sub_admin_can_view_employee_directory(): void
    {
        $subAdmin = User::factory()->subAdmin()->create();
        User::factory()->create(['organization_id' => $subAdmin->organization_id]);

        Sanctum::actingAs($subAdmin);

        $this->withHeaders($this->headers($subAdmin))
            ->getJson('/api/v1/team')
            ->assertOk();
    }

    public function test_sub_admin_can_manage_teams(): void
    {
        $subAdmin = User::factory()->subAdmin()->create();
        Sanctum::actingAs($subAdmin);

        $this->withHeaders($this->headers($subAdmin))
            ->postJson('/api/v1/teams', ['name' => 'Ops Squad'])
            ->assertCreated()
            ->assertJsonPath('team.name', 'Ops Squad');
    }

    public function test_sub_admin_can_view_organization_reports(): void
    {
        $subAdmin = User::factory()->subAdmin()->create();
        Sanctum::actingAs($subAdmin);

        $this->withHeaders($this->headers($subAdmin))
            ->getJson('/api/v1/reports/organization')
            ->assertOk();
    }
}
