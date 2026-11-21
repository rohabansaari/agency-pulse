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
use App\Services\Time\AgentTimerGuard;
use App\Support\WorkforceMembers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TimeEntryController extends TenantAppController
{
    public const PAUSE_REASON_IDLE = 'idle';

    public function __construct(
        private readonly ProjectAccessService $projectAccess,
        private readonly ReportingService $reporting,
        private readonly PayrollPeriodLockService $payrollLock,
        private readonly ScreenshotAgentService $agent,
        private readonly AgentTimerGuard $agentGuard,
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

        $this->agentGuard->enforceForUser($user->id, TenantContext::id());

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

        $paused->update(['paused' => false, 'pause_reason' => null]);

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

            $entry->update(['paused' => false, 'pause_reason' => null]);
        }

        return response()->json([
            'message' => 'Timer stopped.',
            'entry' => new TimeEntryResource($entry->fresh()->load('project')),
        ]);
    }

    /**
     * The desktop agent saw no keyboard/mouse input for the company's idle limit:
     * pause the timer back at the last input, so idle time isn't counted unless
     * the employee chooses to keep it when they return.
     */
    public function idle(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->assertCanTrack($user);

        $validated = $request->validate([
            'idle_since' => ['required', 'date'],
        ]);

        $timeout = (int) TenantContext::get()->idle_timeout_minutes;

        if ($timeout < 1) {
            throw ValidationException::withMessages([
                'idle' => ['Idle detection is turned off for your company.'],
            ]);
        }

        $entry = $this->runningEntry($user->id);

        if (! $entry) {
            throw ValidationException::withMessages([
                'timer' => ['No running timer to pause.'],
            ]);
        }

        $idleSince = Carbon::parse($validated['idle_since']);

        // The agent reports once the limit is reached; allow a minute of clock drift.
        if ($idleSince->greaterThan(now()->subMinutes($timeout)->addMinute())) {
            throw ValidationException::withMessages([
                'idle_since' => ["The idle limit is {$timeout} minutes."],
            ]);
        }

        $this->payrollLock->assertTimeEntryModifiable($entry);

        $endTime = $idleSince->lessThan($entry->start_time) ? $entry->start_time->copy() : $idleSince;

        $entry->update([
            'end_time' => $endTime,
            'duration' => (int) $entry->start_time->diffInSeconds($endTime),
            'status' => TimeEntryStatus::Stopped,
            'paused' => true,
            'pause_reason' => self::PAUSE_REASON_IDLE,
        ]);

        return response()->json([
            'message' => 'Timer paused: no activity for '.$timeout.' minutes.',
            'entry' => new TimeEntryResource($entry->fresh()->load('project')),
        ]);
    }

    /**
     * The employee decides what happens to time the timer was paused for idle:
     * keep it (a call or meeting) or discard it, then continue or stop.
     */
    public function resolveIdle(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->assertCanTrack($user);

        $validated = $request->validate([
            'action' => ['required', Rule::in(['keep', 'discard'])],
            'resume' => ['required', 'boolean'],
        ]);

        $paused = $this->runningEntry($user->id) ? null : $this->pausedSegment($user->id);

        if (! $paused || $paused->pause_reason !== self::PAUSE_REASON_IDLE) {
            throw ValidationException::withMessages([
                'idle' => ['There is no idle time waiting for a decision.'],
            ]);
        }

        $keep = $validated['action'] === 'keep';
        $resume = (bool) $validated['resume'];
        $idleFrom = $paused->end_time->copy();
        $now = now();

        if ($keep) {
            $maxMinutes = max(1, (int) config('screenshots.idle_keep_max_minutes', 240));

            if ($idleFrom->diffInMinutes($now) > $maxMinutes) {
                throw ValidationException::withMessages([
                    'idle' => [
                        'Idle time longer than '.intdiv($maxMinutes, 60).' hours can\'t be kept. Discard it and add the work as manual time instead.',
                    ],
                ]);
            }

            $this->payrollLock->assertDateModifiable($idleFrom->copy()->startOfDay());
        }

        if ($resume) {
            $this->assertAgentConnected($user);
            $this->payrollLock->assertDateModifiable(Carbon::today()->startOfDay());
        }

        $entry = DB::transaction(function () use ($paused, $keep, $resume, $idleFrom, $now, $user) {
            $paused->update(['paused' => false, 'pause_reason' => null]);
            $latest = $paused;

            if ($keep) {
                $latest = TimeEntry::create([
                    'user_id' => $user->id,
                    'organization_id' => TenantContext::id(),
                    'type' => TimeEntryType::Tracked,
                    'project_id' => $paused->project_id,
                    'start_time' => $idleFrom,
                    'end_time' => $now,
                    'duration' => (int) $idleFrom->diffInSeconds($now),
                    'status' => TimeEntryStatus::Stopped,
                    'timer_session' => $paused->timer_session,
                    'idle_kept' => true,
                ]);
            }

            if ($resume) {
                $latest = TimeEntry::create([
                    'user_id' => $user->id,
                    'organization_id' => TenantContext::id(),
                    'type' => TimeEntryType::Tracked,
                    'project_id' => $paused->project_id,
                    'start_time' => $now,
                    'status' => TimeEntryStatus::Running,
                    'timer_session' => $paused->timer_session ?? (string) Str::uuid(),
                ]);
            }

            return $latest;
        });

        $message = ($keep ? 'Idle time kept' : 'Idle time discarded').($resume ? '; timer running.' : '; timer stopped.');

        return response()->json([
            'message' => $message,
            'entry' => new TimeEntryResource($entry->fresh()->load('project')),
        ], $resume ? 201 : 200);
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
        $this->agentGuard->enforceForUser($userId, TenantContext::id());

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
            'pause_reason' => null,
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

        $this->agentGuard->enforceForUser($user->id, TenantContext::id());

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
                'idle_timeout_minutes' => (int) TenantContext::get()->idle_timeout_minutes,
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
