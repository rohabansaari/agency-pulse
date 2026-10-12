"use client";

import { OvertimeStatusBadge } from "@/components/time/OvertimeStatusBadge";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { OVERTIME_EXPORT_COLUMNS } from "@/lib/export-columns";
import {
  ApiError,
  fetchOvertimeRequests,
  formatApiErrors,
} from "@/lib/api";
import { formatDuration } from "@/lib/time";
import type { OvertimeRequest } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

export function OvertimeRequestList() {
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setRequests(await fetchOvertimeRequests());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load overtime requests.",
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

  if (loading) {
    return <div className="ui-card h-24 animate-pulse bg-[var(--accent-sand)]" />;
  }

  return (
    <section className="ui-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">My overtime requests</h2>
          <p className="text-xs text-[var(--muted)]">Track pending, approved, and rejected requests</p>
        </div>
        <ExportDropdown
          filename="overtime-requests"
          columns={OVERTIME_EXPORT_COLUMNS}
          rows={exportRows}
        />
      </div>
      {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}
      {requests.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No overtime requests yet.</p>
      ) : (
        <ul className="space-y-2">
          {requests.map((request) => (
            <li
              key={request.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-[var(--foreground)]">
                  {request.work_date} · {formatDuration(request.duration_seconds)}
                </p>
                <p className="text-xs text-[var(--muted)]">{request.project_name ?? "Project"}</p>
                {request.reason ? (
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{request.reason}</p>
                ) : null}
              </div>
              <OvertimeStatusBadge status={request.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
