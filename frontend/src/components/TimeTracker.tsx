"use client";

import {
  ApiError,
  fetchProjects,
  fetchTodayTime,
  formatApiErrors,
  startTimer,
  stopTimer,
} from "@/lib/api";
import { formatDuration, formatTime } from "@/lib/time";
import { ManualTimeEntries } from "@/components/time/ManualTimeEntries";
import { ManualTimeEntryForm } from "@/components/time/ManualTimeEntryForm";
import { OvertimeRequestForm } from "@/components/time/OvertimeRequestForm";
import { OvertimeRequestList } from "@/components/time/OvertimeRequestList";
import { Button } from "@/components/ui/Button";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { TimerFocusPanel } from "@/components/time/TimerFocusPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { TIME_TRACKING_EXPORT_COLUMNS } from "@/lib/export-columns";
import { wakeDesktopAgent } from "@/lib/desktop-agent";
import type { Project, TimeEntry, User } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

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

function SummaryCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "blue" | "green" | "zinc";
}) {
  const accentClass = {
    blue: "border-blue-100 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20",
    green: "border-green-100 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/20",
    zinc: "border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900",
  }[accent ?? "zinc"];

  return (
    <div
      className={`rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md ${accentClass}`}
    >
      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums sm:text-3xl dark:text-zinc-50">
        {value}
      </p>
      {sub ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>
      ) : null}
    </div>
  );
}

