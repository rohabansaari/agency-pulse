<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Services\Platform\PlatformOrganizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class PlatformOrganizationController extends Controller
{
    public function __construct(
        private readonly PlatformOrganizationService $platformOrganizations
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
            'admin_password' => ['required', 'string', Password::defaults()],
        ]);

        $result = $this->platformOrganizations->createOrganizationWithAdmin($validated);

        return response()->json([
            'message' => 'Organization and admin account created.',
            'organization' => $this->platformOrganizations->formatOrganization($result['organization']),
        ], 201);
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
