<?php

namespace Database\Factories;

use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\Organization>
 */
class OrganizationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->company(),
            'onboarding_completed' => true,
            'onboarding_step' => 6,
        ];
    }

    public function needsOnboarding(): static
    {
        return $this->state(fn () => [
            'onboarding_completed' => false,
            'onboarding_step' => 1,
        ]);
    }
}
