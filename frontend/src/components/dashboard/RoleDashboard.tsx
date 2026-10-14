"use client";

import { AdminDashboardView } from "@/components/dashboard/AdminDashboardView";
import { useAppSession } from "@/components/dashboard/AppShell";
import { Avatar } from "@/components/ledger/Avatar";
import { greeting, hoursLabel, percentLabel } from "@/components/ledger/format";
import { Metric } from "@/components/ledger/Metric";
import { Panel } from "@/components/ledger/Panel";
import { ManualApprovalQueue } from "@/components/time/ManualApprovalQueue";
import { OvertimeApprovalQueue } from "@/components/time/OvertimeApprovalQueue";
import { cn } from "@/lib/cn";
import { formatDuration, formatTime } from "@/lib/time";
import type {
  DashboardData,
  EmployeeDashboard,
  ManagerDashboard,
  ManagerTeamReport,
} from "@/lib/types";
import { Activity, ArrowRight, CalendarRange, Clock, Gauge, Hourglass, Play, Timer, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

function DashboardGreeting({ filter, actions, subtitle }: { filter?: ReactNode; actions?: ReactNode; subtitle?: string }) {
  const { user, organizationName } = useAppSession();
  const now = new Date();
  const firstName = user.name.split(/\s+/)[0] ?? user.name;

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[0.8125rem] text-[var(--muted)]">
          {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          {subtitle ? ` · ${subtitle}` : organizationName ? ` · ${organizationName}` : ""}
        </p>
        <h1 className="mt-1 text-[1.75rem] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
          {greeting(now)}, {firstName}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filter}
        {actions}
      </div>
    </header>
  );
}

const linkButton =
  "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition";

function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[0.8125rem] font-medium text-[var(--primary)] hover:bg-[var(--primary-muted)]"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}

function TrackingPill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-emerald-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent-emerald)]">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-emerald)]" aria-hidden="true" />
      Tracking
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-[var(--accent-sand)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
      Not tracking
    </span>
  );
}

