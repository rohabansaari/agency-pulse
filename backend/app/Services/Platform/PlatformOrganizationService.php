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
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    public function updateOrganization(Organization $organization, array $validated): array
    {
        return DB::transaction(function () use ($organization, $validated) {
            if (array_key_exists('admin_email', $validated)) {
                $admin = $this->resolvePrimaryAdmin($organization);

                if (! $admin) {
                    throw ValidationException::withMessages([
                        'admin_email' => ['This organization has no admin account to update.'],
                    ]);
                }

                $admin->update(['email' => $validated['admin_email']]);
            }

            if (array_key_exists('status', $validated)) {
                $organization->update([
                    'status' => OrganizationStatus::from($validated['status']),
                ]);
            }

            $organization->refresh();
            $organization->loadCount([
                'members as employee_count' => function ($query) {
                    $query->where('status', OrganizationMemberStatus::Active);
                },
            ]);

            return $this->formatOrganization($organization);
        });
    }

    public function deleteOrganization(Organization $organization): void
    {
        if ($organization->status !== OrganizationStatus::Suspended) {
            throw ValidationException::withMessages([
                'organization' => ['Only suspended (inactive) organizations can be deleted. Suspend the organization first.'],
            ]);
        }

        DB::transaction(function () use ($organization) {
            $organization->delete();
        });
    }

    public function resolvePrimaryAdmin(Organization $organization): ?User
    {
        $adminMembership = OrganizationMember::query()
            ->with('user')
            ->where('organization_id', $organization->id)
            ->where('role', UserRole::Admin)
            ->orderBy('id')
            ->first();

        return $adminMembership?->user;
    }

    /**
     * @return array<string, mixed>
     */
    public function formatOrganization(Organization $organization): array
    {
        $admin = $this->resolvePrimaryAdmin($organization);

        return [
            'id' => $organization->id,
            'name' => $organization->name,
            'slug' => $organization->slug,
            'status' => $organization->status->value,
            'employee_count' => $this->activeMemberCount($organization),
            'admin_user_id' => $admin?->id,
            'admin_name' => $admin?->name,
            'admin_email' => $admin?->email,
            'created_at' => $organization->created_at?->toIso8601String(),
        ];
    }

    private function activeMemberCount(Organization $organization): int
    {
        if (isset($organization->employee_count)) {
            return (int) $organization->employee_count;
        }

        return OrganizationMember::query()
            ->where('organization_id', $organization->id)
            ->where('status', OrganizationMemberStatus::Active)
            ->count();
    }
}
