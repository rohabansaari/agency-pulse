<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectMemberTest extends TestCase
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

    public function test_admin_can_assign_member_to_project(): void
    {
        $admin = User::factory()->admin()->create();
        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);
        $project = Project::factory()->create(['organization_id' => $admin->organization_id]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson("/api/v1/projects/{$project->id}/members", [
                'user_id' => $employee->id,
            ])
            ->assertCreated();

        $this->assertTrue($project->members()->where('users.id', $employee->id)->exists());
    }

    public function test_admin_can_remove_member_from_project(): void
    {
        $admin = User::factory()->admin()->create();
        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);
        $project = Project::factory()->create(['organization_id' => $admin->organization_id]);
        $project->members()->attach($employee->id);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->deleteJson("/api/v1/projects/{$project->id}/members/{$employee->id}")
            ->assertOk();

        $this->assertFalse($project->members()->where('users.id', $employee->id)->exists());
    }
}
