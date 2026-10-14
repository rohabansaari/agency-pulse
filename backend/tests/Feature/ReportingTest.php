<?php

namespace Tests\Feature;

use App\Enums\TimeEntryStatus;
use App\Models\Project;
use App\Models\Screenshot;
use App\Models\Team;
use App\Models\TimeEntry;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReportingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    private function headers(User $user): array
    {
        return ['X-Organization-Id' => (string) $user->organization_id];
    }

    public function test_admin_can_fetch_organization_report_with_employee_breakdown(): void
    {
        $admin = User::factory()->admin()->create();
        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);

        TimeEntry::create([
            'organization_id' => $admin->organization_id,
            'user_id' => $employee->id,
            'type' => \App\Enums\TimeEntryType::Tracked,
            'duration' => 3600,
            'status' => TimeEntryStatus::Stopped,
            'start_time' => Carbon::today()->addHours(9),
            'end_time' => Carbon::today()->addHours(10),
        ]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/reports/organization')
            ->assertOk()
            ->assertJsonStructure([
                'hours_today_seconds',
                'hours_week_seconds',
                'hours_month_seconds',
                'hours_in_range_seconds',
                'active_timers',
                'active_employees',
                'active_projects',
                'organization_utilization_percent',
                'range_utilization_percent',
                'team_utilization',
                'employee_breakdown',
                'date_range' => ['start_date', 'end_date'],
            ])
            ->assertJsonPath('hours_today_seconds', 3600)
            ->assertJsonCount(1, 'employee_breakdown');
    }

    public function test_employee_breakdown_includes_activity_percent(): void
    {
        $admin = User::factory()->admin()->create();
        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);

        Screenshot::query()->create([
            'organization_id' => $admin->organization_id,
            'user_id' => $employee->id,
            'session_id' => (string) Str::uuid(),
            'storage_disk' => 'public',
            'image_path' => 'org/1/screenshots/test.jpg',
            'file_size_bytes' => 100,
            'active_seconds' => 225,
            'activity_window_seconds' => 300,
            'captured_at' => now(),
        ]);

        Sanctum::actingAs($admin);

        $breakdown = $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/reports/organization')
            ->assertOk()
            ->json('employee_breakdown');

        $row = collect($breakdown)->firstWhere('user_id', $employee->id);
        $this->assertSame(75, $row['activity_percent']);
    }

    public function test_admin_can_filter_organization_report_by_date_range(): void
    {
        $admin = User::factory()->admin()->create();
        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);

        TimeEntry::create([
            'organization_id' => $admin->organization_id,
            'user_id' => $employee->id,
            'type' => \App\Enums\TimeEntryType::Tracked,
            'duration' => 7200,
            'status' => TimeEntryStatus::Stopped,
            'start_time' => Carbon::today()->subDays(10)->addHours(9),
            'end_time' => Carbon::today()->subDays(10)->addHours(11),
        ]);

        Sanctum::actingAs($admin);

        $start = Carbon::today()->subDays(14)->format('d/m/Y');
        $end = Carbon::today()->subDays(7)->format('d/m/Y');

        $this->withHeaders($this->headers($admin))
            ->getJson("/api/v1/reports/organization?start_date={$start}&end_date={$end}")
            ->assertOk()
            ->assertJsonPath('hours_in_range_seconds', 7200)
            ->assertJsonPath('date_range.start_date', $start)
            ->assertJsonPath('date_range.end_date', $end);
    }

    public function test_manager_can_fetch_team_scoped_report(): void
    {
        $manager = User::factory()->manager()->create();
        $employee = User::factory()->create(['organization_id' => $manager->organization_id]);

        $team = Team::factory()->create([
            'organization_id' => $manager->organization_id,
            'manager_id' => $manager->id,
        ]);
        $team->members()->attach($employee->id);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->getJson('/api/v1/reports/manager')
            ->assertOk()
            ->assertJsonCount(1, 'teams')
            ->assertJsonPath('teams.0.team_name', $team->name);
    }

    public function test_employee_cannot_access_reports(): void
    {
        $employee = User::factory()->create();
        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/reports/organization')
            ->assertForbidden();

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/reports/manager')
            ->assertForbidden();
    }

    public function test_admin_can_fetch_project_report(): void
    {
        $admin = User::factory()->admin()->create();
        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);
        $project = Project::factory()->create(['organization_id' => $admin->organization_id]);
        $project->members()->attach($employee->id, ['role_in_project' => 'worker']);

        TimeEntry::create([
            'organization_id' => $admin->organization_id,
            'user_id' => $employee->id,
            'project_id' => $project->id,
            'type' => \App\Enums\TimeEntryType::Tracked,
            'duration' => 7200,
            'status' => TimeEntryStatus::Stopped,
            // Today, not yesterday: the report defaults to this week, which starts on Monday.
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHours(2),
        ]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson("/api/v1/reports/projects/{$project->id}")
            ->assertOk()
            ->assertJsonPath('total_tracked_seconds', 7200)
            ->assertJsonCount(1, 'employee_contributions');
    }

    public function test_manager_cannot_view_unrelated_project_report(): void
    {
        $manager = User::factory()->manager()->create();
        $project = Project::factory()->create(['organization_id' => $manager->organization_id]);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->getJson("/api/v1/reports/projects/{$project->id}")
            ->assertUnprocessable();
    }
}
