"use client";

import { Dropdown } from "@/components/ui/Dropdown";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { Camera, Pause, Play, Square } from "lucide-react";

type TimerFocusPanelProps = {
  isRunning: boolean;
  isPaused?: boolean;
  displayTime: string;
  projectName: string;
  projectOptions: { value: string; label: string }[];
  selectedProjectId: string;
  onProjectChange: (value: string) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  actionLoading: boolean;
  startBlocked?: boolean;
  projectsNotice?: string;
  /** e.g. "Started 9:04 AM" / "Paused at 1:12 PM". */
  caption?: string;
};

/** Ledger live timer: large mono clock, project picker, start/pause/resume/stop. */
export function TimerFocusPanel({
  isRunning,
  isPaused = false,
  displayTime,
  projectName,
  projectOptions,
  selectedProjectId,
  onProjectChange,
  onStart,
  onPause,
  onResume,
  onStop,
  actionLoading,
  startBlocked = false,
  projectsNotice,
  caption,
}: TimerFocusPanelProps) {
  const idle = !isRunning && !isPaused;

  return (
    <section
      aria-labelledby="live-timer-title"
      className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="live-timer-title" className="text-lg font-semibold text-[var(--foreground)]">
          Live timer
        </h2>
        <StatusPill state={isRunning ? "running" : isPaused ? "paused" : "idle"} />
      </div>

      <p className="mt-5 text-[0.8125rem] text-[var(--muted)]">
        {idle ? "Ready when you are" : `${projectName}${caption ? ` · ${caption}` : ""}`}
      </p>
      <p
        className={cn(
          "num mt-1 text-[clamp(3rem,10vw,5.5rem)] font-semibold leading-none tracking-[-0.03em]",
          idle ? "text-[var(--muted)]" : "text-[var(--foreground)]",
        )}
        aria-live="off"
      >
        {displayTime}
      </p>

      {idle ? (
        <div className="mt-6">
          <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Project</label>
          <Dropdown
            value={selectedProjectId}
            onChange={onProjectChange}
            options={projectOptions}
            placeholder="General time"
            disabled={actionLoading}
          />
          {projectsNotice ? <p className="mt-2 text-xs text-[var(--accent-copper)]">{projectsNotice}</p> : null}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {isRunning ? (
          <>
            <Button variant="secondary" size="lg" onClick={onPause} disabled={actionLoading} className="min-w-[8.75rem]">
              <Pause className="h-4 w-4" aria-hidden="true" />
              Pause
            </Button>
            <Button variant="danger" size="lg" onClick={onStop} disabled={actionLoading} className="min-w-[8.75rem]">
              <Square className="h-4 w-4" aria-hidden="true" />
              Stop
            </Button>
          </>
        ) : isPaused ? (
          <>
            <Button size="lg" onClick={onResume} disabled={actionLoading || startBlocked} className="min-w-[8.75rem]">
              <Play className="h-4 w-4" aria-hidden="true" />
              Resume
            </Button>
            <Button variant="danger" size="lg" onClick={onStop} disabled={actionLoading} className="min-w-[8.75rem]">
              <Square className="h-4 w-4" aria-hidden="true" />
              Stop
            </Button>
          </>
        ) : (
          <Button size="lg" onClick={onStart} disabled={actionLoading || startBlocked} className="min-w-[11.25rem]">
            <Play className="h-4 w-4" aria-hidden="true" />
            {actionLoading ? "Starting…" : startBlocked ? "Start — agent required" : "Start timer"}
          </Button>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-5 text-[0.8125rem]">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5",
            isRunning
              ? "bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]"
              : "bg-[var(--accent-sand)] text-[var(--muted)]",
          )}
        >
          <Camera className="h-3.5 w-3.5" aria-hidden="true" />
          {isRunning
            ? "Capturing screenshots every 5 minutes"
            : isPaused
              ? "Screenshots paused"
              : "Screenshots every 5 minutes while tracking"}
        </span>
      </div>
    </section>
  );
}

function StatusPill({ state }: { state: "running" | "paused" | "idle" }) {
  if (state === "running") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-emerald-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent-emerald)]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-emerald)]" aria-hidden="true" />
        Tracking
      </span>
    );
  }
  if (state === "paused") {
    return (
      <span className="inline-flex rounded-full bg-[var(--accent-copper-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent-copper)]">
        Paused
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-[var(--accent-sand)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
      Idle
    </span>
  );
}
