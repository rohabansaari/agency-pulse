"use client";

import { Dropdown } from "@/components/ui/Dropdown";
import { Button } from "@/components/ui/Button";
import { formatPKR } from "@/lib/currency";
import { cn } from "@/lib/cn";
import { motion } from "framer-motion";
import { Camera, Play, Square } from "lucide-react";

type TimerFocusPanelProps = {
  isRunning: boolean;
  displayTime: string;
  liveSeconds: number;
  projectName: string;
  projectOptions: { value: string; label: string }[];
  selectedProjectId: string;
  onProjectChange: (value: string) => void;
  onStart: () => void;
  onStop: () => void;
  actionLoading: boolean;
  projectsNotice?: string;
  screenshotActive?: boolean;
  hourlyRate?: number | null;
};

const RING_RADIUS = 88;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

export function TimerFocusPanel({
  isRunning,
  displayTime,
  liveSeconds,
  projectName,
  projectOptions,
  selectedProjectId,
  onProjectChange,
  onStart,
  onStop,
  actionLoading,
  projectsNotice,
  screenshotActive = false,
  hourlyRate,
}: TimerFocusPanelProps) {
  const sessionHours = liveSeconds / 3600;
  const earnings =
    hourlyRate && hourlyRate > 0 ? formatPKR(sessionHours * hourlyRate) : "—";
  const ringProgress = isRunning ? ((liveSeconds % 3600) / 3600) * RING_CIRC : 0;

  return (
    <div className="ui-card-elevated mx-auto max-w-3xl p-6 sm:p-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_280px] lg:items-center">
        <div className="flex flex-col items-center">
          <div className="relative flex h-[220px] w-[220px] items-center justify-center">
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 200 200">
              <circle
                cx="100"
                cy="100"
                r={RING_RADIUS}
                fill="none"
                stroke="var(--border)"
                strokeWidth="8"
              />
              <motion.circle
                cx="100"
                cy="100"
                r={RING_RADIUS}
                fill="none"
                stroke={isRunning ? "var(--accent-emerald)" : "var(--muted-foreground)"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={RING_CIRC}
                animate={{
                  strokeDashoffset: isRunning ? RING_CIRC - ringProgress : RING_CIRC * 0.75,
                  opacity: isRunning ? 1 : 0.35,
                }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </svg>
            <div className="relative text-center">
              <p
                className={cn(
                  "text-numeric text-4xl font-bold tracking-tight sm:text-5xl",
                  isRunning ? "text-[var(--foreground)]" : "text-[var(--muted)]",
                )}
              >
                {displayTime}
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                {isRunning ? "Session active" : "Ready"}
              </p>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            {isRunning ? (
              <Button
                variant="danger"
                size="lg"
                onClick={onStop}
                disabled={actionLoading}
                className="min-w-[160px]"
              >
                <Square className="h-4 w-4" />
                {actionLoading ? "Stopping…" : "Stop"}
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={onStart}
                disabled={actionLoading}
                className="min-w-[160px] bg-[var(--accent-emerald)] hover:opacity-90"
              >
                <Play className="h-4 w-4" />
                {actionLoading ? "Starting…" : "Start"}
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-label">Project context</p>
            {!isRunning ? (
              <div className="mt-2">
                <Dropdown
                  value={selectedProjectId}
                  onChange={onProjectChange}
                  options={projectOptions}
                  placeholder="General time"
                  disabled={actionLoading}
                  size="sm"
                />
                {projectsNotice ? (
                  <p className="mt-2 text-xs text-[var(--warning)]">{projectsNotice}</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{projectName}</p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-label">Session earnings</p>
            <p className="text-numeric mt-2 text-2xl font-bold text-[var(--foreground)]">
              {earnings}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">Live estimate from tracked time</p>
          </div>

          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4 transition-colors",
              screenshotActive || isRunning
                ? "border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald-soft)]"
                : "border-[var(--border)] bg-[var(--card)]",
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                isRunning
                  ? "bg-[var(--accent-emerald)]/15 text-[var(--accent-emerald)]"
                  : "bg-[var(--sidebar-hover)] text-[var(--muted)]",
              )}
            >
              <Camera className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Screenshots</p>
              <p className="text-xs text-[var(--muted)]">
                {isRunning ? "Capturing every 5 minutes" : "Start timer to enable capture"}
              </p>
            </div>
            {isRunning ? (
              <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-[var(--accent-emerald)]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-emerald)]" />
                Active
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
