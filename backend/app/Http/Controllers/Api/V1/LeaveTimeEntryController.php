<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\LeaveCategory;
use App\Enums\TimeEntryStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\LeaveTimeEntryResource;
use App\Models\TimeEntry;
use App\Services\Time\LeaveTimeEntryService;
use App\Support\DisplayDate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class LeaveTimeEntryController extends TenantAppController
{
    public function __construct(
        private readonly LeaveTimeEntryService $leaveTime
    ) {}

    public function context(Request $request): JsonResponse
    {
        $role = $request->user()->currentRole();

        return match ($role) {
            UserRole::Employee => response()->json(
                $this->leaveTime->contextForEmployee($request->user())
            ),
            UserRole::Manager => response()->json(
                $this->leaveTime->contextForManager($request->user())
            ),
            UserRole::Admin, UserRole::SubAdmin => response()->json(
                $this->leaveTime->contextForAdmin()
            ),
            default => abort(403),
        };
    }

    public function store(Request $request): JsonResponse
    {
        $role = $request->user()->currentRole();

        if ($role === UserRole::Employee) {
            $validated = $request->validate($this->leaveStoreRules());

            $entries = $this->leaveTime->requestByEmployee($request->user(), $validated);

            return response()->json([
                'message' => 'Leave request submitted for manager approval.',
                'entries' => LeaveTimeEntryResource::collection(
                    $this->loadLeaveEntries($entries->pluck('id')->all(), ['team', 'assignedManager'])
                ),
            ], 201);
        }

        if ($role === UserRole::Manager) {
            if ($request->boolean('for_self')) {
                $validated = $request->validate($this->leaveStoreRules());
                $entries = $this->leaveTime->requestByManagerSelf($request->user(), $validated);

                return response()->json([
                    'message' => 'Leave request submitted for admin approval.',
                    'entries' => LeaveTimeEntryResource::collection(
                        $this->loadLeaveEntries($entries->pluck('id')->all(), ['team', 'assignedManager'])
                    ),
                ], 201);
            }

            $validated = $request->validate([
                ...$this->leaveStoreRules(),
                'user_id' => ['required', 'integer', 'exists:users,id'],
                'require_approval' => ['sometimes', 'boolean'],
            ]);

            $entries = $this->leaveTime->createForTeamMemberByManager($request->user(), $validated);

            return response()->json([
                'message' => 'Leave recorded for team member.',
                'entries' => LeaveTimeEntryResource::collection(
                    $this->loadLeaveEntries($entries->pluck('id')->all(), ['user', 'team', 'assignedManager'])
                ),
            ], 201);
        }

        if (! $role?->isOperationalAdmin()) {
            abort(403);
        }

        $validated = $request->validate([
            ...$this->leaveStoreRules(),
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'team_id' => ['nullable', 'integer', 'exists:teams,id'],
        ]);

        $entries = $this->leaveTime->createByAdmin($request->user(), $validated);

        return response()->json([
            'message' => 'Paid leave assigned to employee.',
            'entries' => LeaveTimeEntryResource::collection(
                $this->loadLeaveEntries($entries->pluck('id')->all(), ['user', 'team', 'assignedManager'])
            ),
        ], 201);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $role = $request->user()->currentRole();

        $entries = match ($role) {
            UserRole::Employee => $this->leaveTime->listForEmployee($request->user()),
            UserRole::Manager => $this->leaveTime->listForManager($request->user()),
            UserRole::Admin, UserRole::SubAdmin => $this->leaveTime->listForAdmin(),
            default => abort(403),
        };

        return LeaveTimeEntryResource::collection($entries);
    }

    public function pending(Request $request): AnonymousResourceCollection
    {
        $role = $request->user()->currentRole();

        $entries = match ($role) {
            UserRole::Admin, UserRole::SubAdmin => $this->leaveTime->pendingForAdmin(),
            UserRole::Manager => $this->leaveTime->pendingForManager($request->user()),
            default => abort(403),
        };

        return LeaveTimeEntryResource::collection($entries);
    }

    public function approve(Request $request, TimeEntry $entry): JsonResponse
    {
        $entry = $this->leaveTime->approve($entry, $request->user());

        return response()->json([
            'message' => 'Leave request approved.',
            'entry' => new LeaveTimeEntryResource($entry),
        ]);
    }

    public function reject(Request $request, TimeEntry $entry): JsonResponse
    {
        $entry = $this->leaveTime->reject($entry, $request->user());

        return response()->json([
            'message' => 'Leave request rejected.',
            'entry' => new LeaveTimeEntryResource($entry),
        ]);
    }

    public function update(Request $request, TimeEntry $entry): JsonResponse
    {
        if (! $request->user()->currentRole()?->isOperationalAdmin()) {
            abort(403);
        }

        $validated = $request->validate([
            'reason' => ['sometimes', 'string', 'max:2000'],
            'status' => ['sometimes', Rule::in([
                TimeEntryStatus::Pending->value,
                TimeEntryStatus::Approved->value,
                TimeEntryStatus::Rejected->value,
            ])],
            'date' => ['sometimes', 'regex:'.DisplayDate::INPUT_PATTERN],
            'duration' => ['sometimes', 'integer', 'min:60', 'max:86400'],
            'user_id' => ['sometimes', 'integer', 'exists:users,id'],
            'manager_id' => ['sometimes', 'integer', 'exists:users,id'],
        ]);

        $entry = $this->leaveTime->updateByAdmin($entry, $request->user(), $validated);

        return response()->json([
            'message' => 'Leave entry updated.',
            'entry' => new LeaveTimeEntryResource($entry),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function leaveStoreRules(): array
    {
        return [
            'date' => ['required_without_all:start_date,end_date', 'regex:'.DisplayDate::INPUT_PATTERN],
            'start_date' => ['required_without:date', 'regex:'.DisplayDate::INPUT_PATTERN],
            'end_date' => ['required_with:start_date', 'regex:'.DisplayDate::INPUT_PATTERN],
            'reason' => ['required', 'string', 'max:2000'],
            'leave_category' => ['required', Rule::enum(LeaveCategory::class)],
        ];
    }

    /**
     * @param  list<int>  $ids
     * @param  list<string>  $relations
     */
    private function loadLeaveEntries(array $ids, array $relations): \Illuminate\Database\Eloquent\Collection
    {
        return TimeEntry::query()
            ->whereIn('id', $ids)
            ->with($relations)
            ->orderBy('start_time')
            ->get();
    }
}
