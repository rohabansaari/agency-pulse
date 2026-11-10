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

    private function signup(array $overrides = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/v1/auth/register', array_merge([
            'name' => 'Jane Doe',
            'organization_name' => 'Northwind Creative',
            'email' => 'Jane@Example.com',
            'password' => 'agency2026',
        ], $overrides));
    }

    public function test_anyone_can_create_an_agency_workspace_and_lands_in_onboarding(): void
    {
        $response = $this->signup()->assertCreated()
            ->assertJsonStructure(['user', 'memberships', 'current_organization_id', 'token'])
            ->assertJsonPath('user.role', 'admin')
            ->assertJsonPath('user.email', 'jane@example.com');

        $organization = \App\Models\Organization::query()->findOrFail($response->json('current_organization_id'));
        $this->assertSame('Northwind Creative', $organization->name);
        $this->assertSame('trial', $organization->status->value);

        $headers = ['X-Organization-Id' => (string) $organization->id];
        $this->withToken($response->json('token'))->getJson('/api/v1/auth/me')->assertOk();
        $this->withToken($response->json('token'))->withHeaders($headers)
            ->getJson('/api/v1/onboarding/status')
            ->assertOk()
            ->assertJsonPath('requires_onboarding', true);
    }

    public function test_signup_rejects_taken_emails_weak_passwords_and_bots(): void
    {
        $this->signup()->assertCreated();

        $this->signup(['organization_name' => 'Other'])->assertStatus(422)->assertJsonValidationErrors('email');
        $this->signup(['email' => 'new@example.com', 'password' => 'short'])->assertStatus(422)->assertJsonValidationErrors('password');
        $this->signup(['email' => 'new@example.com', 'organization_name' => ''])->assertStatus(422)->assertJsonValidationErrors('organization_name');
        $this->signup(['email' => 'bot@example.com', 'website' => 'http://spam.example'])->assertStatus(422);

        $this->assertSame(1, \App\Models\Organization::query()->count());
    }

    public function test_signup_is_rate_limited_per_ip(): void
    {
        for ($i = 1; $i <= 5; $i++) {
            $this->signup(['email' => "user{$i}@example.com"])->assertCreated();
        }

        $this->signup(['email' => 'user6@example.com'])->assertStatus(429);
    }

    public function test_signup_can_be_switched_off(): void
    {
        config(['auth.self_signup' => false]);

        $this->signup()->assertNotFound();
        $this->assertSame(0, User::query()->count());
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
