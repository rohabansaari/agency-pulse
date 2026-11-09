"use client";

import { Metric } from "@/components/ledger/Metric";
import { Panel } from "@/components/ledger/Panel";
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
import {
  AlertTriangle,
  CircleCheck,
  Info,
  OctagonAlert,
  PiggyBank,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

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

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Whole rupees: paise only add noise to business totals. */
function money(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : formatPKR(Math.round(value));
}

function signedMoney(value: number): string {
  return value < 0 ? `−${money(Math.abs(value))}` : money(value);
}

const BILLING_LABEL: Record<ProjectBillingType, string> = {
  hourly: "Hourly",
  fixed: "Fixed fee",
  non_billable: "Internal",
};

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function ProfitText({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "tnum font-medium",
        value < 0 ? "text-[var(--accent-coral)]" : value > 0 ? "text-[var(--accent-emerald)]" : "text-[var(--muted)]",
      )}
    >
      {signedMoney(value)}
    </span>
  );
}

function MarginPill({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-[0.8125rem] text-[var(--muted)]">—</span>;
  }

  const tone =
    value < 0
      ? "bg-[var(--accent-coral-soft)] text-[var(--accent-coral)]"
      : value < 20
        ? "bg-[var(--accent-copper-soft)] text-[var(--accent-copper)]"
        : "bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]";

  return <span className={cn("tnum inline-flex rounded-full px-2.5 py-1 text-xs font-medium", tone)}>{percent(value)}</span>;
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
      <Link href="/projects" className="text-[0.8125rem] text-[var(--muted)] underline-offset-2 hover:underline">
        Set a budget
      </Link>
    );
  }

  const burn = budget.burn_percent ?? 0;

  return (
    <div className="min-w-[11rem]">
      <div className="flex items-center justify-between gap-2 text-[0.8125rem]">
        <span className={cn("font-medium", style.text)}>{style.label}</span>
        <span className="tnum text-[var(--muted)]">
          {hours(budget.used_hours)} / {hours(budget.budget_hours ?? 0)}
        </span>
      </div>
      <div className="relative mt-1.5 h-1.5 rounded-full bg-[var(--border-subtle)]" aria-hidden="true">
        <div className={cn("h-1.5 rounded-full", style.bar)} style={{ width: `${Math.min(100, burn)}%` }} />
        {budget.elapsed_percent !== null ? (
          <span
            className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-[var(--foreground)]/60"
            style={{ left: `${Math.min(100, budget.elapsed_percent)}%` }}
            title={`${percent(budget.elapsed_percent)} of the time elapsed`}
          />
        ) : null}
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {percent(budget.burn_percent)} used
        {budget.elapsed_percent !== null ? ` · ${percent(budget.elapsed_percent)} of time gone` : ""}
        {budget.forecast_exhausted_on ? ` · runs out ${shortDate(budget.forecast_exhausted_on)}` : ""}
      </p>
    </div>
  );
}

const INSIGHT_STYLE: Record<ProfitabilityInsight["severity"], { icon: ReactNode; className: string }> = {
  critical: {
    icon: <OctagonAlert className="h-4 w-4" />,
    className: "border-[var(--accent-coral)]/30 bg-[var(--accent-coral-soft)] text-[var(--accent-coral)]",
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4" />,
    className: "border-[var(--accent-copper)]/30 bg-[var(--accent-copper-soft)] text-[var(--accent-copper)]",
  },
  info: {
    icon: <Info className="h-4 w-4" />,
    className: "border-[var(--border)] bg-[var(--accent-sand)]/60 text-[var(--muted)]",
  },
  positive: {
    icon: <CircleCheck className="h-4 w-4" />,
    className: "border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]",
  },
};

