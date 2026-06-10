"use client";

import type { LeaveStatusFilter } from "@/components/leave/LeaveStatusFilter";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import {
  ApiError,
  fetchLeaveEntries,
  formatApiErrors,
  updateLeaveEntry,
} from "@/lib/api";
import { displayLeaveDate } from "@/lib/dates";
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

export function LeaveHistory({
  showEmployee = false,
  statusFilter = "all",
  adminEditable = false,
  onUpdated,
}: {
  showEmployee?: boolean;
  statusFilter?: LeaveStatusFilter;
  adminEditable?: boolean;
  onUpdated?: () => void;
}) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setEntries(await fetchLeaveEntries());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load leave history.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredEntries = useMemo(() => {
    if (statusFilter === "all") {
      return entries;
    }

    return entries.filter((entry) => entry.status === statusFilter);
  }, [entries, statusFilter]);

  const exportRows = useMemo(
    () =>
      filteredEntries.map((entry) => ({
        employee: entry.user_name ?? "",
        date: displayLeaveDate(entry.start_time),
        duration: formatDuration(entry.duration ?? 0),
        status: entry.status,
        team: entry.team_name ?? "",
        source: entry.source ?? "",
      })),
    [filteredEntries],
  );

  async function handleStatusOverride(
    entry: TimeEntry,
    status: "pending" | "approved" | "rejected",
  ) {
    setSavingId(entry.id);
    setError("");
    try {
      await updateLeaveEntry(entry.id, { status });
      await load();
      onUpdated?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update leave entry.");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="h-24 animate-pulse rounded-lg bg-zinc-200/60 dark:bg-zinc-800/60" />
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ExportDropdown
          filename="leave-entries"
          columns={[
            ...(showEmployee ? [{ key: "employee", label: "Employee" }] : []),
            { key: "date", label: "Date" },
            { key: "duration", label: "Duration" },
            { key: "status", label: "Status" },
            { key: "team", label: "Team" },
            { key: "source", label: "Source" },
          ]}
          rows={exportRows}
        />
      </div>
      {error ? (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {filteredEntries.length === 0 ? (
        <p className="text-sm text-zinc-500">No leave entries match this filter.</p>
      ) : (
        <ul className="space-y-3">
          {filteredEntries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-3 rounded-lg border border-zinc-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800"
            >
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {showEmployee && entry.user_name ? `${entry.user_name} · ` : ""}
                  {displayLeaveDate(entry.start_time)}
                  {entry.source ? ` · ${entry.source}` : ""}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatDuration(entry.duration ?? 0)} paid leave
                  {entry.team_name ? ` · ${entry.team_name}` : ""}
                  {entry.description ? ` — ${entry.description}` : ""}
                </p>
                {entry.approved_by_name ? (
                  <p className="mt-1 text-xs text-zinc-400">
                    Reviewed by {entry.approved_by_name}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {adminEditable ? (
                  <select
                    value={entry.status}
                    disabled={savingId === entry.id}
                    onChange={(event) =>
                      void handleStatusOverride(
                        entry,
                        event.target.value as "pending" | "approved" | "rejected",
                      )
                    }
                    className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="pending">pending</option>
                    <option value="approved">approved</option>
                    <option value="rejected">rejected</option>
                  </select>
                ) : (
                  <StatusBadge status={entry.status} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
