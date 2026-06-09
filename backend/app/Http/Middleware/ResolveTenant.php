<?php

namespace App\Http\Middleware;

use App\Enums\OrganizationStatus;
use App\Models\Organization;
use App\Services\Tenant\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Spatie\Permission\PermissionRegistrar;
use Symfony\Component\HttpFoundation\Response;

class ResolveTenant
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $organizationId = $this->resolveOrganizationId($request, $user);

        if ($organizationId === null) {
            return response()->json([
                'message' => 'Organization context required.',
                'code' => 'TENANT_REQUIRED',
            ], 403);
        }

        if (! $user->belongsToOrganization($organizationId)) {
            return response()->json([
                'message' => 'You do not belong to this organization.',
                'code' => 'TENANT_MISMATCH',
            ], 403);
        }

        $organization = Organization::query()->find($organizationId);

        if (! $organization) {
            return response()->json([
                'message' => 'Organization not found.',
                'code' => 'TENANT_NOT_FOUND',
            ], 404);
        }

        if ($organization->status === OrganizationStatus::Suspended) {
            return response()->json([
                'message' => 'Organization is suspended.',
                'code' => 'ORG_SUSPENDED',
            ], 403);
        }

        TenantContext::set($organization);
        app(PermissionRegistrar::class)->setPermissionsTeamId($organization->id);

        if ($user->organization_id !== $organization->id) {
            $user->forceFill(['organization_id' => $organization->id])->saveQuietly();
        }

        Cache::put("user:{$user->id}:last_organization_id", $organization->id, now()->addDays(30));

        $request->attributes->set('organization_id', $organization->id);

        try {
            return $next($request);
        } finally {
            TenantContext::forget();
            app(PermissionRegistrar::class)->setPermissionsTeamId(null);
        }
    }

    private function resolveOrganizationId(Request $request, $user): ?int
    {
        $headerOrgId = $request->header('X-Organization-Id');

        if ($headerOrgId !== null && $headerOrgId !== '') {
            return (int) $headerOrgId;
        }

        if ($user->organization_id) {
            return (int) $user->organization_id;
        }

        $cachedOrgId = Cache::get("user:{$user->id}:last_organization_id");

        return $cachedOrgId ? (int) $cachedOrgId : null;
    }
}
