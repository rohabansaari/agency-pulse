"use client";

import {
  ApiError,
  fetchScreenshots,
  fetchTeam,
  formatApiErrors,
} from "@/lib/api";
import {
  defaultReportDateRange,
  ReportDateRangeFilter,
  type ReportDateRange,
} from "@/components/reports/ReportDateRangeFilter";
import type { ScreenshotRecord, TeamMember, User } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

function formatCapturedAt(value: string): string {
  return new Date(value).toLocaleString();
}

export function ScreenshotsView({ user }: { user: User }) {
  const [range, setRange] = useState<ReportDateRange>(defaultReportDateRange);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [screenshots, setScreenshots] = useState<ScreenshotRecord[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canFilterUsers = user.role === "admin" || user.role === "sub_admin" || user.role === "manager";

  useEffect(() => {
    if (!canFilterUsers) {
      return;
    }

    void fetchTeam()
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [canFilterUsers]);

  const loadScreenshots = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchScreenshots({
        range,
        page,
        per_page: 24,
        ...(selectedUserId ? { user_id: Number(selectedUserId) } : {}),
      });

      setScreenshots(response.data);
      setLastPage(response.meta.last_page);
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Unable to load screenshots.");
      setScreenshots([]);
    } finally {
      setLoading(false);
    }
  }, [page, range, selectedUserId]);

  useEffect(() => {
    void loadScreenshots();
  }, [loadScreenshots]);

  useEffect(() => {
    setPage(1);
  }, [range, selectedUserId]);

  const memberOptions = useMemo(
    () => members.filter((member) => member.role === "employee" || member.role === "manager"),
    [members],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Screenshots</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Review browser activity captures uploaded by the Chrome extension.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <ReportDateRangeFilter value={range} onChange={setRange} />

        {canFilterUsers ? (
          <label className="flex min-w-[220px] flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Employee</span>
            <select
              value={selectedUserId}
              onChange={(event) =>
                setSelectedUserId(event.target.value ? Number(event.target.value) : "")
              }
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">All visible employees</option>
              {memberOptions.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading screenshots…</p>
      ) : screenshots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
          No screenshots found for this range.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {screenshots.map((shot) => (
            <article
              key={shot.id}
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              {shot.image_url ? (
                <a href={shot.image_url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shot.image_url}
                    alt={`Screenshot by ${shot.user_name ?? "employee"}`}
                    className="aspect-video w-full object-cover"
                  />
                </a>
              ) : (
                <div className="flex aspect-video items-center justify-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-800">
                  Image unavailable
                </div>
              )}
              <div className="space-y-1 p-4 text-sm">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {shot.user_name ?? `User #${shot.user_id}`}
                </p>
                <p className="text-zinc-500">{formatCapturedAt(shot.captured_at)}</p>
                {shot.project_name ? (
                  <p className="text-zinc-500">Project: {shot.project_name}</p>
                ) : null}
                <p className="text-xs text-zinc-400">Session {shot.session_id.slice(0, 8)}…</p>
              </div>
            </article>
          ))}
        </div>
      )}

      {lastPage > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
          >
            Previous
          </button>
          <span className="text-sm text-zinc-500">
            Page {page} of {lastPage}
          </span>
          <button
            type="button"
            disabled={page >= lastPage}
            onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
