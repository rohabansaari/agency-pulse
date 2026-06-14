<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Auth\InvitationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;

class InvitationController extends Controller
{
    public function __construct(
        private readonly InvitationService $invitations
    ) {}

    public function show(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'min:32'],
        ]);

        return response()->json([
            'invitation' => $this->invitations->previewInvitation($validated['token']),
        ]);
    }

    public function accept(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'min:32'],
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ]);

        $user = $this->invitations->acceptInvitation(
            $validated['token'],
            $validated['password'],
        );

        return response()->json([
            'message' => 'Your account is active. You can sign in now.',
            'email' => $user->email,
        ]);
    }
}
