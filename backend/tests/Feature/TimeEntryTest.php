<?php

namespace Tests\Feature;

use App\Enums\TimeEntryStatus;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\ConnectsDesktopAgent;
use Tests\TestCase;

class TimeEntryTest extends TestCase
{
    use ConnectsDesktopAgent;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    private function tenantHeaders(User $user): array
    {
        return [
            'X-Organization-Id' => (string) $user->organization_id,
        ];
    }

    public function test_user_can_start_timer(): void
    {
        $user = User::factory()->create();
        $this->connectDesktopAgent($user);
        Sanctum::actingAs($user);

        $response = $this->withHeaders($this->tenantHeaders($user))
            ->postJson('/api/v1/time/start');

        $response->assertCreated()
            ->assertJsonPath('entry.status', TimeEntryStatus::Running->value)
            ->assertJsonStructure(['entry' => ['id', 'organization_id', 'start_time', 'status']]);

        $this->assertDatabaseHas('time_entries', [
            'status' => TimeEntryStatus::Running->value,
        ]);
    }

    public function test_user_can_start_timer_with_project(): void
    {
        $user = User::factory()->create();
        $project = Project::factory()->create([
            'organization_id' => $user->organization_id,
        ]);
        $project->members()->attach($user->id);

        $this->connectDesktopAgent($user);
        Sanctum::actingAs($user);

        $response = $this->withHeaders($this->tenantHeaders($user))
            ->postJson('/api/v1/time/start', [
                'project_id' => $project->id,
            ]);

        $response->assertCreated()
            ->assertJsonPath('entry.project_id', $project->id)
            ->assertJsonPath('entry.project_name', $project->name);
    }

    public function test_user_cannot_start_timer_with_project_from_another_organization(): void
    {
        $user = User::factory()->create();
        $otherProject = Project::factory()->create();

        $this->connectDesktopAgent($user);
        Sanctum::actingAs($user);

        $response = $this->withHeaders($this->tenantHeaders($user))
            ->postJson('/api/v1/time/start', [
                'project_id' => $otherProject->id,
            ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['project_id']);
    }

    public function test_user_cannot_start_second_timer(): void
    {
        $user = User::factory()->create();
        $this->connectDesktopAgent($user);
        Sanctum::actingAs($user);

        TimeEntry::create([
            'user_id' => $user->id,
            'organization_id' => $user->organization_id,
            'start_time' => now()->subHour(),
            'status' => TimeEntryStatus::Running,
        ]);

        $response = $this->withHeaders($this->tenantHeaders($user))
            ->postJson('/api/v1/time/start');

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['timer']);
    }

    public function test_user_can_stop_active_timer(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        TimeEntry::create([
            'user_id' => $user->id,
            'organization_id' => $user->organization_id,
            'start_time' => now()->subMinutes(30),
            'status' => TimeEntryStatus::Running,
        ]);

        $response = $this->withHeaders($this->tenantHeaders($user))
            ->postJson('/api/v1/time/stop');

        $response->assertOk()
            ->assertJsonPath('entry.status', TimeEntryStatus::Stopped->value)
            ->assertJsonStructure(['entry' => ['duration', 'end_time']]);

        $this->assertDatabaseHas('time_entries', [
            'user_id' => $user->id,
            'status' => TimeEntryStatus::Stopped->value,
        ]);
    }

    public function test_stop_fails_without_active_timer(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->withHeaders($this->tenantHeaders($user))
            ->postJson('/api/v1/time/stop');

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['timer']);
    }

    public function test_today_returns_user_entries_grouped_by_project(): void
    {
        $user = User::factory()->create();
        $project = Project::factory()->create([
            'organization_id' => $user->organization_id,
        ]);

        Sanctum::actingAs($user);

        TimeEntry::create([
            'user_id' => $user->id,
            'organization_id' => $user->organization_id,
            'project_id' => $project->id,
            'start_time' => now()->startOfDay()->addHours(9),
            'end_time' => now()->startOfDay()->addHours(10),
            'duration' => 3600,
            'status' => TimeEntryStatus::Stopped,
        ]);

        TimeEntry::create([
            'user_id' => $user->id,
            'organization_id' => $user->organization_id,
            'start_time' => now()->startOfDay()->addHours(11),
            'end_time' => now()->startOfDay()->addHours(12),
            'duration' => 1800,
            'status' => TimeEntryStatus::Stopped,
        ]);

        TimeEntry::create([
            'user_id' => $user->id,
            'organization_id' => $user->organization_id,
            'start_time' => now()->subDay(),
            'end_time' => now()->subDay()->addHour(),
            'duration' => 3600,
            'status' => TimeEntryStatus::Stopped,
        ]);

        $response = $this->withHeaders($this->tenantHeaders($user))
            ->getJson('/api/v1/time/today');

        $response->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total_duration', 5400)
            ->assertJsonStructure(['meta' => ['by_project']]);

        $byProject = collect($response->json('meta.by_project'));
        $this->assertTrue($byProject->contains(
            fn (array $group) => $group['project_name'] === $project->name && $group['total_duration'] === 3600
        ));
        $this->assertTrue($byProject->contains(
            fn (array $group) => $group['project_name'] === 'No project' && $group['total_duration'] === 1800
        ));
    }

    public function test_timer_start_requires_connected_desktop_agent(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->withHeaders($this->tenantHeaders($user))
            ->postJson('/api/v1/time/start');

        $response->assertForbidden()
            ->assertJsonPath('code', 'AGENT_NOT_CONNECTED');
    }

    public function test_time_routes_require_authentication(): void
    {
        $this->postJson('/api/v1/time/start')->assertUnauthorized();
        $this->postJson('/api/v1/time/stop')->assertUnauthorized();
        $this->getJson('/api/v1/time/today')->assertUnauthorized();
    }

    public function test_tenant_middleware_blocks_users_without_organization(): void
    {
        $user = User::factory()->make([
            'organization_id' => null,
        ]);

        $request = \Illuminate\Http\Request::create('/api/v1/time/start', 'POST');
        $request->setUserResolver(fn () => $user);

        $middleware = new \App\Http\Middleware\ResolveTenant();
        $response = $middleware->handle($request, fn () => response()->json(['ok' => true]));

        $this->assertSame(403, $response->getStatusCode());
    }
}
