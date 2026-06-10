<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\Auth\SuperAdminBootstrap;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SuperAdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    public function test_super_admin_is_created_only_once(): void
    {
        $this->assertTrue(SuperAdminBootstrap::organizationIdAllowsNull());

        SuperAdminBootstrap::ensureExists();
        SuperAdminBootstrap::ensureExists();

        $this->assertSame(1, User::query()->where('role', UserRole::SuperAdmin)->count());
        $this->assertDatabaseHas('users', [
            'email' => SuperAdminBootstrap::EMAIL,
            'role' => UserRole::SuperAdmin->value,
            'organization_id' => null,
        ]);

        $user = User::query()->where('email', SuperAdminBootstrap::EMAIL)->firstOrFail();
        $this->assertTrue(Hash::check('12345678', $user->password));
        $this->assertStringStartsWith('$', (string) $user->getAttributes()['password']);
    }

    public function test_super_admin_login_works_without_organization(): void
    {
        SuperAdminBootstrap::ensureExists();

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => SuperAdminBootstrap::EMAIL,
            'password' => '12345678',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.role', UserRole::SuperAdmin->value)
            ->assertJsonPath('current_organization_id', null)
            ->assertJsonCount(0, 'memberships');
    }

    public function test_super_admin_cannot_access_organization_team_directory(): void
    {
        SuperAdminBootstrap::ensureExists();
        $superAdmin = User::query()->where('email', SuperAdminBootstrap::EMAIL)->firstOrFail();

        Sanctum::actingAs($superAdmin);

        $this->getJson('/api/v1/team')
            ->assertForbidden()
            ->assertJsonPath('code', 'SUPER_ADMIN_TENANT_DENIED');
    }

    public function test_super_admin_can_access_platform_dashboard(): void
    {
        SuperAdminBootstrap::ensureExists();
        $superAdmin = User::query()->where('email', SuperAdminBootstrap::EMAIL)->firstOrFail();

        Sanctum::actingAs($superAdmin);

        $this->getJson('/api/v1/platform/dashboard')
            ->assertOk()
            ->assertJsonPath('role', UserRole::SuperAdmin->value)
            ->assertJsonStructure([
                'organizations_total',
                'organizations_active',
                'organizations_suspended',
                'tenant_users_total',
            ]);
    }

    public function test_super_admin_can_reset_own_password_via_platform_endpoint(): void
    {
        SuperAdminBootstrap::ensureExists();
        $superAdmin = User::query()->where('email', SuperAdminBootstrap::EMAIL)->firstOrFail();

        Sanctum::actingAs($superAdmin);

        $this->patchJson('/api/v1/platform/password', [
            'current_password' => '12345678',
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertOk();

        $superAdmin->refresh();
        $this->assertTrue(Hash::check('NewPassword1!', $superAdmin->password));
    }

    public function test_super_admin_cannot_be_created_via_employee_api(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->withHeaders(['X-Organization-Id' => (string) $admin->organization_id])
            ->postJson('/api/v1/team/create-employee', [
                'name' => 'Fake Super',
                'email' => 'fake-super@example.com',
                'password' => 'Password1!',
                'role' => UserRole::SuperAdmin->value,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['role']);
    }

    public function test_existing_email_blocks_duplicate_super_admin_bootstrap(): void
    {
        User::factory()->create([
            'email' => SuperAdminBootstrap::EMAIL,
            'role' => UserRole::Employee,
        ]);

        SuperAdminBootstrap::ensureExists();

        $this->assertDatabaseMissing('users', [
            'email' => SuperAdminBootstrap::EMAIL,
            'role' => UserRole::SuperAdmin->value,
        ]);
    }

    public function test_super_admin_can_list_organizations_with_employee_counts(): void
    {
        SuperAdminBootstrap::ensureExists();
        $superAdmin = User::query()->where('email', SuperAdminBootstrap::EMAIL)->firstOrFail();
        $admin = User::factory()->admin()->create();
        User::factory()->count(2)->create(['organization_id' => $admin->organization_id]);

        Sanctum::actingAs($superAdmin);

        $this->getJson('/api/v1/platform/organizations')
            ->assertOk()
            ->assertJsonStructure([
                'organizations' => [
                    ['id', 'name', 'status', 'employee_count', 'admin_name', 'admin_email'],
                ],
            ])
            ->assertJsonPath('organizations.0.employee_count', 3);
    }

    public function test_super_admin_can_create_organization_with_admin(): void
    {
        SuperAdminBootstrap::ensureExists();
        $superAdmin = User::query()->where('email', SuperAdminBootstrap::EMAIL)->firstOrFail();

        Sanctum::actingAs($superAdmin);

        $this->postJson('/api/v1/platform/organizations', [
            'organization_name' => 'Acme Agency',
            'admin_name' => 'Acme Admin',
            'admin_email' => 'acme-admin@example.com',
            'admin_password' => 'Password1!',
        ])
            ->assertCreated()
            ->assertJsonPath('organization.name', 'Acme Agency')
            ->assertJsonPath('organization.admin_email', 'acme-admin@example.com')
            ->assertJsonPath('organization.employee_count', 1);

        $this->assertDatabaseHas('organizations', ['name' => 'Acme Agency']);
        $this->assertDatabaseHas('users', [
            'email' => 'acme-admin@example.com',
            'role' => UserRole::Admin->value,
        ]);
    }

    public function test_tenant_admin_cannot_access_platform_organizations(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->getJson('/api/v1/platform/organizations')->assertForbidden();
    }

    public function test_super_admin_can_update_organization_admin_email(): void
    {
        SuperAdminBootstrap::ensureExists();
        $superAdmin = User::query()->where('email', SuperAdminBootstrap::EMAIL)->firstOrFail();
        $tenantAdmin = User::factory()->admin()->create(['email' => 'tenant-admin@example.com']);

        Sanctum::actingAs($superAdmin);

        $this->patchJson('/api/v1/platform/organizations/'.$tenantAdmin->organization_id, [
            'admin_email' => 'new-admin@example.com',
        ])
            ->assertOk()
            ->assertJsonPath('organization.admin_email', 'new-admin@example.com');

        $this->assertDatabaseHas('users', [
            'id' => $tenantAdmin->id,
            'email' => 'new-admin@example.com',
        ]);
    }

    public function test_super_admin_cannot_delete_active_organization(): void
    {
        SuperAdminBootstrap::ensureExists();
        $superAdmin = User::query()->where('email', SuperAdminBootstrap::EMAIL)->firstOrFail();
        $tenantAdmin = User::factory()->admin()->create();

        Sanctum::actingAs($superAdmin);

        $this->deleteJson('/api/v1/platform/organizations/'.$tenantAdmin->organization_id)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['organization']);

        $this->assertDatabaseHas('organizations', ['id' => $tenantAdmin->organization_id]);
    }

    public function test_super_admin_can_delete_suspended_organization(): void
    {
        SuperAdminBootstrap::ensureExists();
        $superAdmin = User::query()->where('email', SuperAdminBootstrap::EMAIL)->firstOrFail();
        $tenantAdmin = User::factory()->admin()->create();
        $organizationId = $tenantAdmin->organization_id;

        Sanctum::actingAs($superAdmin);

        $this->patchJson('/api/v1/platform/organizations/'.$organizationId, [
            'status' => 'suspended',
        ])->assertOk();

        $this->deleteJson('/api/v1/platform/organizations/'.$organizationId)
            ->assertOk();

        $this->assertDatabaseMissing('organizations', ['id' => $organizationId]);
        $this->assertDatabaseMissing('users', ['id' => $tenantAdmin->id]);
    }
}
