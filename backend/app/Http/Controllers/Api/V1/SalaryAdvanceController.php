<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\SalaryAdvanceResource;
use App\Models\SalaryAdvanceRequest;
use App\Services\Payroll\SalaryAdvanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SalaryAdvanceController extends TenantAppController
{
    public function __construct(
        private readonly SalaryAdvanceService $advances
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return SalaryAdvanceResource::collection(
            $this->advances->listForUser($request->user())
        );
    }

    public function pending(): AnonymousResourceCollection
    {
        return SalaryAdvanceResource::collection(
            $this->advances->pendingForAdmin()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1', 'max:999999.99'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $advance = $this->advances->create($request->user(), $validated);

        return response()->json([
            'message' => 'Advance salary request submitted.',
            'request' => new SalaryAdvanceResource($advance->load('user')),
        ], 201);
    }

    public function approve(Request $request, SalaryAdvanceRequest $advanceRequest): JsonResponse
    {
        $updated = $this->advances->approve($request->user(), $advanceRequest);

        return response()->json([
            'message' => 'Advance request approved.',
            'request' => new SalaryAdvanceResource($updated),
        ]);
    }

    public function reject(Request $request, SalaryAdvanceRequest $advanceRequest): JsonResponse
    {
        $updated = $this->advances->reject($request->user(), $advanceRequest);

        return response()->json([
            'message' => 'Advance request rejected.',
            'request' => new SalaryAdvanceResource($updated),
        ]);
    }
}
