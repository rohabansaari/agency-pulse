"use client";

import { Avatar } from "@/components/ledger/Avatar";
import { Alert } from "@/components/ui/EmptyState";
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
    <Modal title={`Report: ${project.name}`} description={project.client_name} onClose={onClose}>
      {loading ? (
        <div className="space-y-3 py-4" aria-busy="true" aria-label="Loading report">
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[70px] animate-pulse rounded-2xl bg-[var(--accent-sand)]" />
            ))}
          </div>
          <div className="h-24 animate-pulse rounded-2xl bg-[var(--accent-sand)]" />
        </div>
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : report ? (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-3">
            <ReportStat label="Total tracked" value={formatDuration(report.total_tracked_seconds)} />
            <ReportStat label="This week" value={formatDuration(report.hours_week_seconds)} />
            <ReportStat label="This month" value={formatDuration(report.hours_month_seconds)} />
            <ReportStat
              label="Utilization (MTD)"
              value={formatUtilization(report.utilization_percent)}
              progress={report.utilization_percent}
            />
          </dl>

          <ContributionList
            title="Team contributions"
            empty="No team contributions yet."
            rows={report.team_contributions.map((row) => ({
              key: row.team_id,
              name: row.team_name,
              seconds: row.total_seconds,
              avatar: false,
            }))}
          />

          <ContributionList
            title="Employee contributions"
            empty="No employee contributions yet."
            rows={report.employee_contributions.map((row) => ({
              key: row.user_id,
              name: row.name,
              seconds: Number(row.total_seconds),
              avatar: true,
            }))}
          />
        </div>
      ) : null}
    </Modal>
  );
}

function ReportStat({ label, value, progress }: { label: string; value: string; progress?: number }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
      <dt className="text-[13px] text-[var(--muted)]">{label}</dt>
      <dd className="num mt-1 truncate text-lg font-semibold text-[var(--foreground)]">{value}</dd>
      {progress !== undefined ? (
        <div className="mt-2 h-1.5 rounded-full bg-[var(--border-subtle)]" aria-hidden="true">
          <div
            className="h-1.5 rounded-full bg-[var(--primary)]"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function ContributionList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { key: number | string; name: string; seconds: number; avatar: boolean }[];
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.seconds), 0);
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-[13px] text-[var(--muted)]">
          {empty}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              {row.avatar ? <Avatar name={row.name} size="sm" /> : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[var(--foreground)]">{row.name}</p>
                <div className="mt-1.5 h-1 rounded-full bg-[var(--border-subtle)]" aria-hidden="true">
                  <div
                    className="h-1 rounded-full bg-[var(--primary)]"
                    style={{ width: `${max > 0 ? (row.seconds / max) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <span className="num shrink-0 text-[var(--foreground)]">{formatDuration(row.seconds)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
