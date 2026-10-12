"use client";

import {
  ApproveRejectButtons,
  PanelEmpty,
  PanelMessage,
  QueueSkeleton,
  RequestItem,
  RequestList,
  RequestPanel,
} from "@/components/leave/approvals";
import {
  ApiError,
  approveManualTimeEntry,
  fetchPendingManualEntries,
  formatApiErrors,
  rejectManualTimeEntry,
} from "@/lib/api";
import { formatDuration } from "@/lib/time";
import type { TimeEntry } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export function ManualApprovalQueue() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setEntries(await fetchPendingManualEntries());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load approval queue.",
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
      await approveManualTimeEntry(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Approval failed.");
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(id: number) {
    setActingId(id);
    try {
      await rejectManualTimeEntry(id);
      await load();
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
      title="My approval queue"
      description="Manual time entries waiting for review"
      count={entries.length}
    >
      <PanelMessage error={error} />
      {entries.length === 0 ? (
        <PanelEmpty title="All caught up" description="No pending manual time entries." />
      ) : (
        <RequestList>
          {entries.map((entry) => {
            const who = entry.user_name ?? "Employee";
            return (
              <RequestItem
                key={entry.id}
                kind="time"
                who={who}
                what={
                  <>
                    {new Date(entry.start_time).toLocaleDateString()} ·{" "}
                    <span className="num">{formatDuration(entry.duration ?? 0)}</span> ·{" "}
                    {entry.project_name ?? "General time"}
                  </>
                }
                note={entry.description || undefined}
                actions={
                  <ApproveRejectButtons
                    subject={`${who}'s manual time`}
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
