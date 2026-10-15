<?php

namespace Tests\Feature;

use App\Enums\TimeEntryStatus;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Tenant\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\ConnectsDesktopAgent;
use Tests\TestCase;

class AgentTimerGuardTest extends TestCase
{
    use RefreshDatabase, ConnectsDesktopAgent;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
        config(['screenshots.timer_requires_agent' => true, 'screenshots.timer_agent_offline_minutes' => 5]);
    }

    private function headers(User $user): array
    {
        return ['X-Organization-Id' => (string) $user->organization_id];
    }

    private function startTimerAt(User $user, int $hour, int $minute = 0): void
    {
        $this->travelTo(now()->setTime($hour, $minute));
        $this->connectDesktopAgent($user);
        $this->withHeaders($this->headers($user))->postJson('/api/v1/time/start')->assertCreated();
    }

    public function test_timer_pauses_at_the_agents_last_check_in_once_it_goes_quiet(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $this->startTimerAt($user, 10);

        // Agent keeps checking in until 10:30, then disappears.
        $this->travelTo(now()->setTime(10, 30));
        $this->connectDesktopAgent($user);
        $this->travelTo(now()->setTime(11, 0));

        $this->withHeaders($this->headers($user))->getJson('/api/v1/time/today')
            ->assertOk()
            ->assertJsonPath('meta.active_timer', null)
            ->assertJsonPath('meta.paused_timer.paused', true)
            ->assertJsonPath('meta.paused_timer.pause_reason', 'agent_offline')
            ->assertJsonPath('meta.paused_timer.duration', 1800)
            // 10:30–11:00 without the agent is not counted.
            ->assertJsonPath('meta.total_duration', 1800);
    }

    public function test_timer_keeps_running_while_the_agent_checks_in(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $this->startTimerAt($user, 10);

        $this->travelTo(now()->setTime(10, 58));
        $this->connectDesktopAgent($user);
        $this->travelTo(now()->setTime(11, 0));

        $this->withHeaders($this->headers($user))->getJson('/api/v1/time/today')
            ->assertJsonPath('meta.active_timer.status', TimeEntryStatus::Running->value)
            ->assertJsonPath('meta.paused_timer', null);
    }

    public function test_agent_status_poll_pauses_the_timer(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $this->startTimerAt($user, 9);
        $this->travelTo(now()->setTime(9, 20));

        $this->withHeaders($this->headers($user))->getJson('/api/v1/screenshots/agent-status')->assertOk();

        $entry = TimeEntry::query()->where('user_id', $user->id)->sole();
        $this->assertSame(TimeEntryStatus::Stopped, $entry->status);
        $this->assertTrue($entry->paused);
        $this->assertSame('agent_offline', $entry->pause_reason);
        $this->assertSame(0, (int) $entry->duration); // agent last seen at start
    }

    public function test_resume_needs_the_agent_and_clears_the_reason(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $this->startTimerAt($user, 10);
        $this->travelTo(now()->setTime(10, 30));
        $this->withHeaders($this->headers($user))->getJson('/api/v1/time/today');

        $this->withHeaders($this->headers($user))->postJson('/api/v1/time/resume')->assertUnprocessable();

        $this->connectDesktopAgent($user);
        $this->withHeaders($this->headers($user))->postJson('/api/v1/time/resume')
            ->assertCreated()
            ->assertJsonPath('entry.status', TimeEntryStatus::Running->value);

        $this->assertDatabaseMissing('time_entries', ['user_id' => $user->id, 'pause_reason' => 'agent_offline']);
    }

    public function test_admin_dashboard_does_not_count_timers_without_an_agent(): void
    {
        $admin = User::factory()->admin()->create();
        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);

        Sanctum::actingAs($employee);
        $this->startTimerAt($employee, 10);
        $this->travelTo(now()->setTime(10, 40));

        Sanctum::actingAs($admin);
        $this->withHeaders($this->headers($admin))->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('running_timers', 0);
    }

    public function test_scheduled_sweep_pauses_quiet_timers_in_every_organization(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $this->startTimerAt($user, 10);
        $this->travelTo(now()->setTime(10, 10));
        TenantContext::forget();

        Artisan::call('timers:pause-offline-agents');

        $this->assertDatabaseHas('time_entries', [
            'user_id' => $user->id,
            'status' => TimeEntryStatus::Stopped->value,
            'pause_reason' => 'agent_offline',
        ]);
    }

    public function test_nothing_is_paused_when_the_agent_requirement_is_off(): void
    {
        config(['screenshots.timer_requires_agent' => false]);
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $this->travelTo(now()->setTime(10, 0));
        $this->withHeaders($this->headers($user))->postJson('/api/v1/time/start')->assertCreated();
        $this->travelTo(now()->setTime(12, 0));

        $this->withHeaders($this->headers($user))->getJson('/api/v1/time/today')
            ->assertJsonPath('meta.active_timer.status', TimeEntryStatus::Running->value);
    }
}
