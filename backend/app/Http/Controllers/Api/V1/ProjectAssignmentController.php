<?php



namespace App\Http\Controllers\Api\V1;



use App\Enums\OrganizationMemberStatus;

use App\Enums\ProjectAssignmentRole;

use App\Enums\UserRole;

use App\Http\Controllers\Controller;

use App\Http\Resources\ProjectAssigneeResource;

use App\Models\OrganizationMember;

use App\Models\Project;

use App\Models\Team;

use App\Models\TeamMember;

use App\Models\User;

use App\Services\Tenant\TenantContext;

use Illuminate\Http\JsonResponse;

use Illuminate\Http\Request;

use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

use Illuminate\Validation\Rule;

use Illuminate\Validation\ValidationException;



class ProjectAssignmentController extends Controller

{

    public function assignees(Request $request, Project $project): AnonymousResourceCollection

    {

        $this->authorizeAssignmentManagement($request, $project);



        $assignees = $project->members()

            ->with(['memberships' => fn ($q) => $q->where('organization_id', TenantContext::id())])

            ->get();



        return ProjectAssigneeResource::collection($assignees);

    }



    public function assign(Request $request, Project $project): JsonResponse

    {

        $this->authorizeAssignmentManagement($request, $project);



        $validated = $request->validate([

            'user_id' => ['required', 'integer', 'exists:users,id'],

            'role_in_project' => ['nullable', Rule::enum(ProjectAssignmentRole::class)],

        ]);



        $user = User::query()->findOrFail($validated['user_id']);



        if (! $this->isActiveOrgMember($user->id)) {

            throw ValidationException::withMessages([

                'user_id' => ['User is not an active member of this organization.'],

            ]);

        }



        $this->ensureManagerCanAssignUser($request, $user->id);



        if ($project->members()->where('users.id', $user->id)->exists()) {

            throw ValidationException::withMessages([

                'user_id' => ['User is already assigned to this project.'],

            ]);

        }



        $project->members()->attach($user->id, [

            'role_in_project' => $validated['role_in_project'] ?? ProjectAssignmentRole::Worker->value,

        ]);



        return response()->json([

            'message' => 'Employee assigned to project.',

            'assignee' => new ProjectAssigneeResource(

                $project->members()->where('users.id', $user->id)->first()

            ),

        ], 201);

    }



    public function unassign(Request $request, Project $project, User $user): JsonResponse

    {

        $this->authorizeAssignmentManagement($request, $project);



        if (! $project->members()->where('users.id', $user->id)->exists()) {

            abort(404);

        }



        $project->members()->detach($user->id);



        return response()->json([

            'message' => 'Employee unassigned from project.',

        ]);

    }



    private function authorizeAssignmentManagement(Request $request, Project $project): void

    {

        if ($project->organization_id !== TenantContext::id()) {

            abort(404);

        }



        $role = $request->user()?->currentRole();



        if (! in_array($role, [UserRole::Admin, UserRole::SubAdmin, UserRole::Manager], true)) {

            throw ValidationException::withMessages([

                'authorization' => ['You are not allowed to manage project assignments.'],

            ]);

        }

    }



    private function ensureManagerCanAssignUser(Request $request, int $userId): void

    {

        if ($request->user()?->currentRole() !== UserRole::Manager) {

            return;

        }



        $managedTeamIds = Team::query()

            ->where('organization_id', TenantContext::id())

            ->where('manager_id', $request->user()->id)

            ->pluck('id');



        $allowedUserIds = TeamMember::query()
            ->whereIn('team_id', $managedTeamIds)
            ->pluck('user_id');

        $allowedUserIds = $allowedUserIds
            ->push($request->user()->id)
            ->unique();



        if (! $allowedUserIds->contains($userId)) {

            throw ValidationException::withMessages([

                'user_id' => ['You can only assign employees from teams you manage.'],

            ]);

        }

    }



    private function isActiveOrgMember(int $userId): bool

    {

        return OrganizationMember::query()

            ->where('organization_id', TenantContext::id())

            ->where('user_id', $userId)

            ->where('status', OrganizationMemberStatus::Active)

            ->exists();

    }

}

