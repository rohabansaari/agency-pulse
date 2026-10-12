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
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { OVERTIME_EXPORT_COLUMNS } from "@/lib/export-columns";
import {
  ApiError,
  approveOvertimeRequest,
  fetchPendingOvertimeRequests,
  formatApiErrors,
  rejectOvertimeRequest,
} from "@/lib/api";
import { formatDuration } from "@/lib/time";
import type { OvertimeRequest, OvertimeRequestStatus } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_LABELS: Record<OvertimeRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export function OvertimeApprovalQueue({ title = "Overtime approval queue" }: { title?: string }) {
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setRequests(await fetchPendingOvertimeRequests());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load overtime queue.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const exportRows = useMemo(
    () =>
      requests.map((request) => ({
        employee_name: request.user_name ?? "—",
        date: request.work_date,
        project_name: request.project_name ?? "",
        duration: formatDuration(request.duration_seconds),
        status: request.status,
      })),
    [requests],
  );

  async function handleApprove(id: number) {
    setActingId(id);
    try {
      await approveOvertimeRequest(id);
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
      await rejectOvertimeRequest(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Rejection failed.");
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return <QueueSkeleton className="h-24" />;
  }

  return (
    <RequestPanel
      title={title}
      description={`${requests.length} pending request${requests.length === 1 ? "" : "s"}`}
      action={
        <ExportDropdown
          filename="overtime-approval-queue"
          columns={OVERTIME_EXPORT_COLUMNS}
          rows={exportRows}
        />
      }
    >
      <PanelMessage error={error} />
      {requests.length === 0 ? (
        <PanelEmpty title="All caught up" description="No pending overtime requests." />
      ) : (
        <RequestList>
          {requests.map((request) => {
            const who = request.user_name ?? `User #${request.user_id}`;
            return (
              <RequestItem
                key={request.id}
                kind="overtime"
                who={who}
                status={<StatusPill status={request.status} label={STATUS_LABELS[request.status]} />}
                what={
                  <>
                    <span className="tnum">{request.work_date}</span> · {request.project_name ?? "Project"} ·{" "}
                    <span className="num">{formatDuration(request.duration_seconds)}</span>
                  </>
                }
                note={request.reason || undefined}
                actions={
                  <ApproveRejectButtons
                    subject={`${who}'s overtime on ${request.work_date}`}
                    disabled={actingId === request.id}
                    onApprove={() => void handleApprove(request.id)}
                    onReject={() => void handleReject(request.id)}
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
