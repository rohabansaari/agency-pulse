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
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { TIME_TRACKING_EXPORT_COLUMNS } from "@/lib/export-columns";
import {
  AGENT_DOWNLOAD_FILENAME,
  getAgentDownloadUrl,
} from "@/lib/desktop-agent-config";
import { wakeDesktopAgent } from "@/lib/desktop-agent";
import { useDesktopAgentStatus } from "@/hooks/useDesktopAgentStatus";
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
  const requiresAgent = isEmployee || isManager;
  const { connected: agentConnected, checking: agentChecking, refresh: refreshAgentStatus } =
    useDesktopAgentStatus(requiresAgent);
  const canStartTimer = !requiresAgent || agentConnected;

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

    if (requiresAgent && !agentConnected) {
      setError(
        `Install and connect ${AGENT_DOWNLOAD_FILENAME} before starting your timer. Download it from the banner above, run --install, sign in, then click Check connection.`,
      );
      setActionLoading(false);
      return;
    }

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
      setSuccessMessage("Timer started — desktop agent capturing screenshots");
      wakeDesktopAgent();
    } catch (err) {
      if (err instanceof ApiError) {
        const apiMessage = formatApiErrors(err.errors) || err.message;
        if (err.status === 403 && apiMessage.toLowerCase().includes("desktop agent")) {
          void refreshAgentStatus();
        }
        setError(apiMessage);
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Time Tracking
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {isEmployee
            ? "Start your timer — the desktop agent starts capturing automatically."
            : isManager
              ? "Start your timer — the desktop agent starts capturing automatically."
              : "Track your work hours across projects"}
        </p>
        {(isEmployee || isManager) ? (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setTab("timer")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                tab === "timer"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              Live timer
            </button>
            {isEmployee ? (
              <button
                type="button"
                onClick={() => setTab("manual")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  tab === "manual"
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                Manual time
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setTab("overtime")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                tab === "overtime"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              Overtime
            </button>
          </div>
        ) : null}
      </div>

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

      {/* Timer centerpiece */}
      <div
        className={`rounded-2xl border bg-white p-8 shadow-sm transition-all duration-300 sm:p-10 dark:bg-zinc-900 ${
          activeTimer
            ? "border-green-200/80 shadow-green-100/50 dark:border-green-900/50 dark:shadow-green-950/20"
            : "border-zinc-200/80 dark:border-zinc-800"
        }`}
      >
        <div className="mx-auto max-w-lg text-center">
          {/* Status indicator */}
          <div className="mb-6 flex items-center justify-center gap-2">
            {activeTimer ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                </span>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  Timer running
                </span>
              </>
            ) : (
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Ready to track
              </span>
            )}
          </div>

          {/* Digital timer */}
          <p
            className={`font-mono text-6xl font-bold tracking-tight tabular-nums transition-colors duration-300 sm:text-7xl ${
              activeTimer
                ? "text-zinc-900 dark:text-zinc-50"
                : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            {displayTime}
          </p>

          {/* Project name */}
          <p className="mt-3 text-base font-medium text-zinc-700 dark:text-zinc-300">
            {activeTimer
              ? activeProjectName
              : selectedProjectId === GENERAL_TIME_VALUE
                ? "General time"
                : projects.find((p) => String(p.id) === selectedProjectId)?.name ??
                  "General time"}
          </p>

          {/* Project selector */}
          {!activeTimer ? (
            <div className="mt-6">
              <select
                id="project-select"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                disabled={actionLoading}
                className="mx-auto w-full max-w-sm rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value={GENERAL_TIME_VALUE}>General time</option>
                {projects.map((project) => (
                  <option key={project.id} value={String(project.id)}>
                    {projectLabel(project)}
                  </option>
                ))}
              </select>
              {projectsNotice ? (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  {projectsNotice}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* CTA */}
          <div className="mt-8">
            {activeTimer ? (
              <button
                type="button"
                onClick={handleStop}
                disabled={actionLoading}
                className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-red-600 px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Stopping...
                  </>
                ) : (
                  "Stop Timer"
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                disabled={actionLoading || agentChecking || !canStartTimer}
                className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-green-600 px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-green-700 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Starting...
                  </>
                ) : agentChecking ? (
                  "Checking agent..."
                ) : (
                  "Start Timer"
                )}
              </button>
            )}
          </div>

          {requiresAgent && !activeTimer && !agentChecking && !agentConnected ? (
            <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">
              Download{" "}
              <a
                href={getAgentDownloadUrl()}
                download={AGENT_DOWNLOAD_FILENAME}
                className="font-medium underline hover:no-underline"
              >
                {AGENT_DOWNLOAD_FILENAME}
              </a>
              , run <span className="font-mono text-xs">--install</span>, sign in, then click{" "}
              <span className="font-medium">Check connection</span> in the banner above.
            </p>
          ) : null}

          {/* Feedback */}
          {successMessage ? (
            <p className="animate-fade-in mt-4 text-sm font-medium text-green-600 dark:text-green-400">
              {successMessage}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </p>
          ) : null}
        </div>
      </div>

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
