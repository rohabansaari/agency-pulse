"use client";

import {
  ApiError,
  fetchProjects,
  fetchTodayTime,
  formatApiErrors,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopTimer,
} from "@/lib/api";
import { formatDuration, formatTime } from "@/lib/time";
import { ManualTimeEntries } from "@/components/time/ManualTimeEntries";
import { ManualTimeEntryForm } from "@/components/time/ManualTimeEntryForm";
import { OvertimeRequestForm } from "@/components/time/OvertimeRequestForm";
import { OvertimeRequestList } from "@/components/time/OvertimeRequestList";
import { hoursLabel } from "@/components/ledger/format";
import { Panel } from "@/components/ledger/Panel";
import { Segmented, type SegmentedOption } from "@/components/ledger/Segmented";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { TimerFocusPanel } from "@/components/time/TimerFocusPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { TIME_TRACKING_EXPORT_COLUMNS } from "@/lib/export-columns";
import { wakeDesktopAgent } from "@/lib/desktop-agent";
import { useDesktopAgentStatus } from "@/hooks/useDesktopAgentStatus";
import type { Project, TimeEntry, User } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

const GENERAL_TIME_VALUE = "";

function elapsedSeconds(startTime: string): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(startTime).getTime()) / 1000),
  );
}

function projectLabel(project: Project): string {
  return `${project.name} — ${project.client_name}`;
}

