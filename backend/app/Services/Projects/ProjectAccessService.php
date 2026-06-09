<?php

namespace App\Services\Projects;

use App\Enums\ProjectStatus;
use App\Enums\UserRole;
use App\Models\Project;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use App\Services\Tenant\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class ProjectAccessService
{
    /**
     * Teams the user participates in (as member or manager).
     *
     * @return Collection<int, Team>
     */
    public function participatingTeams(User $user): Collection
    {
        $memberTeamIds = TeamMember::query()
            ->where('user_id', $user->id)
            ->pluck('team_id');

        return Team::query()
            ->with(['members', 'manager'])
            ->where('organization_id', TenantContext::id())
            ->where(function (Builder $query) use ($user, $memberTeamIds) {
                $query->where('manager_id', $user->id)
                    ->orWhereIn('id', $memberTeamIds);
            })
            ->get();
    }

    public function userCanAccessProject(User $user, Project $project): bool
    {
        if ($project->organization_id !== TenantContext::id()) {
            return false;
        }

        if ($project->members()->where('users.id', $user->id)->exists()) {
            return true;
        }

        return $this->teamAccessibleProjectIds($user)->contains($project->id);
    }

    /**
     * Project IDs accessible via team assignment (any participant on the team is assigned).
     *
     * @return Collection<int, int>
     */
    public function teamAccessibleProjectIds(User $user): Collection
    {
        $projectIds = collect();

        foreach ($this->participatingTeams($user) as $team) {
            $participantIds = $team->participantUserIds();

            if ($participantIds->isEmpty()) {
                continue;
            }

            $ids = Project::query()
                ->where('organization_id', TenantContext::id())
                ->where('status', '!=', ProjectStatus::Archived)
                ->whereHas('members', fn (Builder $q) => $q->whereIn('users.id', $participantIds))
                ->pluck('id');

            $projectIds = $projectIds->merge($ids);
        }

        return $projectIds->unique()->values();
    }

    /**
     * @return Builder<Project>
     */
    public function accessibleProjectsQuery(User $user): Builder
    {
        $query = Project::query()->where('organization_id', TenantContext::id());

        if ($user->currentRole() === UserRole::Employee) {
            $teamProjectIds = $this->teamAccessibleProjectIds($user);

            $query->where(function (Builder $q) use ($user, $teamProjectIds) {
                $q->whereHas('members', fn (Builder $m) => $m->where('users.id', $user->id));

                if ($teamProjectIds->isNotEmpty()) {
                    $q->orWhereIn('id', $teamProjectIds);
                }
            });
        }

        return $query;
    }

    /**
     * Active projects linked to a team via any participant assignment.
     *
     * @return Collection<int, Project>
     */
    public function activeProjectsForTeam(Team $team): Collection
    {
        $participantIds = $team->participantUserIds();

        if ($participantIds->isEmpty()) {
            return collect();
        }

        return Project::query()
            ->where('organization_id', TenantContext::id())
            ->where('status', ProjectStatus::Active)
            ->whereHas('members', fn (Builder $q) => $q->whereIn('users.id', $participantIds))
            ->orderBy('name')
            ->get();
    }
}
