<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\OrganizationMemberStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\OrganizationMemberResource;
use App\Http\Resources\UserResource;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use App\Services\Auth\MembershipRoleSync;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly MembershipRoleSync $membershipRoleSync
    ) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        $payload = DB::transaction(function () use ($request) {
            $organization = Organization::create([
                'name' => $request->validated('organization_name')
                    ?? $request->validated('name')."'s Organization",
            ]);

            $user = User::create([
                'organization_id' => $organization->id,
                'name' => $request->validated('name'),
                'email' => $request->validated('email'),
                'password' => $request->validated('password'),
                'role' => UserRole::Admin,
            ]);

            $membership = OrganizationMember::create([
                'organization_id' => $organization->id,
                'user_id' => $user->id,
                'role' => UserRole::Admin,
                'status' => OrganizationMemberStatus::Active,
                'joined_at' => now(),
            ]);

            $this->membershipRoleSync->syncFromMembership($membership);

            return compact('organization', 'user', 'membership');
        });

        $token = $payload['user']->createToken('api-token')->plainTextToken;

        return response()->json([
            'user' => new UserResource($payload['user']),
            'memberships' => OrganizationMemberResource::collection(
                $payload['user']->memberships()->with('organization')->get()
            ),
            'current_organization_id' => $payload['organization']->id,
            'token' => $token,
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::query()
            ->where('email', $request->validated('email'))
            ->first();

        if (! $user || ! Hash::check($request->validated('password'), $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $token = $user->createToken('api-token')->plainTextToken;
        $memberships = $user->isSuperAdmin()
            ? collect()
            : $user->memberships()->with('organization')->get();

        return response()->json([
            'user' => new UserResource($user),
            'memberships' => OrganizationMemberResource::collection($memberships),
            'current_organization_id' => $user->isSuperAdmin()
                ? null
                : ($user->organization_id ?? $memberships->first()?->organization_id),
            'token' => $token,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $memberships = $user->isSuperAdmin()
            ? collect()
            : $user->memberships()->with('organization')->get();

        return response()->json([
            'user' => new UserResource($user),
            'memberships' => OrganizationMemberResource::collection($memberships),
            'current_organization_id' => $user->isSuperAdmin()
                ? null
                : ($user->organization_id ?? $memberships->first()?->organization_id),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }
}
