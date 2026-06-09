<?php

namespace App\Services\Auth;

use App\Enums\OrganizationMemberStatus;
use App\Enums\UserRole;
use App\Models\OrganizationMember;
use App\Models\User;
use Spatie\Permission\PermissionRegistrar;

class MembershipRoleSync
{
    public function __construct(
        private readonly RoleCatalogService $roleCatalog
    ) {}

    public function sync(User $user, int $organizationId, UserRole $role): void
    {
        $this->roleCatalog->ensureInstalled();

        app(PermissionRegistrar::class)->setPermissionsTeamId($organizationId);

        $user->syncRoles([$role->value]);
    }

    public function syncFromMembership(OrganizationMember $membership): void
    {
        $this->sync(
            $membership->user,
            $membership->organization_id,
            $membership->role
        );
    }
}
