"use client";

import { ScreenshotViewer } from "@/components/screenshots/ScreenshotViewer";
import {
  ReportDateRangeFilter,
  defaultReportDateRange,
  type ReportDateRange,
} from "@/components/reports/ReportDateRangeFilter";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/EmptyState";
import {
  ApiError,
  fetchScreenshotAgentStatus,
  fetchScreenshots,
  fetchTeam,
  formatApiErrors,
  type ScreenshotAgentStatus,
} from "@/lib/api";
import type { ScreenshotRecord, TeamMember, User } from "@/lib/types";
import { motion } from "framer-motion";
import {
  Camera,
  Clock,
  HardDrive,
  ImageIcon,
  Monitor,
  User as UserIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

function formatCapturedAt(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

export function ScreenshotsView({ user }: { user: User }) {
  const [range, setRange] = useState<ReportDateRange>(defaultReportDateRange);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [screenshots, setScreenshots] = useState<ScreenshotRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [agentStatus, setAgentStatus] = useState<ScreenshotAgentStatus | null>(null);

  const canFilterUsers = user.role === "admin" || user.role === "sub_admin" || user.role === "manager";

  const pageDescription =
    user.role === "employee"
      ? "A visual timeline of your desktop while the timer was running — captured automatically every 5 minutes."
      : user.role === "manager"
        ? "Review desktop activity from your team members in a clean, browsable gallery."
        : "Organization-wide screenshot gallery from the AgencyPulse Desktop Agent.";

  useEffect(() => {
    if (!canFilterUsers) return;
    void fetchTeam()
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [canFilterUsers]);

  useEffect(() => {
    void fetchScreenshotAgentStatus()
      .then(setAgentStatus)
      .catch(() => setAgentStatus(null));
  }, []);

  const loadScreenshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchScreenshots({
        range,
        page,
        per_page: 24,
        ...(selectedUserId ? { user_id: Number(selectedUserId) } : {}),
      });
      setScreenshots(response.data);
      setTotalCount(response.meta.total);
      setLastPage(response.meta.last_page);
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Unable to load screenshots.");
      setScreenshots([]);
    } finally {
      setLoading(false);
    }
  }, [page, range, selectedUserId]);

  useEffect(() => {
    void loadScreenshots();
  }, [loadScreenshots]);

  useEffect(() => {
    setPage(1);
  }, [range, selectedUserId]);

  const memberOptions = useMemo(
    () =>
      members
        .filter((m) => m.role === "employee" || m.role === "manager")
        .map((m) => ({ value: String(m.user_id), label: m.name, description: m.email })),
    [members],
  );

  const stats = useMemo(() => {
    const todayCount = screenshots.filter((s) => isToday(s.captured_at)).length;
    const storageBytes = screenshots.reduce((sum, s) => sum + (s.file_size_bytes ?? 0), 0);
    const lastCapture = screenshots[0]?.captured_at ?? agentStatus?.last_upload_at ?? null;
    return { todayCount, storageBytes, lastCapture, total: totalCount };
  }, [screenshots, totalCount, agentStatus]);

  const employeeDropdownOptions = useMemo(
    () => [{ value: "", label: "All team members" }, ...memberOptions],
    [memberOptions],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Activity gallery"
        title={user.role === "employee" ? "My Screenshots" : "Screenshots"}
        description={pageDescription}
      />

      <div className="ui-kpi-grid">
        {[
          { label: "Total captures", value: stats.total.toLocaleString(), icon: ImageIcon, accent: "var(--primary)" },
          { label: "Today", value: stats.todayCount.toLocaleString(), icon: Camera, accent: "var(--accent-emerald)" },
          { label: "Storage (page)", value: formatFileSize(stats.storageBytes), icon: HardDrive, accent: "var(--accent-coral)" },
          {
            label: "Last capture",
            value: stats.lastCapture ? formatCapturedAt(stats.lastCapture) : "—",
            icon: Clock,
            accent: "var(--primary)",
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="ui-stat-card"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-label">{stat.label}</p>
                <p className="text-heading mt-2 text-2xl text-[var(--foreground)]">{stat.value}</p>
              </div>
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `color-mix(in srgb, ${stat.accent} 12%, transparent)` }}
              >
                <stat.icon className="h-5 w-5" style={{ color: stat.accent }} />
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="ui-filter-bar">
        <div className="flex flex-1 flex-wrap items-end gap-4">
          <div>
            <p className="text-label mb-2">Date range</p>
            <ReportDateRangeFilter value={range} onChange={setRange} />
          </div>
          {canFilterUsers ? (
            <div className="min-w-[220px] flex-1 sm:max-w-xs">
              <p className="text-label mb-2">Team member</p>
              <Dropdown
                value={selectedUserId}
                onChange={setSelectedUserId}
                options={employeeDropdownOptions}
                placeholder="All team members"
                searchable
              />
            </div>
          ) : null}
        </div>
        {agentStatus ? (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--accent-sand)] px-3 py-2 text-xs">
            <Monitor className="h-4 w-4 text-[var(--accent-emerald)]" />
            <span className="text-[var(--muted)]">
              Agent {agentStatus.connected ? (
                <span className="font-semibold text-[var(--accent-emerald)]">connected</span>
              ) : (
                <span className="font-semibold text-[var(--accent-coral)]">offline</span>
              )}
            </span>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-[var(--accent-coral)]/30 bg-[var(--accent-coral-soft)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <Spinner label="Loading gallery…" />
      ) : screenshots.length === 0 ? (
        <div className="ui-card-elevated flex flex-col items-center px-8 py-16 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--primary-muted)]">
            <Camera className="h-10 w-10 text-[var(--primary)]" />
          </div>
          <h3 className="text-heading mt-6 text-xl">No screenshots yet</h3>
          <p className="mt-2 max-w-md text-sm text-[var(--muted)]">
            {user.role === "employee"
              ? "Start your timer and install the Desktop Agent to begin capturing screenshots automatically every 5 minutes."
              : "Screenshots appear here when employees run the timer with the AgencyPulse Desktop Agent installed."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-xs text-[var(--muted)]">
            <span className="rounded-full border border-[var(--border)] px-3 py-1.5">Timer must be running</span>
            <span className="rounded-full border border-[var(--border)] px-3 py-1.5">Agent connected</span>
            <span className="rounded-full border border-[var(--border)] px-3 py-1.5">5 min intervals</span>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {screenshots.map((shot, index) => (
            <motion.article
              key={shot.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.3) }}
              className="group ui-card-elevated overflow-hidden p-0 transition-shadow hover:shadow-lg"
            >
              <button
                type="button"
                onClick={() => setViewerIndex(index)}
                className="relative block w-full overflow-hidden"
              >
                {shot.image_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={shot.image_url}
                    alt=""
                    className="aspect-[16/10] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex aspect-[16/10] items-center justify-center bg-[var(--accent-sand)]">
                    <ImageIcon className="h-8 w-8 text-[var(--muted)]" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--foreground)]/0 transition group-hover:bg-[var(--foreground)]/25">
                  <span className="scale-90 rounded-xl bg-[var(--card-elevated)] px-4 py-2 text-sm font-semibold opacity-0 shadow-lg transition group-hover:scale-100 group-hover:opacity-100">
                    View full size
                  </span>
                </div>
              </button>
              <div className="space-y-2 p-4">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-3.5 w-3.5 text-[var(--muted)]" />
                  <p className="text-heading truncate text-sm">{shot.user_name ?? `User #${shot.user_id}`}</p>
                </div>
                <p className="text-xs text-[var(--muted)]">{formatCapturedAt(shot.captured_at)}</p>
                {shot.project_name ? (
                  <p className="truncate text-xs font-medium text-[var(--primary)]">{shot.project_name}</p>
                ) : (
                  <p className="text-xs text-[var(--muted-foreground)]">No project linked</p>
                )}
                <p className="text-[10px] text-[var(--muted-foreground)]">{formatFileSize(shot.file_size_bytes)}</p>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      {lastPage > 1 ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-4 py-3">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span className="text-sm text-[var(--muted)]">
            Page {page} of {lastPage}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
          >
            Next
          </Button>
        </div>
      ) : null}

      {viewerIndex !== null ? (
        <ScreenshotViewer
          shots={screenshots}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onNavigate={setViewerIndex}
        />
      ) : null}
    </div>
  );
}
