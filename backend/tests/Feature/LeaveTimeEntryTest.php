<?php

namespace Tests\Feature;

use App\Enums\TimeEntrySource;
use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Models\Team;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Reporting\UtilizationCalculator;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LeaveTimeEntryTest extends TestCase
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

    private function displayDate(Carbon $date): string
    {
        return $date->format('d/m/Y');
    }

    /**
     * @return array{manager: User, employee: User, team: Team}
     */
    private function setupTeamEmployee(): array
    {
        $manager = User::factory()->manager()->create();
        $employee = User::factory()->create(['organization_id' => $manager->organization_id]);

        $team = Team::factory()->create([
            'organization_id' => $manager->organization_id,
            'manager_id' => $manager->id,
        ]);
        $team->members()->attach($employee->id);

        return compact('manager', 'employee', 'team');
    }

    public function test_employee_leave_context_returns_team_and_managers(): void
    {
        ['manager' => $manager, 'employee' => $employee] = $this->setupTeamEmployee();

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/time/leave/context')
            ->assertOk()
            ->assertJsonPath('can_request', true)
            ->assertJsonPath('manager.id', $manager->id)
            ->assertJsonStructure(['team' => ['id', 'name'], 'manager' => ['id', 'name']]);
    }

    public function test_employee_without_team_cannot_request_leave(): void
    {
        $employee = User::factory()->create();
        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->postJson('/api/v1/time/leave', [
                'leave_category' => 'annual',
                'date' => $this->displayDate(Carbon::today()),
                'reason' => 'Vacation',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['team']);
    }

    public function test_employee_cannot_request_leave_for_past_dates(): void
    {
        ['employee' => $employee] = $this->setupTeamEmployee();

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->postJson('/api/v1/time/leave', [
                'leave_category' => 'annual',
                'date' => $this->displayDate(Carbon::yesterday()),
                'reason' => 'Retroactive leave',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date'])
            ->assertJson([
                'errors' => [
                    'date' => ['Past dates are not allowed for leave requests'],
                ],
            ]);
    }

    public function test_manager_can_create_leave_for_past_dates(): void
    {
        ['manager' => $manager, 'employee' => $employee] = $this->setupTeamEmployee();

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->postJson('/api/v1/time/leave', [
                'leave_category' => 'annual',
                'user_id' => $employee->id,
                'date' => $this->displayDate(Carbon::yesterday()),
                'reason' => 'Backdated PTO',
            ])
            ->assertCreated()
            ->assertJsonPath('entries.0.status', TimeEntryStatus::Approved->value)
            ->assertJsonPath('entries.0.start_time', $this->displayDate(Carbon::yesterday()));
    }

    public function test_leave_api_rejects_iso_date_format(): void
    {
        ['employee' => $employee] = $this->setupTeamEmployee();

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->postJson('/api/v1/time/leave', [
                'leave_category' => 'annual',
                'date' => Carbon::today()->toDateString(),
                'reason' => 'Wrong format',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date']);
    }

    public function test_employee_can_request_single_day_leave(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'team' => $team] = $this->setupTeamEmployee();

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->postJson('/api/v1/time/leave', [
                'leave_category' => 'annual',
                'date' => $this->displayDate(Carbon::today()),
                'reason' => 'Doctor appointment',
            ])
            ->assertCreated()
            ->assertJsonCount(1, 'entries')
            ->assertJsonPath('entries.0.status', TimeEntryStatus::Pending->value)
            ->assertJsonPath('entries.0.type', TimeEntryType::Leave->value)
            ->assertJsonPath('entries.0.source', TimeEntrySource::Employee->value)
            ->assertJsonPath('entries.0.start_time', $this->displayDate(Carbon::today()));

        $this->assertDatabaseHas('time_entries', [
            'user_id' => $employee->id,
            'team_id' => $team->id,
            'manager_id' => $manager->id,
            'type' => TimeEntryType::Leave->value,
            'status' => TimeEntryStatus::Pending->value,
            'is_paid' => true,
            'source' => TimeEntrySource::Employee->value,
            'duration' => UtilizationCalculator::SECONDS_PER_WORK_DAY,
        ]);
    }

    public function test_employee_can_request_date_range_leave(): void
    {
        ['employee' => $employee] = $this->setupTeamEmployee();

        Sanctum::actingAs($employee);

        $start = $this->displayDate(Carbon::today());
        $end = $this->displayDate(Carbon::today()->addDays(2));

        $this->withHeaders($this->headers($employee))
            ->postJson('/api/v1/time/leave', [
                'leave_category' => 'annual',
                'start_date' => $start,
                'end_date' => $end,
                'reason' => 'Family trip',
            ])
            ->assertCreated()
            ->assertJsonCount(3, 'entries');
    }

    public function test_manager_can_approve_team_leave(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'team' => $team] = $this->setupTeamEmployee();

        $entry = TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $manager->organization_id,
            'type' => TimeEntryType::Leave,
            'team_id' => $team->id,
            'manager_id' => $manager->id,
            'duration' => UtilizationCalculator::SECONDS_PER_WORK_DAY,
            'description' => 'Sick day',
            'is_paid' => true,
            'source' => TimeEntrySource::Employee,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHours(8),
        ]);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->postJson("/api/v1/time/leave/{$entry->id}/approve")
            ->assertOk()
            ->assertJsonPath('entry.status', TimeEntryStatus::Approved->value);
    }

    public function test_manager_can_reject_team_leave(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'team' => $team] = $this->setupTeamEmployee();

        $entry = TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $manager->organization_id,
            'type' => TimeEntryType::Leave,
            'team_id' => $team->id,
            'manager_id' => $manager->id,
            'duration' => UtilizationCalculator::SECONDS_PER_WORK_DAY,
            'description' => 'Declined leave',
            'is_paid' => true,
            'source' => TimeEntrySource::Employee,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHours(8),
        ]);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->postJson("/api/v1/time/leave/{$entry->id}/reject")
            ->assertOk()
            ->assertJsonPath('entry.status', TimeEntryStatus::Rejected->value);
    }

    public function test_manager_cannot_reject_leave_assigned_to_other_manager(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'team' => $team] = $this->setupTeamEmployee();
        $otherManager = User::factory()->manager()->create(['organization_id' => $manager->organization_id]);

        $entry = TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $manager->organization_id,
            'type' => TimeEntryType::Leave,
            'team_id' => $team->id,
            'manager_id' => $otherManager->id,
            'duration' => UtilizationCalculator::SECONDS_PER_WORK_DAY,
            'is_paid' => true,
            'source' => TimeEntrySource::Employee,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHours(8),
        ]);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->postJson("/api/v1/time/leave/{$entry->id}/reject")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['authorization']);
    }

    public function test_manager_cannot_approve_leave_assigned_to_other_manager(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'team' => $team] = $this->setupTeamEmployee();
        $otherManager = User::factory()->manager()->create(['organization_id' => $manager->organization_id]);

        $entry = TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $manager->organization_id,
            'type' => TimeEntryType::Leave,
            'team_id' => $team->id,
            'manager_id' => $otherManager->id,
            'duration' => UtilizationCalculator::SECONDS_PER_WORK_DAY,
            'is_paid' => true,
            'source' => TimeEntrySource::Employee,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHours(8),
        ]);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->postJson("/api/v1/time/leave/{$entry->id}/approve")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['authorization']);
    }

    public function test_manager_can_create_auto_approved_leave_for_team_member(): void
    {
        ['manager' => $manager, 'employee' => $employee] = $this->setupTeamEmployee();

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->postJson('/api/v1/time/leave', [
                'leave_category' => 'annual',
                'user_id' => $employee->id,
                'date' => $this->displayDate(Carbon::today()),
                'reason' => 'Approved PTO',
            ])
            ->assertCreated()
            ->assertJsonPath('entries.0.status', TimeEntryStatus::Approved->value)
            ->assertJsonPath('entries.0.source', TimeEntrySource::Manager->value);
    }

    public function test_admin_can_create_approved_leave_for_any_employee(): void
    {
        ['employee' => $employee, 'team' => $team] = $this->setupTeamEmployee();
        $admin = User::factory()->admin()->create(['organization_id' => $employee->organization_id]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/time/leave', [
                'leave_category' => 'annual',
                'user_id' => $employee->id,
                'date' => $this->displayDate(Carbon::today()),
                'reason' => 'HR backdated leave',
                'team_id' => $team->id,
            ])
            ->assertCreated()
            ->assertJsonPath('entries.0.status', TimeEntryStatus::Approved->value)
            ->assertJsonPath('entries.0.source', TimeEntrySource::Admin->value);
    }

    public function test_admin_can_override_leave_status(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'team' => $team] = $this->setupTeamEmployee();
        $admin = User::factory()->admin()->create(['organization_id' => $employee->organization_id]);

        $entry = TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $manager->organization_id,
            'type' => TimeEntryType::Leave,
            'team_id' => $team->id,
            'manager_id' => $manager->id,
            'duration' => UtilizationCalculator::SECONDS_PER_WORK_DAY,
            'description' => 'Pending leave',
            'is_paid' => true,
            'source' => TimeEntrySource::Employee,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHours(8),
        ]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->patchJson("/api/v1/time/leave/{$entry->id}", [
                'status' => TimeEntryStatus::Approved->value,
                'reason' => 'Admin override',
            ])
            ->assertOk()
            ->assertJsonPath('entry.status', TimeEntryStatus::Approved->value)
            ->assertJsonPath('entry.description', 'Admin override');
    }

    public function test_pending_leave_does_not_count_toward_personal_totals(): void
    {
        ['employee' => $employee] = $this->setupTeamEmployee();

        TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $employee->organization_id,
            'type' => TimeEntryType::Leave,
            'duration' => UtilizationCalculator::SECONDS_PER_WORK_DAY,
            'description' => 'Pending',
            'is_paid' => true,
            'source' => TimeEntrySource::Employee,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHours(8),
        ]);

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/time/personal-report')
            ->assertOk()
            ->assertJsonPath('hours_today_seconds', 0);
    }

    public function test_approved_paid_leave_counts_toward_personal_totals(): void
    {
        ['manager' => $manager, 'employee' => $employee] = $this->setupTeamEmployee();

        TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $employee->organization_id,
            'type' => TimeEntryType::Leave,
            'duration' => UtilizationCalculator::SECONDS_PER_WORK_DAY,
            'description' => 'Approved PTO',
            'is_paid' => true,
            'source' => TimeEntrySource::Manager,
            'status' => TimeEntryStatus::Approved,
            'approved_by' => $manager->id,
            'approved_at' => now(),
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHours(8),
        ]);

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/time/personal-report')
            ->assertOk()
            ->assertJsonPath('hours_today_seconds', UtilizationCalculator::SECONDS_PER_WORK_DAY);
    }

    public function test_personal_report_includes_leave_breakdown(): void
    {
        ['employee' => $employee] = $this->setupTeamEmployee();

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/time/personal-report')
            ->assertOk()
            ->assertJsonStructure([
                'leave_breakdown' => [
                    'today' => ['paid_seconds', 'pending_seconds', 'rejected_seconds'],
                    'week' => ['paid_seconds', 'pending_seconds', 'rejected_seconds'],
                    'month' => ['paid_seconds', 'pending_seconds', 'rejected_seconds'],
                ],
            ]);
    }

    public function test_manager_sees_only_team_pending_leave(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'team' => $team] = $this->setupTeamEmployee();
        $other = User::factory()->create(['organization_id' => $manager->organization_id]);

        TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $manager->organization_id,
            'type' => TimeEntryType::Leave,
            'team_id' => $team->id,
            'manager_id' => $manager->id,
            'duration' => UtilizationCalculator::SECONDS_PER_WORK_DAY,
            'is_paid' => true,
            'source' => TimeEntrySource::Employee,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHours(8),
        ]);

        TimeEntry::create([
            'user_id' => $other->id,
            'organization_id' => $manager->organization_id,
            'type' => TimeEntryType::Leave,
            'manager_id' => $manager->id,
            'duration' => UtilizationCalculator::SECONDS_PER_WORK_DAY,
            'is_paid' => true,
            'source' => TimeEntrySource::Employee,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHours(8),
        ]);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->getJson('/api/v1/time/leave/pending')
            ->assertOk()
            ->assertJsonCount(1);
    }

    public function test_employee_can_view_own_leave_history(): void
    {
        ['employee' => $employee] = $this->setupTeamEmployee();

        TimeEntry::create([
            'user_id' => $employee->id,
            'organization_id' => $employee->organization_id,
            'type' => TimeEntryType::Leave,
            'duration' => UtilizationCalculator::SECONDS_PER_WORK_DAY,
            'is_paid' => true,
            'source' => TimeEntrySource::Employee,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHours(8),
        ]);

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/time/leave')
            ->assertOk()
            ->assertJsonCount(1);
    }

    public function test_manager_can_request_leave_for_self_pending_admin_approval(): void
    {
        $manager = User::factory()->manager()->create();

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->postJson('/api/v1/time/leave', [
                'date' => $this->displayDate(Carbon::today()),
                'reason' => 'Personal day',
                'leave_category' => 'annual',
                'for_self' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('entries.0.status', TimeEntryStatus::Pending->value)
            ->assertJsonPath('entries.0.user_id', $manager->id);
    }

    public function test_admin_sees_manager_self_leave_in_pending_queue(): void
    {
        $admin = User::factory()->admin()->create();
        $manager = User::factory()->manager()->create([
            'organization_id' => $admin->organization_id,
        ]);

        TimeEntry::create([
            'user_id' => $manager->id,
            'organization_id' => $admin->organization_id,
            'type' => TimeEntryType::Leave,
            'duration' => UtilizationCalculator::SECONDS_PER_WORK_DAY,
            'is_paid' => true,
            'source' => TimeEntrySource::Manager,
            'status' => TimeEntryStatus::Pending,
            'start_time' => Carbon::today(),
            'end_time' => Carbon::today()->addHours(8),
        ]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/time/leave/pending')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.user_id', $manager->id);
    }
}
