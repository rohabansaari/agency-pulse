<?php



namespace App\Http\Controllers\Api\V1;



use App\Enums\OrganizationMemberStatus;

use App\Enums\ProjectStatus;

use App\Enums\TimeEntryStatus;

use App\Enums\UserRole;

use App\Http\Controllers\Controller;

use App\Http\Resources\WorkTeamResource;

use App\Models\OrganizationMember;

use App\Models\Project;

use App\Models\Team;

use App\Models\TeamMember;

use App\Models\TimeEntry;

use App\Models\User;

use App\Services\Projects\ProjectAccessService;

use App\Services\Tenant\TenantContext;

use Illuminate\Http\JsonResponse;

use Illuminate\Http\Request;

use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

use Illuminate\Support\Carbon;

use Illuminate\Support\Facades\DB;

use Illuminate\Validation\ValidationException;



class TeamsController extends Controller
{
    public function __construct(
        private readonly ProjectAccessService $projectAccess
    ) {}

    public function index(Request $request): AnonymousResourceCollection

    {

        $user = $request->user();

        $role = $user->currentRole();

        $orgId = TenantContext::id();



        $query = Team::query()

            ->with(['manager', 'members'])

            ->withCount('members')

            ->where('organization_id', $orgId);



        if ($role === UserRole::Manager) {

            $query->where('manager_id', $user->id);

        } elseif (! $role?->isOperationalAdmin()) {
            abort(403);
        }



        $teams = $query->orderBy('name')->get();

        $this->hydrateTeamMetrics($teams, $orgId);



        return WorkTeamResource::collection($teams);

    }



    public function store(Request $request): JsonResponse

    {

        $validated = $request->validate([

            'name' => ['required', 'string', 'max:255'],

        ]);



        $team = Team::create([

            'organization_id' => TenantContext::id(),

            'name' => $validated['name'],

        ]);



        $team->load(['manager', 'members'])->loadCount('members');



        return response()->json([

            'message' => 'Team created.',

            'team' => new WorkTeamResource($team),

        ], 201);

    }



    public function assignManager(Request $request, Team $team): JsonResponse

    {

        $this->ensureTeamInTenant($team);



        $validated = $request->validate([

            'manager_id' => ['required', 'integer', 'exists:users,id'],

        ]);



        $manager = User::query()->findOrFail($validated['manager_id']);



        if (! $this->isActiveOrgMemberWithRole($manager->id, UserRole::Manager)) {

            throw ValidationException::withMessages([

                'manager_id' => ['User must be an active manager in this organization.'],

            ]);

        }



        $team->update(['manager_id' => $manager->id]);



        $team->load(['manager', 'members'])->loadCount('members');



        return response()->json([

            'message' => 'Manager assigned to team.',

            'team' => new WorkTeamResource($team),

        ]);

    }



    public function addMember(Request $request, Team $team): JsonResponse

    {

        $this->ensureTeamInTenant($team);



        $validated = $request->validate([

            'user_id' => ['required', 'integer', 'exists:users,id'],

        ]);



        $user = User::query()->findOrFail($validated['user_id']);



        if (! $this->isActiveOrgMemberWithRole($user->id, UserRole::Employee)) {

            throw ValidationException::withMessages([

                'user_id' => ['User must be an active employee in this organization.'],

            ]);

        }



        if (TeamMember::query()->where('user_id', $user->id)->exists()) {

            throw ValidationException::withMessages([

                'user_id' => ['Employee is already assigned to a team.'],

            ]);

        }



        $team->members()->attach($user->id);



        $team->load(['manager', 'members'])->loadCount('members');



        return response()->json([

            'message' => 'Employee added to team.',

            'team' => new WorkTeamResource($team),

        ]);

    }



    public function removeMember(Request $request, Team $team, User $user): JsonResponse

    {

        $this->ensureTeamInTenant($team);



        if (! $team->members()->where('users.id', $user->id)->exists()) {

            abort(404);

        }



        $team->members()->detach($user->id);

        $team->load(['manager', 'members'])->loadCount('members');



        return response()->json([

            'message' => 'Employee removed from team.',

            'team' => new WorkTeamResource($team),

        ]);

    }



    private function ensureTeamInTenant(Team $team): void

    {

        if ($team->organization_id !== TenantContext::id()) {

            abort(404);

        }

    }



    private function isActiveOrgMemberWithRole(int $userId, UserRole $role): bool

    {

        return OrganizationMember::query()

            ->where('organization_id', TenantContext::id())

            ->where('user_id', $userId)

            ->where('status', OrganizationMemberStatus::Active)

            ->where('role', $role)

            ->exists();

    }



    /**

     * @param  \Illuminate\Support\Collection<int, Team>  $teams

     */

    private function hydrateTeamMetrics($teams, int $orgId): void

    {

        $startOfDay = Carbon::today();

        $endOfDay = Carbon::today()->endOfDay();



        foreach ($teams as $team) {
            $participantIds = $team->participantUserIds();

            $team->active_projects_count = $this->projectAccess->activeProjectsForTeam($team)->count();

            $team->team_hours_today_seconds = $participantIds->isEmpty()
                ? 0
                : (int) TimeEntry::query()
                    ->where('organization_id', $orgId)
                    ->whereIn('user_id', $participantIds)
                    ->countable()
                    ->whereBetween('start_time', [$startOfDay, $endOfDay])
                    ->sum('duration');



            $team->members->each(function (User $member): void {

                $membership = $member->memberships()

                    ->where('organization_id', TenantContext::id())

                    ->first();

                $member->membership_role = $membership?->role->value;

            });

        }

    }

}

