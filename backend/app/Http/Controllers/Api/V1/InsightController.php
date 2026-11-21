<?php

namespace App\Http\Controllers\Api\V1;

use App\Services\Insights\InsightService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Dashboard alerts and the weekly AI briefing (admins and managers, via route rbac). */
class InsightController extends TenantAppController
{
    public function __construct(
        private readonly InsightService $insights,
    ) {}

    public function show(Request $request): JsonResponse
    {
        return response()->json($this->insights->overview($request->user()));
    }

    public function summarize(Request $request): JsonResponse
    {
        return response()->json([
            'summary' => $this->insights->generateSummary($request->user()),
        ], 201);
    }
}
