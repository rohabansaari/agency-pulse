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

class ManualTimeEntryTest extends TestCase
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

    /**
     * @return array{manager: User, employee: User, project: Project, team: Team}
     */
    private function setupEligibleEmployee(): array
    {
        $manager = User::factory()->manager()->create();
        $employee = User::factory()->create(['organization_id' => $manager->organization_id]);
        $project = Project::factory()->create(['organization_id' => $manager->organization_id]);

        $team = Team::factory()->create([
            'organization_id' => $manager->organization_id,
            'manager_id' => $manager->id,
        ]);
        $team->members()->attach($employee->id);
        $project->members()->attach($employee->id, ['role_in_project' => 'worker']);

        return compact('manager', 'employee', 'project', 'team');
    }

    public function test_employee_without_team_cannot_submit_manual_time_entry(): void
    {
        $manager = User::factory()->manager()->create();
        $employee = User::factory()->create(['organization_id' => $manager->organization_id]);
        $project = Project::factory()->create(['organization_id' => $manager->organization_id]);
        $project->members()->attach($employee->id, ['role_in_project' => 'worker']);

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->postJson('/api/v1/time/manual', [
                'date' => Carbon::today()->toDateString(),
                'duration' => 3600,
                'description' => 'Client meeting notes',
                'project_id' => $project->id,
                'manager_id' => $manager->id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['team']);

        $this->assertDatabaseMissing('time_entries', [
            'user_id' => $employee->id,
            'type' => TimeEntryType::Manual->value,
        ]);
    }

    public function test_employee_without_project_access_cannot_submit_manual_time_entry(): void
    {
        $manager = User::factory()->manager()->create();
        $employee = User::factory()->create(['organization_id' => $manager->organization_id]);
        $project = Project::factory()->create(['organization_id' => $manager->organization_id]);

        $team = Team::factory()->create([
            'organization_id' => $manager->organization_id,
            'manager_id' => $manager->id,
        ]);
        $team->members()->attach($employee->id);

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->postJson('/api/v1/time/manual', [
                'date' => Carbon::today()->toDateString(),
                'duration' => 3600,
                'description' => 'Client meeting notes',
                'project_id' => $project->id,
                'manager_id' => $manager->id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['project_id']);
    }

    public function test_employee_can_submit_manual_time_entry(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'project' => $project, 'team' => $team] = $this->setupEligibleEmployee();

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->postJson('/api/v1/time/manual', [
                'date' => Carbon::today()->toDateString(),
                'duration' => 3600,
                'description' => 'Client meeting notes',
                'project_id' => $project->id,
                'manager_id' => $manager->id,
            ])
            ->assertCreated()
            ->assertJsonPath('entry.status', TimeEntryStatus::Pending->value)
            ->assertJsonPath('entry.project_id', $project->id)
            ->assertJsonPath('entry.manager_id', $manager->id);

        $this->assertDatabaseHas('time_entries', [
            'user_id' => $employee->id,
            'team_id' => $team->id,
            'project_id' => $project->id,
            'manager_id' => $manager->id,
            'type' => TimeEntryType::Manual->value,
            'status' => TimeEntryStatus::Pending->value,
        ]);
    }

    public function test_employee_context_returns_projects_and_managers_when_eligible(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'project' => $project] = $this->setupEligibleEmployee();

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/time/manual/context')
            ->assertOk()
            ->assertJsonPath('can_create', true)
            ->assertJsonPath('managers.0.id', $manager->id)
            ->assertJsonPath('projects.0.id', $project->id);
    }

    public function test_manager_can_create_manual_time_entry_for_team_member(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'project' => $project, 'team' => $team] = $this->setupEligibleEmployee();

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->postJson('/api/v1/time/manual', [
                'user_id' => $employee->id,
                'date' => Carbon::today()->toDateString(),
                'duration' => 3600,
                'description' => 'Correction',
                'project_id' => $project->id,
            ])
            ->assertCreated()
            ->assertJsonPath('entry.user_id', $employee->id)
            ->assertJsonPath('entry.status', TimeEntryStatus::Approved->value)
            ->assertJsonPath('entry.project_id', $project->id);

        $this->assertDatabaseHas('time_entries', [
            'user_id' => $employee->id,
            'team_id' => $team->id,
            'project_id' => $project->id,
            'manager_id' => $manager->id,
            'type' => TimeEntryType::Manual->value,
            'status' => TimeEntryStatus::Approved->value,
            'approved_by' => $manager->id,
        ]);
    }

    public function test_manager_context_returns_team_members_and_projects(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'project' => $project] = $this->setupEligibleEmployee();

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->getJson('/api/v1/time/manual/context')
            ->assertOk()
            ->assertJsonPath('can_create', true)
            ->assertJsonPath('can_create_self', true)
            ->assertJsonPath('self_projects.0.id', $project->id)
            ->assertJsonPath('team_members.0.id', $employee->id)
            ->assertJsonPath('team_members.0.projects.0.id', $project->id);
    }

    public function test_manager_can_submit_manual_time_for_self_pending_admin_approval(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'project' => $project, 'team' => $team] = $this->setupEligibleEmployee();

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->postJson('/api/v1/time/manual', [
                'for_self' => true,
                'date' => Carbon::today()->toDateString(),
                'duration' => 5400,
                'description' => 'Manager client work',
                'project_id' => $project->id,
            ])
            ->assertCreated()
            ->assertJsonPath('entry.user_id', $manager->id)
            ->assertJsonPath('entry.status', TimeEntryStatus::Pending->value);

        $this->assertDatabaseHas('time_entries', [
            'user_id' => $manager->id,
            'project_id' => $project->id,
            'team_id' => $team->id,
            'manager_id' => null,
            'type' => TimeEntryType::Manual->value,
            'status' => TimeEntryStatus::Pending->value,
        ]);
    }

    public function test_manager_self_entry_appears_in_admin_pending_not_manager_queue(): void
    {
        ['manager' => $manager, 'project' => $project] = $this->setupEligibleEmployee();
        $admin = User::factory()->admin()->create(['organization_id' => $manager->organization_id]);

        TimeEntry::create([
            'user_id' => $manager->id,
            'organization_id' => $manager->organization_id,
            'type' => TimeEntryType::Manual,
            'project_id' => $project->id,
            'duration' => 3600,
            'description' => 'Pending manager self entry',
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHour(),
        ]);

        Sanctum::actingAs($manager);
        $this->withHeaders($this->headers($manager))
            ->getJson('/api/v1/time/manual/pending')
            ->assertOk()
            ->assertJsonCount(0);

        Sanctum::actingAs($admin);
        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/time/manual/pending')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.user_id', $manager->id);
    }

    public function test_admin_can_approve_manager_self_manual_entry(): void
    {
        ['manager' => $manager, 'project' => $project] = $this->setupEligibleEmployee();
        $admin = User::factory()->admin()->create(['organization_id' => $manager->organization_id]);

        $entry = TimeEntry::create([
            'user_id' => $manager->id,
            'organization_id' => $manager->organization_id,
            'type' => TimeEntryType::Manual,
            'project_id' => $project->id,
            'duration' => 3600,
            'description' => 'Manager hours',
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHour(),
        ]);

        Sanctum::actingAs($admin);
        $this->withHeaders($this->headers($admin))
            ->postJson("/api/v1/time/manual/{$entry->id}/approve")
            ->assertOk()
            ->assertJsonPath('entry.status', TimeEntryStatus::Approved->value)
            ->assertJsonPath('entry.approved_by', $admin->id);
    }

    public function test_manager_cannot_approve_own_manual_entry(): void
    {
        ['manager' => $manager, 'project' => $project] = $this->setupEligibleEmployee();

        $entry = TimeEntry::create([
            'user_id' => $manager->id,
            'organization_id' => $manager->organization_id,
            'type' => TimeEntryType::Manual,
            'project_id' => $project->id,
            'duration' => 3600,
            'description' => 'Own entry',
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHour(),
        ]);

        Sanctum::actingAs($manager);
        $this->withHeaders($this->headers($manager))
            ->postJson("/api/v1/time/manual/{$entry->id}/approve")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['authorization']);
    }

    public function test_admin_can_create_manual_entry_for_employee(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'project' => $project, 'team' => $team] = $this->setupEligibleEmployee();
        $admin = User::factory()->admin()->create(['organization_id' => $employee->organization_id]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/time/manual', [
                'user_id' => $employee->id,
                'date' => Carbon::today()->toDateString(),
                'duration' => 3600,
                'description' => 'HR correction',
                'project_id' => $project->id,
                'manager_id' => $manager->id,
                'team_id' => $team->id,
            ])
            ->assertCreated()
            ->assertJsonPath('entry.user_id', $employee->id)
            ->assertJsonPath('entry.status', TimeEntryStatus::Approved->value);

        $this->assertDatabaseHas('time_entries', [
            'user_id' => $employee->id,
            'type' => TimeEntryType::Manual->value,
            'status' => TimeEntryStatus::Approved->value,
            'approved_by' => $admin->id,
            'manager_id' => $manager->id,
        ]);
    }

    public function test_employee_can_view_manual_entry_history(): void
    {
        $employee = User::factory()->create();

        TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $employee->organization_id,
            'type' => TimeEntryType::Manual,
            'duration' => 1800,
            'status' => TimeEntryStatus::Approved,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addMinutes(30),
        ]);

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/time/manual')
            ->assertOk()
            ->assertJsonCount(1);
    }

    public function test_pending_manual_entry_does_not_count_toward_personal_totals(): void
    {
        $employee = User::factory()->create();

        TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $employee->organization_id,
            'type' => TimeEntryType::Manual,
            'duration' => 7200,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today()->addHours(9),
            'end_time' => Carbon::today()->addHours(11),
        ]);

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/time/personal-report')
            ->assertOk()
            ->assertJsonPath('hours_today_seconds', 0);
    }

    public function test_approved_manual_entry_counts_toward_personal_totals(): void
    {
        $admin = User::factory()->admin()->create();
        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);

        TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $employee->organization_id,
            'type' => TimeEntryType::Manual,
            'duration' => 5400,
            'status' => TimeEntryStatus::Approved,
            'start_time' => Carbon::today()->addHours(9),
            'end_time' => Carbon::today()->addHours(10)->addMinutes(30),
            'approved_by' => $admin->id,
            'approved_at' => now(),
        ]);

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/time/personal-report')
            ->assertOk()
            ->assertJsonPath('hours_today_seconds', 5400);
    }

    public function test_manager_can_approve_assigned_manual_entry(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'project' => $project, 'team' => $team] = $this->setupEligibleEmployee();

        $entry = TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $manager->organization_id,
            'type' => TimeEntryType::Manual,
            'team_id' => $team->id,
            'project_id' => $project->id,
            'manager_id' => $manager->id,
            'duration' => 3600,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHour(),
            'description' => 'Needs approval',
        ]);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->postJson("/api/v1/time/manual/{$entry->id}/approve")
            ->assertOk()
            ->assertJsonPath('entry.status', TimeEntryStatus::Approved->value);

        $this->assertDatabaseHas('time_entries', [
            'id' => $entry->id,
            'status' => TimeEntryStatus::Approved->value,
            'approved_by' => $manager->id,
        ]);
    }

    public function test_manager_can_reject_assigned_manual_entry(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'project' => $project, 'team' => $team] = $this->setupEligibleEmployee();

        $entry = TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $manager->organization_id,
            'type' => TimeEntryType::Manual,
            'team_id' => $team->id,
            'project_id' => $project->id,
            'manager_id' => $manager->id,
            'duration' => 3600,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHour(),
            'description' => 'Reject me',
        ]);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->postJson("/api/v1/time/manual/{$entry->id}/reject")
            ->assertOk()
            ->assertJsonPath('entry.status', TimeEntryStatus::Rejected->value);

        $this->assertDatabaseHas('time_entries', [
            'id' => $entry->id,
            'status' => TimeEntryStatus::Rejected->value,
            'approved_by' => $manager->id,
        ]);
    }

    public function test_manager_cannot_reject_entry_assigned_to_another_manager(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'project' => $project, 'team' => $team] = $this->setupEligibleEmployee();
        $otherManager = User::factory()->manager()->create(['organization_id' => $manager->organization_id]);

        $entry = TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $manager->organization_id,
            'type' => TimeEntryType::Manual,
            'team_id' => $team->id,
            'project_id' => $project->id,
            'manager_id' => $otherManager->id,
            'duration' => 3600,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHour(),
        ]);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->postJson("/api/v1/time/manual/{$entry->id}/reject")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['authorization']);
    }

    public function test_manager_cannot_approve_entry_assigned_to_another_manager(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'project' => $project, 'team' => $team] = $this->setupEligibleEmployee();
        $otherManager = User::factory()->manager()->create(['organization_id' => $manager->organization_id]);

        $entry = TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $manager->organization_id,
            'type' => TimeEntryType::Manual,
            'team_id' => $team->id,
            'project_id' => $project->id,
            'manager_id' => $otherManager->id,
            'duration' => 3600,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHour(),
        ]);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->postJson("/api/v1/time/manual/{$entry->id}/approve")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['authorization']);
    }

    public function test_manager_sees_only_entries_assigned_to_them(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'project' => $project, 'team' => $team] = $this->setupEligibleEmployee();
        $otherManager = User::factory()->manager()->create(['organization_id' => $manager->organization_id]);
        $other = User::factory()->create(['organization_id' => $manager->organization_id]);

        TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $manager->organization_id,
            'type' => TimeEntryType::Manual,
            'team_id' => $team->id,
            'project_id' => $project->id,
            'manager_id' => $manager->id,
            'duration' => 3600,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHour(),
        ]);

        TimeEntry::create([
            'user_id' => $other->id,
            'organization_id' => $manager->organization_id,
            'type' => TimeEntryType::Manual,
            'manager_id' => $otherManager->id,
            'duration' => 1800,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addMinutes(30),
        ]);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->getJson('/api/v1/time/manual/pending')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.user_id', $employee->id);
    }

    public function test_employee_dashboard_has_no_team_reporting_fields(): void
    {
        ['manager' => $manager, 'employee' => $employee] = $this->setupEligibleEmployee();

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonStructure([
                'personal_report' => [
                    'hours_today_seconds',
                    'hours_week_seconds',
                    'hours_month_seconds',
                ],
                'team' => ['id', 'name'],
            ])
            ->assertJsonMissingPath('team_summary')
            ->assertJsonMissingPath('team.manager_name');
    }
}
