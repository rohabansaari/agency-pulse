<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\OvertimeRequestResource;
use App\Models\OvertimeRequest;
use App\Services\Time\OvertimeRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class OvertimeRequestController extends TenantAppController
{
    public function __construct(
        private readonly OvertimeRequestService $overtime
    ) {}

    public function context(Request $request): JsonResponse
    {
        $role = $request->user()->currentRole();

        return match ($role) {
            UserRole::Employee => response()->json(
                $this->overtime->contextForEmployee($request->user())
            ),
            UserRole::Manager => response()->json(
                $this->overtime->contextForManager($request->user())
            ),
            default => response()->json([
                'can_create' => false,
                'reason' => 'Only employees and managers can request overtime.',
            ]),
        };
    }

    public function store(Request $request): JsonResponse
    {
        $role = $request->user()?->currentRole();

        $baseRules = [
            'date' => ['required', 'date'],
            'duration' => ['required', 'integer', 'min:900', 'max:86400'],
            'reason' => ['required', 'string', 'max:2000'],
            'project_id' => ['required', 'integer', 'exists:projects,id'],
        ];

        if ($role === UserRole::Employee) {
            $validated = $request->validate($baseRules);
            $overtimeRequest = $this->overtime->createForEmployee($request->user(), $validated);

            return response()->json([
                'message' => 'Overtime request submitted for manager approval.',
                'request' => new OvertimeRequestResource($overtimeRequest->load(['project', 'assignedManager'])),
            ], 201);
        }

        if ($role === UserRole::Manager && $request->boolean('for_self')) {
            $validated = $request->validate($baseRules);
            $overtimeRequest = $this->overtime->createForManagerSelf($request->user(), $validated);

            return response()->json([
                'message' => 'Overtime request submitted for admin approval.',
                'request' => new OvertimeRequestResource($overtimeRequest->load(['project'])),
            ], 201);
        }

        abort(403);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        return OvertimeRequestResource::collection(
            $this->overtime->listForUser($request->user())
        );
    }

    public function pending(Request $request): AnonymousResourceCollection
    {
        $role = $request->user()->currentRole();

        $requests = match ($role) {
            UserRole::Manager => $this->overtime->pendingForManager($request->user()),
            UserRole::Admin, UserRole::SubAdmin => $this->overtime->pendingManagerRequestsForAdmin(),
            default => abort(403),
        };

        return OvertimeRequestResource::collection($requests);
    }

    public function approve(Request $request, OvertimeRequest $overtimeRequest): JsonResponse
    {
        $overtimeRequest = $this->overtime->approve($overtimeRequest, $request->user());

        return response()->json([
            'message' => 'Overtime request approved.',
            'request' => new OvertimeRequestResource($overtimeRequest),
        ]);
    }

    public function reject(Request $request, OvertimeRequest $overtimeRequest): JsonResponse
    {
        $validated = $request->validate([
            'rejection_reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $overtimeRequest = $this->overtime->reject(
            $overtimeRequest,
            $request->user(),
            $validated['rejection_reason'] ?? null
        );

        return response()->json([
            'message' => 'Overtime request rejected.',
            'request' => new OvertimeRequestResource($overtimeRequest),
        ]);
    }
}
