<?php



namespace Tests\Feature;



use App\Enums\UserRole;

use App\Models\User;

use Database\Seeders\RolePermissionSeeder;

use Illuminate\Foundation\Testing\RefreshDatabase;

use Illuminate\Support\Facades\Hash;

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



    public function test_admin_can_create_employee_with_password(): void

    {

        $admin = User::factory()->admin()->create();

        Sanctum::actingAs($admin);



        $response = $this->withHeaders($this->headers($admin))

            ->postJson('/api/v1/team/create-employee', [

                'name' => 'New Employee',

                'email' => 'employee@example.com',

                'password' => 'password123',

                'salary_type' => 'hourly',

                'hourly_rate' => 50,

                'payroll_pin' => '1234',

                'payroll_pin_confirmation' => '1234',

            ]);



        $response->assertCreated()

            ->assertJsonPath('member.email', 'employee@example.com')

            ->assertJsonPath('member.role', UserRole::Employee->value)

            ->assertJsonPath('member.status', 'active');



        $employee = User::query()->where('email', 'employee@example.com')->first();

        $this->assertNotNull($employee);

        $this->assertTrue(Hash::check('password123', $employee->password));



        $this->withHeaders($this->headers($admin))

            ->postJson('/api/v1/auth/login', [

                'email' => 'employee@example.com',

                'password' => 'password123',

            ])

            ->assertOk()

            ->assertJsonPath('user.role', UserRole::Employee->value);

    }



    public function test_manager_cannot_create_employee(): void

    {

        $manager = User::factory()->manager()->create();

        Sanctum::actingAs($manager);



        $this->withHeaders($this->headers($manager))

            ->postJson('/api/v1/team/create-employee', [

                'name' => 'Blocked',

                'email' => 'blocked@example.com',

                'password' => 'password123',

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



    public function test_register_only_creates_admin_user(): void

    {

        $this->postJson('/api/v1/auth/register', [

            'name' => 'Org Owner',

            'email' => 'owner@example.com',

            'password' => 'password123',

        ])

            ->assertCreated()

            ->assertJsonPath('user.role', UserRole::Admin->value);



        $this->assertDatabaseMissing('users', ['role' => UserRole::Employee->value]);

    }

}

