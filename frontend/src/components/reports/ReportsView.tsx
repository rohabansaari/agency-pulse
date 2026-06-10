"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import {
  ApiError,
  fetchManagerReport,
  fetchOrganizationReport,
  formatApiErrors,
} from "@/lib/api";
import { formatDuration, formatUtilization } from "@/lib/time";
import { LeaveBreakdownCard } from "@/components/reports/LeaveBreakdownCard";
import {
  defaultReportDateRange,
  ReportDateRangeFilter,
  type ReportDateRange,
} from "@/components/reports/ReportDateRangeFilter";
import type {
  EmployeeReportBreakdown,
  ManagerReport,
  ManagerTeamReport,
  OrganizationReport,
  User,
} from "@/lib/types";
import { useCallback, useEffect, useState, type ReactNode } from "react";

function OrgTeamUtilizationTable({
  rows,
}: {
  rows: OrganizationReport["team_utilization"];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">No team data available yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
          <tr>
            <th className="px-3 py-2 font-medium">Team</th>
            <th className="px-3 py-2 font-medium">Hours</th>
            <th className="px-3 py-2 font-medium">Utilization</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.team_id} className="border-b border-zinc-50 dark:border-zinc-800/80">
              <td className="px-3 py-2.5 font-medium">{row.team_name}</td>
              <td className="px-3 py-2.5 font-mono tabular-nums">
                {formatDuration(row.tracked_seconds)}
              </td>
              <td className="px-3 py-2.5 font-mono tabular-nums">
                {formatUtilization(row.utilization_percent)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ManagerTeamReportCard({ team }: { team: ManagerTeamReport }) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{team.team_name}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Today {formatDuration(team.hours_today_seconds)} · Range{" "}
            {formatDuration(team.hours_in_range_seconds ?? team.hours_week_seconds)}
          </p>
        </div>
        <span className="text-sm font-mono tabular-nums">
          {formatUtilization(team.range_utilization_percent ?? team.utilization_percent)}
        </span>
      </div>
      {team.leave_breakdown ? (
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <LeaveBreakdownCard title="Leave today" breakdown={team.leave_breakdown.today} />
          <LeaveBreakdownCard title="Leave this week" breakdown={team.leave_breakdown.week} />
          {team.leave_breakdown.range ? (
            <LeaveBreakdownCard title="Leave in range" breakdown={team.leave_breakdown.range} />
          ) : null}
        </div>
      ) : null}
      {team.member_breakdown.length === 0 ? (
        <p className="text-sm text-zinc-500">No team members yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-2 py-2 font-medium">Member</th>
                <th className="px-2 py-2 font-medium">Today</th>
                <th className="px-2 py-2 font-medium">Range</th>
                <th className="px-2 py-2 font-medium">Timer</th>
              </tr>
            </thead>
            <tbody>
              {team.member_breakdown.map((member) => (
                <tr key={member.user_id} className="border-b border-zinc-50 dark:border-zinc-800/80">
                  <td className="px-2 py-2 font-medium">{member.name}</td>
                  <td className="px-2 py-2 font-mono tabular-nums">
                    {formatDuration(member.hours_today_seconds)}
                  </td>
                  <td className="px-2 py-2 font-mono tabular-nums">
                    {formatDuration(member.hours_in_range_seconds ?? member.hours_week_seconds)}
                  </td>
                  <td className="px-2 py-2">
                    {member.has_active_timer ? (
                      <span className="text-xs font-medium text-green-600 dark:text-green-400">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrgEmployeeBreakdownTable({ rows }: { rows: EmployeeReportBreakdown[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">No employee data available yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
          <tr>
            <th className="px-3 py-2 font-medium">Employee</th>
            <th className="px-3 py-2 font-medium">Team</th>
            <th className="px-3 py-2 font-medium">Hours</th>
            <th className="px-3 py-2 font-medium">Utilization</th>
            <th className="px-3 py-2 font-medium">Timer</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.user_id} className="border-b border-zinc-50 dark:border-zinc-800/80">
              <td className="px-3 py-2.5 font-medium">{row.name}</td>
              <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                {row.team_name ?? "Unassigned"}
              </td>
              <td className="px-3 py-2.5 font-mono tabular-nums">
                {formatDuration(row.hours_in_range_seconds)}
              </td>
              <td className="px-3 py-2.5 font-mono tabular-nums">
                {formatUtilization(row.utilization_percent)}
              </td>
              <td className="px-3 py-2.5">
                {row.has_active_timer ? (
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    Active
                  </span>
                ) : (
                  <span className="text-xs text-zinc-400">—</span>
                )}
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Organization reports
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Organization-wide time tracking and utilization for {rangeLabel}
          </p>
        </div>
        {filter ? <div className="shrink-0">{filter}</div> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Hours in range"
          value={formatDuration(report.hours_in_range_seconds ?? report.hours_week_seconds)}
          accent="blue"
        />
        <StatCard label="Hours today" value={formatDuration(report.hours_today_seconds)} />
        <StatCard label="Hours this month" value={formatDuration(report.hours_month_seconds)} />
        <StatCard label="Active timers" value={String(report.active_timers)} accent="green" />
        <StatCard label="Active employees" value={String(report.active_employees)} />
        <StatCard label="Active projects" value={String(report.active_projects)} />
        <StatCard
          label="Range utilization"
          value={formatUtilization(
            report.range_utilization_percent ?? report.organization_utilization_percent,
          )}
          sub="Tracked hours vs expected capacity in range"
          accent="amber"
        />
        <StatCard
          label="Approved overtime"
          value={formatDuration(report.overtime_summary?.approved_seconds ?? 0)}
        />
        <StatCard
          label="Pending overtime"
          value={String(report.overtime_summary?.pending_count ?? 0)}
          sub={formatDuration(report.overtime_summary?.pending_seconds ?? 0)}
          accent="amber"
        />
        {report.overtime_settings?.enabled ? (
          <StatCard
            label="Overtime rate"
            value={`${report.overtime_settings.rate_percentage ?? "—"}%`}
            sub="Applied to effective hourly rate"
          />
        ) : null}
      </div>

      {report.employee_overtime_breakdown && report.employee_overtime_breakdown.length > 0 ? (
        <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Overtime breakdown
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="px-3 py-2 font-medium">Employee</th>
                  <th className="px-3 py-2 font-medium">Approved</th>
                  <th className="px-3 py-2 font-medium">Pending</th>
                </tr>
              </thead>
              <tbody>
                {report.employee_overtime_breakdown.map((row) => (
                  <tr key={row.user_id} className="border-b border-zinc-50 dark:border-zinc-800/80">
                    <td className="px-3 py-2.5 font-medium">{row.name}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums">
                      {formatDuration(row.approved_seconds)}
                    </td>
                    <td className="px-3 py-2.5 font-mono tabular-nums">
                      {formatDuration(row.pending_seconds ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {report.leave_breakdown ? (
        <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Leave summary
          </h2>
          <div className="grid gap-3 lg:grid-cols-3">
            <LeaveBreakdownCard title="Today" breakdown={report.leave_breakdown.today} />
            <LeaveBreakdownCard title="This week" breakdown={report.leave_breakdown.week} />
            {report.leave_breakdown.range ? (
              <LeaveBreakdownCard title="Selected range" breakdown={report.leave_breakdown.range} />
            ) : report.leave_breakdown.month ? (
              <LeaveBreakdownCard title="This month" breakdown={report.leave_breakdown.month} />
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Employee breakdown
        </h2>
        <OrgEmployeeBreakdownTable rows={report.employee_breakdown ?? []} />
      </section>

      <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Team utilization (selected range)
        </h2>
        <OrgTeamUtilizationTable rows={report.team_utilization} />
      </section>
    </div>
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Team reports
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            All team members including you — unified time breakdown
          </p>
        </div>
        {filter ? <div className="shrink-0">{filter}</div> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My teams" value={String(report.team_count)} accent="blue" />
        <StatCard label="Team hours today" value={formatDuration(totalToday)} />
        <StatCard label="Team hours in range" value={formatDuration(totalInRange)} />
        <StatCard
          label="Team utilization"
          value={formatUtilization(avgUtil)}
          sub="Average across managed teams in selected range"
          accent="amber"
        />
        <StatCard
          label="Active projects"
          value={String(report.teams.reduce((sum, t) => sum + t.active_projects, 0))}
        />
        <StatCard
          label="Team overtime"
          value={formatDuration(report.overtime_summary?.approved_seconds ?? 0)}
        />
        <StatCard
          label="Pending overtime"
          value={String(report.overtime_summary?.pending_count ?? 0)}
        />
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Managed teams</h2>
        {report.teams.length === 0 ? (
          <p className="text-sm text-zinc-500">No teams assigned yet.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {report.teams.map((team) => (
              <ManagerTeamReportCard key={team.team_id} team={team} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

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
      <div className="space-y-4">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-zinc-200/60 dark:bg-zinc-800/60" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
        {error}
      </p>
    );
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
