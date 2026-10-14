"use client";

import { Avatar } from "@/components/ledger/Avatar";
import { Metric } from "@/components/ledger/Metric";
import { Panel } from "@/components/ledger/Panel";
import { ledgerTable } from "@/components/ledger/table";
import { LeaveBreakdownCard } from "@/components/reports/LeaveBreakdownCard";
import {
  defaultReportDateRange,
  ReportDateRangeFilter,
  type ReportDateRange,
} from "@/components/reports/ReportDateRangeFilter";
import { Alert } from "@/components/ui/EmptyState";
import {
  ApiError,
  fetchManagerReport,
  fetchOrganizationReport,
  formatApiErrors,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDuration, formatUtilization } from "@/lib/time";
import type {
  EmployeeReportBreakdown,
  ManagerReport,
  ManagerTeamReport,
  OrganizationReport,
  User,
} from "@/lib/types";
import { Activity, Clock, Gauge, Hourglass, Users } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

/** "112h 40m" — compact label used in chart summaries. */
function hoursLabel(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-emerald-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent-emerald)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-emerald)]" aria-hidden="true" />
      Tracking
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-[var(--accent-sand)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
      Idle
    </span>
  );
}

function UtilizationBar({ percent }: { percent: number }) {
  return (
    <div className="flex min-w-[8.75rem] items-center gap-3">
      <div className="h-1.5 flex-1 rounded-full bg-[var(--border-subtle)]" aria-hidden="true">
        <div
          className={cn(
            "h-1.5 rounded-full",
            percent < 60 ? "bg-[var(--accent-copper)]" : "bg-[var(--primary)]",
          )}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
      <span className="tnum w-14 text-right text-[0.8125rem] text-[var(--muted)]">
        {formatUtilization(percent)}
      </span>
    </div>
  );
}

/** Secondary figures shown in a single divided strip under the KPI tiles. */
function StatStrip({ label, items }: { label: string; items: { label: string; value: ReactNode; detail?: ReactNode }[] }) {
  return (
    <section
      aria-label={label}
      className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border-subtle)] sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]"
    >
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1 bg-[var(--card)] px-5 py-4">
          <span className="text-[0.8125rem] text-[var(--muted)]">{item.label}</span>
          <span className="tnum text-xl font-semibold text-[var(--foreground)]">{item.value}</span>
          {item.detail ? <span className="text-xs text-[var(--muted)]">{item.detail}</span> : null}
        </div>
      ))}
    </section>
  );
}

/** Horizontal bar chart of tracked hours; single plum series. */
function HoursBarChart({
  items,
  summaryLabel,
}: {
  items: { id: number; label: string; seconds: number; note?: string }[];
  summaryLabel: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.seconds));
  const summary = `${summaryLabel}: ${items
    .map((item) => `${item.label} ${hoursLabel(item.seconds)}${item.note ? ` (${item.note})` : ""}`)
    .join(", ")}.`;

  return (
    <div role="img" aria-label={summary} className="flex flex-col gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="grid grid-cols-[minmax(5.5rem,30%)_1fr_auto] items-center gap-3 text-sm"
        >
          <span className="truncate text-[var(--foreground)]">{item.label}</span>
          <div className="h-3 rounded-md bg-[var(--accent-sand)]">
            <div
              className="h-3 rounded-md bg-[var(--primary)]"
              style={{ width: `${(item.seconds / max) * 100}%` }}
            />
          </div>
          <span className="tnum w-[4.5rem] text-right text-[0.8125rem] text-[var(--muted)]">
            {hoursLabel(item.seconds)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReportsHeader({
  title,
  description,
  filter,
}: {
  title: string;
  description: string;
  filter?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[0.8125rem] text-[var(--muted)]">Insights</p>
        <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--foreground)]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--muted)]">{description}</p>
      </div>
      {filter ? <div className="min-w-0 max-w-full">{filter}</div> : null}
    </header>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="px-5 pb-6 text-sm text-[var(--muted)]">{children}</p>;
}

/* ------------------------------------------------------------------ */
/* Admin / sub-admin                                                   */
/* ------------------------------------------------------------------ */

