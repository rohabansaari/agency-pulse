"use client";

import { ledgerTable } from "@/components/ledger/table";
import { usePayrollVault } from "@/components/payroll/PayrollVaultProvider";
import {
  presetDateRange,
  ReportDateRangeFilter,
  type ReportDateRange,
} from "@/components/reports/ReportDateRangeFilter";
import { Alert } from "@/components/ui/EmptyState";
import { ApiError, fetchProfitabilityReport, formatApiErrors } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatPKR } from "@/lib/currency";
import type {
  BudgetStatus,
  ProfitabilityInsight,
  ProfitabilityProjectRow,
  ProfitabilityReport,
  ProjectBillingType,
} from "@/lib/types";
import { AlertTriangle, ArrowRight, CircleAlert, Info, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

function hours(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toLocaleString("en-PK")}h`;
}

function percent(value: number | null): string {
  return value === null ? "—" : `${value.toLocaleString("en-PK", { maximumFractionDigits: 1 })}%`;
}

function shortDate(iso: string | null, withYear = true): string {
  if (!iso) return "—";
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
}

function longDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Whole rupees: paise only add noise to business totals. */
function money(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : formatPKR(Math.round(value));
}

function signedMoney(value: number, plus = false): string {
  if (value < 0) return `−${money(Math.abs(value))}`;
  return plus && value > 0 ? `+${money(value)}` : money(value);
}

/** "−59k" / "+92k" for chart axes. */
function compactMoney(value: number): string {
  const abs = Math.abs(value);
  const text = abs >= 1000 ? `${Math.round(abs / 1000).toLocaleString("en-PK")}k` : Math.round(abs).toLocaleString("en-PK");
  return value < 0 ? `−${text}` : value > 0 ? `+${text}` : "0";
}

const BILLING_LABEL: Record<ProjectBillingType, string> = {
  hourly: "Hourly",
  fixed: "Fixed fee",
  non_billable: "Internal",
};

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function ProfitText({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        "tnum font-semibold",
        value < 0 ? "text-[var(--accent-coral)]" : value > 0 ? "text-[var(--accent-emerald)]" : "text-[var(--muted)]",
        className,
      )}
    >
      {signedMoney(value)}
    </span>
  );
}

/** Margin as a number over a thin bar: easier to compare down a column than pills. */
function MarginBar({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-[0.8125rem] text-[var(--muted)]">—</span>;
  }
  const tone = value < 0 ? "bg-[var(--accent-coral)]" : value < 20 ? "bg-[var(--accent-copper)]" : "bg-[var(--primary)]";
  return (
    <div className="flex min-w-[5.5rem] flex-col gap-1.5">
      <span className={cn("tnum text-[0.8125rem] font-medium", value < 0 && "text-[var(--accent-coral)]")}>{percent(value)}</span>
      <div className="h-1 overflow-hidden rounded-full bg-[var(--border-subtle)]" aria-hidden="true">
        <div className={cn("ap-grow-x h-full rounded-full", tone)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

const BUDGET_STATUS: Record<BudgetStatus, { label: string; bar: string; text: string }> = {
  on_track: { label: "On track", bar: "bg-[var(--primary)]", text: "text-[var(--muted)]" },
  at_risk: { label: "At risk", bar: "bg-[var(--accent-copper)]", text: "text-[var(--accent-copper)]" },
  over_budget: { label: "Over budget", bar: "bg-[var(--accent-coral)]", text: "text-[var(--accent-coral)]" },
  no_budget: { label: "No budget", bar: "bg-[var(--border)]", text: "text-[var(--muted)]" },
};

function BudgetCell({ row }: { row: ProfitabilityProjectRow }) {
  const budget = row.budget;
  const style = BUDGET_STATUS[budget.status];

  if (budget.status === "no_budget") {
    return (
      <Link href="/projects" className="text-[0.8125rem] text-[var(--muted)] underline-offset-2 hover:text-[var(--primary)] hover:underline">
        Set a budget to track burn
      </Link>
    );
  }

  const burn = budget.burn_percent ?? 0;
  let note = `${percent(budget.burn_percent)} used`;
  if (budget.status === "over_budget" && budget.elapsed_percent !== null) {
    note += ` · ${percent(budget.elapsed_percent)} of time gone`;
  } else if (budget.forecast_exhausted_on) {
    note = `Runs out ${shortDate(budget.forecast_exhausted_on, budget.status !== "at_risk")}`;
    if (budget.status === "at_risk" && budget.due_on && budget.forecast_exhausted_on < budget.due_on) {
      note += ` · due ${shortDate(budget.due_on, false)}`;
    }
  } else if (budget.elapsed_percent !== null) {
    note += ` · ${percent(budget.elapsed_percent)} of time gone`;
  }

  return (
    <div className="min-w-[13rem]">
      <div className="flex items-center justify-between gap-2 text-[0.8125rem]">
        <span className={cn("font-medium", style.text)}>{style.label}</span>
        <span className="tnum text-[var(--muted)]">
          {hours(budget.used_hours)} / {hours(budget.budget_hours ?? 0)}
        </span>
      </div>
      <div className="relative mt-1.5 h-1.5 rounded-full bg-[var(--border-subtle)]" aria-hidden="true">
        <div className={cn("ap-grow-x h-1.5 rounded-full", style.bar)} style={{ width: `${Math.min(100, burn)}%` }} />
        {budget.elapsed_percent !== null ? (
          <span
            className="absolute -top-1 h-3.5 w-0.5 rounded bg-[var(--foreground)]"
            style={{ left: `calc(${Math.min(100, budget.elapsed_percent)}% - 1px)` }}
            title={`${percent(budget.elapsed_percent)} of the time elapsed`}
          />
        ) : null}
      </div>
      <p className="tnum mt-1 text-xs text-[var(--muted)]">{note}</p>
    </div>
  );
}

function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("rounded-2xl border border-[var(--border)] bg-[var(--card)]", className)} {...rest}>
      {children}
    </section>
  );
}

function CardHeading({ id, title, description, aside }: { id: string; title: string; description?: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold text-[var(--foreground)]">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-[0.8125rem] text-[var(--muted)]">{description}</p> : null}
      </div>
      {aside}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

function Summary({ report }: { report: ProfitabilityReport }) {
  const { totals, projects } = report;
  const worked = projects.filter((row) => row.hours > 0);
  const winners = worked.filter((row) => row.profit > 0).length;
  const losers = worked.filter((row) => row.profit < 0);
  const lost = losers.reduce((sum, row) => sum + row.profit, 0);
  const loss = totals.profit < 0;

  // The bar shows where revenue went; a loss shows cost overrunning revenue instead.
  const costShare = totals.revenue > 0 ? Math.min(100, (totals.cost / totals.revenue) * 100) : 100;
  const unbilled = Math.max(0, totals.hours - totals.billable_hours);
  const avgCost = totals.hours > 0 ? totals.cost / totals.hours : null;
  const avgEarned = totals.billable_hours > 0 ? totals.revenue / totals.billable_hours : null;

  const internal = worked
    .filter((row) => row.billing_type === "non_billable")
    .sort((a, b) => b.hours - a.hours);
  let unbilledNote: string | null = null;
  if (unbilled > 0.05 && internal.length > 0) {
    const internalHours = internal.reduce((sum, row) => sum + row.hours, 0);
    unbilledNote =
      internal.length === 1 && Math.abs(internalHours - unbilled) < 0.05
        ? `All ${hours(unbilled)} unbilled went to ${internal[0].name}.`
        : `${internal[0].name} took the most unbilled time (${hours(internal[0].hours)}).`;
  }

  let sentence: ReactNode = "No project hours in this period yet.";
  if (worked.length > 0) {
    sentence = (
      <>
        {winners} of {worked.length} {worked.length === 1 ? "project" : "projects"} made money.
        {losers.length > 0 ? (
          <>
            {" "}
            {losers.length === 1 ? `${losers[0].name} lost` : `${losers.length} lost`}{" "}
            <span className="tnum font-medium text-[var(--accent-coral)]">{money(Math.abs(lost))}</span>
            {losers.length === 1 ? "." : " between them."}
          </>
        ) : null}
      </>
    );
  }

  return (
    <Card aria-labelledby="profit-summary" className="grid overflow-hidden lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-2.5">
          <h2 id="profit-summary" className="text-sm font-medium text-[var(--muted)]">
            {loss ? "Loss this period" : "Profit this period"}
          </h2>
          <div className="flex flex-wrap items-baseline gap-3">
            <span
              className={cn(
                "tnum text-[2.5rem] font-semibold leading-none tracking-[-0.03em] sm:text-[3.25rem]",
                loss ? "text-[var(--accent-coral)]" : "text-[var(--foreground)]",
              )}
            >
              {signedMoney(totals.profit)}
            </span>
            {totals.margin_percent !== null ? (
              <span
                className={cn(
                  "tnum rounded-full px-3 py-1 text-sm font-semibold",
                  loss
                    ? "bg-[var(--accent-coral-soft)] text-[var(--accent-coral)]"
                    : "bg-[var(--primary-muted)] text-[var(--primary)]",
                )}
              >
                {percent(totals.margin_percent)} margin
              </span>
            ) : null}
          </div>
          <p className="text-[0.9375rem] leading-relaxed text-[var(--muted)]">{sentence}</p>
        </div>

        {totals.revenue > 0 || totals.cost > 0 ? (
          <figure className="flex flex-col gap-2.5">
            <figcaption className="flex flex-wrap justify-between gap-2 text-[0.8125rem] text-[var(--muted)]">
              <span>Where the revenue went</span>
              <span className="tnum">Revenue {money(totals.revenue)}</span>
            </figcaption>
            <div
              role="img"
              aria-label={
                loss
                  ? `Salary cost of ${money(totals.cost)} was more than revenue of ${money(totals.revenue)}.`
                  : `Of ${money(totals.revenue)} revenue, ${money(totals.cost)} went to salary cost and ${money(totals.profit)} was profit.`
              }
              className="flex h-11 gap-[3px] overflow-hidden rounded-xl"
            >
              <div
                className="ap-grow-x flex items-center overflow-hidden whitespace-nowrap bg-[var(--foreground)] px-3.5 text-[0.8125rem] font-medium text-[var(--background)]"
                style={{ width: `${costShare}%` }}
              >
                Salary cost
              </div>
              {!loss && costShare < 100 ? (
                <div className="ap-grow-x flex flex-1 items-center overflow-hidden whitespace-nowrap bg-[var(--primary)] px-3.5 text-[0.8125rem] font-medium text-[var(--primary-foreground)] [animation-delay:150ms]">
                  Profit
                </div>
              ) : null}
            </div>
            <div className="flex text-sm">
              <div className="flex flex-col gap-0.5" style={{ width: loss ? "100%" : `${costShare}%` }}>
                <span className="tnum font-semibold">{money(totals.cost)}</span>
                <span className="tnum text-[0.8125rem] text-[var(--muted)]">
                  {totals.revenue > 0 ? `${percent(Math.round((totals.cost / totals.revenue) * 1000) / 10)} of revenue` : "No revenue"}
                </span>
              </div>
              {!loss ? (
                <div className="flex min-w-[7rem] flex-1 flex-col gap-0.5 pl-[3px]">
                  <span className="tnum font-semibold text-[var(--primary)]">{money(totals.profit)}</span>
                  <span className="tnum text-[0.8125rem] text-[var(--muted)]">{percent(totals.margin_percent)} of revenue</span>
                </div>
              ) : null}
            </div>
          </figure>
        ) : null}
      </div>

      <div className="flex flex-col gap-5 border-t border-[var(--border-subtle)] bg-[var(--accent-sand)]/50 p-6 sm:p-8 lg:border-l lg:border-t-0">
        <h2 className="text-sm font-medium text-[var(--muted)]">Hours</h2>
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="tnum text-[2rem] font-semibold leading-none tracking-[-0.02em]">{hours(totals.billable_hours)}</span>
            <span className="tnum text-[0.9375rem] text-[var(--muted)]">billable of {hours(totals.hours)}</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-[var(--border)]"
            role="img"
            aria-label={`${percent(totals.billable_percent)} of hours were billable`}
          >
            <div className="ap-grow-x h-full rounded-full bg-[var(--primary)]" style={{ width: `${totals.billable_percent ?? 0}%` }} />
          </div>
          <span className="tnum text-[0.8125rem] text-[var(--muted)]">
            {totals.billable_percent === null ? "No hours logged yet" : `${percent(totals.billable_percent)} billable`}
          </span>
        </div>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 border-t border-[var(--border)] pt-4 text-sm">
          <dt className="text-[var(--muted)]">Unbilled hours</dt>
          <dd className="tnum text-right font-semibold">{hours(unbilled)}</dd>
          <dt className="text-[var(--muted)]">Average cost per hour</dt>
          <dd className="tnum text-right font-semibold">{money(avgCost)}</dd>
          <dt className="text-[var(--muted)]">Average earned per billable hour</dt>
          <dd className="tnum text-right font-semibold">{money(avgEarned)}</dd>
          {totals.unpriced_hours > 0 ? (
            <>
              <dt className="text-[var(--accent-copper)]">Hours with no salary cost</dt>
              <dd className="tnum text-right font-semibold text-[var(--accent-copper)]">{hours(totals.unpriced_hours)}</dd>
            </>
          ) : null}
        </dl>
        {unbilledNote ? <p className="text-[0.8125rem] leading-relaxed text-[var(--muted)]">{unbilledNote}</p> : null}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* What needs attention                                                */
/* ------------------------------------------------------------------ */

const SEVERITY_RANK: Record<ProfitabilityInsight["severity"], number> = { critical: 0, warning: 1, info: 2, positive: 3 };

const INSIGHT_STYLE: Record<ProfitabilityInsight["severity"], { icon: ReactNode; tile: string; text: string }> = {
  critical: {
    icon: <CircleAlert className="h-[1.125rem] w-[1.125rem]" />,
    tile: "bg-[var(--accent-coral-soft)] text-[var(--accent-coral)]",
    text: "text-[var(--accent-coral)]",
  },
  warning: {
    icon: <AlertTriangle className="h-[1.125rem] w-[1.125rem]" />,
    tile: "bg-[var(--accent-copper-soft)] text-[var(--accent-copper)]",
    text: "text-[var(--accent-copper)]",
  },
  info: {
    icon: <Info className="h-[1.125rem] w-[1.125rem]" />,
    tile: "bg-[var(--accent-sand)] text-[var(--muted)]",
    text: "text-[var(--muted)]",
  },
  positive: {
    icon: <TrendingUp className="h-[1.125rem] w-[1.125rem]" />,
    tile: "bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]",
    text: "text-[var(--accent-emerald)]",
  },
};

/** Rupees at stake, for ranking; hours count as their cost at the average rate. */
function stake(insight: ProfitabilityInsight, avgCost: number): number {
  if (!insight.impact) return 0;
  return insight.impact.type === "money" ? Math.abs(insight.impact.value) : Math.abs(insight.impact.value) * avgCost;
}

function impactLabel(insight: ProfitabilityInsight): string | null {
  const impact = insight.impact;
  if (!impact) return null;
  if (impact.type === "money") return signedMoney(impact.value, true);
  if (impact.type === "hours_over") return `+${hours(impact.value)} over`;
  return `${hours(impact.value)} left`;
}

function AttentionList({ report }: { report: ProfitabilityReport }) {
  const avgCost = report.totals.hours > 0 ? report.totals.cost / report.totals.hours : 0;
  const insights = [...report.insights].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || stake(b, avgCost) - stake(a, avgCost),
  );

  return (
    <Card aria-labelledby="attention-heading">
      <div className="px-5 pb-2 pt-5 sm:px-7">
        <CardHeading
          id="attention-heading"
          title="What needs attention"
          aside={<span className="text-[0.8125rem] text-[var(--muted)]">Ranked by money at stake</span>}
        />
      </div>
      {insights.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-[var(--muted)] sm:px-7">Nothing needs your attention in this period.</p>
      ) : (
        <ol>
          {insights.map((insight, index) => {
            const style = INSIGHT_STYLE[insight.severity];
            const label = impactLabel(insight);
            return (
              <li
                key={`${insight.title}-${index}`}
                className="ap-rise grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-t border-[var(--border-subtle)] px-5 py-4 transition-colors hover:bg-[var(--accent-sand)]/40 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:px-7"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", style.tile)} aria-hidden="true">
                  {style.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-[0.9375rem] font-semibold text-[var(--foreground)]">{insight.title}</p>
                  <p className="tnum mt-0.5 text-sm leading-relaxed text-[var(--muted)]">{insight.detail}</p>
                </div>
                {label || insight.project_id ? (
                  <div className="col-start-2 flex items-center gap-4 sm:col-start-3 sm:flex-col sm:items-end sm:gap-1">
                    {label ? <span className={cn("tnum whitespace-nowrap text-base font-semibold", style.text)}>{label}</span> : null}
                    {insight.project_id ? (
                      <Link
                        href="/projects"
                        className="group inline-flex items-center gap-1 whitespace-nowrap text-[0.8125rem] font-medium text-[var(--primary)] hover:underline"
                      >
                        Open project
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Charts                                                              */
/* ------------------------------------------------------------------ */

/** Profit per client as a diverging bar: losses left of zero, profit right. */
function ClientProfitChart({ clients }: { clients: ProfitabilityReport["clients"] }) {
  const sorted = [...clients].sort((a, b) => b.profit - a.profit);
  const maxGain = Math.max(0, ...sorted.map((c) => c.profit));
  const maxLoss = Math.max(0, ...sorted.map((c) => -c.profit));
  const span = Math.max(1, maxGain + maxLoss);
  const zero = (maxLoss / span) * 100;
  const summary = `Profit by client: ${sorted.map((c) => `${c.client_name} ${signedMoney(c.profit)}`).join(", ")}.`;

  return (
    <div className="flex flex-col gap-3">
      <div role="img" aria-label={summary} className="flex flex-col gap-3">
        {sorted.map((client, index) => {
          const width = (Math.abs(client.profit) / span) * 100;
          const loss = client.profit < 0;
          return (
            <div key={client.client_name} className="grid grid-cols-[minmax(5rem,7.5rem)_minmax(0,1fr)_5.5rem] items-center gap-3 text-sm">
              <span className="truncate">{client.client_name}</span>
              <div className="relative h-[1.375rem]">
                <span className="absolute -inset-y-1 w-px bg-[var(--border)]" style={{ left: `${zero}%` }} aria-hidden="true" />
                <div
                  className={cn(
                    "absolute inset-y-0",
                    loss
                      ? "ap-grow-x-rev rounded-l-md bg-[var(--accent-coral)]"
                      : "ap-grow-x rounded-r-md bg-[var(--primary)]",
                  )}
                  style={{
                    left: `${loss ? zero - width : zero}%`,
                    width: `${width}%`,
                    animationDelay: `${index * 70}ms`,
                  }}
                />
              </div>
              <span className={cn("tnum text-right font-semibold", loss && "text-[var(--accent-coral)]")}>
                {compactMoney(client.profit)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-[minmax(5rem,7.5rem)_minmax(0,1fr)_5.5rem] gap-3 text-xs text-[var(--muted)]" aria-hidden="true">
        <span />
        <div className="tnum relative h-4">
          {maxLoss > 0 ? <span className="absolute left-0">{compactMoney(-maxLoss)}</span> : null}
          <span className="absolute -translate-x-1/2" style={{ left: `${zero}%` }}>
            0
          </span>
          {maxGain > 0 ? <span className="absolute right-0">{compactMoney(maxGain)}</span> : null}
        </div>
        <span />
      </div>
    </div>
  );
}

/** Cost per hour against what each hour earned, one row per project. */
function RateChart({ rows }: { rows: ProfitabilityProjectRow[] }) {
  const data = rows
    .filter((row) => row.hours > 0 && row.cost_per_hour !== null)
    .map((row) => ({ id: row.id, name: row.name, cost: row.cost_per_hour ?? 0, earned: row.revenue_per_hour ?? 0 }))
    .sort((a, b) => b.earned - a.earned);

  if (data.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No costed hours in this period.</p>;
  }

  const top = Math.max(...data.map((d) => Math.max(d.cost, d.earned)));
  const step = top > 4000 ? 2000 : 1000;
  const max = Math.max(step, Math.ceil((top * 1.05) / step) * step);
  const at = (value: number) => (value / max) * 100;
  const summary = `Per hour, cost against earnings: ${data
    .map((d) => `${d.name} ${money(d.cost)} against ${d.earned > 0 ? money(d.earned) : "nothing"}`)
    .join("; ")}.`;

  return (
    <div className="flex flex-col gap-4">
      <div role="img" aria-label={summary} className="flex flex-col gap-3">
        {data.map((d, index) => {
          const good = d.earned > d.cost;
          const lo = Math.min(at(d.cost), at(d.earned));
          const hi = Math.max(at(d.cost), at(d.earned));
          return (
            <div key={d.id} className="grid grid-cols-[minmax(5rem,9rem)_minmax(0,1fr)_4.25rem] items-center gap-3 text-sm">
              <span className="truncate">{d.name}</span>
              <div className="relative h-[1.375rem]">
                <span className="absolute inset-x-0 top-[10px] h-0.5 rounded bg-[var(--border-subtle)]" aria-hidden="true" />
                <span
                  className={cn(
                    "ap-grow-x absolute top-[9px] h-1 rounded-full",
                    good ? "bg-[var(--primary)]/35" : "bg-[var(--accent-coral)]/35",
                  )}
                  style={{ left: `${lo}%`, width: `${hi - lo}%`, animationDelay: `${index * 70}ms` }}
                  aria-hidden="true"
                />
                <span
                  className="absolute top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-[var(--foreground)] ring-[3px] ring-[var(--card)]"
                  style={{ left: `${at(d.cost)}%` }}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "ap-pop absolute top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full ring-[3px] ring-[var(--card)]",
                    good ? "bg-[var(--primary)]" : "bg-[var(--accent-coral)]",
                  )}
                  style={{ left: `${at(d.earned)}%`, animationDelay: `${300 + index * 70}ms` }}
                  aria-hidden="true"
                />
              </div>
              <span className={cn("tnum text-right font-semibold", !good && "text-[var(--accent-coral)]")}>
                {Math.round(d.earned).toLocaleString("en-PK")}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]">
        <span className="flex flex-wrap gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--foreground)]" aria-hidden="true" />
            Cost per hour
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" aria-hidden="true" />
            Earned per hour
          </span>
        </span>
        <span className="tnum">
          Rs. 0 – {money(max)} per hour
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

const th = cn(ledgerTable.th, "whitespace-nowrap");
const thNum = cn(ledgerTable.th, "whitespace-nowrap text-right");
const tdNum = cn(ledgerTable.td, "tnum whitespace-nowrap text-right");

/** Problems first: over budget, at risk, losing money; then the best earners. */
function projectRank(row: ProfitabilityProjectRow): number {
  if (row.budget.status === "over_budget") return 0;
  if (row.budget.status === "at_risk") return 1;
  if (row.profit < 0) return 2;
  return 3;
}

function ProjectsTable({ rows, totals }: { rows: ProfitabilityProjectRow[]; totals: ProfitabilityReport["totals"] }) {
  if (rows.length === 0) {
    return <p className="px-5 py-6 text-sm text-[var(--muted)] sm:px-7">No projects yet.</p>;
  }

  const sorted = [...rows].sort((a, b) => {
    const rank = projectRank(a) - projectRank(b);
    if (rank !== 0) return rank;
    return projectRank(a) < 3 ? a.profit - b.profit : b.profit - a.profit;
  });

  return (
    <div className={ledgerTable.wrap}>
      <table className={cn(ledgerTable.table, "min-w-[58rem]")}>
        <thead className={ledgerTable.thead}>
          <tr>
            <th scope="col" className={th}>Project</th>
            <th scope="col" className={thNum}>Hours</th>
            <th scope="col" className={thNum}>Revenue</th>
            <th scope="col" className={thNum}>Cost</th>
            <th scope="col" className={thNum}>Profit</th>
            <th scope="col" className={th}>Margin</th>
            <th scope="col" className={th}>Budget</th>
          </tr>
        </thead>
        <tbody className={ledgerTable.tbody}>
          {sorted.map((row) => (
            <tr key={row.id} className={ledgerTable.rowHover}>
              <td className={ledgerTable.td}>
                <p className="font-medium text-[var(--foreground)]">{row.name}</p>
                <p className="tnum text-[0.8125rem] text-[var(--muted)]">
                  {row.client_name} · {BILLING_LABEL[row.billing_type]}
                  {row.billing_type === "hourly" && row.bill_rate ? ` · ${money(row.bill_rate)}/h` : ""}
                  {row.billing_type === "fixed" && row.hours > 0 && row.revenue === 0 && row.budget.status === "over_budget" ? (
                    <span className="text-[var(--accent-coral)]"> · fee used up, extra hours unbilled</span>
                  ) : null}
                  {row.missing_bill_rate ? <span className="text-[var(--accent-copper)]"> · no bill rate</span> : null}
                </p>
              </td>
              <td className={tdNum}>{hours(row.hours)}</td>
              <td className={tdNum}>{money(row.revenue)}</td>
              <td className={tdNum}>{money(row.cost)}</td>
              <td className={cn(ledgerTable.td, "whitespace-nowrap text-right")}>
                <ProfitText value={row.profit} />
              </td>
              <td className={ledgerTable.td}>
                <MarginBar value={row.margin_percent} />
              </td>
              <td className={ledgerTable.td}>
                <BudgetCell row={row} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--foreground)] font-semibold">
            <td className={ledgerTable.td}>Total</td>
            <td className={tdNum}>{hours(totals.hours)}</td>
            <td className={tdNum}>{money(totals.revenue)}</td>
            <td className={tdNum}>{money(totals.cost)}</td>
            <td className={cn(ledgerTable.td, "whitespace-nowrap text-right")}>
              <ProfitText value={totals.profit} />
            </td>
            <td className={cn(ledgerTable.td, "tnum")}>{percent(totals.margin_percent)}</td>
            <td className={cn(ledgerTable.td, "text-[0.8125rem] font-normal text-[var(--muted)]")}>
              {totals.projects_over_budget + totals.projects_at_risk > 0
                ? `${totals.projects_over_budget} over budget · ${totals.projects_at_risk} at risk`
                : "No budgets at risk"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ClientsTable({ rows }: { rows: ProfitabilityReport["clients"] }) {
  if (rows.length === 0) {
    return <p className="px-5 py-6 text-sm text-[var(--muted)] sm:px-7">No client work in this period.</p>;
  }
  const sorted = [...rows].sort((a, b) => b.profit - a.profit);

  return (
    <div className={ledgerTable.wrap}>
      <table className={cn(ledgerTable.table, "min-w-[46rem]")}>
        <thead className={ledgerTable.thead}>
          <tr>
            <th scope="col" className={th}>Client</th>
            <th scope="col" className={thNum}>Projects</th>
            <th scope="col" className={thNum}>Hours</th>
            <th scope="col" className={thNum}>Revenue</th>
            <th scope="col" className={thNum}>Cost</th>
            <th scope="col" className={thNum}>Profit</th>
            <th scope="col" className={th}>Margin</th>
          </tr>
        </thead>
        <tbody className={ledgerTable.tbody}>
          {sorted.map((row) => (
            <tr key={row.client_name} className={ledgerTable.rowHover}>
              <td className={cn(ledgerTable.td, "font-medium text-[var(--foreground)]")}>
                {row.client_name}
                {row.internal ? <span className="ml-2 text-xs font-normal text-[var(--muted)]">not billed</span> : null}
              </td>
              <td className={tdNum}>{row.projects_count}</td>
              <td className={tdNum}>{hours(row.hours)}</td>
              <td className={tdNum}>{money(row.revenue)}</td>
              <td className={tdNum}>{money(row.cost)}</td>
              <td className={cn(ledgerTable.td, "whitespace-nowrap text-right")}>
                <ProfitText value={row.profit} />
              </td>
              <td className={ledgerTable.td}>
                <MarginBar value={row.margin_percent} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmployeesTable({ rows }: { rows: ProfitabilityReport["employees"] }) {
  if (rows.length === 0) {
    return <p className="px-5 py-6 text-sm text-[var(--muted)] sm:px-7">No project hours logged in this period.</p>;
  }
  const sorted = [...rows].sort((a, b) => b.profit - a.profit);

  return (
    <div className={ledgerTable.wrap}>
      <table className={cn(ledgerTable.table, "min-w-[48rem]")}>
        <thead className={ledgerTable.thead}>
          <tr>
            <th scope="col" className={th}>Person</th>
            <th scope="col" className={thNum}>Hours</th>
            <th scope="col" className={thNum}>Cost / hour</th>
            <th scope="col" className={thNum}>Revenue earned</th>
            <th scope="col" className={thNum}>Cost</th>
            <th scope="col" className={thNum}>Profit</th>
            <th scope="col" className={th}>Margin</th>
          </tr>
        </thead>
        <tbody className={ledgerTable.tbody}>
          {sorted.map((row) => (
            <tr key={row.user_id} className={ledgerTable.rowHover}>
              <td className={ledgerTable.td}>
                <p className="font-medium text-[var(--foreground)]">{row.name}</p>
                {!row.has_salary_contract ? (
                  <p className="text-xs text-[var(--accent-copper)]">No salary contract</p>
                ) : row.unpriced_hours > 0 ? (
                  <p className="tnum text-xs text-[var(--accent-copper)]">{hours(row.unpriced_hours)} without a contract</p>
                ) : null}
              </td>
              <td className={tdNum}>{hours(row.hours)}</td>
              <td className={tdNum}>{money(row.cost_per_hour)}</td>
              <td className={tdNum}>{money(row.revenue)}</td>
              <td className={tdNum}>{money(row.cost)}</td>
              <td className={cn(ledgerTable.td, "whitespace-nowrap text-right")}>
                {row.has_salary_contract ? <ProfitText value={row.profit} /> : <span className="text-[var(--muted)]">—</span>}
              </td>
              <td className={ledgerTable.td}>
                <MarginBar value={row.has_salary_contract ? row.margin_percent : null} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Tab = "projects" | "clients" | "people";

function Breakdown({ report }: { report: ProfitabilityReport }) {
  const [tab, setTab] = useState<Tab>("projects");
  const baseId = useId();
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "projects", label: "Projects", count: report.projects.length },
    { id: "clients", label: "Clients", count: report.clients.length },
    { id: "people", label: "People", count: report.employees.length },
  ];

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    setTab(next.id);
    document.getElementById(`${baseId}-tab-${next.id}`)?.focus();
  }

  const note: Record<Tab, string> = {
    projects: "Budget burn is lifetime; the tick marks how much of the timeline has passed.",
    clients: "Internal work is overhead, so it is not counted as a losing client.",
    people: "Revenue earned follows each person's share of hours on a project.",
  };

  return (
    <Card className="overflow-hidden" aria-label="Breakdown">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-[var(--border)] px-5 sm:px-7">
        <div role="tablist" aria-label="Break down by" className="flex gap-6">
          {tabs.map((item, index) => {
            const selected = tab === item.id;
            return (
              <button
                key={item.id}
                id={`${baseId}-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${baseId}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(item.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={cn(
                  "relative min-h-12 text-[0.9375rem] font-medium transition-colors",
                  selected ? "text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {item.label} <span className="tnum font-normal text-[var(--muted-foreground)]">{item.count}</span>
                <span
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-0.5 origin-left rounded-full bg-[var(--primary)] transition-transform duration-300",
                    selected ? "scale-x-100" : "scale-x-0",
                  )}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
        <p className="py-2 text-[0.8125rem] text-[var(--muted)]">{note[tab]}</p>
      </div>
      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${tab}`} key={tab} className="ap-fade">
        {tab === "projects" ? <ProjectsTable rows={report.projects} totals={report.totals} /> : null}
        {tab === "clients" ? <ClientsTable rows={report.clients} /> : null}
        {tab === "people" ? <EmployeesTable rows={report.employees} /> : null}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function SkeletonBlock({ className }: { className: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-[var(--accent-sand)]", className)} />;
}

export function ProfitabilityView() {
  const { financialUnlocked } = usePayrollVault();
  const [range, setRange] = useState<ReportDateRange>(() => presetDateRange("month"));
  const [report, setReport] = useState<ProfitabilityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!financialUnlocked) return;
    let cancelled = false;

    fetchProfitabilityReport(range)
      .then((result) => {
        if (cancelled) return;
        setReport(result);
        setError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? formatApiErrors(err.errors) || err.message
            : "Couldn't load the profitability report.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [financialUnlocked, range]);

  function changeRange(next: ReportDateRange) {
    setLoading(true);
    setRange(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.8125rem] text-[var(--muted)]">Insights</p>
          <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--foreground)]">
            Profitability
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--muted)]">
            {report ? `${longDate(report.range.start_date)} – ${longDate(report.range.end_date)} · ` : ""}
            every approved hour costed at the salary of the person who worked it.
          </p>
        </div>
        <div className="min-w-0 max-w-full">
          <ReportDateRangeFilter value={range} onChange={changeRange} />
        </div>
      </header>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {loading && !report ? (
        <div className="flex flex-col gap-6" aria-busy="true">
          <SkeletonBlock className="h-72" />
          <SkeletonBlock className="h-56" />
          <div className="grid gap-6 xl:grid-cols-2">
            <SkeletonBlock className="h-64" />
            <SkeletonBlock className="h-64" />
          </div>
        </div>
      ) : null}

      {report ? (
        <div className={cn("flex flex-col gap-6 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <Summary report={report} />
          <AttentionList report={report} />

          <div className="grid gap-6 xl:grid-cols-2">
            <Card aria-labelledby="client-chart" className="flex flex-col gap-5 p-5 sm:p-7">
              <CardHeading id="client-chart" title="Profit by client" description="Loss to the left of zero, profit to the right." />
              {report.clients.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No client work in this period.</p>
              ) : (
                <ClientProfitChart clients={report.clients} />
              )}
            </Card>
            <Card aria-labelledby="rate-chart" className="flex flex-col gap-5 p-5 sm:p-7">
              <CardHeading
                id="rate-chart"
                title="Cost vs. earned, per hour"
                description="What an hour costs in salary, against what it brought in."
              />
              <RateChart rows={report.projects} />
            </Card>
          </div>

          <Breakdown report={report} />

          <p className="max-w-3xl text-[0.8125rem] leading-relaxed text-[var(--muted)]">
            Revenue is billable hours × the project&apos;s hourly rate, or the fixed fee once. Cost is hours × each
            person&apos;s salary ÷ their expected monthly hours.
          </p>
        </div>
      ) : null}
    </div>
  );
}
