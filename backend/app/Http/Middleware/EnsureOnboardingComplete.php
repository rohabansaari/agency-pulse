<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use App\Models\Organization;
use App\Services\Onboarding\OnboardingService;
use App\Services\Tenant\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureOnboardingComplete
{
    public function __construct(
        private readonly OnboardingService $onboarding
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $organization = TenantContext::get();

        if (! $user || ! $organization instanceof Organization) {
            return $next($request);
        }

        if (! $this->onboarding->requiresOnboarding($user, $organization)) {
            return $next($request);
        }

        if ($this->isAllowedDuringOnboarding($request)) {
            return $next($request);
        }

        return response()->json([
            'message' => 'Complete organization onboarding to continue.',
            'code' => 'ONBOARDING_REQUIRED',
        ], 403);
    }

    private function isAllowedDuringOnboarding(Request $request): bool
    {
        if ($request->is('api/v1/onboarding', 'api/v1/onboarding/*')) {
            return true;
        }

        if ($request->is('api/v1/payroll/vault/status', 'api/v1/payroll/vault/initialize')) {
            return true;
        }

        if ($request->is('api/v1/auth/password') && $request->isMethod('PATCH')) {
            return true;
        }

        if ($request->is('api/v1/teams') && $request->isMethod('POST')) {
            return $request->user()?->currentRole() === UserRole::Admin;
        }

        if ($request->is('api/v1/projects') && $request->isMethod('POST')) {
            return $request->user()?->currentRole() === UserRole::Admin;
        }

        return false;
    }
}
