<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ProjectStatus;
use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\TimeEntryResource;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Services\Payroll\PayrollPeriodLockService;
use App\Services\Projects\ProjectAccessService;
use App\Services\Reporting\ReportingService;
use App\Services\Screenshots\ScreenshotAgentService;
use App\Services\Tenant\TenantContext;
use App\Support\WorkforceMembers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TimeEntryController extends TenantAppController
{
    public function __construct(
        private readonly ProjectAccessService $projectAccess,
        private readonly ReportingService $reporting,
        private readonly PayrollPeriodLockService $payrollLock,
        private readonly ScreenshotAgentService $agent
    ) {}

    public function start(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->currentRole()?->isOperationalAdmin()) {
            throw ValidationException::withMessages([
                'timer' => ['Administrators cannot track time. Use employee or manager accounts for time tracking.'],
            ]);
        }

        $validated = $request->validate([
            'project_id' => [
                'nullable',
                'integer',
                Rule::exists('projects', 'id')->where(
                    fn ($query) => $query->where('organization_id', TenantContext::id())
                ),
            ],
        ]);

        if (isset($validated['project_id'])) {
            $project = Project::query()->findOrFail($validated['project_id']);

            if ($user->currentRole() === UserRole::Employee) {
                if ($project->status !== ProjectStatus::Active) {
                    throw ValidationException::withMessages([
                        'project_id' => ['You are not assigned to this project.'],
                    ]);
                }

                if (! $this->projectAccess->userCanAccessProject($user, $project)) {
                    throw ValidationException::withMessages([
                        'project_id' => ['You are not assigned to this project.'],
                    ]);
                }
            }
        }

        $activeTimer = TimeEntry::query()
            ->trackedTimers()
            ->where('user_id', $user->id)
            ->where('status', TimeEntryStatus::Running)
            ->first();

        if ($activeTimer) {
            throw ValidationException::withMessages([
                'timer' => ['You already have a running timer. Stop it before starting a new one.'],
            ]);
        }

        $this->assertAgentConnected($user);
        $this->payrollLock->assertDateModifiable(Carbon::today()->startOfDay());

        // Starting fresh discards a paused session; its time is already saved.
        $this->pausedSegment($user->id)?->update(['paused' => false]);

        $entry = TimeEntry::create([
            'user_id' => $user->id,
            'organization_id' => TenantContext::id(),
            'type' => TimeEntryType::Tracked,
            'project_id' => $validated['project_id'] ?? null,
            'start_time' => now(),
            'status' => TimeEntryStatus::Running,
            'timer_session' => (string) Str::uuid(),
        ]);

        return response()->json([
            'message' => 'Timer started.',
            'entry' => new TimeEntryResource($entry->load('project')),
        ], 201);
    }

    public function pause(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->assertCanTrack($user);

        $entry = $this->runningEntry($user->id);

        if (! $entry) {
            throw ValidationException::withMessages([
                'timer' => ['No running timer to pause.'],
            ]);
        }

        $this->closeSegment($entry, paused: true);

        return response()->json([
            'message' => 'Timer paused.',
            'entry' => new TimeEntryResource($entry->fresh()->load('project')),
        ]);
    }

    public function resume(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->assertCanTrack($user);

        if ($this->runningEntry($user->id)) {
            throw ValidationException::withMessages([
                'timer' => ['Your timer is already running.'],
            ]);
        }

        $paused = $this->pausedSegment($user->id);

        if (! $paused) {
            throw ValidationException::withMessages([
                'timer' => ['No paused timer to resume.'],
            ]);
        }

        $this->assertAgentConnected($user);
        $this->payrollLock->assertDateModifiable(Carbon::today()->startOfDay());

        $paused->update(['paused' => false]);

        $entry = TimeEntry::create([
            'user_id' => $user->id,
            'organization_id' => TenantContext::id(),
            'type' => TimeEntryType::Tracked,
            'project_id' => $paused->project_id,
            'start_time' => now(),
            'status' => TimeEntryStatus::Running,
            'timer_session' => $paused->timer_session ?? (string) Str::uuid(),
        ]);

        return response()->json([
            'message' => 'Timer resumed.',
            'entry' => new TimeEntryResource($entry->load('project')),
        ], 201);
    }

    public function stop(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->assertCanTrack($user);

        $entry = $this->runningEntry($user->id);

        if ($entry) {
            $this->closeSegment($entry, paused: false);
        } else {
            $entry = $this->pausedSegment($user->id);

            if (! $entry) {
                throw ValidationException::withMessages([
                    'timer' => ['No active timer found.'],
                ]);
            }

            $entry->update(['paused' => false]);
        }

        return response()->json([
            'message' => 'Timer stopped.',
            'entry' => new TimeEntryResource($entry->fresh()->load('project')),
        ]);
    }

    private function assertCanTrack($user): void
    {
        if ($user->currentRole()?->isOperationalAdmin()) {
            throw ValidationException::withMessages([
                'timer' => ['Administrators cannot track time.'],
            ]);
        }
    }

    private function assertAgentConnected($user): void
    {
        if (config('screenshots.timer_requires_agent') && ! $this->agent->status($user)['connected']) {
            throw ValidationException::withMessages([
                'timer' => ['Install and sign in to the AgencyPulse desktop agent before starting the timer.'],
            ]);
        }
    }

    private function runningEntry(int $userId): ?TimeEntry
    {
        return TimeEntry::query()
            ->trackedTimers()
            ->where('user_id', $userId)
            ->where('status', TimeEntryStatus::Running)
            ->first();
    }

    private function pausedSegment(int $userId): ?TimeEntry
    {
        return TimeEntry::query()
            ->trackedTimers()
            ->where('user_id', $userId)
            ->where('status', TimeEntryStatus::Stopped)
            ->where('paused', true)
            ->latest('end_time')
            ->first();
    }

    private function closeSegment(TimeEntry $entry, bool $paused): void
    {
        $this->payrollLock->assertTimeEntryModifiable($entry);

        $endTime = now();

        $entry->update([
            'end_time' => $endTime,
            'duration' => (int) $entry->start_time->diffInSeconds($endTime),
            'status' => TimeEntryStatus::Stopped,
            'paused' => $paused,
        ]);
    }

    /**
     * Seconds already banked in the current session, excluding the running segment.
     */
    private function sessionBankedSeconds(?TimeEntry $current): int
    {
        if (! $current?->timer_session) {
            return $current && ! $current->isRunning() ? (int) $current->duration : 0;
        }

        return (int) TimeEntry::query()
            ->trackedTimers()
            ->where('user_id', $current->user_id)
            ->where('timer_session', $current->timer_session)
            ->where('status', TimeEntryStatus::Stopped)
            ->sum('duration');
    }

    public function today(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        if ($user->currentRole()?->isOperationalAdmin()) {
            abort(403, 'Administrators cannot track time.');
        }

        $startOfDay = Carbon::today();
        $endOfDay = Carbon::today()->endOfDay();

        $entries = TimeEntry::query()
            ->trackedTimers()
            ->with('project')
            ->where('user_id', $user->id)
            ->whereBetween('start_time', [$startOfDay, $endOfDay])
            ->orderByDesc('start_time')
            ->get();

        $totalDuration = (int) TimeEntry::query()
            ->countable()
            ->where('user_id', $user->id)
            ->whereBetween('start_time', [$startOfDay, $endOfDay])
            ->sum('duration');

        $activeTimer = $entries->first(fn (TimeEntry $entry) => $entry->isRunning());
        $pausedTimer = $activeTimer ? null : $this->pausedSegment($user->id);

        $byProject = $entries
            ->groupBy(fn (TimeEntry $entry) => $entry->project_id ?? 'none')
            ->map(function ($group, $projectKey) {
                /** @var \Illuminate\Support\Collection<int, TimeEntry> $group */
                $project = $group->first()?->project;

                return [
                    'project_id' => $projectKey === 'none' ? null : (int) $projectKey,
                    'project_name' => $project?->name ?? 'No project',
                    'client_name' => $project?->client_name,
                    'total_duration' => $group
                        ->filter(fn (TimeEntry $e) => $e->countsTowardTotals())
                        ->sum('duration'),
                    'entries_count' => $group->count(),
                ];
            })
            ->values()
            ->all();

        return TimeEntryResource::collection($entries)->additional([
            'meta' => [
                'date' => $startOfDay->toDateString(),
                'total_duration' => $totalDuration,
                'active_timer' => $activeTimer
                    ? new TimeEntryResource($activeTimer->load('project'))
                    : null,
                'paused_timer' => $pausedTimer
                    ? new TimeEntryResource($pausedTimer->load('project'))
                    : null,
                'session_elapsed' => $this->sessionBankedSeconds($activeTimer ?? $pausedTimer),
                'by_project' => $byProject,
            ],
        ]);
    }

    public function personalReport(Request $request): JsonResponse
    {
        if ($request->user()->currentRole() !== UserRole::Employee) {
            abort(403);
        }

        return response()->json(
            $this->reporting->employeePersonalReport($request->user())
        );
    }

    public function organization(Request $request): AnonymousResourceCollection
    {
        $startOfDay = Carbon::today();
        $endOfDay = Carbon::today()->endOfDay();
        $orgId = TenantContext::id();
        $workforceIds = WorkforceMembers::activeMemberUserIds($orgId)->all();

        $entries = TimeEntry::query()
            ->with(['user', 'project'])
            ->where('organization_id', $orgId)
            ->whereIn('user_id', $workforceIds)
            ->whereBetween('start_time', [$startOfDay, $endOfDay])
            ->orderByDesc('start_time')
            ->get();

        $totalDuration = (int) TimeEntry::query()
            ->countable()
            ->where('organization_id', $orgId)
            ->whereIn('user_id', $workforceIds)
            ->whereBetween('start_time', [$startOfDay, $endOfDay])
            ->sum('duration');

        return TimeEntryResource::collection($entries)->additional([
            'meta' => [
                'date' => $startOfDay->toDateString(),
                'total_duration' => $totalDuration,
                'scope' => 'organization',
            ],
        ]);
    }
}
