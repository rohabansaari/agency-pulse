<?php

namespace Tests\Feature;

use App\Enums\TimeEntryStatus;
use App\Models\Organization;
use App\Models\TimeEntry;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\ConnectsDesktopAgent;
use Tests\TestCase;

class IdleDetectionTest extends TestCase
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

    /** Employee whose timer started at 10:00; the clock is then moved to $hour:$minute. */
    private function runningTimer(int $hour, int $minute = 0): User
    {
        $user = User::factory()->employee()->create();
        Sanctum::actingAs($user);

        $this->travelTo(now()->setTime(10, 0));
        $this->connectDesktopAgent($user);
        $this->withHeaders($this->headers($user))->postJson('/api/v1/time/start')->assertCreated();

        $this->travelTo(now()->setTime($hour, $minute));
        $this->connectDesktopAgent($user);

        return $user;
    }

    private function reportIdle(User $user, int $hour, int $minute)
    {
        return $this->withHeaders($this->headers($user))->postJson('/api/v1/time/idle', [
            'idle_since' => now()->setTime($hour, $minute)->toIso8601String(),
        ]);
    }

    public function test_idle_report_pauses_the_timer_at_the_last_input(): void
    {
        $user = $this->runningTimer(10, 40);

        $this->reportIdle($user, 10, 30)
            ->assertOk()
            ->assertJsonPath('entry.paused', true)
            ->assertJsonPath('entry.pause_reason', 'idle')
            ->assertJsonPath('entry.duration', 1800);

        $this->withHeaders($this->headers($user))->getJson('/api/v1/time/today')
            ->assertJsonPath('meta.active_timer', null)
            ->assertJsonPath('meta.paused_timer.pause_reason', 'idle')
            ->assertJsonPath('meta.total_duration', 1800)
            ->assertJsonPath('meta.idle_timeout_minutes', 10);
    }

    public function test_idle_report_is_rejected_before_the_limit_is_reached(): void
    {
        $user = $this->runningTimer(10, 40);

        $this->reportIdle($user, 10, 35)->assertUnprocessable()->assertJsonValidationErrors('idle_since');

        $this->assertSame(TimeEntryStatus::Running, TimeEntry::query()->sole()->status);
    }

    public function test_idle_report_is_rejected_when_idle_detection_is_off(): void
    {
        $user = $this->runningTimer(10, 40);
        Organization::query()->whereKey($user->organization_id)->update(['idle_timeout_minutes' => 0]);

        $this->reportIdle($user, 10, 20)->assertUnprocessable()->assertJsonValidationErrors('idle');
    }

    public function test_keeping_idle_time_counts_it_and_continues_the_session(): void
    {
        $user = $this->runningTimer(10, 40);
        $this->reportIdle($user, 10, 30)->assertOk();

        $this->travelTo(now()->setTime(10, 50));
        $this->connectDesktopAgent($user);

        $this->withHeaders($this->headers($user))
            ->postJson('/api/v1/time/idle/resolve', ['action' => 'keep', 'resume' => true])
            ->assertCreated()
            ->assertJsonPath('entry.status', TimeEntryStatus::Running->value);

        $kept = TimeEntry::query()->where('idle_kept', true)->sole();
        $this->assertSame(1200, $kept->duration); // 10:30–10:50
        $this->assertSame(1, TimeEntry::query()->where('status', TimeEntryStatus::Running)->count());
        $this->assertSame(1, TimeEntry::query()->distinct()->count('timer_session'));

        $this->withHeaders($this->headers($user))->getJson('/api/v1/time/today')
            ->assertJsonPath('meta.total_duration', 3000)
            ->assertJsonPath('meta.paused_timer', null);
    }

    public function test_discarding_idle_time_leaves_it_uncounted(): void
    {
        $user = $this->runningTimer(10, 40);
        $this->reportIdle($user, 10, 30)->assertOk();

        $this->travelTo(now()->setTime(10, 50));
        $this->connectDesktopAgent($user);

        $this->withHeaders($this->headers($user))
            ->postJson('/api/v1/time/idle/resolve', ['action' => 'discard', 'resume' => true])
            ->assertCreated();

        $this->assertSame(0, TimeEntry::query()->where('idle_kept', true)->count());

        $this->travelTo(now()->setTime(11, 0));
        $this->connectDesktopAgent($user);

        // 10:00–10:30 plus 10:50–11:00 (running).
        $this->withHeaders($this->headers($user))->getJson('/api/v1/time/today')
            ->assertJsonPath('meta.total_duration', 1800)
            ->assertJsonPath('meta.active_timer.status', TimeEntryStatus::Running->value);
    }

    public function test_keep_and_stop_ends_the_session(): void
    {
        $user = $this->runningTimer(10, 40);
        $this->reportIdle($user, 10, 30)->assertOk();
        $this->travelTo(now()->setTime(10, 45));

        $this->withHeaders($this->headers($user))
            ->postJson('/api/v1/time/idle/resolve', ['action' => 'keep', 'resume' => false])
            ->assertOk()
            ->assertJsonPath('entry.idle_kept', true);

        $this->withHeaders($this->headers($user))->getJson('/api/v1/time/today')
            ->assertJsonPath('meta.active_timer', null)
            ->assertJsonPath('meta.paused_timer', null)
            ->assertJsonPath('meta.total_duration', 2700);
    }

    public function test_long_idle_time_cannot_be_kept(): void
    {
        config(['screenshots.idle_keep_max_minutes' => 240]);
        $user = $this->runningTimer(10, 40);
        $this->reportIdle($user, 10, 30)->assertOk();
        $this->travelTo(now()->setTime(15, 0));

        $this->withHeaders($this->headers($user))
            ->postJson('/api/v1/time/idle/resolve', ['action' => 'keep', 'resume' => false])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('idle');

        $this->assertSame(0, TimeEntry::query()->where('idle_kept', true)->count());
    }

    public function test_resolve_needs_a_timer_paused_for_idle(): void
    {
        $user = $this->runningTimer(10, 40);
        $this->withHeaders($this->headers($user))->postJson('/api/v1/time/pause')->assertOk();

        $this->withHeaders($this->headers($user))
            ->postJson('/api/v1/time/idle/resolve', ['action' => 'keep', 'resume' => true])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('idle');
    }

    public function test_admin_can_change_the_idle_limit(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))->getJson('/api/v1/settings/time-tracking')
            ->assertOk()
            ->assertJsonPath('idle_timeout_minutes', 10);

        $this->withHeaders($this->headers($admin))
            ->patchJson('/api/v1/settings/time-tracking', ['idle_timeout_minutes' => 15])
            ->assertOk()
            ->assertJsonPath('idle_timeout_minutes', 15);

        $this->assertSame(15, Organization::query()->find($admin->organization_id)->idle_timeout_minutes);
    }

    public function test_employees_cannot_change_the_idle_limit(): void
    {
        $user = User::factory()->employee()->create();
        Sanctum::actingAs($user);

        $this->withHeaders($this->headers($user))
            ->patchJson('/api/v1/settings/time-tracking', ['idle_timeout_minutes' => 0])
            ->assertForbidden();
    }
}
