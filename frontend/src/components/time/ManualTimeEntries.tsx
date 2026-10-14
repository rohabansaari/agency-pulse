"use client";

import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { MANUAL_TIME_EXPORT_COLUMNS } from "@/lib/export-columns";
import { ApiError, fetchManualTimeEntries, formatApiErrors } from "@/lib/api";
import { formatDuration } from "@/lib/time";
import type { TimeEntry, TimeEntryStatus } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_STYLES: Record<TimeEntryStatus, string> = {
  running: "bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]",
  stopped: "bg-[var(--accent-sand)] text-[var(--muted)]",
  pending: "bg-[var(--accent-copper-soft)] text-[var(--accent-copper)]",
  approved: "bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]",
  rejected: "bg-[var(--accent-coral-soft)] text-[var(--danger)]",
};

function StatusBadge({ status }: { status: TimeEntryStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[0.625rem] font-semibold uppercase ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function ManualTimeEntries({
  refreshKey = 0,
  employeeName = "—",
}: {
  refreshKey?: number;
  employeeName?: string;
}) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setEntries(await fetchManualTimeEntries());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load manual entries.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const exportRows = useMemo(
    () =>
      entries.map((entry) => ({
        employee_name: employeeName,
        project_name: entry.project_name ?? "General time",
        date: new Date(entry.start_time).toLocaleDateString(),
        hours_worked: formatDuration(entry.duration ?? 0),
        entry_type: "Manual",
        status: entry.status,
      })),
    [entries, employeeName],
  );

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            My manual entries
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Submitted entries appear here with approval status.
          </p>
        </div>
        <ExportDropdown
          filename="manual-time-entries"
          columns={MANUAL_TIME_EXPORT_COLUMNS}
          rows={exportRows}
          formats={["csv", "xlsx", "pdf"]}
        />
      </div>
      {loading ? (
        <div className="h-24 animate-pulse rounded-lg bg-[var(--accent-sand)]" />
      ) : null}
      {error ? (
        <p className="mb-3 text-sm text-[var(--danger)]">{error}</p>
      ) : null}
      {!loading && entries.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No manual entries on your record yet.</p>
      ) : null}
      {!loading && entries.length > 0 ? (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {new Date(entry.start_time).toLocaleDateString()} ·{" "}
                  {entry.project_name ?? "General time"}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {formatDuration(entry.duration ?? 0)}
                  {entry.manager_name ? ` · ${entry.manager_name}` : ""}
                  {entry.description ? ` — ${entry.description}` : ""}
                </p>
              </div>
              <StatusBadge status={entry.status} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
