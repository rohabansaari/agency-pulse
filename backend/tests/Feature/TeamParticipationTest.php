<?php

namespace Tests\Feature;

use App\Enums\TimeEntryStatus;
use App\Models\Project;
use App\Models\Team;
use App\Models\TimeEntry;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TeamParticipationTest extends TestCase
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

    public function test_manager_time_is_included_in_team_report_totals(): void
    {
        $manager = User::factory()->manager()->create();
        $employee = User::factory()->create(['organization_id' => $manager->organization_id]);

        $team = Team::factory()->create([
            'organization_id' => $manager->organization_id,
            'manager_id' => $manager->id,
        ]);
        $team->members()->attach($employee->id);

        TimeEntry::create([
            'organization_id' => $manager->organization_id,
            'user_id' => $manager->id,
            'type' => \App\Enums\TimeEntryType::Tracked,
            'duration' => 3600,
            'status' => TimeEntryStatus::Stopped,
            'start_time' => Carbon::today()->addHours(9),
            'end_time' => Carbon::today()->addHours(10),
        ]);

        TimeEntry::create([
            'organization_id' => $manager->organization_id,
            'user_id' => $employee->id,
            'type' => \App\Enums\TimeEntryType::Tracked,
            'duration' => 1800,
            'status' => TimeEntryStatus::Stopped,
            'start_time' => Carbon::today()->addHours(10),
            'end_time' => Carbon::today()->addHours(10)->addMinutes(30),
        ]);

        Sanctum::actingAs($manager);

        $response = $this->withHeaders($this->headers($manager))
            ->getJson('/api/v1/reports/manager')
            ->assertOk();

        $response->assertJsonPath('teams.0.hours_today_seconds', 5400);
        $response->assertJsonCount(2, 'teams.0.member_breakdown');

        $breakdown = collect($response->json('teams.0.member_breakdown'));
        $managerRow = $breakdown->firstWhere('user_id', $manager->id);
        $employeeRow = $breakdown->firstWhere('user_id', $employee->id);

        $this->assertNotNull($managerRow);
        $this->assertSame(3600, $managerRow['hours_today_seconds']);
        $this->assertSame(1800, $employeeRow['hours_today_seconds']);
    }

    public function test_employee_can_access_team_assigned_project_without_direct_assignment(): void
    {
        $manager = User::factory()->manager()->create();
        $employee = User::factory()->create(['organization_id' => $manager->organization_id]);
        $teammate = User::factory()->create(['organization_id' => $manager->organization_id]);

        $team = Team::factory()->create([
            'organization_id' => $manager->organization_id,
            'manager_id' => $manager->id,
        ]);
        $team->members()->attach([$employee->id, $teammate->id]);

        $project = Project::factory()->create(['organization_id' => $manager->organization_id]);
        $project->members()->attach($teammate->id, ['role_in_project' => 'worker']);

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/projects')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $project->id);
    }

    public function test_employee_dashboard_excludes_team_hours_from_personal_view(): void
    {
        $manager = User::factory()->manager()->create();
        $employee = User::factory()->create(['organization_id' => $manager->organization_id]);

        $team = Team::factory()->create([
            'organization_id' => $manager->organization_id,
            'manager_id' => $manager->id,
            'name' => 'Delivery Team',
        ]);
        $team->members()->attach($employee->id);

        TimeEntry::create([
            'organization_id' => $manager->organization_id,
            'user_id' => $manager->id,
            'type' => \App\Enums\TimeEntryType::Tracked,
            'duration' => 7200,
            'status' => TimeEntryStatus::Stopped,
            'start_time' => Carbon::today()->addHours(8),
            'end_time' => Carbon::today()->addHours(10),
        ]);

        TimeEntry::create([
            'organization_id' => $manager->organization_id,
            'user_id' => $employee->id,
            'type' => \App\Enums\TimeEntryType::Tracked,
            'duration' => 1800,
            'status' => TimeEntryStatus::Stopped,
            'start_time' => Carbon::today()->addHours(10),
            'end_time' => Carbon::today()->addHours(10)->addMinutes(30),
        ]);

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('team.name', 'Delivery Team')
            ->assertJsonPath('personal_report.hours_today_seconds', 1800)
            ->assertJsonMissingPath('team_summary');
    }
}
