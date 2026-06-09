<?php



namespace Tests\Feature;



use App\Enums\ProjectStatus;

use App\Models\Project;

use App\Models\Team;

use App\Models\User;

use Database\Seeders\RolePermissionSeeder;

use Illuminate\Foundation\Testing\RefreshDatabase;

use Laravel\Sanctum\Sanctum;

use Tests\TestCase;



class ProjectPayrollPermissionsTest extends TestCase

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



    public function test_manager_cannot_set_hourly_rate_on_create(): void

    {

        $manager = User::factory()->manager()->create();

        Sanctum::actingAs($manager);



        $this->withHeaders($this->headers($manager))

            ->postJson('/api/v1/projects', [

                'name' => 'Client Site',

                'client_name' => 'Acme',

                'hourly_rate' => 150,

            ])

            ->assertUnprocessable()

            ->assertJsonValidationErrors(['hourly_rate']);

    }



    public function test_manager_can_create_project_without_hourly_rate(): void

    {

        $manager = User::factory()->manager()->create();

        Sanctum::actingAs($manager);



        $this->withHeaders($this->headers($manager))

            ->postJson('/api/v1/projects', [

                'name' => 'Client Site',

                'client_name' => 'Acme',

                'description' => 'Website rebuild',

            ])

            ->assertCreated()

            ->assertJsonMissingPath('project.hourly_rate');

    }



    public function test_manager_cannot_update_hourly_rate(): void

    {

        $manager = User::factory()->manager()->create();

        $project = Project::factory()->create([

            'organization_id' => $manager->organization_id,

            'hourly_rate' => 100,

        ]);



        Sanctum::actingAs($manager);



        $this->withHeaders($this->headers($manager))

            ->putJson("/api/v1/projects/{$project->id}", [

                'hourly_rate' => 200,

            ])

            ->assertUnprocessable()

            ->assertJsonValidationErrors(['hourly_rate']);



        $this->assertEquals('100.00', $project->fresh()->hourly_rate);

    }



    public function test_manager_project_response_hides_hourly_rate(): void

    {

        $manager = User::factory()->manager()->create();

        Project::factory()->create([

            'organization_id' => $manager->organization_id,

            'hourly_rate' => 125,

        ]);



        Sanctum::actingAs($manager);



        $response = $this->withHeaders($this->headers($manager))

            ->getJson('/api/v1/projects')

            ->assertOk();



        $this->assertArrayNotHasKey('hourly_rate', $response->json('0'));

    }



    public function test_admin_project_response_includes_hourly_rate(): void

    {

        $admin = User::factory()->admin()->create();

        Project::factory()->create([

            'organization_id' => $admin->organization_id,

            'hourly_rate' => 125,

        ]);



        Sanctum::actingAs($admin);



        $this->withHeaders($this->headers($admin))

            ->getJson('/api/v1/projects')

            ->assertOk()

            ->assertJsonPath('0.hourly_rate', '125.00');

    }



    public function test_manager_cannot_archive_project(): void

    {

        $manager = User::factory()->manager()->create();

        $project = Project::factory()->create(['organization_id' => $manager->organization_id]);



        Sanctum::actingAs($manager);



        $this->withHeaders($this->headers($manager))

            ->patchJson("/api/v1/projects/{$project->id}/status", [

                'status' => ProjectStatus::Archived->value,

            ])

            ->assertUnprocessable();

    }



    public function test_manager_can_only_assign_from_managed_teams(): void

    {

        $manager = User::factory()->manager()->create();

        $otherEmployee = User::factory()->create(['organization_id' => $manager->organization_id]);

        $teamEmployee = User::factory()->create(['organization_id' => $manager->organization_id]);



        $team = Team::factory()->create([

            'organization_id' => $manager->organization_id,

            'manager_id' => $manager->id,

        ]);

        $team->members()->attach($teamEmployee->id);



        $project = Project::factory()->create(['organization_id' => $manager->organization_id]);



        Sanctum::actingAs($manager);



        $this->withHeaders($this->headers($manager))

            ->postJson("/api/v1/projects/{$project->id}/assign", [

                'user_id' => $otherEmployee->id,

            ])

            ->assertUnprocessable()

            ->assertJsonValidationErrors(['user_id']);



        $this->withHeaders($this->headers($manager))

            ->postJson("/api/v1/projects/{$project->id}/assign", [

                'user_id' => $teamEmployee->id,

            ])

            ->assertCreated();

    }

}

