<?php

namespace Database\Factories;

use App\Enums\OrganizationMemberStatus;
use App\Enums\UserRole;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use App\Services\Auth\MembershipRoleSync;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'role' => UserRole::Employee,
            'remember_token' => Str::random(10),
        ];
    }

    public function configure(): static
    {
        return $this->afterCreating(function (User $user): void {
            if (! $user->organization_id) {
                return;
            }

            $membership = OrganizationMember::query()->firstOrCreate(
                [
                    'organization_id' => $user->organization_id,
                    'user_id' => $user->id,
                ],
                [
                    'role' => $user->role,
                    'status' => OrganizationMemberStatus::Active,
                    'joined_at' => now(),
                ]
            );

            app(MembershipRoleSync::class)->syncFromMembership($membership);
        });
    }

    public function admin(): static
    {
        return $this->state(fn () => ['role' => UserRole::Admin]);
    }

    public function subAdmin(): static
    {
        return $this->state(fn () => ['role' => UserRole::SubAdmin]);
    }

    public function manager(): static
    {
        return $this->state(fn () => ['role' => UserRole::Manager]);
    }

    public function unverified(): static
    {
        return $this->state(fn () => [
            'email_verified_at' => null,
        ]);
    }
}
