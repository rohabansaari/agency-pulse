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
    use RefreshDatabase, ConnectsDesktopAgent;

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
        Sanctum::actingAs($user);
        $this->connectDesktopAgent($user);

        $response = $this->withHeaders($this->tenantHeaders($user))
            ->postJson('/api/v1/time/start');

        $response->assertCreated()
            ->assertJsonPath('entry.status', TimeEntryStatus::Running->value)
            ->assertJsonStructure(['entry' => ['id', 'organization_id', 'start_time', 'status']]);

        $this->assertDatabaseHas('time_entries', [
            'status' => TimeEntryStatus::Running->value,
        ]);
    }

    public function test_pause_and_resume_continue_the_same_session(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $headers = $this->tenantHeaders($user);

        // Heartbeats are refreshed after each time jump, as the running agent would.
        $this->travelTo(now()->setTime(10, 0));
        $this->connectDesktopAgent($user);
        $this->withHeaders($headers)->postJson('/api/v1/time/start')->assertCreated();

        $this->travelTo(now()->setTime(10, 20));
        $this->withHeaders($headers)->postJson('/api/v1/time/pause')
            ->assertOk()
            ->assertJsonPath('entry.paused', true)
            ->assertJsonPath('entry.duration', 1200);

        $this->withHeaders($headers)->getJson('/api/v1/time/today')
            ->assertOk()
            ->assertJsonPath('meta.active_timer', null)
            ->assertJsonPath('meta.paused_timer.paused', true)
            ->assertJsonPath('meta.session_elapsed', 1200)
            ->assertJsonPath('meta.total_duration', 1200);

        $this->travelTo(now()->setTime(10, 45));
        $this->connectDesktopAgent($user);
        $this->withHeaders($headers)->postJson('/api/v1/time/resume')
            ->assertCreated()
            ->assertJsonPath('entry.status', TimeEntryStatus::Running->value);

        $this->travelTo(now()->setTime(10, 55));
        $this->withHeaders($headers)->getJson('/api/v1/time/today')
            ->assertJsonPath('meta.paused_timer', null)
            ->assertJsonPath('meta.session_elapsed', 1200);

        $this->withHeaders($headers)->postJson('/api/v1/time/stop')->assertOk();

        // Paused gap (10:20–10:45) is not counted; the next start begins a new session.
        $this->withHeaders($headers)->getJson('/api/v1/time/today')
            ->assertJsonPath('meta.total_duration', 1800)
            ->assertJsonPath('meta.paused_timer', null)
            ->assertJsonPath('meta.session_elapsed', 0);

        $this->connectDesktopAgent($user);
        $this->withHeaders($headers)->postJson('/api/v1/time/start')->assertCreated();
        $this->withHeaders($headers)->getJson('/api/v1/time/today')
            ->assertJsonPath('meta.session_elapsed', 0);
    }

    public function test_stop_while_paused_ends_the_session(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $this->connectDesktopAgent($user);
        $headers = $this->tenantHeaders($user);

        $this->withHeaders($headers)->postJson('/api/v1/time/start')->assertCreated();
        $this->withHeaders($headers)->postJson('/api/v1/time/pause')->assertOk();
        $this->withHeaders($headers)->postJson('/api/v1/time/stop')
            ->assertOk()
            ->assertJsonPath('entry.paused', false);

        $this->withHeaders($headers)->postJson('/api/v1/time/resume')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('timer');
    }

    public function test_pause_requires_a_running_timer(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->withHeaders($this->tenantHeaders($user))
            ->postJson('/api/v1/time/pause')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('timer');
    }

    public function test_timer_cannot_start_until_desktop_agent_connects(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->withHeaders($this->tenantHeaders($user))
            ->postJson('/api/v1/time/start')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('timer');

        $this->assertDatabaseCount('time_entries', 0);

        $this->connectDesktopAgent($user);

        $this->withHeaders($this->tenantHeaders($user))
            ->postJson('/api/v1/time/start')
            ->assertCreated();
    }

    public function test_agent_requirement_can_be_disabled(): void
    {
        config(['screenshots.timer_requires_agent' => false]);
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->withHeaders($this->tenantHeaders($user))
            ->postJson('/api/v1/time/start')
            ->assertCreated();

        $this->withHeaders($this->tenantHeaders($user))
            ->getJson('/api/v1/screenshots/agent-status')
            ->assertOk()
            ->assertJsonPath('timer_requires_agent', false);
    }

    public function test_user_can_start_timer_with_project(): void
    {
        $user = User::factory()->create();
        $project = Project::factory()->create([
            'organization_id' => $user->organization_id,
        ]);
        $project->members()->attach($user->id);

        Sanctum::actingAs($user);
        $this->connectDesktopAgent($user);

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