function EmployeeView({ data, filter }: { data: EmployeeDashboard; filter?: ReactNode }) {
  const timer = data.active_timer;
  const rangeSeconds = data.personal_report.hours_in_range_seconds ?? data.range_total_seconds ?? 0;
  const utilization = data.range_utilization_percent ?? data.week_utilization_percent;
  const pendingOvertime = data.overtime_summary?.pending_count ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <DashboardGreeting filter={filter} subtitle={data.team?.name} />

      <section
        aria-label="Time tracker"
        className={cn(
          "flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5",
          timer
            ? "border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald-soft)]"
            : "border-[var(--border)] bg-[var(--card)]",
        )}
      >
        <div className="flex items-center gap-4">
          <span
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl",
              timer ? "bg-[var(--card)] text-[var(--accent-emerald)]" : "bg-[var(--primary-muted)] text-[var(--primary)]",
            )}
            aria-hidden="true"
          >
            <Timer className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[0.8125rem] text-[var(--muted)]">Time tracker</p>
            <p className="text-lg font-semibold text-[var(--foreground)]">
              {timer ? `Tracking ${timer.project_name ?? "general time"}` : "Not tracking right now"}
            </p>
            {timer ? (
              <p className="tnum text-[0.8125rem] text-[var(--muted)]">Since {formatTime(timer.start_time)}</p>
            ) : null}
          </div>
        </div>
        <Link
          href="/time"
          className={cn(linkButton, "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]")}
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          {timer ? "Open timer" : "Start tracking"}
        </Link>
      </section>

      <section aria-label="At a glance" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Today" icon={<Clock className="h-4 w-4" />} value={hoursLabel(data.personal_report.hours_today_seconds)} />
        <Metric
          label="Hours in range"
          icon={<CalendarRange className="h-4 w-4" />}
          value={hoursLabel(rangeSeconds)}
          detail={`This month ${hoursLabel(data.personal_report.hours_month_seconds)}`}
        />
        <Metric
          label="Utilization"
          icon={<Gauge className="h-4 w-4" />}
          value={percentLabel(utilization)}
          progress={utilization}
          detail="Tracked vs. expected hours"
        />
        <Metric
          label="Overtime pending"
          icon={<Hourglass className="h-4 w-4" />}
          value={pendingOvertime}
          tone={pendingOvertime > 0 ? "attention" : "default"}
          detail="Waiting for approval"
        />
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[999_1_30rem]">
          <Panel
            title="Recent sessions"
            description="Your latest tracked time"
            action={<SeeAll href="/time" label="Time" />}
            flush
          >
            {data.recent_sessions.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-[var(--muted)]">No sessions yet. Start the timer to see activity here.</p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
                {data.recent_sessions.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">
                        {entry.project_name ?? "General time"}
                      </p>
                      <p className="tnum text-xs text-[var(--muted)]">
                        {new Date(entry.start_time).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                        {" · "}
                        {formatTime(entry.start_time)}
                      </p>
                    </div>
                    <span className="num shrink-0 text-sm font-semibold text-[var(--foreground)]">
                      {formatDuration(entry.duration ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <div className="min-w-0 flex-[1_1_18.75rem]">
          <Panel title="My projects" description={`${data.assigned_projects.length} assigned`} flush>
            {data.assigned_projects.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-[var(--muted)]">No projects yet. Ask your manager to assign you.</p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
                {data.assigned_projects.map((project) => (
                  <li key={project.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">{project.name}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{project.client_name}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ManagerTeamPanel({ team }: { team: ManagerTeamReport }) {
  const tracking = team.member_breakdown.filter((member) => member.has_active_timer).length;

  return (
    <Panel
      title={team.team_name}
      description={`${tracking} of ${team.member_breakdown.length} tracking now`}
      action={
        <span className="tnum rounded-full bg-[var(--primary-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)]">
          {percentLabel(team.utilization_percent)}
        </span>
      }
      flush
    >
      <div className="grid grid-cols-2 gap-3 px-5 pb-4">
        <div className="rounded-xl bg-[var(--accent-sand)] px-3 py-2.5">
          <p className="text-xs text-[var(--muted)]">Today</p>
          <p className="tnum mt-0.5 font-semibold text-[var(--foreground)]">{hoursLabel(team.hours_today_seconds)}</p>
        </div>
        <div className="rounded-xl bg-[var(--accent-sand)] px-3 py-2.5">
          <p className="text-xs text-[var(--muted)]">Active projects</p>
          <p className="tnum mt-0.5 font-semibold text-[var(--foreground)]">{team.active_projects}</p>
        </div>
      </div>
      {team.member_breakdown.length > 0 ? (
        <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
          {team.member_breakdown.slice(0, 6).map((member) => (
            <li key={member.user_id} className="flex items-center justify-between gap-3 px-5 py-2.5">
              <span className="flex min-w-0 items-center gap-3">
                <Avatar name={member.name} size="sm" />
                <span className="truncate text-sm text-[var(--foreground)]">{member.name}</span>
              </span>
              <TrackingPill active={member.has_active_timer} />
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}

function ManagerView({ data, filter }: { data: ManagerDashboard; filter?: ReactNode }) {
  const utilization = data.summary.team_utilization_percent;

  return (
    <div className="flex flex-col gap-6">
      <DashboardGreeting
        filter={filter}
        actions={
          <Link
            href="/reports"
            className={cn(linkButton, "border border-[var(--border)] bg-[var(--card-elevated)] font-medium text-[var(--foreground)] hover:bg-[var(--accent-sand)]")}
          >
            Full reports
          </Link>
        }
      />

      <section aria-label="At a glance" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Teams" icon={<Users className="h-4 w-4" />} value={data.team_count} detail={`${data.summary.active_projects} active projects`} />
        <Metric label="Hours today" icon={<Clock className="h-4 w-4" />} value={hoursLabel(data.summary.hours_today_seconds)} />
        <Metric label="Hours in range" icon={<Activity className="h-4 w-4" />} value={hoursLabel(data.summary.hours_in_range_seconds ?? 0)} />
        <Metric
          label="Team utilization"
          icon={<Gauge className="h-4 w-4" />}
          value={percentLabel(utilization)}
          progress={utilization}
          detail="Tracked vs. expected hours"
        />
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[999_1_35rem]">
          {data.teams.length === 0 ? (
            <Panel title="Your teams">
              <p className="text-sm text-[var(--muted)]">An admin will assign you as a team manager.</p>
            </Panel>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {data.teams.map((team) => (
                <ManagerTeamPanel key={team.team_id} team={team} />
              ))}
            </div>
          )}
        </div>
        <aside className="flex min-w-0 flex-[1_1_20rem] flex-col gap-4">
          <ManualApprovalQueue />
          <OvertimeApprovalQueue title="Overtime approvals" />
        </aside>
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
