<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\ConnectsDesktopAgent;
use Tests\TestCase;

class IdempotencyTest extends TestCase
{
    use ConnectsDesktopAgent;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    public function test_idempotency_key_replays_identical_response(): void
    {
        $user = User::factory()->create();
        $this->connectDesktopAgent($user);
        Sanctum::actingAs($user);

        $key = (string) Str::uuid();

        $first = $this->withHeaders([
            'Idempotency-Key' => $key,
            'X-Organization-Id' => (string) $user->organization_id,
        ])->postJson('/api/v1/time/start');

        $first->assertCreated();

        $second = $this->withHeaders([
            'Idempotency-Key' => $key,
            'X-Organization-Id' => (string) $user->organization_id,
        ])->postJson('/api/v1/time/start');

        $second->assertCreated()
            ->assertExactJson($first->json());

        $this->assertDatabaseCount('time_entries', 1);
    }
}
