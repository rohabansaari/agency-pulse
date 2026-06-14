<?php

namespace App\Services\Platform;

use App\Enums\OrganizationMemberStatus;
use App\Enums\OrganizationStatus;
use App\Enums\UserRole;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use App\Services\Auth\InvitationService;
use App\Services\Auth\MembershipRoleSync;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PlatformOrganizationService
{
    public function __construct(
        private readonly MembershipRoleSync $membershipRoleSync,
        private readonly InvitationService $invitations,
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

            $result = $this->invitations->createInvitedMember(
                $organization,
                $validated['admin_name'],
                $validated['admin_email'],
                UserRole::Admin,
                isAdminWelcome: true,
            );

            return [
                'organization' => $organization->fresh(),
                'admin' => $result['user']->fresh(),
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
            $organizationId = $organization->id;

            $userIds = OrganizationMember::query()
                ->where('organization_id', $organizationId)
                ->pluck('user_id')
                ->merge(
                    User::query()
                        ->where('organization_id', $organizationId)
                        ->pluck('id')
                )
                ->unique()
                ->values();

            foreach ($userIds as $userId) {
                $user = User::query()->find($userId);

                if (! $user || $user->isSuperAdmin()) {
                    continue;
                }

                $user->tokens()->delete();
                $user->delete();
            }

            $organization->delete();
        });

        $this->purgeOrphanedTenantUsers();
    }

    public function purgeOrphanedTenantUsers(): int
    {
        $validOrganizationIds = Organization::query()->pluck('id');

        $orphanedUsers = User::query()
            ->where('role', '!=', UserRole::SuperAdmin)
            ->where(function ($query) use ($validOrganizationIds) {
                $query->whereNull('organization_id');

                if ($validOrganizationIds->isNotEmpty()) {
                    $query->orWhereNotIn('organization_id', $validOrganizationIds);
                } else {
                    $query->orWhereNotNull('organization_id');
                }
            })
            ->get();

        $removed = 0;

        foreach ($orphanedUsers as $user) {
            $user->tokens()->delete();
            $user->delete();
            $removed++;
        }

        return $removed;
    }

    public function tenantUsersTotal(): int
    {
        return User::query()
            ->where('role', '!=', UserRole::SuperAdmin)
            ->whereIn('organization_id', Organization::query()->select('id'))
            ->count();
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
