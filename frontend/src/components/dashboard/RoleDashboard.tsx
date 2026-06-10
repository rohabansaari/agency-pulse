"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { formatDuration, formatTime, formatUtilization } from "@/lib/time";
import type {
  AdminDashboard,
  DashboardData,
  EmployeeDashboard,
  ManagerDashboard,
  ManagerTeamReport,
  WorkTeam,
} from "@/lib/types";
import { ManualApprovalQueue } from "@/components/time/ManualApprovalQueue";
import { OvertimeApprovalQueue } from "@/components/time/OvertimeApprovalQueue";
import Link from "next/link";
import type { ReactNode } from "react";

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white py-12 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</p>
      <p className="mt-1 max-w-sm text-center text-xs text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
    </div>
  );
}

function AdminTeamCard({ team }: { team: WorkTeam }) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{team.name}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Manager: {team.manager_name ?? "Unassigned"}
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {team.members_count ?? team.members?.length ?? 0} members
        </span>
      </div>
    </div>
  );
}

function ManagerTeamCard({ team }: { team: ManagerTeamReport }) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{team.team_name}</h3>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700 dark:bg-blue-950 dark:text-blue-200">
          {formatUtilization(team.utilization_percent)}
        </span>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
          <p className="text-zinc-500">Team hours today</p>
          <p className="font-mono font-semibold tabular-nums">
            {formatDuration(team.hours_today_seconds)}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
          <p className="text-zinc-500">Active projects</p>
          <p className="font-semibold">{team.active_projects}</p>
        </div>
      </div>
      {team.member_breakdown.length === 0 ? (
        <p className="text-xs text-zinc-500">No team members yet.</p>
      ) : (
        <ul className="space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {team.member_breakdown.map((member) => (
            <li
              key={member.user_id}
              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                  {member.name}
                </p>
                <p className="text-xs text-zinc-500">
                  Today {formatDuration(member.hours_today_seconds)} · Range{" "}
                  {formatDuration(member.hours_in_range_seconds ?? member.hours_week_seconds)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  member.has_active_timer
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {member.has_active_timer ? "Timer on" : "Idle"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DashboardHeader({
  title,
  subtitle,
  filter,
}: {
  title: string;
  subtitle: string;
  filter?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      </div>
      {filter ? <div className="shrink-0">{filter}</div> : null}
    </div>
  );
}

function EmployeeView({
  data,
  filter,
}: {
  data: EmployeeDashboard;
  filter?: ReactNode;
}) {
  return (
    <div className="space-y-8">
      <DashboardHeader
        title="Good to see you"
        subtitle={data.team ? `Team: ${data.team.name}` : "Your personal work summary"}
        filter={filter}
      />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">My reports</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Today"
            value={formatDuration(data.personal_report.hours_today_seconds)}
            sub="Approved + tracked time"
            accent="blue"
          />
          <StatCard
            label="Selected range"
            value={formatDuration(
              data.personal_report.hours_in_range_seconds ?? data.range_total_seconds ?? 0,
            )}
            sub={
              data.date_range
                ? `${data.date_range.start_date} – ${data.date_range.end_date}`
                : "Filtered period"
            }
          />
          <StatCard
            label="Approved overtime"
            value={formatDuration(data.personal_report.overtime_summary?.approved_seconds ?? 0)}
          />
          <StatCard
            label="Pending overtime"
            value={String(data.overtime_summary?.pending_count ?? data.personal_report.overtime_summary?.pending_count ?? 0)}
          />
          <StatCard
            label="This month"
            value={formatDuration(data.personal_report.hours_month_seconds)}
          />
          <StatCard
            label="Timer"
            value={data.active_timer ? "Running" : "Idle"}
            sub={
              data.active_timer
                ? `Since ${formatTime(data.active_timer.start_time)}`
                : "Personal live tracking"
            }
            accent={data.active_timer ? "green" : "default"}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Recent sessions
            </h2>
            <Link
              href="/time"
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Open timer
            </Link>
          </div>
          {data.recent_sessions.length === 0 ? (
            <EmptyState
              title="No sessions yet"
              description="Start your first timer to see activity here."
            />
          ) : (
            <ul className="space-y-3">
              {data.recent_sessions.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2.5 dark:border-zinc-800"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {entry.project_name ?? "General time"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatTime(entry.start_time)}
                      {entry.end_time ? ` – ${formatTime(entry.end_time)}` : ""}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {formatDuration(entry.duration ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            My projects
          </h2>
          {data.assigned_projects.length === 0 ? (
            <EmptyState
              title="No project assignments"
              description="Ask your manager to assign you to a project."
            />
          ) : (
            <ul className="space-y-2">
              {data.assigned_projects.map((project) => (
                <li
                  key={project.id}
                  className="rounded-lg border border-zinc-100 px-3 py-2.5 dark:border-zinc-800"
                >
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {project.name}
                  </p>
                  <p className="text-xs text-zinc-500">{project.client_name}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function ManagerView({
  data,
  filter,
}: {
  data: ManagerDashboard;
  filter?: ReactNode;
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <DashboardHeader
          title="My teams"
          subtitle="Team hours, utilization, and active work"
        />
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          {filter}
          <Link
            href="/reports"
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Full reports →
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My teams" value={String(data.team_count)} accent="blue" />
        <StatCard
          label="Team hours today"
          value={formatDuration(data.summary.hours_today_seconds)}
        />
        <StatCard
          label="Team hours in range"
          value={formatDuration(data.summary.hours_in_range_seconds ?? 0)}
          sub={
            data.date_range
              ? `${data.date_range.start_date} – ${data.date_range.end_date}`
              : "Filtered period"
          }
        />
        <StatCard
          label="Team utilization"
          value={formatUtilization(data.summary.team_utilization_percent)}
          sub="Selected range average"
          accent="amber"
        />
        <StatCard
          label="Pending overtime"
          value={String(data.overtime_summary?.pending_count ?? 0)}
        />
        <StatCard
          label="Team overtime"
          value={formatDuration(data.overtime_summary?.approved_seconds ?? 0)}
          sub="Approved in selected range"
        />
        <StatCard
          label="Active projects"
          value={String(data.summary.active_projects)}
          sub={`${data.summary.active_timers} active timer(s)`}
        />
      </div>

      <ManualApprovalQueue />
      <OvertimeApprovalQueue title="My Overtime Approval Queue" />

      {data.teams.length === 0 ? (
        <EmptyState
          title="No teams assigned"
          description="An admin will assign you as manager to a team."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.teams.map((team) => (
            <ManagerTeamCard key={team.team_id} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}

function AdminView({
  data,
  filter,
}: {
  data: AdminDashboard;
  filter?: ReactNode;
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <DashboardHeader
          title="Organization control center"
          subtitle="Workforce overview, utilization, and active work"
        />
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          {filter}
          <Link
            href="/reports"
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Full reports →
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Workforce" value={String(data.employee_count)} sub="Employees + managers" accent="blue" />
        <StatCard label="Teams" value={String(data.team_count)} accent="blue" />
        <StatCard label="Projects" value={String(data.active_projects)} />
        <StatCard
          label="Active timers"
          value={String(data.running_timers)}
          accent="green"
        />
        <StatCard
          label="Hours in range"
          value={formatDuration(data.range_tracked_seconds ?? data.week_tracked_seconds)}
          sub={
            data.date_range
              ? `${data.date_range.start_date} – ${data.date_range.end_date}`
              : "Filtered period"
          }
        />
        <StatCard
          label="Range utilization"
          value={formatUtilization(
            data.range_utilization_percent ?? data.organization_utilization_percent,
          )}
          sub={`Today: ${formatDuration(data.today_tracked_seconds)}`}
          accent="amber"
        />
        <StatCard
          label="Org overtime"
          value={formatDuration(data.overtime_summary?.approved_seconds ?? 0)}
          sub={`${data.overtime_summary?.pending_count ?? 0} pending`}
        />
      </div>

      <ManualApprovalQueue />
      <OvertimeApprovalQueue title="Manager Overtime Approval Queue" />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Team utilization (selected range)
          </h2>
          <Link
            href="/teams"
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Manage teams →
          </Link>
        </div>
        {data.team_utilization.length === 0 ? (
          <EmptyState
            title="No utilization data"
            description="Team utilization appears once teams track time."
          />
        ) : (
          <div className="ui-table-wrap ui-card">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/80 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/40">
                <tr>
                  <th className="px-4 py-3 font-medium">Team</th>
                  <th className="px-4 py-3 font-medium">Tracked</th>
                  <th className="px-4 py-3 font-medium">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {data.team_utilization.map((row) => (
                  <tr
                    key={row.team_id}
                    className="border-b border-zinc-50 dark:border-zinc-800/80"
                  >
                    <td className="px-4 py-3 font-medium">{row.team_name}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {formatDuration(row.tracked_seconds)}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {formatUtilization(row.utilization_percent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">All teams</h2>
        {data.teams.length === 0 ? (
          <EmptyState
            title="No teams yet"
            description="Create teams and assign managers from the Teams page."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.teams.map((team) => (
              <AdminTeamCard key={team.id} team={team} />
            ))}
          </div>
        )}
        {data.unassigned_employees > 0 ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {data.unassigned_employees} employee(s) not assigned to a team yet.
          </p>
        ) : null}
      </section>
    </div>
  );
}

export function RoleDashboard({
  data,
  dateRangeFilter,
}: {
  data: DashboardData;
  dateRangeFilter?: ReactNode;
}) {
  if (data.role === "employee") {
    return <EmployeeView data={data} filter={dateRangeFilter} />;
  }
  if (data.role === "manager") {
    return <ManagerView data={data} filter={dateRangeFilter} />;
  }
  return <AdminView data={data} filter={dateRangeFilter} />;
}
