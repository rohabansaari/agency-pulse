"use client";

import { isoToLong, money } from "@/components/invoices/format";
import { Panel } from "@/components/ledger/Panel";
import { Alert } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApiError, fetchPayslips, formatApiErrors, type PayslipSummary } from "@/lib/api";
import { ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function PayslipList() {
  const [payslips, setPayslips] = useState<PayslipSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchPayslips()
      .then((result) => {
        if (!cancelled) setPayslips(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Couldn't load payslips.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pay"
        title="Payslips"
        description="Your payslip for each finalized payroll. Open one to see earnings and deductions, or save it as a PDF."
      />

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Panel title="Your payslips" flush>
        {payslips === null && !error ? (
          <div className="mx-5 mb-5 h-40 animate-pulse rounded-xl bg-[var(--accent-sand)]" />
        ) : payslips && payslips.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <FileText className="mx-auto h-6 w-6 text-[var(--muted)]" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-[var(--foreground)]">No payslips yet</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              They appear here, and you get an email, when your company finalizes payroll.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
            {(payslips ?? []).map((payslip) => (
              <li key={payslip.id}>
                <Link
                  href={`/payslips/${payslip.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[var(--accent-sand)]/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">{payslip.period_label}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {payslip.pay_date ? `Issued ${isoToLong(payslip.pay_date)}` : "Issued"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="num text-sm font-semibold text-[var(--foreground)]">{money(payslip.net_pay)}</p>
                      <p className="text-[0.6875rem] text-[var(--muted)]">Net pay</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
