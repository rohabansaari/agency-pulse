<?php

namespace Tests\Feature;

use App\Enums\ProjectStatus;
use App\Enums\UserRole;
use App\Models\Project;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectTest extends TestCase
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

    public function test_admin_can_create_project(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $response = $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/projects', [
                'name' => 'Website Redesign',
                'client_name' => 'Acme Corp',
                'hourly_rate' => 125,
            ]);

        $response->assertCreated()
            ->assertJsonPath('project.name', 'Website Redesign');

        $this->assertDatabaseHas('projects', [
            'name' => 'Website Redesign',
            'organization_id' => $admin->organization_id,
        ]);
    }

    public function test_employee_cannot_create_project(): void
    {
        $employee = User::factory()->create();
        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->postJson('/api/v1/projects', [
                'name' => 'Blocked',
                'client_name' => 'Client',
            ])
            ->assertForbidden();
    }

    public function test_employee_only_sees_assigned_projects(): void
    {
        $employee = User::factory()->create();
        $assigned = Project::factory()->create(['organization_id' => $employee->organization_id]);
        Project::factory()->create(['organization_id' => $employee->organization_id]);

        $assigned->members()->attach($employee->id);

        Sanctum::actingAs($employee);

        $response = $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/projects');

        $response->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $assigned->id);
    }

    public function test_admin_can_archive_project(): void
    {
        $admin = User::factory()->admin()->create();
        $project = Project::factory()->create(['organization_id' => $admin->organization_id]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->patchJson("/api/v1/projects/{$project->id}/status", [
                'status' => ProjectStatus::Archived->value,
            ])
            ->assertOk()
            ->assertJsonPath('project.status', ProjectStatus::Archived->value);
    }

    public function test_manager_can_update_project(): void
    {
        $manager = User::factory()->manager()->create();
        $project = Project::factory()->create(['organization_id' => $manager->organization_id]);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->putJson("/api/v1/projects/{$project->id}", [
                'name' => 'Updated Name',
            ])
            ->assertOk()
            ->assertJsonPath('project.name', 'Updated Name');
    }

    public function test_admin_can_toggle_project_status_active_inactive(): void
    {
        $admin = User::factory()->admin()->create();
        $project = Project::factory()->create([
            'organization_id' => $admin->organization_id,
            'status' => ProjectStatus::Active,
        ]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->patchJson("/api/v1/projects/{$project->id}/status", [
                'status' => ProjectStatus::Inactive->value,
            ])
            ->assertOk()
            ->assertJsonPath('project.status', ProjectStatus::Inactive->value);

        $this->withHeaders($this->headers($admin))
            ->patchJson("/api/v1/projects/{$project->id}/status", [
                'status' => ProjectStatus::Active->value,
            ])
            ->assertOk()
            ->assertJsonPath('project.status', ProjectStatus::Active->value);
    }
}
