<?php

namespace App\Services\Screenshots;

use App\Models\Team;
use App\Models\User;
use App\Services\Tenant\TenantContext;
use Illuminate\Support\Collection;

class ScreenshotAccessService
{
    /**
     * @return list<int>|null Null means unrestricted within the organization.
     */
    public function visibleUserIds(User $viewer): ?array
    {
        if ($viewer->can('screenshots.view_all')) {
            return null;
        }

        if (! $viewer->can('screenshots.view')) {
            return [$viewer->id];
        }

        if ($viewer->isManager()) {
            return $this->managedTeamMemberIds($viewer)->push($viewer->id)->unique()->values()->all();
        }

        return [$viewer->id];
    }

    public function canViewUser(User $viewer, int $targetUserId): bool
    {
        $visible = $this->visibleUserIds($viewer);

        return $visible === null || in_array($targetUserId, $visible, true);
    }

    /**
     * @return Collection<int, int>
     */
    private function managedTeamMemberIds(User $manager): Collection
    {
        return Team::query()
            ->with('members:id')
            ->where('organization_id', TenantContext::id())
            ->where('manager_id', $manager->id)
            ->get()
            ->flatMap(fn (Team $team) => $team->members->pluck('id'));
    }
}
