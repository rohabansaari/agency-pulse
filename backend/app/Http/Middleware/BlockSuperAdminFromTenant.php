<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class BlockSuperAdminFromTenant
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->isSuperAdmin()) {
            return response()->json([
                'message' => 'Super admins cannot access organization data.',
                'code' => 'SUPER_ADMIN_TENANT_DENIED',
            ], 403);
        }

        return $next($request);
    }
}
