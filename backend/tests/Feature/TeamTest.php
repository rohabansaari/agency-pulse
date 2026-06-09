<?php

namespace Tests\Feature;

use App\Enums\OrganizationMemberStatus;
use App\Enums\UserRole;
use App\Models\OrganizationMember;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TeamTest extends TestCase
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

    public function test_admin_can_list_team(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/team')
            ->assertOk()
            ->assertJsonStructure([['id', 'name', 'email', 'role', 'status']]);
    }

    public function test_employee_cannot_access_team(): void
    {
        $employee = User::factory()->create();
        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/team')
            ->assertForbidden();
    }

    public function test_manager_cannot_list_org_employee_roster(): void
    {
        $manager = User::factory()->manager()->create();
        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->getJson('/api/v1/team')
            ->assertForbidden();
    }

    public function test_admin_can_invite_employee(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/team/invite', [
                'name' => 'New Hire',
                'email' => 'hire@example.com',
                'role' => UserRole::Employee->value,
            ])
            ->assertCreated()
            ->assertJsonPath('member.email', 'hire@example.com');

        $this->assertDatabaseHas('users', ['email' => 'hire@example.com']);
        $this->assertDatabaseHas('organization_members', [
            'status' => OrganizationMemberStatus::Invited->value,
        ]);
    }

    public function test_admin_can_deactivate_member(): void
    {
        $admin = User::factory()->admin()->create();
        $member = OrganizationMember::query()
            ->where('user_id', $admin->id)
            ->first();

        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);
        $employeeMember = OrganizationMember::query()
            ->where('user_id', $employee->id)
            ->first();

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->patchJson("/api/v1/team/{$employeeMember->id}", [
                'status' => OrganizationMemberStatus::Suspended->value,
            ])
            ->assertOk()
            ->assertJsonPath('member.status', OrganizationMemberStatus::Suspended->value);
    }
}
