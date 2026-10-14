"use client";

import type { LeaveStatusFilter } from "@/components/leave/LeaveStatusFilter";
import { RequestItem, RequestList, StatusPill } from "@/components/leave/approvals";
import { Alert, EmptyState } from "@/components/ui/EmptyState";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { Select } from "@/components/ui/Input";
import { LEAVE_EXPORT_COLUMNS } from "@/lib/export-columns";
import {
  ApiError,
  fetchLeaveEntries,
  formatApiErrors,
  updateLeaveEntry,
} from "@/lib/api";
import { displayLeaveDate } from "@/lib/dates";
import { formatDuration } from "@/lib/time";
import type { TimeEntry, TimeEntryStatus } from "@/lib/types";
import { CalendarDays } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_LABELS: Record<TimeEntryStatus, string> = {
  running: "Running",
  stopped: "Stopped",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

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
        employee_name: entry.user_name ?? "",
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
      <div className="px-5 pb-5">
        <div className="h-24 animate-pulse rounded-xl bg-[var(--accent-sand)]" role="status" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="@container">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3">
        <p className="text-[0.8125rem] text-[var(--muted)]">
          <span className="tnum">{filteredEntries.length}</span>{" "}
          {filteredEntries.length === 1 ? "entry" : "entries"}
        </p>
        <ExportDropdown
          filename="leave-entries"
          columns={LEAVE_EXPORT_COLUMNS}
          rows={exportRows}
        />
      </div>
      {error ? (
        <div className="px-5 pb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      ) : null}
      {filteredEntries.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState icon={CalendarDays} title="No leave entries" description="No leave entries match this filter." className="py-8" />
        </div>
      ) : (
        <RequestList>
          {filteredEntries.map((entry) => {
            const selectId = `leave-status-${entry.id}`;
            return (
              <RequestItem
                key={entry.id}
                kind="leave"
                who={
                  <>
                    {showEmployee && entry.user_name ? `${entry.user_name} · ` : ""}
                    {displayLeaveDate(entry.start_time)}
                    {entry.source ? <span className="font-normal text-[var(--muted)]"> · {entry.source}</span> : null}
                  </>
                }
                status={adminEditable ? null : <StatusPill status={entry.status} label={STATUS_LABELS[entry.status]} />}
                what={
                  <>
                    <span className="num">{formatDuration(entry.duration ?? 0)}</span> paid leave
                    {entry.team_name ? ` · ${entry.team_name}` : ""}
                    {entry.description ? ` — ${entry.description}` : ""}
                  </>
                }
                meta={entry.approved_by_name ? `Reviewed by ${entry.approved_by_name}` : undefined}
                actions={
                  adminEditable ? (
                    <div className="w-full @lg:w-40">
                      <label htmlFor={selectId} className="sr-only">
                        Status for {entry.user_name ?? "leave"} on {displayLeaveDate(entry.start_time)}
                      </label>
                      <Select
                        id={selectId}
                        value={entry.status}
                        disabled={savingId === entry.id}
                        onChange={(event) =>
                          void handleStatusOverride(
                            entry,
                            event.target.value as "pending" | "approved" | "rejected",
                          )
                        }
                        className="w-full"
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </Select>
                    </div>
                  ) : undefined
                }
              />
            );
          })}
        </RequestList>
      )}
    </div>
  );
}
