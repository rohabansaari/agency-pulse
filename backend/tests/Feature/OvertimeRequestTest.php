<?php

namespace Tests\Feature;

use App\Enums\OvertimeRequestStatus;
use App\Models\OrganizationPayrollSettings;
use App\Models\OvertimeRequest;
use App\Models\Project;
use App\Models\Team;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OvertimeRequestTest extends TestCase
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

    private function enableOvertime(User $admin): void
    {
        OrganizationPayrollSettings::query()->updateOrCreate(
            ['organization_id' => $admin->organization_id],
            [
                'overtime_enabled' => true,
                'overtime_rate_percentage' => 150,
            ]
        );
    }

    /**
     * @return array{admin: User, manager: User, employee: User, project: Project, team: Team}
     */
    private function setupTeamFixture(): array
    {
        $admin = User::factory()->admin()->create();
        $this->enableOvertime($admin);

        $manager = User::factory()->manager()->create(['organization_id' => $admin->organization_id]);
        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);

        $project = Project::factory()->create(['organization_id' => $admin->organization_id]);
        $project->members()->attach($employee->id, ['role_in_project' => 'worker']);
        $project->members()->attach($manager->id, ['role_in_project' => 'worker']);

        $team = Team::factory()->create([
            'organization_id' => $admin->organization_id,
            'manager_id' => $manager->id,
        ]);
        $team->members()->attach($employee->id);

        return compact('admin', 'manager', 'employee', 'project', 'team');
    }

    public function test_employee_can_submit_overtime_for_manager_approval(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'project' => $project] = $this->setupTeamFixture();

        Sanctum::actingAs($employee);

        $response = $this->withHeaders($this->headers($employee))
            ->postJson('/api/v1/time/overtime', [
                'date' => Carbon::today()->toDateString(),
                'duration' => 3600,
                'reason' => 'Release deadline support',
                'project_id' => $project->id,
            ]);

        $response->assertCreated()
            ->assertJsonPath('request.status', 'pending');

        $this->assertDatabaseHas('overtime_requests', [
            'user_id' => $employee->id,
            'manager_id' => $manager->id,
            'status' => OvertimeRequestStatus::Pending->value,
        ]);
    }

    public function test_manager_can_submit_overtime_for_self_pending_admin_approval(): void
    {
        ['manager' => $manager, 'project' => $project] = $this->setupTeamFixture();

        Sanctum::actingAs($manager);

        $response = $this->withHeaders($this->headers($manager))
            ->postJson('/api/v1/time/overtime', [
                'for_self' => true,
                'date' => Carbon::today()->toDateString(),
                'duration' => 5400,
                'reason' => 'Weekend deployment',
                'project_id' => $project->id,
            ]);

        $response->assertCreated();

        $this->assertDatabaseHas('overtime_requests', [
            'user_id' => $manager->id,
            'manager_id' => null,
            'status' => OvertimeRequestStatus::Pending->value,
        ]);
    }

    public function test_manager_approves_employee_overtime(): void
    {
        ['manager' => $manager, 'employee' => $employee, 'project' => $project, 'team' => $team] = $this->setupTeamFixture();

        $request = OvertimeRequest::create([
            'organization_id' => $employee->organization_id,
            'user_id' => $employee->id,
            'project_id' => $project->id,
            'manager_id' => $manager->id,
            'work_date' => Carbon::today(),
            'duration_seconds' => 3600,
            'reason' => 'Client support',
            'status' => OvertimeRequestStatus::Pending,
        ]);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->postJson("/api/v1/time/overtime/{$request->id}/approve")
            ->assertOk()
            ->assertJsonPath('request.status', 'approved');
    }

    public function test_admin_approves_manager_overtime(): void
    {
        ['admin' => $admin, 'manager' => $manager, 'project' => $project] = $this->setupTeamFixture();

        $request = OvertimeRequest::create([
            'organization_id' => $manager->organization_id,
            'user_id' => $manager->id,
            'project_id' => $project->id,
            'manager_id' => null,
            'work_date' => Carbon::today(),
            'duration_seconds' => 7200,
            'reason' => 'Emergency fix',
            'status' => OvertimeRequestStatus::Pending,
        ]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson("/api/v1/time/overtime/{$request->id}/approve")
            ->assertOk()
            ->assertJsonPath('request.status', 'approved');
    }

    public function test_manager_cannot_approve_own_overtime(): void
    {
        ['manager' => $manager, 'project' => $project] = $this->setupTeamFixture();

        $request = OvertimeRequest::create([
            'organization_id' => $manager->organization_id,
            'user_id' => $manager->id,
            'project_id' => $project->id,
            'manager_id' => null,
            'work_date' => Carbon::today(),
            'duration_seconds' => 3600,
            'reason' => 'Self request',
            'status' => OvertimeRequestStatus::Pending,
        ]);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->postJson("/api/v1/time/overtime/{$request->id}/approve")
            ->assertUnprocessable();
    }

    public function test_admin_can_update_overtime_settings(): void
    {
        $admin = User::factory()->admin()->create();
        $this->enableOvertime($admin);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/vault/initialize', [
                'payroll_pin' => '1234',
                'payroll_pin_confirmation' => '1234',
            ])
            ->assertCreated();

        $this->withHeaders([...$this->headers($admin), 'X-Payroll-Pin' => '1234'])
            ->patchJson('/api/v1/payroll/settings', [
                'overtime_enabled' => true,
                'overtime_rate_percentage' => 200,
            ])
            ->assertOk()
            ->assertJsonPath('settings.overtime_rate_percentage', '200.00');
    }

    public function test_admin_cannot_approve_employee_overtime(): void
    {
        ['admin' => $admin, 'manager' => $manager, 'employee' => $employee, 'project' => $project] = $this->setupTeamFixture();

        $request = OvertimeRequest::create([
            'organization_id' => $employee->organization_id,
            'user_id' => $employee->id,
            'project_id' => $project->id,
            'manager_id' => $manager->id,
            'work_date' => Carbon::today(),
            'duration_seconds' => 3600,
            'reason' => 'Employee overtime',
            'status' => OvertimeRequestStatus::Pending,
        ]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->postJson("/api/v1/time/overtime/{$request->id}/approve")
            ->assertUnprocessable();
    }

    public function test_overtime_context_returns_reason_when_disabled(): void
    {
        $admin = User::factory()->admin()->create();
        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);

        OrganizationPayrollSettings::query()->updateOrCreate(
            ['organization_id' => $admin->organization_id],
            ['overtime_enabled' => false]
        );

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/time/overtime/context')
            ->assertOk()
            ->assertJsonPath('can_create', false)
            ->assertJsonPath('reason', 'Overtime is not enabled for this organization. Ask your admin to enable it in Payroll Settings.');
    }

    public function test_manager_can_submit_overtime_for_team_accessible_project_without_direct_membership(): void
    {
        ['admin' => $admin, 'manager' => $manager, 'employee' => $employee] = $this->setupTeamFixture();

        $project = Project::factory()->create(['organization_id' => $admin->organization_id]);
        $project->members()->attach($employee->id, ['role_in_project' => 'worker']);

        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->getJson('/api/v1/time/overtime/context')
            ->assertOk()
            ->assertJsonPath('can_create_self', true);

        $this->withHeaders($this->headers($manager))
            ->postJson('/api/v1/time/overtime', [
                'for_self' => true,
                'date' => Carbon::today()->toDateString(),
                'duration' => 3600,
                'reason' => 'Weekend support for team project',
                'project_id' => $project->id,
            ])
            ->assertCreated()
            ->assertJsonPath('request.status', 'pending')
            ->assertJsonPath('request.manager_id', null);
    }

    public function test_sub_admin_can_approve_manager_overtime(): void
    {
        ['manager' => $manager, 'project' => $project] = $this->setupTeamFixture();

        $subAdmin = User::factory()->subAdmin()->create([
            'organization_id' => $manager->organization_id,
        ]);

        $request = OvertimeRequest::create([
            'organization_id' => $manager->organization_id,
            'user_id' => $manager->id,
            'project_id' => $project->id,
            'manager_id' => null,
            'work_date' => Carbon::today(),
            'duration_seconds' => 3600,
            'reason' => 'Manager overtime',
            'status' => OvertimeRequestStatus::Pending,
        ]);

        Sanctum::actingAs($subAdmin);

        $this->withHeaders($this->headers($subAdmin))
            ->postJson("/api/v1/time/overtime/{$request->id}/approve")
            ->assertOk()
            ->assertJsonPath('request.status', 'approved');
    }

    public function test_pending_overtime_excluded_from_organization_report_totals(): void
    {
        ['admin' => $admin, 'employee' => $employee, 'project' => $project, 'team' => $team] = $this->setupTeamFixture();

        OvertimeRequest::create([
            'organization_id' => $employee->organization_id,
            'user_id' => $employee->id,
            'project_id' => $project->id,
            'manager_id' => $team->manager_id,
            'work_date' => Carbon::today(),
            'duration_seconds' => 7200,
            'reason' => 'Pending only',
            'status' => OvertimeRequestStatus::Pending,
        ]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/reports/organization')
            ->assertOk()
            ->assertJsonPath('overtime_summary.approved_seconds', 0)
            ->assertJsonPath('overtime_summary.pending_count', 1)
            ->assertJsonPath('overtime_summary.pending_seconds', 7200);
    }
}
