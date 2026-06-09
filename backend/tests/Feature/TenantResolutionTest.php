<?php

namespace Tests\Feature;

use App\Enums\OrganizationStatus;
use App\Models\Organization;
use App\Models\Project;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TenantResolutionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    public function test_tenant_header_scopes_project_queries(): void
    {
        $user = User::factory()->create();
        $ownProject = Project::factory()->create([
            'organization_id' => $user->organization_id,
        ]);
        Project::factory()->create();

        Sanctum::actingAs($user);

        $this->withHeader('X-Organization-Id', (string) $user->organization_id)
            ->postJson('/api/v1/time/start')
            ->assertCreated();

        $this->assertTrue(
            Project::query()->whereKey($ownProject->id)->exists()
        );
    }

    public function test_user_cannot_access_foreign_organization_via_header(): void
    {
        $user = User::factory()->create();
        $foreignOrganization = Organization::factory()->create();

        Sanctum::actingAs($user);

        $this->withHeader('X-Organization-Id', (string) $foreignOrganization->id)
            ->postJson('/api/v1/time/start')
            ->assertForbidden()
            ->assertJsonPath('code', 'TENANT_MISMATCH');
    }

    public function test_suspended_organization_is_blocked(): void
    {
        $user = User::factory()->create();
        Organization::query()
            ->whereKey($user->organization_id)
            ->update(['status' => OrganizationStatus::Suspended->value]);

        Sanctum::actingAs($user);

        $this->withHeader('X-Organization-Id', (string) $user->organization_id)
            ->postJson('/api/v1/time/start')
            ->assertForbidden()
            ->assertJsonPath('code', 'ORG_SUSPENDED');
    }
}
