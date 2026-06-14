<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Services\Auth\InvitationService;
use App\Services\Platform\PlatformOrganizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PlatformOrganizationController extends Controller
{
    public function __construct(
        private readonly PlatformOrganizationService $platformOrganizations,
        private readonly InvitationService $invitations,
    ) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'organizations' => $this->platformOrganizations->listOrganizations(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'organization_name' => ['required', 'string', 'max:255'],
            'admin_name' => ['required', 'string', 'max:255'],
            'admin_email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'admin_password' => ['prohibited'],
        ]);

        $result = $this->platformOrganizations->createOrganizationWithAdmin($validated);

        $message = $result['invitation_email_sent']
            ? 'Organization created. An invitation email was sent to the admin.'
            : 'Organization created. The invitation email could not be sent — check mail settings and resend the invitation.';

        return response()->json([
            'message' => $message,
            'organization' => $this->platformOrganizations->formatOrganization($result['organization']),
            'invitation_email_sent' => $result['invitation_email_sent'],
            'delivery_issue' => $result['invitation_email_sent'] ? null : $this->invitations->mailDeliveryIssue(),
        ], 201);
    }

    public function resendAdminInvitation(Organization $organization): JsonResponse
    {
        $admin = $this->platformOrganizations->resolvePrimaryAdmin($organization);

        if (! $admin) {
            abort(404, 'This organization has no admin account.');
        }

        $this->invitations->resend($admin, $organization, isAdminWelcome: true);

        return response()->json([
            'message' => 'Admin invitation email resent.',
        ]);
    }

    public function update(Request $request, Organization $organization): JsonResponse
    {
        $admin = $this->platformOrganizations->resolvePrimaryAdmin($organization);

        $validated = $request->validate([
            'admin_email' => [
                'sometimes',
                'required',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($admin?->id),
            ],
            'status' => ['sometimes', 'required', Rule::in(['active', 'suspended', 'trial'])],
        ]);

        $updated = $this->platformOrganizations->updateOrganization($organization, $validated);

        return response()->json([
            'message' => 'Organization updated.',
            'organization' => $updated,
        ]);
    }

    public function destroy(Organization $organization): JsonResponse
    {
        $this->platformOrganizations->deleteOrganization($organization);

        return response()->json([
            'message' => 'Organization deleted.',
        ]);
    }
}
