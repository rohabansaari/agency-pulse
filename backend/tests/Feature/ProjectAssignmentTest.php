<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Team;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectAssignmentTest extends TestCase
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

    public function test_manager_can_assign_and_unassign_employee(): void
    {
        $manager = User::factory()->manager()->create();
        $employee = User::factory()->create(['organization_id' => $manager->organization_id]);
        $project = Project::factory()->create(['organization_id' => $manager->organization_id]);

        $team = Team::factory()->create([
            'organization_id' => $manager->organization_id,
            'manager_id' => $manager->id,
        ]);
        $team->members()->attach($employee->id);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->postJson("/api/v1/projects/{$project->id}/assign", [
                'user_id' => $employee->id,
            ])
            ->assertCreated()
            ->assertJsonPath('assignee.id', $employee->id);

        $this->withHeaders($this->headers($manager))
            ->getJson("/api/v1/projects/{$project->id}/assignees")
            ->assertOk()
            ->assertJsonCount(1);

        $this->withHeaders($this->headers($manager))
            ->deleteJson("/api/v1/projects/{$project->id}/unassign/{$employee->id}")
            ->assertOk();

        $this->assertDatabaseMissing('project_assignments', [
            'project_id' => $project->id,
            'user_id' => $employee->id,
        ]);
    }

    public function test_employee_cannot_assign_users_to_project(): void
    {
        $employee = User::factory()->create();
        $other = User::factory()->create(['organization_id' => $employee->organization_id]);
        $project = Project::factory()->create(['organization_id' => $employee->organization_id]);

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->postJson("/api/v1/projects/{$project->id}/assign", [
                'user_id' => $other->id,
            ])
            ->assertForbidden();
    }

    public function test_employee_only_sees_assigned_projects_via_assignments(): void
    {
        $employee = User::factory()->create();
        $assigned = Project::factory()->create(['organization_id' => $employee->organization_id]);
        Project::factory()->create(['organization_id' => $employee->organization_id]);

        $assigned->members()->attach($employee->id, ['role_in_project' => 'worker']);

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/projects')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $assigned->id);
    }

    public function test_admin_can_bulk_assign_employees(): void
    {
        $admin = User::factory()->admin()->create();
        $employee1 = User::factory()->create(['organization_id' => $admin->organization_id]);
        $employee2 = User::factory()->create(['organization_id' => $admin->organization_id]);
        $project = Project::factory()->create(['organization_id' => $admin->organization_id]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson("/api/v1/projects/{$project->id}/assign-bulk", [
                'user_ids' => [$employee1->id, $employee2->id],
            ])
            ->assertCreated()
            ->assertJsonPath('assigned', 2);

        $this->withHeaders($this->headers($admin))
            ->getJson("/api/v1/projects/{$project->id}/assignees")
            ->assertOk()
            ->assertJsonCount(2);
    }
}
