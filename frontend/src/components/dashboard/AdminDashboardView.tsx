"use client";

import { useAppSession } from "@/components/dashboard/AppShell";
import { Metric } from "@/components/ledger/Metric";
import { initialsOf } from "@/components/ledger/Avatar";
import { greeting, hoursLabel, percentLabel } from "@/components/ledger/format";
import { Panel } from "@/components/ledger/Panel";
import { ManualApprovalQueue } from "@/components/time/ManualApprovalQueue";
import { OvertimeApprovalQueue } from "@/components/time/OvertimeApprovalQueue";
import { cn } from "@/lib/cn";
import type { AdminDashboard, EmployeeReportBreakdown } from "@/lib/types";
import { Activity, ArrowRight, Clock, Gauge, Hourglass, UserPlus } from "lucide-react";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";

export function AdminDashboardView({ data, filter }: { data: AdminDashboard; filter?: ReactNode }) {
  const { user, organizationName } = useAppSession();
  const now = new Date();
  const firstName = user.name.split(/\s+/)[0] ?? user.name;

  const rangeSeconds = data.range_tracked_seconds ?? data.week_tracked_seconds;
  const utilization = data.range_utilization_percent ?? data.organization_utilization_percent;
  const pendingOvertime = data.overtime_summary?.pending_count ?? 0;
  const trackingShare = data.active_employees > 0 ? (data.running_timers / data.active_employees) * 100 : 0;

  const roster = useMemo(
    () =>
      [...(data.employee_breakdown ?? [])].sort(
        (a, b) =>
          Number(b.has_active_timer) - Number(a.has_active_timer) ||
          b.hours_in_range_seconds - a.hours_in_range_seconds,
      ),
    [data.employee_breakdown],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.8125rem] text-[var(--muted)]">
            {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            {organizationName ? ` · ${organizationName}` : ""}
          </p>
          <h1 className="mt-1 text-[1.75rem] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
            {greeting(now)}, {firstName}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filter}
          <Link
            href="/reports"
            className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-4 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--accent-sand)]"
          >
            Full reports
          </Link>
          <Link
            href="/employees"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Add employee
          </Link>
        </div>
      </header>

      <section aria-label="At a glance" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Tracking right now"
          icon={<Activity className="h-4 w-4" />}
          value={
            <>
              {data.running_timers}
              <span className="text-lg text-[var(--muted)]"> / {data.active_employees}</span>
            </>
          }
          progress={trackingShare}
          detail="Active people with a live timer"
        />
        <Metric
          label="Hours in range"
          icon={<Clock className="h-4 w-4" />}
          value={hoursLabel(rangeSeconds)}
          detail={`Today ${hoursLabel(data.today_tracked_seconds)}`}
        />
        <Metric
          label="Utilization"
          icon={<Gauge className="h-4 w-4" />}
          value={percentLabel(utilization)}
          progress={utilization}
          detail="Tracked vs. expected hours"
        />
        <Metric
          label="Overtime waiting"
          icon={<Hourglass className="h-4 w-4" />}
          value={pendingOvertime}
          tone={pendingOvertime > 0 ? "attention" : "default"}
          detail={`${hoursLabel(data.overtime_summary?.approved_seconds ?? 0)} approved in range`}
        />
      </section>

      <section
        aria-label="Organization"
        className="grid grid-cols-2 divide-[var(--border-subtle)] rounded-2xl border border-[var(--border)] bg-[var(--card)] sm:grid-cols-4 sm:divide-x"
      >
        <MiniStat label="Workforce" value={data.employee_count} href="/employees" />
        <MiniStat label="Teams" value={data.team_count} href="/teams" />
        <MiniStat label="Active projects" value={data.active_projects} href="/projects" />
        <MiniStat
          label="Not in a team"
          value={data.unassigned_employees}
          href="/teams"
          highlight={data.unassigned_employees > 0}
        />
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_35rem] flex-col gap-6">
          <Panel
            title="Team activity"
            description="Who is tracking now and hours in the selected range"
            action={<SeeAll href="/employees" label="Employees" />}
            flush
          >
            {roster.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-[var(--muted)]">
                No tracked time yet. Activity appears here as soon as employees start their timers.
              </p>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[38.75rem] text-left text-sm">
                  <thead className="border-y border-[var(--border)] bg-[var(--accent-sand)]/60 text-xs uppercase tracking-[0.04em] text-[var(--muted)]">
                    <tr>
                      <th scope="col" className="px-5 py-2.5 font-medium">Employee</th>
                      <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-medium">Hours</th>
                      <th scope="col" className="px-5 py-2.5 font-medium">Utilization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {roster.slice(0, 12).map((row) => (
                      <RosterRow key={row.user_id} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Team utilization"
            description="Tracked against expected hours"
            action={<SeeAll href="/teams" label="Teams" />}
          >
            {data.team_utilization.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Utilization appears once teams track time.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {data.team_utilization.map((team) => (
                  <li key={team.team_id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium text-[var(--foreground)]">{team.team_name}</span>
                      <span className="tnum text-[0.8125rem] text-[var(--muted)]">
                        {hoursLabel(team.tracked_seconds)} · {percentLabel(team.utilization_percent)}
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-[var(--border-subtle)]" aria-hidden="true">
                      <div
                        className="h-2 rounded-full bg-[var(--primary)]"
                        style={{ width: `${Math.min(100, team.utilization_percent)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="flex min-w-0 flex-[1_1_20rem] flex-col gap-4">
          <ManualApprovalQueue />
          <OvertimeApprovalQueue title="Overtime queue" />
        </aside>
      </div>
    </div>
  );
}

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

function MiniStat({
  label,
  value,
  href,
  highlight = false,
}: {
  label: string;
  value: number;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link href={href} className="group flex flex-col gap-1 px-5 py-4 transition hover:bg-[var(--accent-sand)]/60">
      <span className={cn("text-[0.8125rem]", highlight ? "text-[var(--accent-copper)]" : "text-[var(--muted)]")}>
        {label}
      </span>
      <span className={cn("tnum text-xl font-semibold", highlight ? "text-[var(--accent-copper)]" : "text-[var(--foreground)]")}>
        {value}
      </span>
    </Link>
  );
}

function RosterRow({ row }: { row: EmployeeReportBreakdown }) {
  return (
    <tr>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-muted)] text-xs font-semibold text-[var(--primary)]">
            {initialsOf(row.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-[var(--foreground)]">{row.name}</span>
            <span className="block truncate text-xs text-[var(--muted)]">{row.team_name ?? "No team"}</span>
          </span>
        </div>
      </td>
      <td className="px-5 py-3">
        {row.has_active_timer ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-emerald-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent-emerald)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-emerald)]" aria-hidden="true" />
            Tracking
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-[var(--accent-sand)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
            Idle
          </span>
        )}
      </td>
      <td className="tnum px-5 py-3 text-right">{hoursLabel(row.hours_in_range_seconds)}</td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 rounded-full bg-[var(--border-subtle)]" aria-hidden="true">
            <div
              className={cn(
                "h-1.5 rounded-full",
                row.utilization_percent < 60 ? "bg-[var(--accent-copper)]" : "bg-[var(--primary)]",
              )}
              style={{ width: `${Math.min(100, row.utilization_percent)}%` }}
            />
          </div>
          <span className="tnum w-10 text-right text-[0.8125rem] text-[var(--muted)]">{percentLabel(row.utilization_percent)}</span>
        </div>
      </td>
    </tr>
  );
}
