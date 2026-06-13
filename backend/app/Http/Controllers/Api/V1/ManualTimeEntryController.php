<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\TimeEntryResource;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Tenant\TenantContext;
use App\Services\Time\ManualTimeEntryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class ManualTimeEntryController extends TenantAppController
{
    public function __construct(
        private readonly ManualTimeEntryService $manualTime
    ) {}

    public function context(Request $request): JsonResponse
    {
        $role = $request->user()->currentRole();

        return match ($role) {
            UserRole::Employee => response()->json(
                $this->manualTime->contextForEmployee($request->user())
            ),
            UserRole::Manager => response()->json(
                $this->manualTime->contextForManager($request->user())
            ),
            UserRole::Admin, UserRole::SubAdmin => abort(403, 'Administrators cannot submit manual time entries.'),
            default => abort(403),
        };
    }

    public function store(Request $request): JsonResponse
    {
        $role = $request->user()?->currentRole();

        if ($role === UserRole::Employee) {
            $validated = $request->validate([
                'date' => ['required', 'date'],
                'duration' => ['required', 'integer', 'min:60', 'max:86400'],
                'description' => ['required', 'string', 'max:2000'],
                'project_id' => [
                    'required',
                    'integer',
                    Rule::exists('projects', 'id')->where(
                        fn ($query) => $query->where('organization_id', TenantContext::id())
                    ),
                ],
                'manager_id' => ['required', 'integer', 'exists:users,id'],
            ]);

            $entry = $this->manualTime->createForEmployee($request->user(), $validated);

            return response()->json([
                'message' => 'Manual time entry submitted for manager approval.',
                'entry' => new TimeEntryResource($entry->load(['project', 'assignedManager', 'team'])),
            ], 201);
        }

        if ($role === UserRole::Manager) {
            $forSelf = $request->boolean('for_self');

            if ($forSelf) {
                $validated = $request->validate([
                    'date' => ['required', 'date'],
                    'duration' => ['required', 'integer', 'min:60', 'max:86400'],
                    'description' => ['required', 'string', 'max:2000'],
                    'project_id' => [
                        'required',
                        'integer',
                        Rule::exists('projects', 'id')->where(
                            fn ($query) => $query->where('organization_id', TenantContext::id())
                        ),
                    ],
                ]);

                $entry = $this->manualTime->createForManagerSelf($request->user(), $validated);

                return response()->json([
                    'message' => 'Manual time entry submitted for admin approval.',
                    'entry' => new TimeEntryResource($entry->load(['project', 'team'])),
                ], 201);
            }

            $validated = $request->validate([
                'user_id' => ['required', 'integer', 'exists:users,id'],
                'date' => ['required', 'date'],
                'duration' => ['required', 'integer', 'min:60', 'max:86400'],
                'description' => ['required', 'string', 'max:2000'],
                'project_id' => [
                    'required',
                    'integer',
                    Rule::exists('projects', 'id')->where(
                        fn ($query) => $query->where('organization_id', TenantContext::id())
                    ),
                ],
                'require_approval' => ['sometimes', 'boolean'],
            ]);

            $entry = $this->manualTime->createForTeamMemberByManager($request->user(), $validated);

            return response()->json([
                'message' => 'Manual time entry recorded for team member.',
                'entry' => new TimeEntryResource($entry->load(['project', 'user', 'assignedManager', 'team'])),
            ], 201);
        }

        if ($role?->isOperationalAdmin()) {
            abort(403, 'Administrators cannot submit manual time entries.');
        }

        abort(403);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $entries = TimeEntry::query()
            ->manualEntries()
            ->with(['project', 'approver', 'assignedManager', 'team'])
            ->where('organization_id', TenantContext::id())
            ->where('user_id', $request->user()->id)
            ->orderByDesc('start_time')
            ->get();

        return TimeEntryResource::collection($entries);
    }

    public function pending(Request $request): AnonymousResourceCollection
    {
        $role = $request->user()->currentRole();

        $entries = match ($role) {
            UserRole::Admin, UserRole::SubAdmin => $this->manualTime->pendingForAdmin(),
            UserRole::Manager => $this->manualTime->pendingForManager($request->user()),
            default => abort(403),
        };

        return TimeEntryResource::collection($entries);
    }

    public function approve(Request $request, TimeEntry $entry): JsonResponse
    {
        $entry = $this->manualTime->approve($entry, $request->user());

        return response()->json([
            'message' => 'Manual time entry approved.',
            'entry' => new TimeEntryResource($entry),
        ]);
    }

    public function reject(Request $request, TimeEntry $entry): JsonResponse
    {
        $entry = $this->manualTime->reject($entry, $request->user());

        return response()->json([
            'message' => 'Manual time entry rejected.',
            'entry' => new TimeEntryResource($entry),
        ]);
    }
}
