<?php



namespace Tests\Feature;



use App\Enums\UserRole;

use App\Models\Team;

use App\Models\User;

use Database\Seeders\RolePermissionSeeder;

use Illuminate\Foundation\Testing\RefreshDatabase;

use Laravel\Sanctum\Sanctum;

use Tests\TestCase;



class WorkTeamsTest extends TestCase

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



    public function test_admin_can_create_team_and_assign_manager_and_member(): void

    {

        $admin = User::factory()->admin()->create();

        $manager = User::factory()->manager()->create(['organization_id' => $admin->organization_id]);

        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);



        Sanctum::actingAs($admin);



        $create = $this->withHeaders($this->headers($admin))

            ->postJson('/api/v1/teams', ['name' => 'Design Squad'])

            ->assertCreated()

            ->assertJsonPath('team.name', 'Design Squad');



        $teamId = $create->json('team.id');



        $this->withHeaders($this->headers($admin))

            ->postJson("/api/v1/teams/{$teamId}/assign-manager", [

                'manager_id' => $manager->id,

            ])

            ->assertOk()

            ->assertJsonPath('team.manager_id', $manager->id);



        $this->withHeaders($this->headers($admin))

            ->postJson("/api/v1/teams/{$teamId}/add-member", [

                'user_id' => $employee->id,

            ])

            ->assertOk()

            ->assertJsonCount(1, 'team.members');



        $this->assertDatabaseHas('team_members', [

            'team_id' => $teamId,

            'user_id' => $employee->id,

        ]);

    }



    public function test_manager_only_sees_assigned_teams(): void

    {

        $admin = User::factory()->admin()->create();

        $manager = User::factory()->manager()->create(['organization_id' => $admin->organization_id]);

        $otherManager = User::factory()->manager()->create(['organization_id' => $admin->organization_id]);



        Team::factory()->create([

            'organization_id' => $admin->organization_id,

            'name' => 'My Team',

            'manager_id' => $manager->id,

        ]);



        Team::factory()->create([

            'organization_id' => $admin->organization_id,

            'name' => 'Other Team',

            'manager_id' => $otherManager->id,

        ]);



        Sanctum::actingAs($manager);



        $this->withHeaders($this->headers($manager))

            ->getJson('/api/v1/teams')

            ->assertOk()

            ->assertJsonCount(1)

            ->assertJsonPath('0.name', 'My Team');

    }



    public function test_manager_cannot_create_teams(): void

    {

        $manager = User::factory()->manager()->create();

        Sanctum::actingAs($manager);



        $this->withHeaders($this->headers($manager))

            ->postJson('/api/v1/teams', ['name' => 'Blocked'])

            ->assertForbidden();

    }



    public function test_employee_cannot_access_teams_api(): void

    {

        $employee = User::factory()->create();

        Sanctum::actingAs($employee);



        $this->withHeaders($this->headers($employee))

            ->getJson('/api/v1/teams')

            ->assertForbidden();

    }



    public function test_employee_cannot_be_in_two_teams(): void

    {

        $admin = User::factory()->admin()->create();

        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);



        $teamA = Team::factory()->create(['organization_id' => $admin->organization_id]);

        $teamB = Team::factory()->create(['organization_id' => $admin->organization_id]);



        Sanctum::actingAs($admin);



        $this->withHeaders($this->headers($admin))

            ->postJson("/api/v1/teams/{$teamA->id}/add-member", ['user_id' => $employee->id])

            ->assertOk();



        $this->withHeaders($this->headers($admin))

            ->postJson("/api/v1/teams/{$teamB->id}/add-member", ['user_id' => $employee->id])

            ->assertUnprocessable();

    }



    public function test_manager_cannot_access_org_employee_roster(): void

    {

        $manager = User::factory()->manager()->create();

        Sanctum::actingAs($manager);



        $this->withHeaders($this->headers($manager))

            ->getJson('/api/v1/team')

            ->assertForbidden();

    }



    public function test_admin_can_remove_team_member(): void

    {

        $admin = User::factory()->admin()->create();

        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);

        $team = Team::factory()->create(['organization_id' => $admin->organization_id]);

        $team->members()->attach($employee->id);



        Sanctum::actingAs($admin);



        $this->withHeaders($this->headers($admin))

            ->deleteJson("/api/v1/teams/{$team->id}/remove-member/{$employee->id}")

            ->assertOk()

            ->assertJsonPath('team.members_count', 0);



        $this->assertDatabaseMissing('team_members', [

            'team_id' => $team->id,

            'user_id' => $employee->id,

        ]);

    }

}

