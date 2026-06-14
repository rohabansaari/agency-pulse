<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\InvitationToken;
use App\Models\OrganizationMember;
use App\Models\User;
use App\Services\Auth\InvitationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class E2eTestingController extends Controller
{
    public function __construct(
        private readonly InvitationService $invitations,
    ) {}

    public function activateInvitedUser(Request $request): JsonResponse
    {
        abort_unless(app()->environment(['local', 'testing']), 404);

        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $user = User::query()->where('email', $validated['email'])->firstOrFail();

        $membership = OrganizationMember::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->firstOrFail();

        $organization = $membership->organization;

        $plainToken = DB::transaction(function () use ($user, $organization) {
            InvitationToken::query()
                ->where('user_id', $user->id)
                ->where('organization_id', $organization->id)
                ->whereNull('used_at')
                ->update(['used_at' => now()]);

            return $this->invitations->issueToken($user, $organization, resent: false);
        });

        $this->invitations->acceptInvitation($plainToken, $validated['password']);

        return response()->json([
            'message' => 'Invited user activated for testing.',
            'user_id' => $user->id,
            'organization_id' => $organization->id,
        ]);
    }
}