function OrgTeamUtilizationTable({
  rows,
}: {
  rows: OrganizationReport["team_utilization"];
}) {
  if (rows.length === 0) {
    return <EmptyLine>No team data available yet.</EmptyLine>;
  }

  return (
    <div className={ledgerTable.wrap}>
      <table className={cn(ledgerTable.table, "min-w-[32.5rem]")}>
        <thead className={ledgerTable.thead}>
          <tr>
            <th scope="col" className={ledgerTable.th}>Team</th>
            <th scope="col" className={cn(ledgerTable.th, "text-right")}>Hours</th>
            <th scope="col" className={ledgerTable.th}>Utilization</th>
          </tr>
        </thead>
        <tbody className={ledgerTable.tbody}>
          {rows.map((row) => (
            <tr key={row.team_id} className={ledgerTable.rowHover}>
              <td className={cn(ledgerTable.td, "font-medium text-[var(--foreground)]")}>{row.team_name}</td>
              <td className={cn(ledgerTable.td, "num text-right")}>{formatDuration(row.tracked_seconds)}</td>
              <td className={ledgerTable.td}>
                <UtilizationBar percent={row.utilization_percent} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrgEmployeeBreakdownTable({ rows }: { rows: EmployeeReportBreakdown[] }) {
  if (rows.length === 0) {
    return <EmptyLine>No employee data available yet.</EmptyLine>;
  }

  return (
    <div className={ledgerTable.wrap}>
      <table className={cn(ledgerTable.table, "min-w-[42.5rem]")}>
        <thead className={ledgerTable.thead}>
          <tr>
            <th scope="col" className={ledgerTable.th}>Employee</th>
            <th scope="col" className={ledgerTable.th}>Timer</th>
            <th scope="col" className={cn(ledgerTable.th, "text-right")}>Hours</th>
            <th scope="col" className={ledgerTable.th}>Utilization</th>
          </tr>
        </thead>
        <tbody className={ledgerTable.tbody}>
          {rows.map((row) => (
            <tr key={row.user_id} className={ledgerTable.rowHover}>
              <td className={ledgerTable.td}>
                <div className="flex items-center gap-3">
                  <Avatar name={row.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[var(--foreground)]">{row.name}</span>
                    <span className="block truncate text-xs text-[var(--muted)]">
                      {row.team_name ?? "Unassigned"}
                    </span>
                  </span>
                </div>
              </td>
              <td className={ledgerTable.td}>
                <StatusPill active={row.has_active_timer} />
              </td>
              <td className={cn(ledgerTable.td, "num text-right")}>{formatDuration(row.hours_in_range_seconds)}</td>
              <td className={ledgerTable.td}>
                <UtilizationBar percent={row.utilization_percent} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminReports({
  report,
  filter,
}: {
  report: OrganizationReport;
  filter?: ReactNode;
}) {
  const rangeLabel = report.date_range
    ? `${report.date_range.start_date} – ${report.date_range.end_date}`
    : "selected period";
  const utilization = report.range_utilization_percent ?? report.organization_utilization_percent;
  const pendingOvertime = report.overtime_summary?.pending_count ?? 0;
  const trackingShare =
    report.active_employees > 0 ? (report.active_timers / report.active_employees) * 100 : 0;

  const strip: { label: string; value: ReactNode; detail?: ReactNode }[] = [
    { label: "Hours today", value: <span className="num">{formatDuration(report.hours_today_seconds)}</span> },
    { label: "Hours this month", value: <span className="num">{formatDuration(report.hours_month_seconds)}</span> },
    { label: "Active projects", value: report.active_projects },
    {
      label: "Approved overtime",
      value: <span className="num">{formatDuration(report.overtime_summary?.approved_seconds ?? 0)}</span>,
    },
  ];
  if (report.overtime_settings?.enabled) {
    strip.push({
      label: "Overtime rate",
      value: `${report.overtime_settings.rate_percentage ?? "—"}%`,
      detail: "Applied to effective hourly rate",
    });
  }

  const teamChart = report.team_utilization.map((team) => ({
    id: team.team_id,
    label: team.team_name,
    seconds: team.tracked_seconds,
    note: `${formatUtilization(team.utilization_percent)} utilization`,
  }));

  const hasOvertimeRows =
    !!report.employee_overtime_breakdown && report.employee_overtime_breakdown.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <ReportsHeader
        title="Organization reports"
        description={`Organization-wide time tracking and utilization for ${rangeLabel}`}
        filter={filter}
      />

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Hours in range"
          icon={<Clock className="h-4 w-4" />}
          value={<span className="num">{formatDuration(report.hours_in_range_seconds ?? report.hours_week_seconds)}</span>}
          detail={rangeLabel}
        />
        <Metric
          label="Range utilization"
          icon={<Gauge className="h-4 w-4" />}
          value={formatUtilization(utilization)}
          progress={utilization}
          detail="Tracked hours vs expected capacity in range"
        />
        <Metric
          label="Active timers"
          icon={<Activity className="h-4 w-4" />}
          value={
            <>
              {report.active_timers}
              <span className="text-lg text-[var(--muted)]"> / {report.active_employees}</span>
            </>
          }
          progress={trackingShare}
          detail={`${report.active_employees} active employees`}
        />
        <Metric
          label="Pending overtime"
          icon={<Hourglass className="h-4 w-4" />}
          value={pendingOvertime}
          tone={pendingOvertime > 0 ? "attention" : "default"}
          detail={<span className="num">{formatDuration(report.overtime_summary?.pending_seconds ?? 0)} requested</span>}
        />
      </section>

      <StatStrip label="More figures" items={strip} />

      <Panel title="Team utilization" description="Hours tracked per team in the selected range" flush>
        {teamChart.length > 0 ? (
          <div className="px-5 pb-5">
            <HoursBarChart items={teamChart} summaryLabel="Hours tracked by team" />
          </div>
        ) : null}
        <OrgTeamUtilizationTable rows={report.team_utilization} />
      </Panel>

      <Panel title="Employee breakdown" description="Hours and utilization per person" flush>
        <OrgEmployeeBreakdownTable rows={report.employee_breakdown ?? []} />
      </Panel>

      {hasOvertimeRows || report.leave_breakdown ? (
        <div className="flex flex-wrap items-start gap-6">
          {hasOvertimeRows ? (
            <Panel title="Overtime breakdown" className="min-w-0 flex-[1_1_26.25rem]" flush>
              <div className={ledgerTable.wrap}>
                <table className={cn(ledgerTable.table, "min-w-[26.25rem]")}>
                  <thead className={ledgerTable.thead}>
                    <tr>
                      <th scope="col" className={ledgerTable.th}>Employee</th>
                      <th scope="col" className={cn(ledgerTable.th, "text-right")}>Approved</th>
                      <th scope="col" className={cn(ledgerTable.th, "text-right")}>Pending</th>
                    </tr>
                  </thead>
                  <tbody className={ledgerTable.tbody}>
                    {report.employee_overtime_breakdown!.map((row) => (
                      <tr key={row.user_id} className={ledgerTable.rowHover}>
                        <td className={cn(ledgerTable.td, "font-medium text-[var(--foreground)]")}>{row.name}</td>
                        <td className={cn(ledgerTable.td, "num text-right")}>{formatDuration(row.approved_seconds)}</td>
                        <td className={cn(ledgerTable.td, "num text-right")}>{formatDuration(row.pending_seconds ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}

          {report.leave_breakdown ? (
            <Panel title="Leave summary" className="min-w-0 flex-[1_1_26.25rem]">
              <div className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(12.5rem,1fr))]">
                <LeaveBreakdownCard title="Today" breakdown={report.leave_breakdown.today} />
                <LeaveBreakdownCard title="This week" breakdown={report.leave_breakdown.week} />
                {report.leave_breakdown.range ? (
                  <LeaveBreakdownCard title="Selected range" breakdown={report.leave_breakdown.range} />
                ) : report.leave_breakdown.month ? (
                  <LeaveBreakdownCard title="This month" breakdown={report.leave_breakdown.month} />
                ) : null}
              </div>
            </Panel>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Manager                                                             */
/* ------------------------------------------------------------------ */

function ManagerTeamReportCard({ team }: { team: ManagerTeamReport }) {
  return (
    <Panel
      title={team.team_name}
      description={
        <span className="num">
          Today {formatDuration(team.hours_today_seconds)} · Range{" "}
          {formatDuration(team.hours_in_range_seconds ?? team.hours_week_seconds)}
        </span>
      }
      action={
        <span className="inline-flex items-center rounded-full bg-[var(--primary-muted)] px-2.5 py-1 text-xs font-medium text-[var(--primary)]">
          <span className="tnum">
            {formatUtilization(team.range_utilization_percent ?? team.utilization_percent)}
          </span>
          &nbsp;utilized
        </span>
      }
      flush
    >
      {team.leave_breakdown ? (
        <div className="grid gap-2 px-5 pb-4 sm:grid-cols-2">
          <LeaveBreakdownCard title="Leave today" breakdown={team.leave_breakdown.today} />
          <LeaveBreakdownCard title="Leave this week" breakdown={team.leave_breakdown.week} />
          {team.leave_breakdown.range ? (
            <LeaveBreakdownCard title="Leave in range" breakdown={team.leave_breakdown.range} />
          ) : null}
        </div>
      ) : null}
      {team.member_breakdown.length === 0 ? (
        <EmptyLine>No team members yet.</EmptyLine>
      ) : (
        <div className={ledgerTable.wrap}>
          <table className={cn(ledgerTable.table, "min-w-[28.75rem]")}>
            <thead className={ledgerTable.thead}>
              <tr>
                <th scope="col" className={ledgerTable.th}>Member</th>
                <th scope="col" className={cn(ledgerTable.th, "text-right")}>Today</th>
                <th scope="col" className={cn(ledgerTable.th, "text-right")}>Range</th>
                <th scope="col" className={ledgerTable.th}>Timer</th>
              </tr>
            </thead>
            <tbody className={ledgerTable.tbody}>
              {team.member_breakdown.map((member) => (
                <tr key={member.user_id} className={ledgerTable.rowHover}>
                  <td className={ledgerTable.td}>
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} size="sm" />
                      <span className="truncate font-medium text-[var(--foreground)]">{member.name}</span>
                    </div>
                  </td>
                  <td className={cn(ledgerTable.td, "num text-right")}>{formatDuration(member.hours_today_seconds)}</td>
                  <td className={cn(ledgerTable.td, "num text-right")}>
                    {formatDuration(member.hours_in_range_seconds ?? member.hours_week_seconds)}
                  </td>
                  <td className={ledgerTable.td}>
                    <StatusPill active={member.has_active_timer} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function ManagerReports({
  report,
  filter,
}: {
  report: ManagerReport;
  filter?: ReactNode;
}) {
  const totalToday = report.teams.reduce((sum, team) => sum + team.hours_today_seconds, 0);
  const totalInRange = report.teams.reduce(
    (sum, team) => sum + (team.hours_in_range_seconds ?? team.hours_week_seconds),
    0,
  );
  const avgUtil =
    report.teams.length > 0
      ? report.teams.reduce(
          (sum, t) => sum + (t.range_utilization_percent ?? t.utilization_percent),
          0,
        ) / report.teams.length
      : 0;
  const pendingOvertime = report.overtime_summary?.pending_count ?? 0;

  const teamChart = report.teams.map((team) => ({
    id: team.team_id,
    label: team.team_name,
    seconds: team.hours_in_range_seconds ?? team.hours_week_seconds,
    note: `${formatUtilization(team.range_utilization_percent ?? team.utilization_percent)} utilization`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <ReportsHeader
        title="Team reports"
        description="All team members including you — unified time breakdown"
        filter={filter}
      />

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="My teams" icon={<Users className="h-4 w-4" />} value={report.team_count} />
        <Metric
          label="Team hours in range"
          icon={<Clock className="h-4 w-4" />}
          value={<span className="num">{formatDuration(totalInRange)}</span>}
        />
        <Metric
          label="Team utilization"
          icon={<Gauge className="h-4 w-4" />}
          value={formatUtilization(avgUtil)}
          progress={avgUtil}
          detail="Average across managed teams in selected range"
        />
        <Metric
          label="Pending overtime"
          icon={<Hourglass className="h-4 w-4" />}
          value={pendingOvertime}
          tone={pendingOvertime > 0 ? "attention" : "default"}
        />
      </section>

      <StatStrip
        label="More figures"
        items={[
          { label: "Team hours today", value: <span className="num">{formatDuration(totalToday)}</span> },
          { label: "Active projects", value: report.teams.reduce((sum, t) => sum + t.active_projects, 0) },
          {
            label: "Team overtime",
            value: <span className="num">{formatDuration(report.overtime_summary?.approved_seconds ?? 0)}</span>,
          },
        ]}
      />

      {teamChart.length > 0 ? (
        <Panel title="Hours by team" description="Tracked in the selected range">
          <HoursBarChart items={teamChart} summaryLabel="Hours tracked by managed team" />
        </Panel>
      ) : null}

      <section aria-labelledby="managed-teams-heading" className="flex flex-col gap-4">
        <h2 id="managed-teams-heading" className="text-base font-semibold text-[var(--foreground)]">
          Managed teams
        </h2>
        {report.teams.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--border)] px-5 py-8 text-center text-sm text-[var(--muted)]">
            No teams assigned yet.
          </p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {report.teams.map((team) => (
              <ManagerTeamReportCard key={team.team_id} team={team} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Entry                                                               */
/* ------------------------------------------------------------------ */

export function ReportsView({ user }: { user: User }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState<ReportDateRange>(defaultReportDateRange);
  const [orgReport, setOrgReport] = useState<OrganizationReport | null>(null);
  const [managerReport, setManagerReport] = useState<ManagerReport | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (user.role === "admin" || user.role === "sub_admin") {
        setOrgReport(await fetchOrganizationReport(dateRange));
      } else if (user.role === "manager") {
        setManagerReport(await fetchManagerReport(dateRange));
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load reports.",
      );
    } finally {
      setLoading(false);
    }
  }, [dateRange, user.role]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <span className="sr-only" role="status">Loading reports…</span>
        <div className="h-10 w-56 animate-pulse rounded-xl bg-[var(--accent-sand)]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--card)]"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--card)]" />
      </div>
    );
  }

  if (error) {
    return <Alert variant="error">{error}</Alert>;
  }

  const dateFilter = (
    <ReportDateRangeFilter value={dateRange} onChange={setDateRange} disabled={loading} />
  );

  if ((user.role === "admin" || user.role === "sub_admin") && orgReport) {
    return <AdminReports report={orgReport} filter={dateFilter} />;
  }

  if (user.role === "manager" && managerReport) {
    return <ManagerReports report={managerReport} filter={dateFilter} />;
  }

  return null;
}
