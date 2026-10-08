<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Organization;
use App\Models\User;
use App\Services\Onboarding\OnboardingService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OnboardingTest extends TestCase
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

    private function adminNeedingOnboarding(): User
    {
        $organization = Organization::factory()->needsOnboarding()->create([
            'name' => 'Acme Agency',
        ]);

        return User::factory()->admin()->create([
            'organization_id' => $organization->id,
        ]);
    }

    public function test_super_admin_never_requires_onboarding(): void
    {
        $superAdmin = User::factory()->create([
            'organization_id' => null,
            'role' => UserRole::SuperAdmin,
        ]);

        Sanctum::actingAs($superAdmin);

        $this->getJson('/api/v1/platform/dashboard')->assertOk();
    }

    public function test_admin_dashboard_blocked_until_onboarding_complete(): void
    {
        $admin = $this->adminNeedingOnboarding();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/dashboard')
            ->assertForbidden()
            ->assertJsonPath('code', 'ONBOARDING_REQUIRED');
    }

    public function test_employee_never_requires_onboarding(): void
    {
        $organization = Organization::factory()->needsOnboarding()->create();
        $employee = User::factory()->create([
            'organization_id' => $organization->id,
        ]);

        Sanctum::actingAs($employee);

        $this->withHeaders($this->headers($employee))
            ->getJson('/api/v1/dashboard')
            ->assertOk();
    }

    public function test_admin_can_complete_required_onboarding_steps(): void
    {
        $admin = $this->adminNeedingOnboarding();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/onboarding/status')
            ->assertOk()
            ->assertJsonPath('requires_onboarding', true)
            ->assertJsonPath('onboarding_step', 1);

        $this->withHeaders($this->headers($admin))
            ->patchJson('/api/v1/onboarding/organization', [
                'name' => 'Bright Agency',
                'timezone' => 'America/New_York',
                'website' => 'https://bright.example',
            ])
            ->assertOk()
            ->assertJsonPath('status.organization.name', 'Bright Agency');

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/vault/initialize', [
                'payroll_pin' => '4321',
                'payroll_pin_confirmation' => '4321',
            ])
            ->assertCreated();

        $organization = Organization::query()->find($admin->organization_id);
        $this->assertTrue($organization?->onboarding_completed);

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/dashboard')
            ->assertOk();
    }

    public function test_admin_can_continue_optional_steps_after_required_completion(): void
    {
        $admin = $this->adminNeedingOnboarding();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->patchJson('/api/v1/onboarding/organization', ['name' => 'Bright Agency'])
            ->assertOk();

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/vault/initialize', [
                'payroll_pin' => '4321',
                'payroll_pin_confirmation' => '4321',
            ])
            ->assertCreated();

        $this->withHeaders($this->headers($admin))
            ->getJson('/api/v1/onboarding/status')
            ->assertOk()
            ->assertJsonPath('requirements_met', true)
            ->assertJsonPath('onboarding_completed', true)
            ->assertJsonPath('onboarding_step', OnboardingService::TOTAL_STEPS);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/onboarding/employees', [
                'name' => 'Optional Hire',
                'email' => 'optional@example.com',
                'salary' => 4500,
                'salary_type' => 'monthly',
            ])
            ->assertCreated()
            ->assertJsonPath('status.onboarding_step', OnboardingService::TOTAL_STEPS);

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/teams', ['name' => 'Delivery'])
            ->assertCreated();

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/projects', [
                'name' => 'Client Site',
                'client_name' => 'Acme Corp',
            ])
            ->assertCreated();

        $this->withHeaders($this->headers($admin))
            ->patchJson('/api/v1/onboarding/step', ['step' => 5])
            ->assertOk();

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/onboarding/complete')
            ->assertOk()
            ->assertJsonPath('status.onboarding_completed', true);
    }

    public function test_onboarding_employee_creation_without_password(): void
    {
        $admin = $this->adminNeedingOnboarding();
        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->patchJson('/api/v1/onboarding/organization', ['name' => 'Bright Agency'])
            ->assertOk();

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/vault/initialize', [
                'payroll_pin' => '1234',
                'payroll_pin_confirmation' => '1234',
            ])
            ->assertCreated();

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/onboarding/employees', [
                'name' => 'New Hire',
                'email' => 'hire@example.com',
                'salary' => 5000,
                'salary_type' => 'monthly',
            ])
            ->assertCreated()
            ->assertJsonPath('member.email', 'hire@example.com');

        $this->assertDatabaseHas('users', [
            'email' => 'hire@example.com',
            'organization_id' => $admin->organization_id,
        ]);

        $this->assertDatabaseHas('organization_members', [
            'status' => 'active',
        ]);
    }

    public function test_onboarding_csv_import_with_roles(): void
    {
        $admin = $this->adminNeedingOnboarding();
        Sanctum::actingAs($admin);
        $this->prepareOnboardingForImport($admin);

        $csv = <<<'CSV'
name,email,salary,salary_type,role
John Doe,john@example.com,100000,monthly,employee
Jane Smith,jane@example.com,1200,hourly,manager
Mark Wilson,mark@example.com,85000,monthly,sub_admin
CSV;
        $file = UploadedFile::fake()->createWithContent('employees.csv', $csv);

        $this->withHeaders($this->headers($admin))
            ->post('/api/v1/onboarding/employees/import', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('created', 3)
            ->assertJsonPath('failed_count', 0)
            ->assertJsonPath('total', 3);

        $this->assertDatabaseHas('users', ['email' => 'john@example.com', 'role' => 'employee']);
        $this->assertDatabaseHas('users', ['email' => 'jane@example.com', 'role' => 'manager']);
        $this->assertDatabaseHas('users', ['email' => 'mark@example.com', 'role' => 'sub_admin']);
    }

    public function test_onboarding_csv_import_ignores_extra_columns(): void
    {
        $admin = $this->adminNeedingOnboarding();
        Sanctum::actingAs($admin);
        $this->prepareOnboardingForImport($admin);

        $csv = <<<'CSV'
name,email,salary,salary_type,role,department,phone
Alex Lee,alex@example.com,5000,monthly,employee,Engineering,555-0100
CSV;
        $file = UploadedFile::fake()->createWithContent('employees.csv', $csv);

        $this->withHeaders($this->headers($admin))
            ->post('/api/v1/onboarding/employees/import', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('created', 1);

        $this->assertDatabaseHas('users', ['email' => 'alex@example.com']);
    }

    public function test_onboarding_csv_import_partial_with_failed_rows(): void
    {
        $admin = $this->adminNeedingOnboarding();
        Sanctum::actingAs($admin);
        $this->prepareOnboardingForImport($admin);

        $csv = <<<'CSV'
name,email,salary,salary_type,role
Valid User,valid@example.com,5000,monthly,employee
Bad Role,badrole@example.com,5000,monthly,admin
Missing Salary,missing@example.com,,monthly,employee
Duplicate,dupe@example.com,5000,monthly,employee
Duplicate,dupe@example.com,6000,monthly,manager
CSV;
        $file = UploadedFile::fake()->createWithContent('employees.csv', $csv);

        $response = $this->withHeaders($this->headers($admin))
            ->post('/api/v1/onboarding/employees/import', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('created', 2)
            ->assertJsonPath('failed_count', 3)
            ->assertJsonPath('total', 5);

        $response->assertJsonPath('results.0.status', 'imported');
        $response->assertJsonPath('results.1.status', 'failed');
        $this->assertStringContainsString(
            'CSV import supports only employee, manager, and sub_admin roles.',
            (string) $response->json('results.1.error')
        );

        $this->assertDatabaseHas('users', ['email' => 'valid@example.com']);
        $this->assertDatabaseHas('users', ['email' => 'dupe@example.com']);
        $this->assertDatabaseMissing('users', ['email' => 'badrole@example.com']);
    }

    public function test_onboarding_csv_import_rejects_super_admin_role(): void
    {
        $admin = $this->adminNeedingOnboarding();
        Sanctum::actingAs($admin);
        $this->prepareOnboardingForImport($admin);

        $csv = "name,email,salary,salary_type,role\nRoot User,root@example.com,5000,monthly,super_admin\n";
        $file = UploadedFile::fake()->createWithContent('employees.csv', $csv);

        $this->withHeaders($this->headers($admin))
            ->post('/api/v1/onboarding/employees/import', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('created', 0)
            ->assertJsonPath('failed_count', 1);

        $this->assertDatabaseMissing('users', ['email' => 'root@example.com']);
    }

    private function prepareOnboardingForImport(User $admin): void
    {
        $this->withHeaders($this->headers($admin))
            ->patchJson('/api/v1/onboarding/organization', ['name' => 'Bright Agency'])
            ->assertOk();

        $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/payroll/vault/initialize', [
                'payroll_pin' => '1234',
                'payroll_pin_confirmation' => '1234',
            ])
            ->assertCreated();
    }

    public function test_non_admin_cannot_access_onboarding_endpoints(): void
    {
        $manager = User::factory()->manager()->create();
        Sanctum::actingAs($manager);

        $this->withHeaders($this->headers($manager))
            ->getJson('/api/v1/onboarding/status')
            ->assertForbidden();
    }

    public function test_admin_can_upload_organization_logo(): void
    {
        $admin = $this->adminNeedingOnboarding();
        Sanctum::actingAs($admin);

        $response = $this->withHeaders($this->headers($admin))
            ->post('/api/v1/onboarding/organization/logo', [
                'logo' => UploadedFile::fake()->image('logo.png', 120, 120),
            ])
            ->assertOk();

        $logoUrl = $response->json('logo_url');
        $this->assertIsString($logoUrl);
        $this->assertStringContainsString('organization-logos', $logoUrl);

        $organization = Organization::query()->find($admin->organization_id);
        $this->assertSame($logoUrl, $organization?->logo_url);
    }
}
