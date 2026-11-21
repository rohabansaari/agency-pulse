<?php

namespace App\Http\Controllers\Api\V1;

use App\Services\Tenant\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Company-wide time tracking settings (the idle limit). Admin only, via the route's rbac middleware.
 */
class TimeTrackingSettingsController extends TenantAppController
{
    public function show(Request $request): JsonResponse
    {
        return response()->json($this->settings());
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'idle_timeout_minutes' => ['required', 'integer', 'min:0', 'max:120'],
        ]);

        $organization = TenantContext::get();
        $organization->update(['idle_timeout_minutes' => (int) $validated['idle_timeout_minutes']]);

        return response()->json([
            'message' => 'Time tracking settings saved.',
            ...$this->settings(),
        ]);
    }

    /** @return array{idle_timeout_minutes: int} */
    private function settings(): array
    {
        return ['idle_timeout_minutes' => (int) TenantContext::get()->idle_timeout_minutes];
    }
}
