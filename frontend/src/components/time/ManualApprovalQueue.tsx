"use client";

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
    return (
      <div className="h-32 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        My Approval Queue
      </h2>
      {error ? (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No pending manual time entries.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-lg border border-zinc-100 px-3 py-3 dark:border-zinc-800"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {entry.user_name ?? "Employee"}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {new Date(entry.start_time).toLocaleDateString()} ·{" "}
                    {formatDuration(entry.duration ?? 0)} ·{" "}
                    {entry.project_name ?? "General time"}
                  </p>
                  {entry.description ? (
                    <p className="mt-1 text-xs text-zinc-500">{entry.description}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={actingId === entry.id}
                    onClick={() => handleApprove(entry.id)}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={actingId === entry.id}
                    onClick={() => handleReject(entry.id)}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-zinc-700"
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
