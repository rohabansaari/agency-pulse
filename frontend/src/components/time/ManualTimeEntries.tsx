"use client";

import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { ApiError, fetchManualTimeEntries, formatApiErrors } from "@/lib/api";
import { formatDuration } from "@/lib/time";
import type { TimeEntry, TimeEntryStatus } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_STYLES: Record<TimeEntryStatus, string> = {
  running: "bg-green-100 text-green-700",
  stopped: "bg-zinc-100 text-zinc-600",
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

function StatusBadge({ status }: { status: TimeEntryStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function ManualTimeEntries({ refreshKey = 0 }: { refreshKey?: number }) {
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
        date: new Date(entry.start_time).toLocaleDateString(),
        project: entry.project_name ?? "General time",
        duration: formatDuration(entry.duration ?? 0),
        status: entry.status,
      })),
    [entries],
  );

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            My manual entries
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Submitted entries appear here with approval status.
          </p>
        </div>
        <ExportDropdown
          filename="manual-time-entries"
          columns={[
            { key: "date", label: "Date" },
            { key: "project", label: "Project" },
            { key: "duration", label: "Duration" },
            { key: "status", label: "Status" },
          ]}
          rows={exportRows}
          formats={["csv", "xlsx", "pdf"]}
        />
      </div>
      {loading ? (
        <div className="h-24 animate-pulse rounded-lg bg-zinc-200/60 dark:bg-zinc-800/60" />
      ) : null}
      {error ? (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {!loading && entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No manual entries on your record yet.</p>
      ) : null}
      {!loading && entries.length > 0 ? (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-2 rounded-lg border border-zinc-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800"
            >
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {new Date(entry.start_time).toLocaleDateString()} ·{" "}
                  {entry.project_name ?? "General time"}
                </p>
                <p className="text-xs text-zinc-500">
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
