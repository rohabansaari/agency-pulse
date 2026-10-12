"use client";

import {
  ApproveRejectButtons,
  PanelEmpty,
  PanelMessage,
  QueueSkeleton,
  RequestItem,
  RequestList,
  RequestPanel,
  StatusPill,
} from "@/components/leave/approvals";
import {
  ApiError,
  approveLeaveEntry,
  fetchPendingLeaveEntries,
  formatApiErrors,
  rejectLeaveEntry,
} from "@/lib/api";
import { displayLeaveDate } from "@/lib/dates";
import { formatDuration } from "@/lib/time";
import type { TimeEntry } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export function LeaveApprovalQueue({ onAction }: { onAction?: () => void }) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setEntries(await fetchPendingLeaveEntries());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load leave approval queue.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleApprove(id: number) {
    setActingId(id);
    try {
      await approveLeaveEntry(id);
      await load();
      onAction?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Approval failed.");
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(id: number) {
    setActingId(id);
    try {
      await rejectLeaveEntry(id);
      await load();
      onAction?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Rejection failed.");
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return <QueueSkeleton />;
  }

  return (
    <RequestPanel
      title="Leave approval queue"
      description="Team leave requests waiting for your decision"
      count={entries.length}
    >
      <PanelMessage error={error} />
      {entries.length === 0 ? (
        <PanelEmpty title="All caught up" description="No pending leave requests." />
      ) : (
        <RequestList>
          {entries.map((entry) => {
            const who = entry.user_name ?? "Employee";
            return (
              <RequestItem
                key={entry.id}
                kind="leave"
                who={who}
                status={<StatusPill status="pending" label="Pending" />}
                what={
                  <>
                    {displayLeaveDate(entry.start_time)} ·{" "}
                    <span className="num">{formatDuration(entry.duration ?? 0)}</span> paid leave
                  </>
                }
                note={entry.description || undefined}
                actions={
                  <ApproveRejectButtons
                    subject={`${who}'s leave on ${displayLeaveDate(entry.start_time)}`}
                    disabled={actingId === entry.id}
                    onApprove={() => void handleApprove(entry.id)}
                    onReject={() => void handleReject(entry.id)}
                  />
                }
              />
            );
          })}
        </RequestList>
      )}
    </RequestPanel>
  );
}
