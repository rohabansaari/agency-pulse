"use client";

import { LeaveDateInput } from "@/components/leave/LeaveDateInput";
import {
  ApiError,
  createPayrollRun,
  deletePayrollRun,
  fetchPayrollRun,
  fetchPayrollRuns,
  finalizePayrollRun,
  formatApiErrors,
  lockPayrollRun,
  recalculatePayrollRun,
  updatePayrollRun,
} from "@/lib/api";
import { formatDuration } from "@/lib/time";
import type { PayrollRun, PayrollRunStatus } from "@/lib/types";
import { PayrollNav } from "@/components/payroll/PayrollNav";
import { PageTransition } from "@/components/motion/PageTransition";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePayrollVault } from "@/components/payroll/PayrollVaultProvider";
import { PayrollSettingsPanel } from "@/components/payroll/PayrollSettingsPanel";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import {
  PAYROLL_RUNS_EXPORT_COLUMNS,
  PAYROLL_SUMMARY_EXPORT_COLUMNS,
} from "@/lib/export-columns";
import {
  presetDateRange,
  ReportDateRangeFilter,
  type ReportDateRange,
} from "@/components/reports/ReportDateRangeFilter";
import { MoneyAmount } from "@/components/ui/MoneyAmount";
import { PayrollEmployeeLines } from "@/components/payroll/PayrollEmployeeLines";
import { PayrollRunStepper } from "@/components/payroll/PayrollRunStepper";
import { Metric } from "@/components/ledger/Metric";
import { Panel } from "@/components/ledger/Panel";
import { ledgerTable, rowButton } from "@/components/ledger/table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert, EmptyState, Spinner } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { CalendarRange, ChevronDown, Lock, ShieldCheck } from "lucide-react";
import { formatPKR } from "@/lib/currency";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

const STATUS_LABEL: Record<PayrollRunStatus, string> = {
  draft: "Draft",
  finalized: "Finalized",
  locked: "Locked · secured",
};

const STATUS_VARIANT: Record<PayrollRunStatus, "default" | "warning" | "success"> = {
  draft: "default",
  finalized: "warning",
  locked: "success",
};

function StatusBadge({ status }: { status: PayrollRunStatus }) {
  return (
    <span title={status === "locked" ? "Secured audit record — immutable" : undefined}>
      <Badge variant={STATUS_VARIANT[status]} className="gap-1 normal-case">
        {status === "locked" ? <Lock className="h-3 w-3" aria-hidden="true" /> : null}
        {STATUS_LABEL[status]}
      </Badge>
    </span>
  );
}

function formatRunDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Sum of a run money field; null when any run hides it (masked or missing). */
function sumMoney(values: (string | null | undefined)[]): number | null {
  let total = 0;
  for (const value of values) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return null;
    total += parsed;
  }
  return total;
}

