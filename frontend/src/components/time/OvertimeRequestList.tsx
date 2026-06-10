"use client";

import { ExportDropdown } from "@/components/ui/ExportDropdown";
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
        date: request.work_date,
        project: request.project_name ?? "",
        duration: formatDuration(request.duration_seconds),
        status: request.status,
      })),
    [requests],
  );

  if (loading) {
    return <div className="h-20 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />;
  }

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">My overtime requests</h2>
        <ExportDropdown
          filename="overtime-requests"
          columns={[
            { key: "date", label: "Date" },
            { key: "project", label: "Project" },
            { key: "duration", label: "Duration" },
            { key: "status", label: "Status" },
          ]}
          rows={exportRows}
        />
      </div>
      {error ? <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {requests.length === 0 ? (
        <p className="text-sm text-zinc-500">No overtime requests yet.</p>
      ) : (
        <ul className="space-y-2">
          {requests.map((request) => (
            <li
              key={request.id}
              className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {request.work_date} · {formatDuration(request.duration_seconds)}
                </p>
                <p className="text-xs text-zinc-500">{request.project_name ?? "Project"}</p>
              </div>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs capitalize dark:bg-zinc-800">
                {request.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
