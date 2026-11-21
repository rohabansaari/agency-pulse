<?php

namespace Tests\Feature;

use App\Enums\OvertimeRequestStatus;
use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Models\InsightSummary;
use App\Models\OvertimeRequest;
use App\Models\Project;
use App\Models\Screenshot;
use App\Models\Team;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Insights\SummaryWriter;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InsightsTest extends TestCase
{
    use RefreshDatabase;

    /** Facts the fake writer received, to check what would be sent to the AI. */
    public static array $sentFacts = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
        $this->travelTo(Carbon::create(2026, 11, 20, 12));
        self::$sentFacts = [];
        $this->fakeWriter(available: true);
    }

    private function fakeWriter(bool $available): void
    {
        $this->app->instance(SummaryWriter::class, new class($available) implements SummaryWriter
        {
            public function __construct(private bool $available) {}

            public function available(): bool
            {
                return $this->available;
            }

            public function model(): string
            {
                return 'fake-model';
            }

            public function write(array $facts): array
            {
                InsightsTest::$sentFacts = $facts;

                return [
                    'headline' => 'The team logged '.$facts['totals']['hours'].' h last week.',
                    'highlights' => ['Steady week.'],
                    'concerns' => [],
                    'suggestions' => ['Clear the approval queue.'],
                ];
            }
        });
    }

    private function headers(User $user): array
    {
        return ['X-Organization-Id' => (string) $user->organization_id];
    }

    private function work(User $user, Carbon $start, int $hours, ?Project $project = null): void
    {
        TimeEntry::create([
            'user_id' => $user->id,
            'organization_id' => $user->organization_id,
            'type' => TimeEntryType::Tracked,
            'project_id' => $project?->id,
            'start_time' => $start,
            'end_time' => $start->copy()->addHours($hours),
            'duration' => $hours * 3600,
            'status' => TimeEntryStatus::Stopped,
        ]);
    }

    private function screenshotActivity(User $user, Carbon $at, int $activePercent): void
    {
        Screenshot::query()->create([
            'organization_id' => $user->organization_id,
            'user_id' => $user->id,
            'session_id' => (string) Str::uuid(),
            'storage_disk' => 'local',
            'image_path' => 'screenshots/test.jpg',
            'file_size_bytes' => 1000,
            'captured_at' => $at,
            'active_seconds' => $activePercent * 3,
            'activity_window_seconds' => 300,
        ]);
    }

    public function test_activity_drop_is_flagged_against_the_persons_usual_level(): void
    {
        $admin = User::factory()->admin()->create();
        $ali = User::factory()->employee()->create(['organization_id' => $admin->organization_id, 'name' => 'Ali']);
        $sara = User::factory()->employee()->create(['organization_id' => $admin->organization_id, 'name' => 'Sara']);

        foreach ([10, 14, 20, 25] as $daysAgo) {
            $this->screenshotActivity($ali, now()->subDays($daysAgo), 80);
            $this->screenshotActivity($sara, now()->subDays($daysAgo), 70);
        }
        $this->screenshotActivity($ali, now()->subDays(2), 40); // 80 -> 40
        $this->screenshotActivity($sara, now()->subDays(2), 65); // 70 -> 65, normal

        Sanctum::actingAs($admin);
        $alerts = collect($this->withHeaders($this->headers($admin))->getJson('/api/v1/insights')->assertOk()->json('alerts'));

        $drops = $alerts->where('type', 'activity_drop');
        $this->assertCount(1, $drops);
        $this->assertSame($ali->id, $drops->first()['user_id']);
        $this->assertStringContainsString('40% this week against a usual 80%', $drops->first()['detail']);
    }

    public function test_overtime_and_waiting_approvals_are_flagged(): void
    {
        $admin = User::factory()->admin()->create();
        $ali = User::factory()->employee()->create(['organization_id' => $admin->organization_id, 'name' => 'Ali']);
        $project = Project::factory()->create(['organization_id' => $admin->organization_id]);

        foreach ([3, 5, 7] as $day) {
            OvertimeRequest::create([
                'organization_id' => $admin->organization_id,
                'user_id' => $ali->id,
                'project_id' => $project->id,
                'work_date' => now()->setDay($day)->toDateString(),
                'duration_seconds' => 8 * 3600,
                'reason' => 'Launch',
                'status' => OvertimeRequestStatus::Approved,
            ]);
        }

        $manual = TimeEntry::create([
            'user_id' => $ali->id,
            'organization_id' => $admin->organization_id,
            'type' => TimeEntryType::Manual,
            'start_time' => now()->subDays(6),
            'end_time' => now()->subDays(6)->addHour(),
            'duration' => 3600,
            'description' => 'Forgot the timer',
            'status' => TimeEntryStatus::Pending,
        ]);
        $manual->forceFill(['created_at' => now()->subDays(5)])->save();

        Sanctum::actingAs($admin);
        $alerts = collect($this->withHeaders($this->headers($admin))->getJson('/api/v1/insights')->json('alerts'));

        $this->assertSame('Ali has 24 h of overtime this month', $alerts->firstWhere('type', 'overtime')['title']);
        $this->assertSame('1 request is waiting for approval', $alerts->firstWhere('type', 'approvals')['title']);
    }

    public function test_manager_sees_only_their_team_and_no_project_money(): void
    {
        $admin = User::factory()->admin()->create();
        $manager = User::factory()->manager()->create(['organization_id' => $admin->organization_id]);
        $mine = User::factory()->employee()->create(['organization_id' => $admin->organization_id, 'name' => 'Mine']);
        $other = User::factory()->employee()->create(['organization_id' => $admin->organization_id, 'name' => 'Other']);
        $team = Team::factory()->create(['organization_id' => $admin->organization_id, 'manager_id' => $manager->id]);
        $team->members()->attach($mine->id);

        $this->work($mine, now()->subDays(3)->setTime(9, 0), 6);
        $this->work($other, now()->subDays(3)->setTime(9, 0), 8);

        Sanctum::actingAs($manager);
        $this->withHeaders($this->headers($manager))->postJson('/api/v1/insights/summary')->assertCreated();

        $names = array_column(self::$sentFacts['people'], 'name');
        $this->assertSame(['Mine'], $names);
        $this->assertSame(6.0, self::$sentFacts['totals']['hours']);

        $alerts = $this->withHeaders($this->headers($manager))->getJson('/api/v1/insights')->json('alerts');
        $this->assertEmpty(array_filter($alerts, fn ($alert) => $alert['type'] === 'project'));
    }

    public function test_summary_is_stored_and_shown_until_the_next_one(): void
    {
        $admin = User::factory()->admin()->create();
        $ali = User::factory()->employee()->create(['organization_id' => $admin->organization_id, 'name' => 'Ali']);
        $this->work($ali, now()->subDays(2)->setTime(9, 0), 7);
        $this->work($ali, now()->subDays(9)->setTime(9, 0), 5);

        Sanctum::actingAs($admin);
        $this->withHeaders($this->headers($admin))->postJson('/api/v1/insights/summary')
            ->assertCreated()
            ->assertJsonPath('summary.headline', 'The team logged 7 h last week.')
            ->assertJsonPath('summary.period_start', '2026-11-13')
            ->assertJsonPath('summary.period_end', '2026-11-19');

        $this->assertSame(5.0, self::$sentFacts['people'][0]['hours_week_before']);
        // Aggregates only: no screenshots, salaries or emails in what goes to the AI.
        $this->assertStringNotContainsString('@', json_encode(self::$sentFacts));

        $this->withHeaders($this->headers($admin))->getJson('/api/v1/insights')
            ->assertJsonPath('summary.headline', 'The team logged 7 h last week.')
            ->assertJsonPath('ai_available', true);
    }

    public function test_a_new_summary_waits_for_the_cooldown(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))->postJson('/api/v1/insights/summary')->assertCreated();
        $this->withHeaders($this->headers($admin))->postJson('/api/v1/insights/summary')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('summary');

        $this->travel(11)->minutes();
        $this->withHeaders($this->headers($admin))->postJson('/api/v1/insights/summary')->assertCreated();
        $this->assertSame(2, InsightSummary::query()->count());
    }

    public function test_alerts_work_without_an_ai_key(): void
    {
        $this->fakeWriter(available: false);
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))->getJson('/api/v1/insights')
            ->assertOk()
            ->assertJsonPath('ai_available', false)
            ->assertJsonPath('summary', null);

        $this->withHeaders($this->headers($admin))->postJson('/api/v1/insights/summary')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('summary');
    }

    public function test_employees_cannot_see_insights(): void
    {
        $employee = User::factory()->employee()->create();
        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))->getJson('/api/v1/insights')->assertForbidden();
    }
}
