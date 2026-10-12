"use client";

import { ScreenshotViewer } from "@/components/screenshots/ScreenshotViewer";
import {
  ReportDateRangeFilter,
  defaultReportDateRange,
  type ReportDateRange,
} from "@/components/reports/ReportDateRangeFilter";
import { Metric } from "@/components/ledger/Metric";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, EmptyState, Spinner } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import {
  ApiError,
  fetchScreenshotAgentStatus,
  fetchScreenshots,
  fetchTeam,
  formatApiErrors,
  type ScreenshotAgentStatus,
} from "@/lib/api";
import type { ScreenshotRecord, TeamMember, User } from "@/lib/types";
import { Camera, Clock, HardDrive, ImageIcon, Monitor } from "lucide-react";
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

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function hourLabel(hour: number): string {
  const d = new Date();
  d.setHours(hour % 24, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric" });
}

type HourGroup = {
  key: string;
  day: string;
  hour: number;
  items: { shot: ScreenshotRecord; index: number }[];
};

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

  // Presentation-only grouping of the loaded page: by calendar day, then by hour.
  const hourGroups = useMemo(() => {
    const groups: HourGroup[] = [];
    screenshots.forEach((shot, index) => {
      const hour = new Date(shot.captured_at).getHours();
      const key = `${dayKey(shot.captured_at)}-${hour}`;
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.items.push({ shot, index });
      } else {
        groups.push({ key, day: dayKey(shot.captured_at), hour, items: [{ shot, index }] });
      }
    });
    return groups;
  }, [screenshots]);

  const daySummary = useMemo(() => {
    if (screenshots.length === 0) return null;
    const days = new Set(screenshots.map((s) => dayKey(s.captured_at)));
    const counts = new Array<number>(24).fill(0);
    for (const s of screenshots) counts[new Date(s.captured_at).getHours()] += 1;
    const active = counts.flatMap((count, hour) => (count > 0 ? [hour] : []));
    let first = Math.min(...active);
    let last = Math.max(...active);
    // Show at least an 8-hour window so a short day still reads as a timeline.
    while (last - first < 7) {
      if (first > 0) first -= 1;
      if (last - first < 7 && last < 23) last += 1;
      if (first === 0 && last === 23) break;
    }
    const hours = [] as { hour: number; count: number }[];
    for (let h = first; h <= last; h += 1) hours.push({ hour: h, count: counts[h] });
    const peak = Math.max(...counts);
    return {
      singleDay: days.size === 1,
      dayCount: days.size,
      title: days.size === 1 ? formatDay(screenshots[0].captured_at) : "Capture activity",
      hours,
      peak,
    };
  }, [screenshots]);

  const employeeDropdownOptions = useMemo(
    () => [{ value: "", label: "All team members" }, ...memberOptions],
    [memberOptions],
  );

  const showUserNames = user.role !== "employee";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Activity gallery"
        title={user.role === "employee" ? "My Screenshots" : "Screenshots"}
        description={pageDescription}
        actions={
          agentStatus ? (
            <span
              className={cn(
                "inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-[13px] font-medium",
                agentStatus.connected
                  ? "bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]"
                  : "bg-[var(--accent-coral-soft)] text-[var(--accent-coral)]",
              )}
            >
              <Monitor className="h-4 w-4" aria-hidden="true" />
              Desktop Agent {agentStatus.connected ? "connected" : "offline"}
            </span>
          ) : null
        }
      />

      <section
        aria-label="Filters"
        className="flex flex-wrap items-end gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-5 py-4"
      >
        <div className="min-w-0">
          <p className="mb-1.5 text-xs text-[var(--muted)]">Date range</p>
          <ReportDateRangeFilter value={range} onChange={setRange} />
        </div>
        {canFilterUsers ? (
          <div className="min-w-[220px] flex-1 sm:max-w-xs">
            <p className="mb-1.5 text-xs text-[var(--muted)]">Team member</p>
            <Dropdown
              value={selectedUserId}
              onChange={setSelectedUserId}
              options={employeeDropdownOptions}
              placeholder="All team members"
              searchable
            />
          </div>
        ) : null}
      </section>

      <section aria-label="At a glance" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total captures" icon={<ImageIcon className="h-4 w-4" />} value={stats.total.toLocaleString()} detail="In the selected range" />
        <Metric label="Today" icon={<Camera className="h-4 w-4" />} value={stats.todayCount.toLocaleString()} detail="On this page" />
        <Metric label="Storage" icon={<HardDrive className="h-4 w-4" />} value={formatFileSize(stats.storageBytes)} detail="Screenshots on this page" />
        <Metric
          label="Last capture"
          icon={<Clock className="h-4 w-4" />}
          value={stats.lastCapture ? formatCapturedAt(stats.lastCapture) : "—"}
        />
      </section>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {loading ? (
        <Spinner label="Loading gallery…" />
      ) : screenshots.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="No screenshots yet"
          description={
            user.role === "employee"
              ? "Start your timer and install the Desktop Agent to begin capturing screenshots automatically every 5 minutes."
              : "Screenshots appear here when employees run the timer with the AgencyPulse Desktop Agent installed."
          }
          action={
            <ul className="flex flex-wrap justify-center gap-2 text-xs text-[var(--muted)]">
              <li className="rounded-full border border-[var(--border)] px-3 py-1.5">Timer must be running</li>
              <li className="rounded-full border border-[var(--border)] px-3 py-1.5">Agent connected</li>
              <li className="rounded-full border border-[var(--border)] px-3 py-1.5">5 min intervals</li>
            </ul>
          }
        />
      ) : (
        <>
          {daySummary ? (
            <section
              aria-labelledby="capture-summary-heading"
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-5 py-5 sm:px-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="capture-summary-heading" className="text-base font-semibold text-[var(--foreground)]">
                  {daySummary.title}
                </h2>
                <p className="tnum text-[13px] text-[var(--muted)]">
                  {screenshots.length} {screenshots.length === 1 ? "capture" : "captures"}
                  {daySummary.singleDay ? "" : ` across ${daySummary.dayCount} days`}
                  {lastPage > 1 ? ` · page ${page} of ${lastPage}` : ""} · {formatFileSize(stats.storageBytes)}
                </p>
              </div>
              <div
                role="img"
                aria-label={`Captures by hour: ${daySummary.hours
                  .filter((h) => h.count > 0)
                  .map((h) => `${hourLabel(h.hour)} ${h.count}`)
                  .join(", ")}`}
                className="mt-4 grid gap-1"
                style={{ gridTemplateColumns: `repeat(${daySummary.hours.length}, minmax(0, 1fr))` }}
              >
                {daySummary.hours.map(({ hour, count }, i) => (
                  <div key={hour} className="flex min-w-0 flex-col gap-1.5" title={`${hourLabel(hour)} · ${count} captures`}>
                    <div
                      className={cn("h-7 rounded-md", count === 0 ? "bg-[var(--border-subtle)]" : "bg-[var(--primary)]")}
                      style={count === 0 ? undefined : { opacity: 0.35 + (count / daySummary.peak) * 0.65 }}
                    />
                    <span
                      className={cn(
                        "tnum truncate text-[11px] text-[var(--muted)]",
                        // Thin out labels on narrow screens when the strip is long.
                        daySummary.hours.length > 10 && i % 2 === 1 && "max-sm:invisible",
                      )}
                    >
                      {hourLabel(hour)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {hourGroups.map((group) => (
            <section key={group.key} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-[var(--muted)]">
                {daySummary?.singleDay ? null : (
                  <span className="text-[var(--foreground)]">{formatDay(group.items[0].shot.captured_at)} · </span>
                )}
                <span className="tnum">
                  {hourLabel(group.hour)} – {hourLabel(group.hour + 1)}
                </span>
                <span className="tnum ml-2 font-normal">
                  {group.items.length} {group.items.length === 1 ? "capture" : "captures"}
                </span>
              </h2>
              <ul className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
                {group.items.map(({ shot, index }) => (
                  <li key={shot.id}>
                    <button
                      type="button"
                      onClick={() => setViewerIndex(index)}
                      aria-label={`Open screenshot from ${formatCapturedAt(shot.captured_at)}${showUserNames && shot.user_name ? ` by ${shot.user_name}` : ""}`}
                      className="group block w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] text-left transition hover:border-[var(--primary)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                    >
                      <span className="relative block aspect-[16/10] overflow-hidden bg-[var(--accent-sand)]">
                        {shot.image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={shot.image_url}
                            alt={`Screenshot captured ${formatCapturedAt(shot.captured_at)}`}
                            loading="lazy"
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-[var(--muted)]">
                            <ImageIcon className="h-8 w-8" aria-hidden="true" />
                            <span className="sr-only">Image unavailable</span>
                          </span>
                        )}
                      </span>
                      <span className="flex flex-col gap-0.5 px-3 py-2.5 text-[13px]">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="num font-semibold text-[var(--foreground)]">{formatTime(shot.captured_at)}</span>
                          <span className="tnum shrink-0 text-xs text-[var(--muted)]">{formatFileSize(shot.file_size_bytes)}</span>
                        </span>
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              "truncate",
                              shot.project_name ? "text-[var(--muted)]" : "text-[var(--muted-foreground)]",
                            )}
                          >
                            {shot.project_name ?? "No project linked"}
                          </span>
                          {showUserNames ? (
                            <span className="truncate text-xs text-[var(--muted)]">
                              {shot.user_name ?? `User #${shot.user_id}`}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {lastPage > 1 ? (
        <nav
          aria-label="Screenshot pages"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3"
        >
          <Button variant="secondary" size="lg" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span className="tnum text-sm text-[var(--muted)]">
            Page {page} of {lastPage}
          </span>
          <Button
            variant="secondary"
            size="lg"
            disabled={page >= lastPage}
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
          >
            Next
          </Button>
        </nav>
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
