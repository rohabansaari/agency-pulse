<?php



namespace Tests\Feature;



use App\Enums\OrganizationMemberStatus;
use App\Enums\UserRole;
use App\Mail\UserInvitationMail;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmployeeManagementTest extends TestCase
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

    public function test_admin_can_invite_employee_without_password(): void
    {
        Mail::fake();

        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $response = $this->withHeaders($this->headers($admin))
            ->postJson('/api/v1/team/create-employee', [
                'name' => 'New Employee',
                'email' => 'employee@example.com',
                'role' => UserRole::Employee->value,
                'salary_type' => 'hourly',
                'hourly_rate' => 50,
                'payroll_pin' => '1234',
                'payroll_pin_confirmation' => '1234',
            ]);

        $response->assertCreated()
            ->assertJsonPath('member.email', 'employee@example.com')
            ->assertJsonPath('member.role', UserRole::Employee->value)
            ->assertJsonPath('member.status', OrganizationMemberStatus::Invited->value);

        Mail::assertSent(UserInvitationMail::class);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'employee@example.com',
            'password' => 'password123',
        ])->assertUnprocessable();
    }



    public function test_sub_admin_cannot_create_employee(): void
    {
        $subAdmin = User::factory()->subAdmin()->create();
        Sanctum::actingAs($subAdmin);

        $this->withHeaders($this->headers($subAdmin))
            ->postJson('/api/v1/team/create-employee', [
                'name' => 'Blocked',
                'email' => 'subadmin-blocked@example.com',
            ])
            ->assertForbidden();
    }

    public function test_manager_cannot_create_employee(): void

    {

        $manager = User::factory()->manager()->create();

        Sanctum::actingAs($manager);



        $this->withHeaders($this->headers($manager))

            ->postJson('/api/v1/team/create-employee', [

                'name' => 'Blocked',

                'email' => 'blocked@example.com',

                'salary_type' => 'hourly',

                'hourly_rate' => 50,

            ])

            ->assertForbidden();

    }



    public function test_admin_can_reset_employee_password(): void

    {

        $admin = User::factory()->admin()->create();

        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);



        Sanctum::actingAs($admin);



        $this->withHeaders($this->headers($admin))

            ->patchJson("/api/v1/team/{$employee->id}/reset-password", [

                'new_password' => 'newpassword123',

            ])

            ->assertOk();



        $employee->refresh();

        $this->assertTrue(Hash::check('newpassword123', $employee->password));

    }

    public function test_admin_can_reset_manager_password(): void
    {
        $admin = User::factory()->admin()->create();
        $manager = User::factory()->manager()->create([
            'organization_id' => $admin->organization_id,
        ]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->patchJson("/api/v1/team/{$manager->id}/reset-password", [
                'new_password' => 'managerpass123',
            ])
            ->assertOk();

        $manager->refresh();
        $this->assertTrue(Hash::check('managerpass123', $manager->password));
    }

    public function test_admin_can_reset_sub_admin_password(): void
    {
        $admin = User::factory()->admin()->create();
        $subAdmin = User::factory()->subAdmin()->create([
            'organization_id' => $admin->organization_id,
        ]);

        Sanctum::actingAs($admin);

        $this->withHeaders($this->headers($admin))
            ->patchJson("/api/v1/team/{$subAdmin->id}/reset-password", [
                'new_password' => 'subadminpass123',
            ])
            ->assertOk();

        $subAdmin->refresh();
        $this->assertTrue(Hash::check('subadminpass123', $subAdmin->password));
    }



    public function test_admin_role_cannot_be_created_via_employee_endpoint(): void
    {
        $admin = User::factory()->admin()->create();

        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/team/create-employee', [
            'name' => 'Blocked Admin',
            'email' => 'blocked-admin@example.com',
            'role' => UserRole::Admin->value,
            'salary_type' => 'monthly',
            'monthly_salary' => 5000,
        ])->assertStatus(422);
    }

}

