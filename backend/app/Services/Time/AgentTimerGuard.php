<?php

namespace App\Services\Time;

use App\Enums\TimeEntryStatus;
use App\Models\TimeEntry;
use App\Services\Payroll\PayrollPeriodLockService;
use App\Services\Screenshots\ScreenshotAgentService;
use App\Services\Tenant\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Timers need the desktop agent while they run, not only when they start: once
 * the agent stops checking in (quit, uninstalled, PC asleep or offline) the
 * running timer is paused at the agent's last check-in, so time without
 * screenshots or activity is never counted. The employee resumes once the
 * agent is back.
 */
class AgentTimerGuard
{
    public const REASON_AGENT_OFFLINE = 'agent_offline';

    public function __construct(
        private readonly ScreenshotAgentService $agent,
        private readonly PayrollPeriodLockService $payrollLock,
    ) {}

    /** Pause the user's running timer if their agent has gone quiet. */
    public function enforceForUser(int $userId, int $organizationId): void
    {
        $running = $this->runningTimers()
            ->where('organization_id', $organizationId)
            ->where('user_id', $userId)
            ->first();

        if ($running) {
            $this->enforce($running);
        }
    }

    /** Pause every running timer in the organization whose agent has gone quiet. */
    public function enforceForOrganization(int $organizationId): int
    {
        return $this->runningTimers()
            ->where('organization_id', $organizationId)
            ->get()
            ->filter(fn (TimeEntry $entry) => $this->enforce($entry))
            ->count();
    }

    /** Sweep every organization (scheduled safety net, runs without a tenant context). */
    public function enforceEverywhere(): int
    {
        $paused = 0;

        $this->runningTimers()
            ->with('organization')
            ->get()
            ->groupBy('organization_id')
            ->each(function ($entries) use (&$paused) {
                $organization = $entries->first()->organization;
                if (! $organization) {
                    return;
                }

                // Payroll-lock checks are tenant scoped; run each organization in its own context.
                $previous = TenantContext::has() ? TenantContext::get() : null;
                TenantContext::set($organization);

                try {
                    $paused += $entries->filter(fn (TimeEntry $entry) => $this->enforce($entry))->count();
                } finally {
                    $previous ? TenantContext::set($previous) : TenantContext::forget();
                }
            });

        return $paused;
    }

    /** @return bool true when the timer was paused */
    public function enforce(TimeEntry $entry): bool
    {
        if (! config('screenshots.timer_requires_agent') || $entry->status !== TimeEntryStatus::Running) {
            return false;
        }

        $graceMinutes = max(1, (int) config('screenshots.timer_agent_offline_minutes', 5));
        // No trace at all (e.g. the check-in cache expired): the agent was present at start.
        $lastSeen = $this->agent->lastCheckInAt($entry->user_id, $entry->organization_id) ?? $entry->start_time;

        if ($lastSeen->greaterThan(now()->subMinutes($graceMinutes))) {
            return false;
        }

        $endTime = $lastSeen->greaterThan($entry->start_time) ? $lastSeen->copy() : $entry->start_time->copy();

        try {
            $this->payrollLock->assertTimeEntryModifiable($entry);
        } catch (\Throwable) {
            return false; // a locked payroll period is never rewritten automatically
        }

        $entry->update([
            'end_time' => $endTime,
            'duration' => (int) $entry->start_time->diffInSeconds($endTime),
            'status' => TimeEntryStatus::Stopped,
            'paused' => true,
            'pause_reason' => self::REASON_AGENT_OFFLINE,
        ]);

        Log::info('Timer paused: desktop agent offline.', [
            'time_entry_id' => $entry->id,
            'user_id' => $entry->user_id,
            'organization_id' => $entry->organization_id,
            'agent_last_seen' => $lastSeen->toIso8601String(),
        ]);

        return true;
    }

    private function runningTimers()
    {
        // Explicit organization filters above; works with or without tenant context (cron).
        return TimeEntry::query()
            ->withoutGlobalScope('organization')
            ->trackedTimers()
            ->where('status', TimeEntryStatus::Running);
    }
}