function TodayPanel({
  entries,
  liveElapsed,
  totalSeconds,
  exportControl,
}: {
  entries: TimeEntry[];
  liveElapsed: number;
  totalSeconds: number;
  exportControl: ReactNode;
}) {
  const first = entries.at(-1);
  const last = entries[0];

  return (
    <Panel
      title="Today"
      description={new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
      action={exportControl}
      flush
    >
      <div className="grid grid-cols-2 gap-3 px-5">
        <div className="rounded-xl bg-[var(--accent-sand)] px-4 py-3">
          <p className="text-[0.8125rem] text-[var(--muted)]">Total</p>
          <p className="num mt-1 text-xl font-semibold text-[var(--foreground)]">{hoursLabel(totalSeconds)}</p>
        </div>
        <div className="rounded-xl bg-[var(--accent-sand)] px-4 py-3">
          <p className="text-[0.8125rem] text-[var(--muted)]">Sessions</p>
          <p className="num mt-1 text-xl font-semibold text-[var(--foreground)]">{entries.length}</p>
        </div>
      </div>
      {first && last ? (
        <p className="tnum px-5 pt-3 text-xs text-[var(--muted)]">
          {formatTime(first.start_time)} → {last.end_time ? formatTime(last.end_time) : "now"}
        </p>
      ) : null}

      {entries.length === 0 ? (
        <div className="px-5 pb-6 pt-4">
          <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            No sessions yet today. Start the timer to begin tracking.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
          {entries.map((entry) => {
            const isRunning = entry.status === "running";
            const duration = isRunning ? liveElapsed : (entry.duration ?? 0);
            return (
              <li key={entry.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {entry.project_name ?? "General time"}
                  </p>
                  <p className="tnum mt-0.5 text-xs text-[var(--muted)]">
                    {formatTime(entry.start_time)} → {entry.end_time ? formatTime(entry.end_time) : "now"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="num text-sm font-semibold text-[var(--foreground)]">{formatDuration(duration)}</span>
                  {isRunning ? (
                    <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-[var(--accent-emerald)]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-emerald)]" aria-hidden="true" />
                      Live
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function TimeTracker({ user }: { user?: User }) {
  const [tab, setTab] = useState<"timer" | "manual" | "overtime">("timer");
  const [overtimeRefreshKey, setOvertimeRefreshKey] = useState(0);
  const [manualRefreshKey, setManualRefreshKey] = useState(0);
  const isEmployee = user?.role === "employee";
  const isManager = user?.role === "manager";
  const isAdmin = user?.role === "admin" || user?.role === "sub_admin";
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(GENERAL_TIME_VALUE);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null);
  const [pausedTimer, setPausedTimer] = useState<TimeEntry | null>(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [projectsNotice, setProjectsNotice] = useState("");
  const requiresAgent = isEmployee || isManager;
  const {
    connected: agentConnected,
    refresh: refreshAgentStatus,
    timerRequiresAgent,
  } = useDesktopAgentStatus(requiresAgent);
  const agentMissing = requiresAgent && timerRequiresAgent && !agentConnected;

  const loadToday = useCallback(async () => {
    setError("");

    try {
      const response = await fetchTodayTime();
      setEntries(response.data ?? []);
      setTotalDuration(response.meta.total_duration);
      setActiveTimer(response.meta.active_timer);
      setPausedTimer(response.meta.paused_timer ?? null);
      setSessionElapsed(response.meta.session_elapsed ?? 0);
      setLiveElapsed(
        response.meta.active_timer
          ? elapsedSeconds(response.meta.active_timer.start_time)
          : 0,
      );

      const sessionProjectId =
        response.meta.active_timer?.project_id ?? response.meta.paused_timer?.project_id;
      if (sessionProjectId) {
        setSelectedProjectId(String(sessionProjectId));
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(formatApiErrors(err.errors) || err.message);
      } else {
        setError("Unable to load today's time entries.");
      }
    }
  }, []);

  useEffect(() => {
    async function init() {
      const [projectsResult, todayResult] = await Promise.allSettled([
        fetchProjects(),
        loadToday(),
      ]);

      if (projectsResult.status === "fulfilled") {
        setProjects(projectsResult.value);
      } else {
        setProjects([]);
        setProjectsNotice("Projects API unavailable — using general time only.");
      }

      if (todayResult.status === "rejected") {
        const err = todayResult.reason;
        if (err instanceof ApiError) {
          setError(formatApiErrors(err.errors) || err.message);
        } else {
          setError("Unable to load today's time entries.");
        }
      }

      setLoading(false);
    }

    void init();
  }, [loadToday]);

  useEffect(() => {
    if (!activeTimer) return;

    setLiveElapsed(elapsedSeconds(activeTimer.start_time));
    const interval = window.setInterval(() => {
      setLiveElapsed(elapsedSeconds(activeTimer.start_time));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activeTimer]);

  // While a timer runs, re-check every 30s: the server pauses it if the desktop agent
  // stops checking in, and this page should show that promptly.
  useEffect(() => {
    if (!activeTimer) return;
    const interval = window.setInterval(() => void loadToday(), 30_000);
    return () => window.clearInterval(interval);
  }, [activeTimer, loadToday]);

  useEffect(() => {
    if (!successMessage) return;
    const t = window.setTimeout(() => setSuccessMessage(""), 3000);
    return () => window.clearTimeout(t);
  }, [successMessage]);

  const activeProjectName = useMemo(() => {
    const sessionEntry = activeTimer ?? pausedTimer;
    if (!sessionEntry) return null;
    return (
      sessionEntry.project_name ??
      projects.find((p) => p.id === sessionEntry.project_id)?.name ??
      "General time"
    );
  }, [activeTimer, pausedTimer, projects]);

  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (a, b) =>
          new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
      ),
    [entries],
  );

  const projectOptions = useMemo(
    () => [
      { value: GENERAL_TIME_VALUE, label: "General time" },
      ...projects.map((p) => ({ value: String(p.id), label: projectLabel(p) })),
    ],
    [projects],
  );

  const timeExportRows = useMemo(
    () =>
      sortedEntries.map((entry) => ({
        employee_name: user?.name ?? "—",
        project_name: entry.project_name ?? "General time",
        date: new Date(entry.start_time).toLocaleDateString(),
        hours_worked: formatDuration(
          entry.status === "running" ? liveElapsed : (entry.duration ?? 0),
        ),
        entry_type: "Auto",
        status: entry.status,
      })),
    [sortedEntries, liveElapsed, user?.name],
  );

  async function handleStart() {
    setActionLoading(true);
    setError("");
    setSuccessMessage("");

    const projectId =
      selectedProjectId === GENERAL_TIME_VALUE
        ? null
        : Number(selectedProjectId);

    try {
      await startTimer(projectId);

      try {
        await loadToday();
      } catch (refreshErr) {
        if (refreshErr instanceof ApiError) {
          setError(
            `Timer started, but refresh failed: ${formatApiErrors(refreshErr.errors) || refreshErr.message}`,
          );
        } else {
          setError("Timer started, but unable to refresh today's entries.");
        }
        return;
      }
      setSuccessMessage("Timer started — screenshots will capture automatically");
      wakeDesktopAgent();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(formatApiErrors(err.errors) || err.message);
        void refreshAgentStatus();
      } else {
        setError("Unable to start timer.");
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function runTimerAction(
    action: () => Promise<unknown>,
    success: string,
    fallbackError: string,
  ) {
    setActionLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      await action();
      await loadToday();
      setSuccessMessage(success);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(formatApiErrors(err.errors) || err.message);
      } else {
        setError(fallbackError);
      }
    } finally {
      setActionLoading(false);
    }
  }

  function handlePause() {
    void runTimerAction(pauseTimer, "Timer paused — screenshots paused too", "Unable to pause timer.");
  }

  function handleResume() {
    void runTimerAction(
      async () => {
        await resumeTimer();
        wakeDesktopAgent();
      },
      "Timer resumed",
      "Unable to resume timer.",
    );
  }

  async function handleStop() {
    setActionLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      await stopTimer();
      try {
        await loadToday();
      } catch (refreshErr) {
        if (refreshErr instanceof ApiError) {
          setError(
            `Session saved, but refresh failed: ${formatApiErrors(refreshErr.errors) || refreshErr.message}`,
          );
        } else {
          setError("Session saved, but unable to refresh today's entries.");
        }
        return;
      }
      setSuccessMessage("Session saved");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(formatApiErrors(err.errors) || err.message);
      } else {
        setError("Unable to stop timer.");
      }
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <div className="h-16 w-64 animate-pulse rounded-xl bg-[var(--accent-sand)]" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="h-80 animate-pulse rounded-2xl bg-[var(--accent-sand)]" />
          <div className="h-80 animate-pulse rounded-2xl bg-[var(--accent-sand)]" />
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <h1 className="text-lg font-semibold text-[var(--foreground)]">Time tracking unavailable</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Administrators manage the organization but do not track time. Use employee or manager
          accounts for timers, manual entries, and overtime requests.
        </p>
      </div>
    );
  }

  const sessionSeconds = activeTimer
    ? sessionElapsed + liveElapsed
    : pausedTimer
      ? sessionElapsed
      : 0;
  const displayTime = formatDuration(sessionSeconds);
  const todaySeconds = totalDuration + (activeTimer ? liveElapsed : 0);
  const timerCaption = activeTimer
    ? `Started ${formatTime(activeTimer.start_time)}`
    : pausedTimer?.end_time
      ? `Paused at ${formatTime(pausedTimer.end_time)}`
      : undefined;

  const tabOptions: SegmentedOption<typeof tab>[] = [
    { value: "timer", label: "Live timer" },
    ...(isEmployee ? [{ value: "manual" as const, label: "Manual time" }] : []),
    { value: "overtime", label: "Overtime" },
  ];
  const showTimer = tab === "timer";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Time"
        title="Time tracking"
        description="Start your timer — screenshots capture automatically every 5 minutes."
        actions={
          isEmployee || isManager ? (
            <Segmented label="Time tracking views" options={tabOptions} value={tab} onChange={setTab} />
          ) : null
        }
      />

      {tab === "overtime" ? (
        <div className="flex flex-col gap-6">
          <OvertimeRequestForm
            role={isManager ? "manager" : "employee"}
            onSubmitted={() => setOvertimeRefreshKey((value) => value + 1)}
          />
          <OvertimeRequestList key={overtimeRefreshKey} />
        </div>
      ) : null}

      {isEmployee && tab === "manual" ? (
        <div className="flex flex-col gap-6">
          <Panel title="Submit manual time" description="Requires team membership, a project, and manager approval.">
            <ManualTimeEntryForm
              role="employee"
              onSubmitted={() => setManualRefreshKey((value) => value + 1)}
            />
          </Panel>
          <ManualTimeEntries refreshKey={manualRefreshKey} employeeName={user.name} />
        </div>
      ) : null}

      {showTimer ? (
        <>
          {!activeTimer && pausedTimer?.pause_reason === "agent_offline" ? (
            <p
              role="status"
              className="rounded-xl border border-[var(--accent-copper)]/30 bg-[var(--accent-copper-soft)] px-4 py-2.5 text-sm text-[var(--foreground)]"
            >
              Your timer was paused automatically
              {pausedTimer.end_time ? ` at ${formatTime(pausedTimer.end_time)}` : ""} because the desktop agent stopped
              running. Open AgencyPulseAgent, then press Resume to continue the same session.
            </p>
          ) : null}
          {successMessage ? (
            <p role="status" className="rounded-xl bg-[var(--accent-emerald-soft)] px-4 py-2.5 text-sm font-medium text-[var(--accent-emerald)]">
              {successMessage}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-xl border border-[var(--accent-coral)]/30 bg-[var(--accent-coral-soft)] px-4 py-2.5 text-sm text-[var(--danger)]">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-start gap-6">
            <div className="min-w-0 flex-[999_1_32.5rem]">
              <TimerFocusPanel
                isRunning={Boolean(activeTimer)}
                isPaused={!activeTimer && Boolean(pausedTimer)}
                displayTime={displayTime}
                caption={timerCaption}
                projectName={
                  activeProjectName ??
                  (selectedProjectId === GENERAL_TIME_VALUE
                    ? "General time"
                    : projects.find((p) => String(p.id) === selectedProjectId)?.name ?? "General time")
                }
                projectOptions={projectOptions}
                selectedProjectId={selectedProjectId}
                onProjectChange={setSelectedProjectId}
                onStart={() => void handleStart()}
                onPause={handlePause}
                onResume={handleResume}
                onStop={() => void handleStop()}
                actionLoading={actionLoading}
                startBlocked={agentMissing}
                projectsNotice={projectsNotice}
              />
            </div>
            <div className="min-w-0 flex-[1_1_18.75rem]">
              <TodayPanel
                entries={sortedEntries}
                liveElapsed={liveElapsed}
                totalSeconds={todaySeconds}
                exportControl={
                  <ExportDropdown
                    filename="time-tracking-today"
                    columns={TIME_TRACKING_EXPORT_COLUMNS}
                    rows={timeExportRows}
                    formats={["csv", "xlsx", "pdf"]}
                  />
                }
              />
            </div>
          </div>

          {isManager ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <Panel title="Manual time for yourself" description="Sent to an admin for approval.">
                <ManualTimeEntryForm
                  role="manager"
                  forSelf
                  onSubmitted={() => setManualRefreshKey((value) => value + 1)}
                />
              </Panel>
              <Panel title="Manual time for your team" description="Record entries for employees on teams you manage.">
                <ManualTimeEntryForm
                  role="manager"
                  onSubmitted={() => setManualRefreshKey((value) => value + 1)}
                />
              </Panel>
              <div className="xl:col-span-2">
                <ManualTimeEntries refreshKey={manualRefreshKey} employeeName={user.name} />
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