function InsightList({ insights }: { insights: ProfitabilityInsight[] }) {
  if (insights.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Nothing needs your attention in this period.</p>;
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {insights.map((insight, index) => {
        const style = INSIGHT_STYLE[insight.severity];
        return (
          <li
            key={`${insight.title}-${index}`}
            className={cn("flex gap-3 rounded-xl border px-4 py-3", style.className)}
          >
            <span className="mt-0.5 shrink-0" aria-hidden="true">
              {style.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--foreground)]">{insight.title}</p>
              <p className="mt-0.5 text-[0.8125rem] text-[var(--muted)]">{insight.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Profit per client as a diverging bar: losses left of the axis, profit right. */
function ClientProfitChart({ clients }: { clients: ProfitabilityReport["clients"] }) {
  const max = Math.max(1, ...clients.map((client) => Math.abs(client.profit)));
  const summary = `Profit by client: ${clients
    .map((client) => `${client.client_name} ${signedMoney(client.profit)}`)
    .join(", ")}.`;

  return (
    <div role="img" aria-label={summary} className="flex flex-col gap-3">
      {clients.map((client) => {
        const width = (Math.abs(client.profit) / max) * 50;
        const loss = client.profit < 0;
        return (
          <div key={client.client_name} className="grid grid-cols-[minmax(6rem,28%)_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate text-[var(--foreground)]">{client.client_name}</span>
            <div className="relative h-3 rounded-md bg-[var(--accent-sand)]">
              <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--border)]" aria-hidden="true" />
              <div
                className={cn(
                  "absolute inset-y-0 rounded-md",
                  loss ? "bg-[var(--accent-coral)]" : "bg-[var(--accent-emerald)]",
                )}
                style={loss ? { right: "50%", width: `${width}%` } : { left: "50%", width: `${width}%` }}
              />
            </div>
            <span className="w-28 text-right text-[0.8125rem]">
              <ProfitText value={client.profit} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="px-5 pb-6 text-sm text-[var(--muted)]">{children}</p>;
}

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

function ProjectsTable({ rows }: { rows: ProfitabilityProjectRow[] }) {
  if (rows.length === 0) {
    return <EmptyLine>No projects yet.</EmptyLine>;
  }

  return (
    <div className={ledgerTable.wrap}>
      <table className={cn(ledgerTable.table, "min-w-[56rem]")}>
        <thead className={ledgerTable.thead}>
          <tr>
            <th scope="col" className={ledgerTable.th}>Project</th>
            <th scope="col" className={cn(ledgerTable.th, "whitespace-nowrap text-right")}>Hours</th>
            <th scope="col" className={cn(ledgerTable.th, "whitespace-nowrap text-right")}>Revenue</th>
            <th scope="col" className={cn(ledgerTable.th, "whitespace-nowrap text-right")}>Cost</th>
            <th scope="col" className={cn(ledgerTable.th, "whitespace-nowrap text-right")}>Profit</th>
            <th scope="col" className={ledgerTable.th}>Margin</th>
            <th scope="col" className={ledgerTable.th}>Budget</th>
          </tr>
        </thead>
        <tbody className={ledgerTable.tbody}>
          {rows.map((row) => (
            <tr key={row.id} className={ledgerTable.rowHover}>
              <td className={ledgerTable.td}>
                <p className="font-medium text-[var(--foreground)]">{row.name}</p>
                <p className="text-[0.8125rem] text-[var(--muted)]">
                  {row.client_name} · {BILLING_LABEL[row.billing_type]}
                  {row.billing_type === "hourly" && row.bill_rate ? ` · ${money(row.bill_rate)}/h` : ""}
                  {row.billing_type === "fixed" && row.hours > 0 && row.revenue === 0 && row.budget.status === "over_budget" ? (
                    <span className="ml-1 text-[var(--accent-coral)]">· fee used up, extra hours unbilled</span>
                  ) : null}
                  {row.missing_bill_rate ? (
                    <span className="ml-1 text-[var(--accent-copper)]">· no bill rate</span>
                  ) : null}
                </p>
              </td>
              <td className={cn(ledgerTable.td, "tnum whitespace-nowrap text-right")}>{hours(row.hours)}</td>
              <td className={cn(ledgerTable.td, "tnum whitespace-nowrap text-right")}>{money(row.revenue)}</td>
              <td className={cn(ledgerTable.td, "tnum whitespace-nowrap text-right")}>{money(row.cost)}</td>
              <td className={cn(ledgerTable.td, "whitespace-nowrap text-right")}>
                <ProfitText value={row.profit} />
              </td>
              <td className={ledgerTable.td}>
                <MarginPill value={row.margin_percent} />
              </td>
              <td className={ledgerTable.td}>
                <BudgetCell row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClientsTable({ rows }: { rows: ProfitabilityReport["clients"] }) {
  return (
    <div className={ledgerTable.wrap}>
      <table className={cn(ledgerTable.table, "min-w-[40rem]")}>
        <thead className={ledgerTable.thead}>
          <tr>
            <th scope="col" className={ledgerTable.th}>Client</th>
            <th scope="col" className={cn(ledgerTable.th, "whitespace-nowrap text-right")}>Projects</th>
            <th scope="col" className={cn(ledgerTable.th, "whitespace-nowrap text-right")}>Hours</th>
            <th scope="col" className={cn(ledgerTable.th, "whitespace-nowrap text-right")}>Revenue</th>
            <th scope="col" className={cn(ledgerTable.th, "whitespace-nowrap text-right")}>Cost</th>
            <th scope="col" className={cn(ledgerTable.th, "whitespace-nowrap text-right")}>Profit</th>
            <th scope="col" className={ledgerTable.th}>Margin</th>
          </tr>
        </thead>
        <tbody className={ledgerTable.tbody}>
          {rows.map((row) => (
            <tr key={row.client_name} className={ledgerTable.rowHover}>
              <td className={cn(ledgerTable.td, "font-medium text-[var(--foreground)]")}>{row.client_name}</td>
              <td className={cn(ledgerTable.td, "tnum whitespace-nowrap text-right")}>{row.projects_count}</td>
              <td className={cn(ledgerTable.td, "tnum whitespace-nowrap text-right")}>{hours(row.hours)}</td>
              <td className={cn(ledgerTable.td, "tnum whitespace-nowrap text-right")}>{money(row.revenue)}</td>
              <td className={cn(ledgerTable.td, "tnum whitespace-nowrap text-right")}>{money(row.cost)}</td>
              <td className={cn(ledgerTable.td, "whitespace-nowrap text-right")}>
                <ProfitText value={row.profit} />
              </td>
              <td className={ledgerTable.td}>
                <MarginPill value={row.margin_percent} />
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
    return <EmptyLine>No project hours logged in this period.</EmptyLine>;
  }

  return (
    <div className={ledgerTable.wrap}>
      <table className={cn(ledgerTable.table, "min-w-[44rem]")}>
        <thead className={ledgerTable.thead}>
          <tr>
            <th scope="col" className={ledgerTable.th}>Employee</th>
            <th scope="col" className={cn(ledgerTable.th, "whitespace-nowrap text-right")}>Hours</th>
            <th scope="col" className={cn(ledgerTable.th, "whitespace-nowrap text-right")}>Cost / hour</th>
            <th scope="col" className={cn(ledgerTable.th, "whitespace-nowrap text-right")}>Revenue earned</th>
            <th scope="col" className={cn(ledgerTable.th, "whitespace-nowrap text-right")}>Cost</th>
            <th scope="col" className={cn(ledgerTable.th, "whitespace-nowrap text-right")}>Profit</th>
            <th scope="col" className={ledgerTable.th}>Margin</th>
          </tr>
        </thead>
        <tbody className={ledgerTable.tbody}>
          {rows.map((row) => (
            <tr key={row.user_id} className={ledgerTable.rowHover}>
              <td className={ledgerTable.td}>
                <p className="font-medium text-[var(--foreground)]">{row.name}</p>
                {!row.has_salary_contract ? (
                  <p className="text-xs text-[var(--accent-copper)]">No salary contract</p>
                ) : row.unpriced_hours > 0 ? (
                  <p className="text-xs text-[var(--accent-copper)]">{hours(row.unpriced_hours)} without a contract</p>
                ) : null}
              </td>
              <td className={cn(ledgerTable.td, "tnum whitespace-nowrap text-right")}>{hours(row.hours)}</td>
              <td className={cn(ledgerTable.td, "tnum whitespace-nowrap text-right")}>{money(row.cost_per_hour)}</td>
              <td className={cn(ledgerTable.td, "tnum whitespace-nowrap text-right")}>{money(row.revenue)}</td>
              <td className={cn(ledgerTable.td, "tnum whitespace-nowrap text-right")}>{money(row.cost)}</td>
              <td className={cn(ledgerTable.td, "whitespace-nowrap text-right")}>
                {row.has_salary_contract ? <ProfitText value={row.profit} /> : <span className="text-[var(--muted)]">—</span>}
              </td>
              <td className={ledgerTable.td}>
                <MarginPill value={row.has_salary_contract ? row.margin_percent : null} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

  const totals = report?.totals;
  const clientsWithWork = report?.clients ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.8125rem] text-[var(--muted)]">Insights</p>
          <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--foreground)]">
            Profitability
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--muted)]">
            What each project, client and person earned against what their time cost, using approved hours and real
            salary data.
          </p>
        </div>
        <div className="min-w-0 max-w-full">
          <ReportDateRangeFilter value={range} onChange={changeRange} />
        </div>
      </header>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {loading && !report ? (
        <div className="flex flex-col gap-6" aria-busy="true">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <SkeletonBlock key={index} className="h-[7.5rem]" />
            ))}
          </div>
          <SkeletonBlock className="h-40" />
          <SkeletonBlock className="h-72" />
        </div>
      ) : null}

      {report && totals ? (
        <div className={cn("flex flex-col gap-6 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Revenue"
              value={money(totals.revenue)}
              icon={<Receipt className="h-4 w-4" />}
              detail={`${hours(totals.billable_hours)} billable of ${hours(totals.hours)}`}
            />
            <Metric
              label="Salary cost"
              value={money(totals.cost)}
              icon={<Wallet className="h-4 w-4" />}
              detail={totals.unpriced_hours > 0 ? `${hours(totals.unpriced_hours)} not costed` : "All hours costed"}
            />
            <Metric
              label="Profit"
              value={signedMoney(totals.profit)}
              icon={<PiggyBank className="h-4 w-4" />}
              tone={totals.profit < 0 ? "attention" : "default"}
              detail={
                totals.projects_over_budget + totals.projects_at_risk > 0
                  ? `${totals.projects_over_budget} over budget · ${totals.projects_at_risk} at risk`
                  : "No budgets at risk"
              }
            />
            <Metric
              label="Margin"
              value={percent(totals.margin_percent)}
              icon={<TrendingUp className="h-4 w-4" />}
              progress={totals.margin_percent !== null ? Math.max(0, totals.margin_percent) : undefined}
              detail={`${percent(totals.billable_percent)} of hours billable`}
            />
          </section>

          <Panel title="What needs attention" description="Generated from this period's numbers.">
            <InsightList insights={report.insights} />
          </Panel>

          <Panel
            title="Projects"
            description="Budget burn is lifetime; the marker shows how much of the timeline has passed."
            flush
          >
            <ProjectsTable rows={report.projects} />
          </Panel>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Panel title="Profit by client">
              {clientsWithWork.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No client work in this period.</p>
              ) : (
                <ClientProfitChart clients={clientsWithWork} />
              )}
            </Panel>
            <Panel title="Clients" flush>
              {clientsWithWork.length === 0 ? (
                <EmptyLine>No client work in this period.</EmptyLine>
              ) : (
                <ClientsTable rows={clientsWithWork} />
              )}
            </Panel>
          </div>

          <Panel
            title="People"
            description="Revenue earned follows each person's share of hours on a project."
            flush
          >
            <EmployeesTable rows={report.employees} />
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
