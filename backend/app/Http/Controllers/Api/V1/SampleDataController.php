<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Services\SampleData\SampleDataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin-only: load or remove sample data in the current organization.
 */
class SampleDataController extends TenantAppController
{
    public function __construct(
        private readonly SampleDataService $sampleData,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        return response()->json($this->sampleData->status());
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $data = $request->validate(['sample_team' => ['sometimes', 'boolean']]);
        $created = $this->sampleData->load($request->user(), (bool) ($data['sample_team'] ?? false));

        return response()->json([
            'message' => 'Sample data loaded.',
            'created' => $created,
            ...$this->sampleData->status(),
        ], 201);
    }

    public function destroy(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $removed = $this->sampleData->remove();

        return response()->json([
            'message' => 'Sample data removed.',
            'removed' => $removed,
            ...$this->sampleData->status(),
        ]);
    }

    private function authorizeAdmin(Request $request): void
    {
        if ($request->user()?->currentRole() !== UserRole::Admin) {
            abort(403);
        }
    }
}
