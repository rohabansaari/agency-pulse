<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Team;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DashboardTest extends TestCase
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

    public function test_employee_dashboard_returns_assigned_projects(): void
    {
        $employee = User::factory()->create();
        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('role', UserRole::Employee->value)
            ->assertJsonStructure([
                'active_timer',
                'today_total_seconds',
                'week_total_seconds',
                'week_utilization_percent',
                'personal_report',
                'recent_sessions',
                'assigned_projects',
                'team',
            ]);
    }

    public function test_admin_dashboard_returns_org_metrics(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('role', UserRole::Admin->value)
            ->assertJsonStructure([
                'team_count',
                'employee_count',
                'teams',
                'active_projects',
                'active_employees',
                'today_tracked_seconds',
                'week_tracked_seconds',
                'month_tracked_seconds',
                'running_timers',
                'organization_utilization_percent',
                'team_utilization',
            ]);
    }

    public function test_manager_dashboard_returns_team_centric_data(): void
    {
        $manager = User::factory()->manager()->create();
        Team::factory()->create([
            'organization_id' => $manager->organization_id,
            'manager_id' => $manager->id,
            'name' => 'Alpha Team',
        ]);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('role', UserRole::Manager->value)
            ->assertJsonStructure(['teams', 'team_count', 'summary'])
            ->assertJsonPath('team_count', 1)
            ->assertJsonPath('teams.0.team_name', 'Alpha Team');
    }
}
