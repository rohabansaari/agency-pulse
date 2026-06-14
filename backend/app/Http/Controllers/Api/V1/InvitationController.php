<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Services\Auth\InvitationService;
use App\Services\Auth\RoleMutationGuard;
use App\Services\Tenant\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class InvitationController extends Controller
{
    public function __construct(
        private readonly InvitationService $invitations,
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
            'password' => ['required', 'string', 'confirmed', \Illuminate\Validation\Rules\Password::defaults()],
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

    public function send(Request $request): JsonResponse
    {
        $this->authorizeInvitationSend($request);

        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'role' => [
                'required',
                'string',
                Rule::in(['admin', 'sub-admin', 'sub_admin', 'manager', 'employee']),
            ],
        ]);

        $roleValue = str_replace('-', '_', strtolower($validated['role']));
        $role = UserRole::from($roleValue);

        if ($role === UserRole::SuperAdmin) {
            throw ValidationException::withMessages([
                'role' => ['Invalid role.'],
            ]);
        }

        if (in_array($role, [UserRole::Admin, UserRole::SubAdmin], true)) {
            RoleMutationGuard::assertPrivilegedRoleAssignable($request->user(), $role);
        }

        $organization = Organization::query()->findOrFail(TenantContext::id());

        $result = $this->invitations->createInvitedMember(
            $organization,
            trim($validated['name']),
            strtolower(trim($validated['email'])),
            $role,
            isAdminWelcome: $role === UserRole::Admin,
        );

        $message = $result['invitation_email_sent']
            ? 'Invitation sent successfully.'
            : 'Invitation created but the email could not be delivered. Check mail settings and resend.';

        return response()->json([
            'message' => $message,
            'success' => $result['invitation_email_sent'],
            'invitation_email_sent' => $result['invitation_email_sent'],
            'delivery_issue' => $result['delivery_issue'],
            'invite_link' => $this->invitations->setupPasswordUrl($result['plain_token']),
            'expires_in_hours' => InvitationService::TOKEN_TTL_HOURS,
        ], 201);
    }

    private function authorizeInvitationSend(Request $request): void
    {
        $role = $request->user()?->currentRole();

        if (! in_array($role, [UserRole::Admin, UserRole::SubAdmin, UserRole::Manager], true)) {
            throw ValidationException::withMessages([
                'authorization' => ['You are not allowed to send invitations.'],
            ]);
        }
    }
}
