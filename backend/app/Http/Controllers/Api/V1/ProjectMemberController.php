<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\OrganizationMemberStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\ProjectMemberResource;
use App\Models\OrganizationMember;
use App\Models\Project;
use App\Models\User;
use App\Services\Tenant\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;

class ProjectMemberController extends Controller
{
    public function index(Request $request, Project $project): AnonymousResourceCollection
    {
        $this->authorizeMemberManagement($request, $project);

        $members = $project->members()
            ->with(['memberships' => fn ($q) => $q->where('organization_id', TenantContext::id())])
            ->get()
            ->map(function (User $user) {
                $membership = $user->memberships->first();
                $user->membership_role = $membership?->role->value;

                return $user;
            });

        return ProjectMemberResource::collection($members);
    }

    public function store(Request $request, Project $project): JsonResponse
    {
        $this->authorizeMemberManagement($request, $project);

        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $user = User::query()->findOrFail($validated['user_id']);

        if (! $this->isActiveOrgMember($user->id)) {
            throw ValidationException::withMessages([
                'user_id' => ['User is not an active member of this organization.'],
            ]);
        }

        if ($project->members()->where('users.id', $user->id)->exists()) {
            throw ValidationException::withMessages([
                'user_id' => ['User is already assigned to this project.'],
            ]);
        }

        $project->members()->attach($user->id, ['role_in_project' => 'worker']);

        return response()->json([
            'message' => 'Member assigned to project.',
            'member' => new ProjectMemberResource($user),
        ], 201);
    }

    public function destroy(Request $request, Project $project, User $user): JsonResponse
    {
        $this->authorizeMemberManagement($request, $project);

        if (! $project->members()->where('users.id', $user->id)->exists()) {
            abort(404);
        }

        $project->members()->detach($user->id);

        return response()->json([
            'message' => 'Member removed from project.',
        ]);
    }

    private function authorizeMemberManagement(Request $request, Project $project): void
    {
        if ($project->organization_id !== TenantContext::id()) {
            abort(404);
        }

        $role = $request->user()?->currentRole();

        if (! in_array($role, [UserRole::Admin, UserRole::Manager], true)) {
            throw ValidationException::withMessages([
                'authorization' => ['You are not allowed to manage project members.'],
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
