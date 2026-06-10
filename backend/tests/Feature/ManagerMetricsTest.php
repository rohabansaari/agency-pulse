<?php

namespace Tests\Feature;

use App\Enums\ProjectStatus;
use App\Models\Project;
use App\Models\Team;
use App\Models\User;
use App\Services\Employee\EmployeeDirectoryService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ManagerMetricsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    public function test_manager_project_count_aggregates_unique_projects_across_teams(): void
    {
        $admin = User::factory()->admin()->create();
        $manager = User::factory()->manager()->create(['organization_id' => $admin->organization_id]);
        $employeeA = User::factory()->create(['organization_id' => $admin->organization_id]);
        $employeeB = User::factory()->create(['organization_id' => $admin->organization_id]);

        $teamAlpha = Team::factory()->create([
            'organization_id' => $admin->organization_id,
            'manager_id' => $manager->id,
            'name' => 'Alpha',
        ]);
        $teamBeta = Team::factory()->create([
            'organization_id' => $admin->organization_id,
            'manager_id' => $manager->id,
            'name' => 'Beta',
        ]);

        $teamAlpha->members()->attach([$employeeA->id]);
        $teamBeta->members()->attach([$employeeB->id]);

        $sharedProject = Project::factory()->create([
            'organization_id' => $admin->organization_id,
            'status' => ProjectStatus::Active,
            'name' => 'Shared Client',
        ]);
        $teamOnlyProject = Project::factory()->create([
            'organization_id' => $admin->organization_id,
            'status' => ProjectStatus::Active,
            'name' => 'Alpha Only',
        ]);

        $sharedProject->members()->attach([$employeeA->id, $employeeB->id]);
        $teamOnlyProject->members()->attach([$employeeA->id]);

        $metrics = app(EmployeeDirectoryService::class)->managerMetricsForUser($manager);

        $this->assertSame(2, $metrics['teams_managed']);
        $this->assertSame(2, $metrics['projects_managed']);
        $this->assertSame(2, $metrics['active_employees']);
        $this->assertCount(2, $metrics['managed_projects']);
        $this->assertEqualsCanonicalizing(
            ['Shared Client', 'Alpha Only'],
            collect($metrics['managed_projects'])->pluck('name')->all()
        );
    }

    public function test_manager_profile_includes_team_based_metrics(): void
    {
        $admin = User::factory()->admin()->create();
        $manager = User::factory()->manager()->create(['organization_id' => $admin->organization_id]);
        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);

        $team = Team::factory()->create([
            'organization_id' => $admin->organization_id,
            'manager_id' => $manager->id,
        ]);
        $team->members()->attach([$employee->id]);

        $project = Project::factory()->create([
            'organization_id' => $admin->organization_id,
            'status' => ProjectStatus::Active,
        ]);
        $project->members()->attach([$employee->id]);

        Sanctum::actingAs($admin);

        $this->withHeaders(['X-Organization-Id' => (string) $admin->organization_id])
            ->getJson("/api/v1/team/{$manager->id}/profile")
            ->assertOk()
            ->assertJsonPath('manager_metrics.teams_managed', 1)
            ->assertJsonPath('manager_metrics.projects_managed', 1)
            ->assertJsonPath('manager_metrics.active_employees', 1);
    }
}
