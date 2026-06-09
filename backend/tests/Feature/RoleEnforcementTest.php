<?php



namespace Tests\Feature;



use App\Models\Project;

use App\Models\User;

use Database\Seeders\RolePermissionSeeder;

use Illuminate\Foundation\Testing\RefreshDatabase;

use Laravel\Sanctum\Sanctum;

use Tests\TestCase;



class RoleEnforcementTest extends TestCase

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



    public function test_employee_can_list_assigned_projects_but_not_create(): void

    {

        $employee = User::factory()->create();

        Sanctum::actingAs($employee);



        $this->withHeaders($this->headers($employee))

            ->getJson('/api/v1/projects')

            ->assertOk();



        $this->withHeaders($this->headers($employee))

            ->postJson('/api/v1/projects', [

                'name' => 'Blocked',

                'client_name' => 'Client',

            ])

            ->assertForbidden();

    }



    public function test_employee_cannot_update_or_change_project_status(): void

    {

        $employee = User::factory()->create();

        $project = Project::factory()->create(['organization_id' => $employee->organization_id]);

        $project->members()->attach($employee->id);



        Sanctum::actingAs($employee);



        $this->withHeaders($this->headers($employee))

            ->putJson("/api/v1/projects/{$project->id}", ['name' => 'Hacked'])

            ->assertForbidden();



        $this->withHeaders($this->headers($employee))

            ->patchJson("/api/v1/projects/{$project->id}/status", ['status' => 'inactive'])

            ->assertForbidden();

    }



    public function test_employee_cannot_access_team_or_org_time_entries(): void

    {

        $employee = User::factory()->create();

        Sanctum::actingAs($employee);



        $this->withHeaders($this->headers($employee))

            ->getJson('/api/v1/teams')

            ->assertForbidden();



        $this->withHeaders($this->headers($employee))

            ->getJson('/api/v1/time/organization')

            ->assertForbidden();

    }



    public function test_manager_has_project_crud_and_org_time_access(): void

    {

        $manager = User::factory()->manager()->create();

        Sanctum::actingAs($manager);



        $this->withHeaders($this->headers($manager))

            ->postJson('/api/v1/projects', [

                'name' => 'Manager Project',

                'client_name' => 'Client',

            ])

            ->assertCreated();



        $this->withHeaders($this->headers($manager))

            ->getJson('/api/v1/time/organization')

            ->assertOk()

            ->assertJsonPath('meta.scope', 'organization');



        $this->withHeaders($this->headers($manager))

            ->getJson('/api/v1/teams')

            ->assertOk();

    }



    public function test_manager_cannot_update_team_members(): void

    {

        $manager = User::factory()->manager()->create();

        $employee = User::factory()->create(['organization_id' => $manager->organization_id]);



        Sanctum::actingAs($manager);



        $member = $employee->memberships()->first();



        $this->withHeaders($this->headers($manager))

            ->patchJson("/api/v1/team/{$member->id}", ['status' => 'suspended'])

            ->assertForbidden();

    }



    public function test_admin_can_update_team_members(): void

    {

        $admin = User::factory()->admin()->create();

        $employee = User::factory()->create(['organization_id' => $admin->organization_id]);



        Sanctum::actingAs($admin);



        $member = $employee->memberships()->first();



        $this->withHeaders($this->headers($admin))

            ->patchJson("/api/v1/team/{$member->id}", ['status' => 'suspended'])

            ->assertOk();

    }

}

