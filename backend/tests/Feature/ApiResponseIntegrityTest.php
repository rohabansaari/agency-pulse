<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ApiResponseIntegrityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    public function test_unauthenticated_team_returns_single_json_payload(): void
    {
        $response = $this->getJson('/api/v1/team');

        $response->assertUnauthorized();
        $this->assertValidSingleJsonPayload($response->getContent());
        $response->assertJsonPath('message', 'Unauthenticated.');
    }

    public function test_unauthenticated_dashboard_returns_single_json_payload(): void
    {
        $response = $this->getJson('/api/v1/dashboard');

        $response->assertUnauthorized();
        $this->assertValidSingleJsonPayload($response->getContent());
        $response->assertJsonPath('message', 'Unauthenticated.');
    }

    public function test_authenticated_admin_can_load_team_and_dashboard(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $headers = ['X-Organization-Id' => (string) $admin->organization_id];

        $this->withHeaders($headers)
            ->getJson('/api/v1/team')
            ->assertOk();

        $this->withHeaders($headers)
            ->getJson('/api/v1/dashboard')
            ->assertOk();
    }

    private function assertValidSingleJsonPayload(string $content): void
    {
        $this->assertSame(
            1,
            substr_count($content, '"message"'),
            'API responses must not concatenate multiple JSON payloads.'
        );

        json_decode($content, true, 512, JSON_THROW_ON_ERROR);
    }
}
