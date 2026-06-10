<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmployeeDirectoryTest extends TestCase
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

    public function test_admin_can_list_enriched_employee_directory(): void
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/team')
            ->assertOk()
            ->assertJsonStructure([
                '*' => [
                    'user_id',
                    'name',
                    'email',
                    'role',
                    'status',
                    'team_name',
                    'manager_name',
                    'joined_at',
                    'assigned_projects_count',
                    'overtime_requests_count',
                ],
            ])
            ->assertJsonMissingPath('0.monthly_salary')
            ->assertJsonMissingPath('0.hourly_rate');
    }

    public function test_admin_can_view_employee_profile_without_salary_fields(): void
    {
        $admin = User::factory()->admin()->create();
        $employee = User::factory()->create([
            'organization_id' => $admin->organization_id,
        ]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson("/api/v1/team/{$employee->id}/profile")
            ->assertOk()
            ->assertJsonPath('user.id', $employee->id)
            ->assertJsonStructure([
                'user' => ['id', 'name', 'email'],
                'team',
                'assigned_projects',
                'leave_history',
                'overtime_history',
                'time_summary',
            ])
            ->assertJsonMissingPath('monthly_salary')
            ->assertJsonMissingPath('hourly_rate')
            ->assertJsonMissingPath('gross_pay');
    }
}
