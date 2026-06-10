<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\OrganizationStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformDashboardController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'role' => UserRole::SuperAdmin->value,
            'organizations_total' => Organization::query()->count(),
            'organizations_active' => Organization::query()
                ->where('status', OrganizationStatus::Active)
                ->count(),
            'organizations_suspended' => Organization::query()
                ->where('status', OrganizationStatus::Suspended)
                ->count(),
            'tenant_users_total' => User::query()
                ->where('role', '!=', UserRole::SuperAdmin)
                ->count(),
        ]);
    }
}
