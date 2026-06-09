<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TenantHttpApiTest extends TestCase
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

    public function test_user_cannot_fetch_foreign_organization_project_via_api(): void
    {
        $userA = User::factory()->admin()->create();
        $userB = User::factory()->admin()->create();

        $foreignProject = Project::factory()->create([
            'organization_id' => $userB->organization_id,
        ]);

        Sanctum::actingAs($userA);

        $this->withHeaders($this->headers($userA))
            ->getJson("/api/v1/projects/{$foreignProject->id}")
            ->assertNotFound();
    }

    public function test_user_cannot_patch_foreign_organization_project(): void
    {
        $userA = User::factory()->admin()->create();
        $userB = User::factory()->admin()->create();

        $foreignProject = Project::factory()->create([
            'organization_id' => $userB->organization_id,
            'name' => 'Foreign Project',
        ]);

        Sanctum::actingAs($userA);

        $this->withHeaders($this->headers($userA))
            ->putJson("/api/v1/projects/{$foreignProject->id}", [
                'name' => 'Hijacked',
            ])
            ->assertNotFound();

        $this->assertDatabaseHas('projects', [
            'id' => $foreignProject->id,
            'name' => 'Foreign Project',
        ]);
    }
}
