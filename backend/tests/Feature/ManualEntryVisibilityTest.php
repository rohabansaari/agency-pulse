<?php

namespace Tests\Feature;

use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Models\Project;
use App\Models\Team;
use App\Models\TimeEntry;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ManualEntryVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private const MANUAL_SECONDS = 5400;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    private function headers(User $user): array
    {
        return ['X-Organization-Id' => (string) $user->organization_id];
    }

    /**
     * @return array{admin: User, manager: User, employee: User, project: Project, team: Team}
     */
    private function setupTeamFixture(): array
    {
        $admin = User::factory()->admin()->create();
        $manager = User::factory()->manager()->create(['organization_id' => $admin->organization_id]);
        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);

        $project = Project::factory()->create(['organization_id' => $admin->organization_id]);
        $project->members()->attach($employee->id, ['role_in_project' => 'worker']);

        $team = Team::factory()->create([
            'organization_id' => $admin->organization_id,
            'manager_id' => $manager->id,
        ]);
        $team->members()->attach($employee->id);

        return compact('admin', 'manager', 'employee', 'project', 'team');
    }

    private function approvedManualEntry(
        User $employee,
        User $manager,
        Team $team,
        Project $project,
        int $duration = self::MANUAL_SECONDS
    ): TimeEntry {
        return TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $employee->organization_id,
            'type' => TimeEntryType::Manual,
            'team_id' => $team->id,
            'project_id' => $project->id,
            'manager_id' => $manager->id,
            'duration' => $duration,
            'description' => 'Approved manual work',
            'status' => TimeEntryStatus::Approved,
            'approved_by' => $manager->id,
            'approved_at' => now(),
            'start_time' => Carbon::today()->addHours(9),
            'end_time' => Carbon::today()->addHours(9)->addSeconds($duration),
        ]);
    }

    public function test_approved_manual_entry_appears_on_employee_dashboard(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'project' => $project, 'team' => $team] = $this->setupTeamFixture();
        $this->approvedManualEntry($employee, $manager, $team, $project);

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('today_total_seconds', self::MANUAL_SECONDS)
            ->assertJsonPath('personal_report.hours_today_seconds', self::MANUAL_SECONDS)
            ->assertJsonPath('week_total_seconds', self::MANUAL_SECONDS);
    }

    public function test_pending_manual_entry_excluded_from_employee_dashboard(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'project' => $project, 'team' => $team] = $this->setupTeamFixture();

        TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $employee->organization_id,
            'type' => TimeEntryType::Manual,
            'team_id' => $team->id,
            'project_id' => $project->id,
            'manager_id' => $manager->id,
            'duration' => self::MANUAL_SECONDS,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today()->addHours(9),
            'end_time' => Carbon::today()->addHours(10)->addMinutes(30),
        ]);

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('today_total_seconds', 0)
            ->assertJsonPath('personal_report.hours_today_seconds', 0);
    }

    public function test_approved_manual_entry_appears_on_admin_dashboard_and_org_report(): void
    {
        ['admin' => $admin, 'manager' => $manager, 'employee' => $employee, 'project' => $project, 'team' => $team] = $this->setupTeamFixture();
        $this->approvedManualEntry($employee, $manager, $team, $project);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('today_tracked_seconds', self::MANUAL_SECONDS)
            ->assertJsonPath('week_tracked_seconds', self::MANUAL_SECONDS);

        $teamUtil = collect(
            $this->withHeaders($this->headers($admin))
                ->getJson('/api/v1/dashboard')
                ->json('team_utilization')
        );
        $teamRow = $teamUtil->firstWhere('team_id', $team->id);
        $this->assertNotNull($teamRow);
        $this->assertSame(self::MANUAL_SECONDS, $teamRow['tracked_seconds']);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/reports/organization')
            ->assertOk()
            ->assertJsonPath('hours_today_seconds', self::MANUAL_SECONDS)
            ->assertJsonPath('hours_week_seconds', self::MANUAL_SECONDS);
    }

    public function test_approved_manual_entry_appears_in_manager_dashboard_and_team_report(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'project' => $project, 'team' => $team] = $this->setupTeamFixture();
        $this->approvedManualEntry($employee, $manager, $team, $project);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('teams.0.hours_today_seconds', self::MANUAL_SECONDS)
            ->assertJsonPath('summary.hours_today_seconds', self::MANUAL_SECONDS);

        $report = $this->withHeaders($this->headers($manager))
            ->getJson('/api/v1/reports/manager')
            ->assertOk()
            ->assertJsonPath('teams.0.hours_today_seconds', self::MANUAL_SECONDS)
            ->assertJsonPath('teams.0.hours_week_seconds', self::MANUAL_SECONDS);

        $breakdown = collect($report->json('teams.0.member_breakdown'));
        $employeeRow = $breakdown->firstWhere('user_id', $employee->id);
        $this->assertNotNull($employeeRow);
        $this->assertSame(self::MANUAL_SECONDS, $employeeRow['hours_today_seconds']);
        $this->assertSame(self::MANUAL_SECONDS, $employeeRow['hours_week_seconds']);
    }

    public function test_approved_manual_entry_appears_in_project_report(): void
    {
        ['admin' => $admin, 'manager' => $manager, 'employee' => $employee, 'project' => $project, 'team' => $team] = $this->setupTeamFixture();
        $this->approvedManualEntry($employee, $manager, $team, $project);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson("/api/v1/reports/projects/{$project->id}")
            ->assertOk()
            ->assertJsonPath('total_tracked_seconds', self::MANUAL_SECONDS)
            ->assertJsonPath('hours_today_seconds', self::MANUAL_SECONDS)
            ->assertJsonPath('employee_contributions.0.total_seconds', (string) self::MANUAL_SECONDS)
            ->assertJsonPath('team_contributions.0.total_seconds', self::MANUAL_SECONDS);
    }

    public function test_manual_and_tracked_hours_combine_in_team_totals(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'project' => $project, 'team' => $team] = $this->setupTeamFixture();

        TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $employee->organization_id,
            'type' => TimeEntryType::Tracked,
            'project_id' => $project->id,
            'duration' => 3600,
            'status' => TimeEntryStatus::Stopped,
            'start_time' => Carbon::today()->addHours(8),
            'end_time' => Carbon::today()->addHours(9),
        ]);

        $this->approvedManualEntry($employee, $manager, $team, $project, 1800);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->getJson('/api/v1/reports/manager')
            ->assertOk()
            ->assertJsonPath('teams.0.hours_today_seconds', 5400);
    }
}
