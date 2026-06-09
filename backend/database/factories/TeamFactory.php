<?php



namespace Database\Factories;



use App\Models\Organization;

use App\Models\Team;

use App\Models\User;

use Illuminate\Database\Eloquent\Factories\Factory;



/**

 * @extends Factory<Team>

 */

class TeamFactory extends Factory

{

    protected $model = Team::class;



    public function definition(): array

    {

        return [

            'organization_id' => Organization::factory(),

            'name' => fake()->words(2, true),

            'manager_id' => null,

        ];

    }



    public function withManager(?User $manager = null): static

    {

        return $this->state(function (array $attributes) use ($manager) {

            $manager ??= User::factory()->manager()->create([

                'organization_id' => $attributes['organization_id'],

            ]);



            return ['manager_id' => $manager->id];

        });

    }

}

