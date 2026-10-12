"use client";

import { AdminDashboardView } from "@/components/dashboard/AdminDashboardView";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState as UiEmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDuration, formatTime, formatUtilization } from "@/lib/time";
import type {
  DashboardData,
  EmployeeDashboard,
  ManagerDashboard,
  ManagerTeamReport,
} from "@/lib/types";
import { ManualApprovalQueue } from "@/components/time/ManualApprovalQueue";
import { OvertimeApprovalQueue } from "@/components/time/OvertimeApprovalQueue";
import {
  Activity,
  Briefcase,
  Clock,
  Play,
  Timer,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

function ManagerTeamCard({ team }: { team: ManagerTeamReport }) {
  return (
    <div className="ui-card rounded-xl p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{team.team_name}</h3>
        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
          {formatUtilization(team.utilization_percent)}
        </span>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
          <p className="text-zinc-500">Today</p>
          <p className="font-mono font-semibold tabular-nums">{formatDuration(team.hours_today_seconds)}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
          <p className="text-zinc-500">Projects</p>
          <p className="font-semibold">{team.active_projects}</p>
        </div>
      </div>
      {team.member_breakdown.length > 0 ? (
        <ul className="space-y-1.5 border-t border-[var(--border)] pt-3">
          {team.member_breakdown.slice(0, 4).map((member) => (
            <li key={member.user_id} className="flex items-center justify-between text-sm">
              <span className="truncate text-zinc-700 dark:text-zinc-300">{member.name}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  member.has_active_timer
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                }`}
              >
                {member.has_active_timer ? "Active" : "Idle"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function EmployeeView({ data, filter }: { data: EmployeeDashboard; filter?: ReactNode }) {
  const timerRunning = Boolean(data.active_timer);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={data.team ? `${data.team.name} · Your work at a glance` : "Your personal work summary"}
        actions={filter}
      />

      <div className="ui-card flex flex-col gap-4 rounded-xl border border-[var(--border)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl ${
              timerRunning
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
            }`}
          >
            <Timer className={`h-6 w-6 ${timerRunning ? "animate-pulse-ring" : ""}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Time tracker</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {timerRunning ? "Timer running" : "Not tracking"}
            </p>
            {timerRunning && data.active_timer ? (
              <p className="text-xs text-zinc-500">Since {formatTime(data.active_timer.start_time)}</p>
            ) : null}
          </div>
        </div>
        <Link href="/time">
          <Button size="lg">
            <Play className="h-4 w-4" />
            {timerRunning ? "Open timer" : "Start tracking"}
          </Button>
        </Link>
      </div>

      <div className="ui-kpi-grid">
        <StatCard index={0} icon={Clock} label="Today" value={formatDuration(data.personal_report.hours_today_seconds)} accent="blue" />
        <StatCard index={1} icon={TrendingUp} label="Selected range" value={formatDuration(data.personal_report.hours_in_range_seconds ?? data.range_total_seconds ?? 0)} />
        <StatCard index={2} label="This month" value={formatDuration(data.personal_report.hours_month_seconds)} />
        <StatCard index={3} label="Pending OT" value={String(data.overtime_summary?.pending_count ?? 0)} accent="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card animate={false}>
          <CardHeader title="Recent activity" description="Your latest tracked sessions" />
          {data.recent_sessions.length === 0 ? (
            <UiEmptyState icon={Activity} title="No sessions yet" description="Start tracking to see activity here." />
          ) : (
            <ul className="space-y-2">
              {data.recent_sessions.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium">{entry.project_name ?? "General time"}</p>
                    <p className="text-xs text-zinc-500">{formatTime(entry.start_time)}</p>
                  </div>
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {formatDuration(entry.duration ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card animate={false}>
          <CardHeader title="My projects" description={`${data.assigned_projects.length} assigned`} />
          {data.assigned_projects.length === 0 ? (
            <UiEmptyState icon={Briefcase} title="No projects" description="Ask your manager to assign you." />
          ) : (
            <ul className="space-y-2">
              {data.assigned_projects.map((project) => (
                <li key={project.id} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2.5">
                  <p className="text-sm font-medium">{project.name}</p>
                  <p className="text-xs text-zinc-500">{project.client_name}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function ManagerView({ data, filter }: { data: ManagerDashboard; filter?: ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Team overview"
        description="Hours, utilization, and approvals for your teams"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {filter}
            <Link href="/reports">
              <Button variant="secondary" size="sm">
                Full reports
              </Button>
            </Link>
          </div>
        }
      />

      <div className="ui-kpi-grid">
        <StatCard index={0} icon={Users} label="Teams" value={String(data.team_count)} accent="blue" />
        <StatCard index={1} icon={Clock} label="Hours today" value={formatDuration(data.summary.hours_today_seconds)} />
        <StatCard index={2} label="Range hours" value={formatDuration(data.summary.hours_in_range_seconds ?? 0)} />
        <StatCard index={3} label="Utilization" value={formatUtilization(data.summary.team_utilization_percent)} accent="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {data.teams.length === 0 ? (
            <UiEmptyState icon={Users} title="No teams" description="An admin will assign you as a team manager." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {data.teams.map((team) => (
                <ManagerTeamCard key={team.team_id} team={team} />
              ))}
            </div>
          )}
        </div>
        <div className="space-y-4">
          <ManualApprovalQueue />
          <OvertimeApprovalQueue title="Overtime approvals" />
        </div>
      </div>
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
  if (data.role === "employee") return <EmployeeView data={data} filter={dateRangeFilter} />;
  if (data.role === "manager") return <ManagerView data={data} filter={dateRangeFilter} />;
  return <AdminDashboardView data={data} filter={dateRangeFilter} />;
}
