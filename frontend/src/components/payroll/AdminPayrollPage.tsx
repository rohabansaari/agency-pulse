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
import type { PayrollRun, PayrollRunEmployeeRecord, PayrollRunStatus } from "@/lib/types";
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
import { PayrollBreakdown } from "@/components/payroll/PayrollBreakdown";
import { formatPKR } from "@/lib/currency";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

const STATUS_STYLES: Record<PayrollRunStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  finalized: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  locked: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
};

function StatusBadge({ status }: { status: PayrollRunStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
      title={status === "locked" ? "Secured audit record — immutable" : undefined}
    >
      {status === "locked" ? "locked · secured" : status}
    </span>
  );
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

  function renderEmployeeRecords(records: PayrollRunEmployeeRecord[] | undefined) {
    if (!records?.length) {
      return <p className="text-sm text-[var(--muted)]">No employee payroll records.</p>;
    }

    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {records.map((record) => {
          const masked = record.financial_data_masked || !financialUnlocked;
          return (
            <div key={record.id} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-heading text-sm font-semibold">
                  {record.user_name ?? `User #${record.user_id}`}
                </p>
                <span className="text-xs capitalize text-[var(--muted)]">{record.salary_type}</span>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Worked {formatDuration(record.regular_hours_seconds ?? record.payable_hours_seconds)}
                {record.overtime_hours_seconds
                  ? ` · OT ${formatDuration(record.overtime_hours_seconds)}`
                  : ""}
              </p>
              <PayrollBreakdown
                gross={record.gross_salary_snapshot}
                net={record.net_salary_snapshot}
                lines={record.adjustment_lines_snapshot}
                masked={masked}
              />
            </div>
          );
        })}
      </div>
    );
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

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Payroll"
          description="Manage payroll runs, organization settings, and compensation snapshots."
        />
        <PayrollNav />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ReportDateRangeFilter value={filterRange} onChange={setFilterRange} disabled={loading} />
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
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          {success}
        </div>
      ) : null}

      <PayrollSettingsPanel />

      <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Create payroll run
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Snapshots approved tracked time, manual entries, paid leave, and approved overtime for the selected period.
        </p>

        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleCreate}>
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
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating || !periodStart || !periodEnd || !financialUnlocked}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {creating ? "Creating snapshot…" : "Create payroll run"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Payroll history
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Runs overlapping {filterRange.start_date} – {filterRange.end_date}
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-zinc-500">Loading payroll runs…</p>
        ) : runs.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No payroll runs yet.</p>
        ) : (
          <div className="ui-table-wrap mt-4">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-700">
                <tr>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Total hours</th>
                  <th className="px-3 py-2 font-medium">Created by</th>
                  <th className="px-3 py-2 font-medium">Generated</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {runs.map((run) => {
                  const detail = runDetails[run.id];
                  const isExpanded = expandedRunId === run.id;

                  return (
                  <Fragment key={run.id}>
                  <tr>
                    <td className="px-3 py-3 whitespace-nowrap text-zinc-900 dark:text-zinc-100">
                      {run.period_start} – {run.period_end}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-3 py-3 font-mono text-zinc-700 dark:text-zinc-300">
                      {formatDuration(run.total_hours_snapshot)}
                    </td>
                    <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">
                      {run.created_by_name ?? `User #${run.created_by}`}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                      {run.created_at ? new Date(run.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void toggleRunDetails(run.id)}
                          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          {loadingDetailId === run.id
                            ? "Loading…"
                            : isExpanded
                              ? "Hide"
                              : "Details"}
                        </button>
                        {run.status === "draft" ? (
                          <>
                            <button
                              type="button"
                              disabled={actingId === run.id || !financialUnlocked}
                              onClick={() => startEditRun(run)}
                              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={actingId === run.id || !financialUnlocked}
                              onClick={() => void runAction(run.id, "recalculate")}
                              className="rounded-md border border-blue-300 px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:text-blue-200 dark:hover:bg-blue-950/30"
                            >
                              Recalculate
                            </button>
                            <button
                              type="button"
                              disabled={actingId === run.id || !financialUnlocked}
                              onClick={() => void runAction(run.id, "delete")}
                              className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-200 dark:hover:bg-red-950/30"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              disabled={actingId === run.id || !financialUnlocked}
                              onClick={() => void runAction(run.id, "finalize")}
                              className="rounded-md border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-950/30"
                            >
                              Finalize
                            </button>
                          </>
                        ) : null}
                        {run.status === "finalized" ? (
                          <button
                            type="button"
                            disabled={actingId === run.id || !financialUnlocked}
                            onClick={() => void runAction(run.id, "lock")}
                            className="rounded-md border border-green-300 px-2.5 py-1 text-xs font-medium text-green-800 hover:bg-green-50 disabled:opacity-50 dark:border-green-700 dark:text-green-200 dark:hover:bg-green-950/30"
                          >
                            Lock
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr>
                      <td colSpan={6} className="bg-zinc-50 px-3 py-4 dark:bg-zinc-950/50">
                        {editingRunId === run.id ? (
                          <form className="mb-4 grid gap-3 sm:grid-cols-2" onSubmit={handleEditRun}>
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
                            <div className="flex gap-2 sm:col-span-2">
                              <button
                                type="submit"
                                disabled={actingId === run.id || !financialUnlocked}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                              >
                                Save & recalculate
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingRunId(null)}
                                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : null}
                        {renderEmployeeRecords(detail?.employee_records)}
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
      </section>
      </div>
    </PageTransition>
  );
}
