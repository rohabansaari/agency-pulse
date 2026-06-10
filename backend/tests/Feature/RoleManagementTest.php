<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\OrganizationMember;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RoleManagementTest extends TestCase
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

    public function test_admin_can_change_employee_role_to_manager(): void
    {
        $admin = User::factory()->admin()->create();
        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);
        $membership = OrganizationMember::query()
            ->where('user_id', $employee->id)
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->patchJson("/api/v1/team/{$membership->id}", [
                'role' => UserRole::Manager->value,
            ])
            ->assertOk()
            ->assertJsonPath('member.role', UserRole::Manager->value);
    }

    public function test_admin_can_change_manager_role_to_employee(): void
    {
        $admin = User::factory()->admin()->create();
        $manager = User::factory()->manager()->create(['organization_id' => $admin->organization_id]);
        $membership = OrganizationMember::query()
            ->where('user_id', $manager->id)
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->patchJson("/api/v1/team/{$membership->id}", [
                'role' => UserRole::Employee->value,
            ])
            ->assertOk()
            ->assertJsonPath('member.role', UserRole::Employee->value);
    }

    public function test_sub_admin_cannot_change_employee_role(): void
    {
        $subAdmin = User::factory()->subAdmin()->create();
        $employee = User::factory()->create(['organization_id' => $subAdmin->organization_id]);
        $membership = OrganizationMember::query()
            ->where('user_id', $employee->id)
            ->firstOrFail();

        Sanctum::actingAs($subAdmin);

        $this->withHeaders($this->headers($subAdmin))
            ->patchJson("/api/v1/team/{$membership->id}", [
                'role' => UserRole::Manager->value,
            ])
            ->assertForbidden();
    }

    public function test_admin_cannot_change_own_role(): void
    {
        $admin = User::factory()->admin()->create();
        $membership = OrganizationMember::query()
            ->where('user_id', $admin->id)
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->patchJson("/api/v1/team/{$membership->id}", [
                'role' => UserRole::Employee->value,
            ])
            ->assertForbidden();
    }

    public function test_admin_cannot_change_sub_admin_role_after_creation(): void
    {
        $admin = User::factory()->admin()->create();
        $subAdmin = User::factory()->subAdmin()->create(['organization_id' => $admin->organization_id]);
        $membership = OrganizationMember::query()
            ->where('user_id', $subAdmin->id)
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->patchJson("/api/v1/team/{$membership->id}", [
                'role' => UserRole::Employee->value,
            ])
            ->assertForbidden();
    }

    public function test_admin_cannot_promote_employee_to_sub_admin_after_creation(): void
    {
        $admin = User::factory()->admin()->create();
        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);
        $membership = OrganizationMember::query()
            ->where('user_id', $employee->id)
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->patchJson("/api/v1/team/{$membership->id}", [
                'role' => UserRole::SubAdmin->value,
            ])
            ->assertForbidden();
    }

    public function test_role_is_required_when_creating_employee(): void
    {
        $admin = User::factory()->admin()->create();

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/team/create-employee', [
                'name' => 'Missing Role',
                'email' => 'missing-role@example.com',
                'password' => 'Password1!',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['role']);
    }

    public function test_sub_admin_can_update_employee_status(): void
    {
        $subAdmin = User::factory()->subAdmin()->create();
        $employee = User::factory()->create(['organization_id' => $subAdmin->organization_id]);
        $membership = OrganizationMember::query()
            ->where('user_id', $employee->id)
            ->firstOrFail();

        Sanctum::actingAs($subAdmin);

        $this->withHeaders($this->headers($subAdmin))
            ->patchJson("/api/v1/team/{$membership->id}", [
                'status' => 'suspended',
            ])
            ->assertOk()
            ->assertJsonPath('member.status', 'suspended');
    }

    public function test_admin_can_assign_role_when_creating_employee(): void
    {
        $admin = User::factory()->admin()->create();

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/team/create-employee', [
                'name' => 'New Manager',
                'email' => 'manager@example.com',
                'password' => 'Password1!',
                'role' => UserRole::Manager->value,
            ])
            ->assertCreated()
            ->assertJsonPath('member.role', UserRole::Manager->value);
    }

    public function test_admin_can_assign_sub_admin_at_creation_only(): void
    {
        $admin = User::factory()->admin()->create();

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/team/create-employee', [
                'name' => 'Ops Lead',
                'email' => 'ops@example.com',
                'password' => 'Password1!',
                'role' => UserRole::SubAdmin->value,
            ])
            ->assertCreated()
            ->assertJsonPath('member.role', UserRole::SubAdmin->value);
    }
}
