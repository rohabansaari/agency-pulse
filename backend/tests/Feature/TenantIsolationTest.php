<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    public function test_user_cannot_access_projects_from_another_organization(): void
    {
        $user = User::factory()->create();
        $foreignProject = Project::factory()->create();

        Sanctum::actingAs($user);

        \App\Services\Tenant\TenantContext::set(
            \App\Models\Organization::query()->findOrFail($user->organization_id)
        );

        $this->assertFalse(
            Project::query()->whereKey($foreignProject->id)->exists()
        );

        \App\Services\Tenant\TenantContext::forget();
    }

    public function test_user_only_sees_projects_in_their_organization(): void
    {
        $user = User::factory()->create();
        $ownProject = Project::factory()->create([
            'organization_id' => $user->organization_id,
        ]);
        Project::factory()->create();

        Sanctum::actingAs($user);

        \App\Services\Tenant\TenantContext::set(
            \App\Models\Organization::query()->findOrFail($user->organization_id)
        );

        $projectIds = Project::query()->pluck('id')->all();

        $this->assertSame([$ownProject->id], $projectIds);

        \App\Services\Tenant\TenantContext::forget();
    }
}
