<?php

namespace App\Services\Platform;

use App\Enums\OrganizationMemberStatus;
use App\Enums\OrganizationStatus;
use App\Enums\UserRole;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use App\Services\Auth\MembershipRoleSync;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PlatformOrganizationService
{
    public function __construct(
        private readonly MembershipRoleSync $membershipRoleSync
    ) {}

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function listOrganizations(): Collection
    {
        return Organization::query()
            ->withCount([
                'members as employee_count' => function ($query) {
                    $query->where('status', OrganizationMemberStatus::Active);
                },
            ])
            ->orderBy('name')
            ->get()
            ->map(fn (Organization $organization) => $this->formatOrganization($organization));
    }

    /**
     * @return array{organization: Organization, admin: User}
     */
    public function createOrganizationWithAdmin(array $validated): array
    {
        if (User::query()->where('email', $validated['admin_email'])->exists()) {
            throw ValidationException::withMessages([
                'admin_email' => ['This email is already registered.'],
            ]);
        }

        return DB::transaction(function () use ($validated) {
            $organization = Organization::create([
                'name' => $validated['organization_name'],
                'status' => OrganizationStatus::Active,
            ]);

            $admin = User::create([
                'organization_id' => $organization->id,
                'name' => $validated['admin_name'],
                'email' => $validated['admin_email'],
                'password' => $validated['admin_password'],
                'role' => UserRole::Admin,
            ]);

            $membership = OrganizationMember::create([
                'organization_id' => $organization->id,
                'user_id' => $admin->id,
                'role' => UserRole::Admin,
                'status' => OrganizationMemberStatus::Active,
                'joined_at' => now(),
            ]);

            $this->membershipRoleSync->syncFromMembership($membership);

            return [
                'organization' => $organization->fresh(),
                'admin' => $admin->fresh(),
            ];
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function formatOrganization(Organization $organization): array
    {
        $adminMembership = OrganizationMember::query()
            ->with('user:id,name,email')
            ->where('organization_id', $organization->id)
            ->where('role', UserRole::Admin)
            ->orderBy('id')
            ->first();

        return [
            'id' => $organization->id,
            'name' => $organization->name,
            'slug' => $organization->slug,
            'status' => $organization->status->value,
            'employee_count' => (int) ($organization->employee_count ?? 0),
            'admin_name' => $adminMembership?->user?->name,
            'admin_email' => $adminMembership?->user?->email,
            'created_at' => $organization->created_at?->toIso8601String(),
        ];
    }
}
