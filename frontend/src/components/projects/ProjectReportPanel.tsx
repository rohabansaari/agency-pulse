"use client";

import { Modal } from "@/components/ui/Modal";
import { ApiError, fetchProjectReport, formatApiErrors } from "@/lib/api";
import { formatDuration, formatUtilization } from "@/lib/time";
import type { Project, ProjectReport } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export function ProjectReportPanel({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState<ProjectReport | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await fetchProjectReport(project.id));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load project report.",
      );
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Modal title={`Report: ${project.name}`} onClose={onClose}>
      {loading ? (
        <div className="space-y-3 py-4">
          <div className="h-6 w-40 animate-pulse rounded bg-zinc-200/60 dark:bg-zinc-800/60" />
          <div className="h-24 animate-pulse rounded-lg bg-zinc-200/60 dark:bg-zinc-800/60" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : report ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
              <p className="text-xs text-zinc-500">Total tracked</p>
              <p className="font-mono text-lg font-semibold tabular-nums">
                {formatDuration(report.total_tracked_seconds)}
              </p>
            </div>
            <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
              <p className="text-xs text-zinc-500">This week</p>
              <p className="font-mono text-lg font-semibold tabular-nums">
                {formatDuration(report.hours_week_seconds)}
              </p>
            </div>
            <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
              <p className="text-xs text-zinc-500">This month</p>
              <p className="font-mono text-lg font-semibold tabular-nums">
                {formatDuration(report.hours_month_seconds)}
              </p>
            </div>
            <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
              <p className="text-xs text-zinc-500">Utilization (MTD)</p>
              <p className="font-mono text-lg font-semibold tabular-nums">
                {formatUtilization(report.utilization_percent)}
              </p>
            </div>
          </div>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Team contributions
            </h3>
            {report.team_contributions.length === 0 ? (
              <p className="text-xs text-zinc-500">No team contributions yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {report.team_contributions.map((row) => (
                  <li
                    key={row.team_id}
                    className="flex justify-between rounded-lg border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800"
                  >
                    <span>{row.team_name}</span>
                    <span className="font-mono tabular-nums">
                      {formatDuration(row.total_seconds)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Employee contributions
            </h3>
            {report.employee_contributions.length === 0 ? (
              <p className="text-xs text-zinc-500">No employee contributions yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {report.employee_contributions.map((row) => (
                  <li
                    key={row.user_id}
                    className="flex justify-between rounded-lg border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800"
                  >
                    <span>{row.name}</span>
                    <span className="font-mono tabular-nums">
                      {formatDuration(Number(row.total_seconds))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </Modal>
  );
}
