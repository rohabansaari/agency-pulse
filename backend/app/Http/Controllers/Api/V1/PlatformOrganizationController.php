<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Platform\PlatformOrganizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
            'organization' => [
                'id' => $result['organization']->id,
                'name' => $result['organization']->name,
                'slug' => $result['organization']->slug,
                'status' => $result['organization']->status->value,
                'employee_count' => 1,
                'admin_name' => $result['admin']->name,
                'admin_email' => $result['admin']->email,
                'created_at' => $result['organization']->created_at?->toIso8601String(),
            ],
        ], 201);
    }
}
