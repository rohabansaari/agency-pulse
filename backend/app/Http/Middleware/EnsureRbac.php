<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRbac
{
    /**
     * @param  string  ...$roles  Allowed roles (admin, manager, employee)
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if ($roles === []) {
            return $next($request);
        }

        $allowed = array_map(
            fn (string $role) => UserRole::from($role),
            $roles
        );

        $currentRole = $user->currentRole();

        if ($currentRole === null || ! in_array($currentRole, $allowed, true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return $next($request);
    }
}
