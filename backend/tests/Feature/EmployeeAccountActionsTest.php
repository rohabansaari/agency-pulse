<?php

namespace Tests\Feature;

use App\Enums\OrganizationMemberStatus;
use App\Enums\PayrollRunStatus;
use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\TimeEntry;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmployeeAccountActionsTest extends TestCase
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
     * @return array{admin: User, employee: User, member: OrganizationMember}
     */
    private function fixture(): array
    {
        $admin = User::factory()->admin()->create();
        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);
        $member = $employee->memberships()->firstOrFail();

        Sanctum::actingAs($admin);

        return ['admin' => $admin, 'employee' => $employee, 'member' => $member];
    }

    public function test_admin_can_change_employee_email(): void
    {
        ['admin' => $admin, 'employee' => $employee, 'member' => $member] = $this->fixture();

        $this->withHeaders($this->headers($admin))
            ->patchJson("/api/v1/team/{$member->id}", ['email' => 'new.address@example.com'])
            ->assertOk()
            ->assertJsonPath('member.email', 'new.address@example.com');

        $this->assertSame('new.address@example.com', $employee->fresh()->email);
    }

    public function test_email_must_be_unique(): void
    {
        ['admin' => $admin, 'member' => $member] = $this->fixture();

        $this->withHeaders($this->headers($admin))
            ->patchJson("/api/v1/team/{$member->id}", ['email' => $admin->email])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_email_of_member_in_another_organization_cannot_be_changed(): void
    {
        ['admin' => $admin, 'employee' => $employee, 'member' => $member] = $this->fixture();
        OrganizationMember::factory()->create([
            'organization_id' => Organization::factory()->create()->id,
            'user_id' => $employee->id,
        ]);

        $this->withHeaders($this->headers($admin))
            ->patchJson("/api/v1/team/{$member->id}", ['email' => 'new.address@example.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_deactivating_employee_stops_running_timer(): void
    {
        ['admin' => $admin, 'employee' => $employee, 'member' => $member] = $this->fixture();
        $entry = TimeEntry::query()->create([
            'user_id' => $employee->id,
            'organization_id' => $admin->organization_id,
            'type' => TimeEntryType::Tracked,
            'start_time' => now()->subHour(),
            'status' => TimeEntryStatus::Running,
        ]);

        $this->withHeaders($this->headers($admin))
            ->patchJson("/api/v1/team/{$member->id}", ['status' => OrganizationMemberStatus::Suspended->value])
            ->assertOk();

        $entry->refresh();
        $this->assertSame(TimeEntryStatus::Stopped, $entry->status);
        $this->assertNotNull($entry->end_time);
    }

    public function test_admin_can_delete_employee(): void
    {
        ['admin' => $admin, 'employee' => $employee, 'member' => $member] = $this->fixture();
        TimeEntry::query()->create([
            'user_id' => $employee->id,
            'organization_id' => $admin->organization_id,
            'type' => TimeEntryType::Tracked,
            'start_time' => now()->subHour(),
            'end_time' => now(),
            'duration' => 3600,
            'status' => TimeEntryStatus::Stopped,
        ]);

        $this->withHeaders($this->headers($admin))
            ->deleteJson("/api/v1/team/{$member->id}")
            ->assertOk();

        $this->assertDatabaseMissing('organization_members', ['id' => $member->id]);
        $this->assertDatabaseMissing('users', ['id' => $employee->id]);
        $this->assertDatabaseMissing('time_entries', ['user_id' => $employee->id]);
    }

    public function test_employee_in_finalized_payroll_cannot_be_deleted(): void
    {
        ['admin' => $admin, 'employee' => $employee, 'member' => $member] = $this->fixture();
        $runId = DB::table('payroll_runs')->insertGetId([
            'organization_id' => $admin->organization_id,
            'period_start' => now()->subMonth()->toDateString(),
            'period_end' => now()->toDateString(),
            'status' => PayrollRunStatus::Finalized->value,
            'created_by' => $admin->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('payroll_run_employee_records')->insert([
            'payroll_run_id' => $runId,
            'user_id' => $employee->id,
            'salary_type' => 'hourly',
            'payable_hours_seconds' => 3600,
            'gross_salary_snapshot' => 100,
            'deduction_mode_snapshot' => 'none',
            'working_days_per_month_snapshot' => 22,
            'working_hours_per_day_snapshot' => 8,
            'income_tax_percent_snapshot' => 0,
            'eobi_percent_snapshot' => 0,
            'social_security_percent_snapshot' => 0,
            'custom_deduction_percent_snapshot' => 0,
            'income_tax_snapshot' => 0,
            'eobi_snapshot' => 0,
            'social_security_snapshot' => 0,
            'custom_deduction_snapshot' => 0,
            'net_salary_snapshot' => 100,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->withHeaders($this->headers($admin))
            ->deleteJson("/api/v1/team/{$member->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('member');

        $this->assertDatabaseHas('users', ['id' => $employee->id]);
    }

    public function test_admin_accounts_and_self_cannot_be_deleted(): void
    {
        ['admin' => $admin] = $this->fixture();
        $adminMember = $admin->memberships()->firstOrFail();

        $this->withHeaders($this->headers($admin))
            ->deleteJson("/api/v1/team/{$adminMember->id}")
            ->assertForbidden();
    }

    public function test_sub_admin_cannot_delete_employees(): void
    {
        $subAdmin = User::factory()->subAdmin()->create();
        $employee = User::factory()->create(['organization_id' => $subAdmin->organization_id]);
        Sanctum::actingAs($subAdmin);

        $this->withHeaders($this->headers($subAdmin))
            ->deleteJson('/api/v1/team/'.$employee->memberships()->firstOrFail()->id)
            ->assertForbidden();
    }

    public function test_member_of_another_organization_cannot_be_deleted(): void
    {
        ['admin' => $admin] = $this->fixture();
        $outsider = User::factory()->create();

        $this->withHeaders($this->headers($admin))
            ->deleteJson('/api/v1/team/'.$outsider->memberships()->firstOrFail()->id)
            ->assertNotFound();

        $this->assertDatabaseHas('users', ['id' => $outsider->id]);
    }
}