export function AdminPayrollPage() {
  const { financialUnlocked } = usePayrollVault();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actingId, setActingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [runDetails, setRunDetails] = useState<Record<number, PayrollRun>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null);
  const [editingRunId, setEditingRunId] = useState<number | null>(null);
  const [editPeriodStart, setEditPeriodStart] = useState("");
  const [editPeriodEnd, setEditPeriodEnd] = useState("");

  const [filterRange, setFilterRange] = useState<ReportDateRange>(() =>
    presetDateRange("month"),
  );

  const load = useCallback(async () => {
    setError("");
    try {
      setRuns(await fetchPayrollRuns(filterRange));
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Failed to load payroll runs.");
    } finally {
      setLoading(false);
    }
  }, [filterRange]);

  useEffect(() => {
    void load();
  }, [load, financialUnlocked]);

  async function toggleRunDetails(runId: number) {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }

    setExpandedRunId(runId);

    if (runDetails[runId]) {
      return;
    }

    setLoadingDetailId(runId);
    try {
      const detail = await fetchPayrollRun(runId);
      setRunDetails((current) => ({ ...current, [runId]: detail }));
    } catch (err) {
      setError(
        err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Failed to load payroll details.",
      );
      setExpandedRunId(null);
    } finally {
      setLoadingDetailId(null);
    }
  }

  const { payrollExportRows, payrollSummaryRows } = useMemo(() => {
    const rows: Record<string, string>[] = [];
    let totalNet = 0;
    let totalHoursSeconds = 0;
    let totalOvertimePay = 0;
    let employeeCount = 0;

    for (const run of runs) {
      const detail = runDetails[run.id];
      const records = detail?.employee_records ?? [];
      const period = `${run.period_start} – ${run.period_end}`;

      if (records.length === 0) {
        rows.push({
          employee_name: "—",
          period,
          total_hours: formatDuration(run.total_hours_snapshot),
          overtime_hours: "—",
          deductions: "—",
          gross_pay: "—",
          net_pay: "—",
          payroll_status: run.status,
        });
        totalHoursSeconds += run.total_hours_snapshot ?? 0;
        continue;
      }

      for (const record of records) {
        const masked = record.financial_data_masked || !financialUnlocked;
        const gross = masked ? 0 : Number(record.gross_salary_snapshot ?? 0);
        const net = masked ? 0 : Number(record.net_salary_snapshot ?? 0);
        const overtimePay = masked ? 0 : Number(record.overtime_pay_snapshot ?? 0);
        const deductions = masked ? "—" : (gross - net).toFixed(2);

        rows.push({
          employee_name: record.user_name ?? `User #${record.user_id}`,
          period,
          total_hours: formatDuration(record.payable_hours_seconds),
          overtime_hours: formatDuration(record.overtime_hours_seconds ?? 0),
          deductions: String(deductions),
          gross_pay: masked ? "—" : formatPKR(record.gross_salary_snapshot),
          net_pay: masked ? "—" : formatPKR(record.net_salary_snapshot),
          payroll_status: run.status,
        });

        if (!masked) {
          totalNet += net;
          totalOvertimePay += overtimePay;
        }
        totalHoursSeconds += record.payable_hours_seconds ?? 0;
        employeeCount += 1;
      }
    }

    const summary = [
      { metric: "Total Payroll Cost", value: financialUnlocked ? totalNet.toFixed(2) : "—" },
      { metric: "Total Employees", value: String(employeeCount) },
      { metric: "Total Hours", value: formatDuration(totalHoursSeconds) },
      { metric: "Total Overtime Cost", value: financialUnlocked ? totalOvertimePay.toFixed(2) : "—" },
    ];

    return { payrollExportRows: rows, payrollSummaryRows: summary };
  }, [runs, runDetails, financialUnlocked]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const response = await createPayrollRun({
        period_start: periodStart,
        period_end: periodEnd,
      });
      setSuccess(response.message);
      setPeriodStart("");
      setPeriodEnd("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Failed to create payroll run.");
    } finally {
      setCreating(false);
    }
  }

  async function runAction(
    id: number,
    action: "finalize" | "lock" | "recalculate" | "delete",
  ) {
    setActingId(id);
    setError("");
    setSuccess("");

    try {
      if (action === "delete") {
        if (!window.confirm("Delete this draft payroll run? This cannot be undone.")) {
          return;
        }
        const response = await deletePayrollRun(id);
        setSuccess(response.message);
        setExpandedRunId(null);
        setRunDetails((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        if (editingRunId === id) {
          setEditingRunId(null);
        }
      } else {
        const response =
          action === "finalize"
            ? await finalizePayrollRun(id)
            : action === "lock"
              ? await lockPayrollRun(id)
              : await recalculatePayrollRun(id);
        setSuccess(response.message);
        setRunDetails((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
      }
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : `Failed to ${action} payroll run.`,
      );
    } finally {
      setActingId(null);
    }
  }

  function startEditRun(run: PayrollRun) {
    setEditingRunId(run.id);
    setEditPeriodStart(run.period_start);
    setEditPeriodEnd(run.period_end);
    setError("");
    setSuccess("");
  }

  async function handleEditRun(event: React.FormEvent) {
    event.preventDefault();
    if (!editingRunId) {
      return;
    }

    setActingId(editingRunId);
    setError("");
    setSuccess("");

    try {
      const response = await updatePayrollRun(editingRunId, {
        period_start: editPeriodStart,
        period_end: editPeriodEnd,
      });
      setSuccess(response.message);
      setEditingRunId(null);
      setRunDetails((current) => {
        const next = { ...current };
        delete next[editingRunId];
        return next;
      });
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to update payroll run.",
      );
    } finally {
      setActingId(null);
    }
  }


  const totals = useMemo(() => {
    const counts: Record<PayrollRunStatus, number> = { draft: 0, finalized: 0, locked: 0 };
    let hoursSeconds = 0;
    for (const run of runs) {
      counts[run.status] += 1;
      hoursSeconds += run.total_hours_snapshot ?? 0;
    }
    const visible = financialUnlocked && !runs.some((run) => run.financial_data_masked);
    return {
      counts,
      hoursSeconds,
      gross: visible ? sumMoney(runs.map((run) => run.total_gross_snapshot)) : null,
      net: visible ? sumMoney(runs.map((run) => run.total_net_snapshot)) : null,
    };
  }, [runs, financialUnlocked]);

  const moneyHidden = financialUnlocked ? "Not available" : "Unlock vault to view";

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Payroll"
          title="Payroll runs"
          description="Manage payroll runs, organization settings, and compensation snapshots."
          actions={
            <>
              {financialUnlocked ? (
                <Badge variant="success" className="min-h-8 gap-1.5 px-3 normal-case">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Vault unlocked
                </Badge>
              ) : (
                <Badge variant="warning" className="min-h-8 gap-1.5 px-3 normal-case">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  Vault locked
                </Badge>
              )}
              <ExportDropdown
                filename="payroll-runs"
                formats={["csv", "xlsx", "pdf"]}
                columns={PAYROLL_RUNS_EXPORT_COLUMNS}
                rows={payrollExportRows}
                extraSheets={[
                  {
                    name: "Summary",
                    columns: PAYROLL_SUMMARY_EXPORT_COLUMNS,
                    rows: payrollSummaryRows,
                  },
                ]}
              />
            </>
          }
        />
        <PayrollNav />

        <ReportDateRangeFilter value={filterRange} onChange={setFilterRange} disabled={loading} />

        {error ? <Alert variant="error">{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Runs in range"
            value={runs.length}
            detail={`${totals.counts.draft} draft · ${totals.counts.finalized} finalized · ${totals.counts.locked} locked`}
          />
          <Metric
            label="Total hours"
            value={<span className="num">{formatDuration(totals.hoursSeconds)}</span>}
            detail="Snapshot across runs"
          />
          <Metric
            label="Gross pay"
            value={totals.gross === null ? "—" : formatPKR(totals.gross)}
            detail={totals.gross === null ? moneyHidden : "PKR · all runs in range"}
          />
          <Metric
            label="Net payable"
            value={totals.net === null ? "—" : formatPKR(totals.net)}
            detail={totals.net === null ? moneyHidden : "PKR · after deductions"}
          />
        </div>

        <Panel
          title="New payroll run"
          description="Snapshots approved tracked time, manual entries, paid leave, and approved overtime for the selected period."
        >
          <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end" onSubmit={handleCreate}>
            <LeaveDateInput
              id="payroll-period-start"
              label="Period start"
              value={periodStart}
              onChange={setPeriodStart}
              hint="dd/mm/yyyy"
            />
            <LeaveDateInput
              id="payroll-period-end"
              label="Period end"
              value={periodEnd}
              onChange={setPeriodEnd}
              hint="dd/mm/yyyy"
            />
            <div className="sm:col-span-2 lg:col-span-1 lg:pb-6">
              <Button
                type="submit"
                size="lg"
                className="w-full sm:w-auto"
                disabled={creating || !periodStart || !periodEnd || !financialUnlocked}
              >
                {creating ? "Creating snapshot…" : "Create payroll run"}
              </Button>
            </div>
          </form>
        </Panel>

        <Panel
          title="Payroll history"
          description={
            <>
              Runs overlapping <span className="tnum">{filterRange.start_date} – {filterRange.end_date}</span> · amounts in PKR
            </>
          }
          flush
        >
          {loading ? (
            <Spinner label="Loading payroll runs…" />
          ) : runs.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState
                icon={CalendarRange}
                title="No payroll runs yet"
                description="Create a run for a period above to snapshot hours and pay."
              />
            </div>
          ) : (
            <div className={ledgerTable.wrap}>
              <table className={cn(ledgerTable.table, "min-w-[60rem]")}>
                <thead className={ledgerTable.thead}>
                  <tr>
                    <th scope="col" className={ledgerTable.th}>Period</th>
                    <th scope="col" className={ledgerTable.th}>Status</th>
                    <th scope="col" className={cn(ledgerTable.th, "text-right")}>Total hours</th>
                    <th scope="col" className={cn(ledgerTable.th, "text-right")}>Net pay</th>
                    <th scope="col" className={ledgerTable.th}>Created by</th>
                    <th scope="col" className={ledgerTable.th}>Generated</th>
                    <th scope="col" className={cn(ledgerTable.th, "text-right")}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={ledgerTable.tbody}>
                  {runs.map((run) => {
                    const detail = runDetails[run.id];
                    const isExpanded = expandedRunId === run.id;
                    const busy = actingId === run.id || !financialUnlocked;
                    const moneyMasked = Boolean(run.financial_data_masked) || !financialUnlocked;
                    const detailId = `payroll-run-detail-${run.id}`;

                    return (
                      <Fragment key={run.id}>
                        <tr className={cn(ledgerTable.rowHover, isExpanded && "bg-[var(--accent-sand)]/40")}>
                          <td className={cn(ledgerTable.td, "whitespace-nowrap font-medium text-[var(--foreground)]")}>
                            <span className="tnum">{run.period_start} – {run.period_end}</span>
                          </td>
                          <td className={ledgerTable.td}>
                            <StatusBadge status={run.status} />
                          </td>
                          <td className={cn(ledgerTable.td, "num text-right text-[var(--foreground)]")}>
                            {formatDuration(run.total_hours_snapshot)}
                          </td>
                          <td className={cn(ledgerTable.td, "text-right")}>
                            {moneyMasked ? (
                              <span className="text-[var(--muted)]">—</span>
                            ) : (
                              <MoneyAmount amount={run.total_net_snapshot} size="sm" />
                            )}
                          </td>
                          <td className={cn(ledgerTable.td, "text-[var(--muted)]")}>
                            {run.created_by_name ?? `User #${run.created_by}`}
                          </td>
                          <td className={cn(ledgerTable.td, "whitespace-nowrap text-[var(--muted)]")}>
                            {formatRunDate(run.created_at)}
                          </td>
                          <td className={ledgerTable.td}>
                            <div className="flex flex-wrap justify-end gap-1.5">
                              {run.status === "draft" ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => startEditRun(run)}
                                    className={rowButton}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void runAction(run.id, "recalculate")}
                                    className={rowButton}
                                  >
                                    Recalculate
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void runAction(run.id, "delete")}
                                    className={cn(
                                      rowButton,
                                      "border-[var(--accent-coral)]/30 bg-[var(--accent-coral-soft)] text-[var(--danger)] hover:bg-[var(--accent-coral)]/20",
                                    )}
                                  >
                                    Delete
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void runAction(run.id, "finalize")}
                                    className={cn(
                                      rowButton,
                                      "border-transparent bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]",
                                    )}
                                  >
                                    Finalize
                                  </button>
                                </>
                              ) : null}
                              {run.status === "finalized" ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void runAction(run.id, "lock")}
                                  className={cn(
                                    rowButton,
                                    "border-transparent bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]",
                                  )}
                                >
                                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                                  Lock
                                </button>
                              ) : null}
                              <button
                                type="button"
                                aria-expanded={isExpanded}
                                aria-controls={detailId}
                                onClick={() => void toggleRunDetails(run.id)}
                                className={rowButton}
                              >
                                {loadingDetailId === run.id
                                  ? "Loading…"
                                  : isExpanded
                                    ? "Hide"
                                    : "Details"}
                                <ChevronDown
                                  className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")}
                                  aria-hidden="true"
                                />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr id={detailId}>
                            <td colSpan={7} className="bg-[var(--accent-sand)]/40 p-0">
                              <div className="space-y-4 px-5 py-4">
                                <PayrollRunStepper run={run} />
                                {editingRunId === run.id ? (
                                  <form
                                    className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:grid-cols-2"
                                    onSubmit={handleEditRun}
                                  >
                                    <p className="text-sm font-semibold text-[var(--foreground)] sm:col-span-2">
                                      Edit run period
                                    </p>
                                    <LeaveDateInput
                                      id={`edit-period-start-${run.id}`}
                                      label="Period start"
                                      value={editPeriodStart}
                                      onChange={setEditPeriodStart}
                                      hint="dd/mm/yyyy"
                                    />
                                    <LeaveDateInput
                                      id={`edit-period-end-${run.id}`}
                                      label="Period end"
                                      value={editPeriodEnd}
                                      onChange={setEditPeriodEnd}
                                      hint="dd/mm/yyyy"
                                    />
                                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                                      <Button
                                        type="submit"
                                        size="lg"
                                        disabled={actingId === run.id || !financialUnlocked}
                                      >
                                        Save & recalculate
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="lg"
                                        onClick={() => setEditingRunId(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </form>
                                ) : null}
                              </div>
                              <div className="border-t border-[var(--border)] bg-[var(--card)]">
                                <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pb-3 pt-4">
                                  <h3 className="text-sm font-semibold text-[var(--foreground)]">Employees in this run</h3>
                                  <p className="text-[0.8125rem] text-[var(--muted)]">Amounts in PKR</p>
                                </div>
                                {loadingDetailId === run.id && !detail ? (
                                  <Spinner label="Loading employee lines…" />
                                ) : (
                                  <PayrollEmployeeLines
                                    records={detail?.employee_records}
                                    financialUnlocked={financialUnlocked}
                                  />
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <PayrollSettingsPanel />
      </div>
    </PageTransition>
  );
}