function ActivityTimeline({
  entries,
  liveElapsed,
}: {
  entries: TimeEntry[];
  liveElapsed: number;
}) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-zinc-400">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
        </div>
        <p className="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          No sessions yet today
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Start a timer to begin tracking your time
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute top-3 bottom-3 left-[19px] w-px bg-zinc-200 dark:bg-zinc-700" />
      {entries.map((entry, index) => {
        const isRunning = entry.status === "running";
        const duration = isRunning
          ? liveElapsed
          : (entry.duration ?? 0);
        const projectName = entry.project_name ?? "General time";

        return (
          <div
            key={entry.id}
            className="animate-fade-in relative flex gap-4 pb-6"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div
              className={`relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-white dark:bg-zinc-900 ${
                isRunning
                  ? "border-green-500 animate-pulse-ring"
                  : "border-zinc-200 dark:border-zinc-700"
              }`}
            >
              {isRunning ? (
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              )}
            </div>

            <div className="min-w-0 flex-1 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {projectName}
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                    {formatTime(entry.start_time)}
                    {entry.end_time
                      ? ` → ${formatTime(entry.end_time)}`
                      : " → now"}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                  <span className="font-mono text-lg font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
                    {formatDuration(duration)}
                  </span>
                  {isRunning ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/50 dark:text-green-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      Live
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      Completed
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
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
  const [totalDuration, setTotalDuration] = useState(0);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [projectsNotice, setProjectsNotice] = useState("");

  const loadToday = useCallback(async () => {
    setError("");

    try {
      const response = await fetchTodayTime();
      setEntries(response.data ?? []);
      setTotalDuration(response.meta.total_duration);
      setActiveTimer(response.meta.active_timer);
      setLiveElapsed(
        response.meta.active_timer
          ? elapsedSeconds(response.meta.active_timer.start_time)
          : 0,
      );

      if (response.meta.active_timer?.project_id) {
        setSelectedProjectId(String(response.meta.active_timer.project_id));
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

  useEffect(() => {
    if (!successMessage) return;
    const t = window.setTimeout(() => setSuccessMessage(""), 3000);
    return () => window.clearTimeout(t);
  }, [successMessage]);

  const activeProjectName = useMemo(() => {
    if (!activeTimer) return null;
    return (
      activeTimer.project_name ??
      projects.find((p) => p.id === activeTimer.project_id)?.name ??
      "General time"
    );
  }, [activeTimer, projects]);

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
      } else {
        setError("Unable to start timer.");
      }
    } finally {
      setActionLoading(false);
    }
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
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60"
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Time tracking unavailable
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Administrators manage the organization but do not track time. Use employee or manager
          accounts for timers, manual entries, and overtime requests.
        </p>
      </div>
    );
  }

  const displayTime = activeTimer
    ? formatDuration(liveElapsed)
    : formatDuration(totalDuration);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Time Tracking"
        description={
          isEmployee || isManager
            ? "Start your timer — screenshots capture automatically every 5 minutes."
            : "Track your work hours across projects"
        }
        actions={null}
      />

      {(isEmployee || isManager) ? (
        <div className="flex flex-wrap gap-2">
          {(["timer", ...(isEmployee ? (["manual"] as const) : []), "overtime"] as const).map((tabKey) => (
            <Button
              key={tabKey}
              type="button"
              size="sm"
              variant={tab === tabKey ? "primary" : "secondary"}
              onClick={() => setTab(tabKey as typeof tab)}
            >
              {tabKey === "timer" ? "Live timer" : tabKey === "manual" ? "Manual time" : "Overtime"}
            </Button>
          ))}
        </div>
      ) : null}

      {isEmployee && tab === "overtime" ? (
        <div className="space-y-8">
          <OvertimeRequestForm
            role="employee"
            onSubmitted={() => setOvertimeRefreshKey((value) => value + 1)}
          />
          <OvertimeRequestList key={overtimeRefreshKey} />
        </div>
      ) : null}

      {isManager && tab === "overtime" ? (
        <div className="space-y-8">
          <OvertimeRequestForm
            role="manager"
            onSubmitted={() => setOvertimeRefreshKey((value) => value + 1)}
          />
          <OvertimeRequestList key={overtimeRefreshKey} />
        </div>
      ) : null}

      {isEmployee && tab === "manual" ? (
        <div className="space-y-8">
          <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Submit manual time
            </h2>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              Requires team membership, a project, and manager approval.
            </p>
            <ManualTimeEntryForm
              role="employee"
              onSubmitted={() => setManualRefreshKey((value) => value + 1)}
            />
          </section>
          <ManualTimeEntries refreshKey={manualRefreshKey} employeeName={user.name} />
        </div>
      ) : null}

      {(isEmployee && (tab === "manual" || tab === "overtime")) || (isManager && tab === "overtime") ? null : (
        <>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Today's total"
          value={formatDuration(totalDuration)}
          sub="All completed sessions"
          accent="blue"
        />
        <SummaryCard
          label="Active session"
          value={activeTimer ? "Running" : "Idle"}
          sub={
            activeTimer
              ? `Started ${formatTime(activeTimer.start_time)}`
              : "No timer active"
          }
          accent={activeTimer ? "green" : "zinc"}
        />
        <SummaryCard
          label="Sessions today"
          value={String(entries.length)}
          sub={
            entries.length === 1 ? "1 time entry" : `${entries.length} time entries`
          }
        />
      </div>

      <TimerFocusPanel
        isRunning={Boolean(activeTimer)}
        displayTime={displayTime}
        liveSeconds={activeTimer ? liveElapsed : totalDuration}
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
        onStop={() => void handleStop()}
        actionLoading={actionLoading}
        projectsNotice={projectsNotice}
        screenshotActive={Boolean(activeTimer)}
      />

      {successMessage ? (
        <p className="text-center text-sm font-medium text-[var(--accent-emerald)]">{successMessage}</p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-[var(--accent-coral)]/30 bg-[var(--accent-coral-soft)] px-4 py-2.5 text-center text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {/* Activity timeline */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Today&apos;s activity
          </h2>
          <div className="flex items-center gap-2">
            <ExportDropdown
              filename="time-tracking-today"
              columns={TIME_TRACKING_EXPORT_COLUMNS}
              rows={timeExportRows}
              formats={["csv", "xlsx", "pdf"]}
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>
        <ActivityTimeline entries={sortedEntries} liveElapsed={liveElapsed} />
      </div>

      {isManager && tab !== "overtime" ? (
        <div className="space-y-8">
          <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Submit manual time for yourself
            </h2>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              Your entry will be sent to an admin for approval.
            </p>
            <ManualTimeEntryForm
              role="manager"
              forSelf
              onSubmitted={() => setManualRefreshKey((value) => value + 1)}
            />
          </section>
          <ManualTimeEntries refreshKey={manualRefreshKey} employeeName={user.name} />
          <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Record manual time for team
            </h2>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              Create manual entries on behalf of employees on your managed teams.
            </p>
            <ManualTimeEntryForm
              role="manager"
              onSubmitted={() => setManualRefreshKey((value) => value + 1)}
            />
          </section>
        </div>
      ) : null}
        </>
      )}
    </div>
  );
}
