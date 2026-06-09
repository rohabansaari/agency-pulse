"use client";

import {
  ApiError,
  approveOvertimeRequest,
  fetchPendingOvertimeRequests,
  formatApiErrors,
  rejectOvertimeRequest,
} from "@/lib/api";
import { formatDuration } from "@/lib/time";
import type { OvertimeRequest } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export function OvertimeApprovalQueue({ title = "My Overtime Approval Queue" }: { title?: string }) {
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
    return <div className="h-24 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />;
  }

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      {error ? <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {requests.length === 0 ? (
        <p className="text-sm text-zinc-500">No pending overtime requests.</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => (
            <li
              key={request.id}
              className="rounded-lg border border-zinc-100 px-3 py-3 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {request.user_name ?? `User #${request.user_id}`}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {request.work_date} · {request.project_name ?? "Project"} ·{" "}
                    {formatDuration(request.duration_seconds)}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{request.reason}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={actingId === request.id}
                    onClick={() => void handleApprove(request.id)}
                    className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={actingId === request.id}
                    onClick={() => void handleReject(request.id)}
                    className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
