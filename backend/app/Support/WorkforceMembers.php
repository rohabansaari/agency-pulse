<?php

namespace App\Support;

use App\Enums\OrganizationMemberStatus;
use App\Enums\UserRole;
use App\Models\OrganizationMember;
use Illuminate\Support\Collection;

/**
 * Active org members who contribute to workforce metrics (employees + managers).
 * Admins are organizational operators and excluded from time/productivity metrics.
 */
final class WorkforceMembers
{
    /**
     * @return Collection<int, int>
     */
    public static function activeMemberUserIds(int $orgId): Collection
    {
        return OrganizationMember::query()
            ->where('organization_id', $orgId)
            ->where('status', OrganizationMemberStatus::Active)
            ->whereIn('role', [UserRole::Employee, UserRole::Manager])
            ->pluck('user_id');
    }

    /**
     * @return Collection<int, int>
     */
    public static function adminUserIds(int $orgId): Collection
    {
        return OrganizationMember::query()
            ->where('organization_id', $orgId)
            ->where('status', OrganizationMemberStatus::Active)
            ->where('role', UserRole::Admin)
            ->pluck('user_id');
    }
}
