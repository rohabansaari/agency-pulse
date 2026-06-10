<?php

namespace App\Services\Auth;

use App\Enums\UserRole;
use App\Models\OrganizationMember;
use App\Models\User;
use Symfony\Component\HttpKernel\Exception\HttpException;

final class RoleMutationGuard
{
    /** @var list<UserRole> */
    public const MUTABLE_ROLES = [UserRole::Employee, UserRole::Manager];

    /** @var list<UserRole> */
    public const IMMUTABLE_ROLES = [UserRole::Admin, UserRole::SubAdmin];

    public static function assertPrivilegedRoleAssignable(User $actor, UserRole $targetRole): void
    {
        if (! in_array($targetRole, self::IMMUTABLE_ROLES, true)) {
            return;
        }

        if ($actor->currentRole() !== UserRole::Admin) {
            throw new HttpException(403, 'Only organization admins can assign admin or sub admin roles.');
        }
    }

    public static function assertRoleChangeAllowed(User $actor, OrganizationMember $member, UserRole $newRole): void
    {
        if ($actor->currentRole() !== UserRole::Admin) {
            throw new HttpException(403, 'Only organization admins can change member roles.');
        }

        if ($actor->id === $member->user_id) {
            throw new HttpException(403, 'You cannot change your own role.');
        }

        $currentRole = $member->role;

        if (in_array($currentRole, self::IMMUTABLE_ROLES, true)) {
            throw new HttpException(403, 'Admin and sub admin roles cannot be changed after creation.');
        }

        if (! in_array($currentRole, self::MUTABLE_ROLES, true)) {
            throw new HttpException(403, 'This role cannot be changed.');
        }

        if (! in_array($newRole, self::MUTABLE_ROLES, true)) {
            throw new HttpException(403, 'Roles can only be changed between employee and manager.');
        }

        if ($currentRole === $newRole) {
            throw new HttpException(403, 'The member already has this role.');
        }
    }

    public static function isMutableRole(UserRole $role): bool
    {
        return in_array($role, self::MUTABLE_ROLES, true);
    }
}
