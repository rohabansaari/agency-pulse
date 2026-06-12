<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\OrganizationStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Services\Platform\PlatformOrganizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformDashboardController extends Controller
{
    public function __construct(
        private readonly PlatformOrganizationService $platformOrganizations
    ) {}

    public function show(Request $request): JsonResponse
    {
        $this->platformOrganizations->purgeOrphanedTenantUsers();

        return response()->json([
            'role' => UserRole::SuperAdmin->value,
            'organizations_total' => Organization::query()->count(),
            'organizations_active' => Organization::query()
                ->where('status', OrganizationStatus::Active)
                ->count(),
            'organizations_suspended' => Organization::query()
                ->where('status', OrganizationStatus::Suspended)
                ->count(),
            'tenant_users_total' => $this->platformOrganizations->tenantUsersTotal(),
        ]);
    }
}
