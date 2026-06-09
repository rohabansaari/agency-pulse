<?php

namespace Tests\Feature;

use App\Enums\OrganizationMemberStatus;
use App\Enums\OrganizationStatus;
use App\Enums\UserRole;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    public function test_user_can_register(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'password' => 'password123',
        ]);

        $response->assertCreated()
            ->assertJsonStructure([
                'user' => ['id', 'name', 'email', 'role', 'created_at', 'updated_at'],
                'memberships',
                'current_organization_id',
                'token',
            ])
            ->assertJsonPath('user.role', UserRole::Admin->value);

        $this->assertDatabaseHas('users', [
            'email' => 'jane@example.com',
            'role' => UserRole::Admin->value,
        ]);

        $this->assertDatabaseHas('organizations', [
            'name' => "Jane Doe's Organization",
        ]);

        $this->assertDatabaseHas('organization_members', [
            'role' => UserRole::Admin->value,
            'status' => OrganizationMemberStatus::Active->value,
        ]);
    }

    public function test_user_can_login_and_receive_token(): void
    {
        $user = User::factory()->create([
            'email' => 'login@example.com',
            'password' => 'password123',
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'login@example.com',
            'password' => 'password123',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['user', 'memberships', 'current_organization_id', 'token'])
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role', UserRole::Employee->value);
    }

    public function test_authenticated_user_can_fetch_profile_via_me(): void
    {
        $user = User::factory()->manager()->create();

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/auth/me');

        $response->assertOk()
            ->assertJsonStructure(['user', 'memberships', 'current_organization_id'])
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role', UserRole::Manager->value);
    }

    public function test_user_endpoint_requires_authentication(): void
    {
        $this->getJson('/api/v1/user')->assertUnauthorized();
    }

    public function test_login_does_not_require_csrf_for_api_requests(): void
    {
        User::factory()->create([
            'email' => 'csrf-free@example.com',
            'password' => 'password123',
        ]);

        $response = $this->withHeaders([
            'Origin' => 'http://localhost:3000',
            'Referer' => 'http://localhost:3000/login',
        ])->postJson('/api/v1/auth/login', [
            'email' => 'csrf-free@example.com',
            'password' => 'password123',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['user', 'token'])
            ->assertHeaderMissing('Set-Cookie');
    }

    public function test_register_accepts_ten_consecutive_requests(): void
    {
        for ($i = 1; $i <= 10; $i++) {
            $response = $this->withHeaders([
                'Origin' => 'http://localhost:3000',
            ])->postJson('/api/v1/auth/register', [
                'name' => "User {$i}",
                'email' => "user{$i}@example.com",
                'password' => 'password123',
            ]);

            $response->assertCreated()
                ->assertJsonStructure(['user', 'token']);
        }
    }

    public function test_user_can_logout(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('api-token')->plainTextToken;

        $response = $this->withToken($token)->postJson('/api/v1/auth/logout');

        $response->assertOk()
            ->assertJson(['message' => 'Logged out successfully.']);

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}
