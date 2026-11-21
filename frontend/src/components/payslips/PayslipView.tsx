"use client";

import { hours, isoToLong, money } from "@/components/invoices/format";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/EmptyState";
import { ApiError, fetchPayslip, formatApiErrors, type Payslip, type PayslipLine } from "@/lib/api";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

function LinesTable({ title, lines, total, totalLabel }: { title: string; lines: PayslipLine[]; total: number; totalLabel: string }) {
  return (
    <section className="min-w-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-[#111723] text-left text-xs uppercase tracking-[0.06em] text-[#5b6472]">
            <th scope="col" className="pb-2 font-medium">{title}</th>
            <th scope="col" className="w-36 pb-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr className="border-b border-[#eef0f3]">
              <td className="py-2.5 text-[#5b6472]" colSpan={2}>None</td>
            </tr>
          ) : (
            lines.map((line, index) => (
              <tr key={`${line.name}-${index}`} className="border-b border-[#eef0f3]">
                <td className="py-2.5 pr-4">{line.name}</td>
                <td className="tnum py-2.5 text-right">{money(line.amount)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-3 font-semibold">{totalLabel}</td>
            <td className="tnum pt-3 text-right font-semibold">{money(total)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

/** The payslip as the employee keeps it. Always light, so it prints like paper. */
function Paper({ payslip }: { payslip: Payslip }) {
  return (
    <article
      className="invoice-paper rounded-2xl border border-[var(--border)] bg-white p-6 text-[#111723] shadow-[0_24px_60px_-30px_rgb(23_15_28/0.35)] sm:p-10"
      aria-label={`Payslip for ${payslip.period_label}`}
    >
      <header className="flex flex-wrap justify-between gap-8">
        <div className="min-w-0 max-w-sm">
          {payslip.company.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={payslip.company.logo_url} alt="" className="mb-3 h-10 w-auto object-contain" />
          ) : null}
          <p className="text-xl font-semibold tracking-[-0.01em]">{payslip.company.name}</p>
          {payslip.company.address ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#5b6472]">{payslip.company.address}</p>
          ) : null}
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[2rem] font-semibold leading-none tracking-[-0.03em] text-[#9d2a8c]">Payslip</p>
          <p className="mt-2 text-sm font-medium">{payslip.period_label}</p>
          <dl className="tnum mt-4 grid grid-cols-[auto_auto] justify-start gap-x-4 gap-y-1.5 text-sm sm:justify-end">
            <dt className="text-[#5b6472]">Period</dt>
            <dd className="font-medium">
              {isoToLong(payslip.period_start)} – {isoToLong(payslip.period_end)}
            </dd>
            {payslip.pay_date ? (
              <>
                <dt className="text-[#5b6472]">Issued</dt>
                <dd className="font-medium">{isoToLong(payslip.pay_date)}</dd>
              </>
            ) : null}
          </dl>
        </div>
      </header>

      <section className="mt-10 grid gap-6 border-t border-[#e3e6eb] pt-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#5b6472]">Employee</p>
          <p className="mt-2 font-semibold">{payslip.employee.name}</p>
          {payslip.employee.email ? <p className="mt-0.5 text-sm text-[#5b6472]">{payslip.employee.email}</p> : null}
        </div>
        <dl className="tnum grid grid-cols-[auto_auto] content-start justify-start gap-x-4 gap-y-1.5 text-sm sm:justify-end">
          <dt className="text-[#5b6472]">Pay type</dt>
          <dd className="font-medium capitalize">{payslip.salary_type}</dd>
          <dt className="text-[#5b6472]">Hours paid</dt>
          <dd className="font-medium">{hours(payslip.hours.payable_seconds / 3600)}</dd>
          {payslip.hours.overtime_seconds > 0 ? (
            <>
              <dt className="text-[#5b6472]">Overtime</dt>
              <dd className="font-medium">{hours(payslip.hours.overtime_seconds / 3600)}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <LinesTable title="Earnings" lines={payslip.earnings} total={payslip.total_earnings} totalLabel="Total earnings" />
        <LinesTable
          title="Deductions"
          lines={payslip.deductions}
          total={payslip.total_deductions}
          totalLabel="Total deductions"
        />
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#f6eef5] px-5 py-4">
        <p className="text-sm font-medium text-[#5b6472]">Net pay</p>
        <p className="tnum text-2xl font-semibold tracking-[-0.02em] text-[#9d2a8c]">{money(payslip.net_pay)}</p>
      </div>

      <p className="mt-8 text-xs text-[#5b6472]">
        Amounts in Pakistani rupees (PKR). Generated by AgencyPulse from {payslip.company.name}&apos;s finalized payroll.
      </p>
    </article>
  );
}

export function PayslipView({ id, backHref, backLabel }: { id: number; backHref: string; backLabel: string }) {
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchPayslip(id)
      .then((result) => {
        if (!cancelled) setPayslip(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setError("This payslip isn't available. Admins need to unlock payroll with the payroll PIN first.");
        } else {
          setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Couldn't load the payslip.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {backLabel}
        </Link>
        {payslip ? (
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden="true" /> Print / PDF
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="no-print">
          <Alert variant="error">{error}</Alert>
        </div>
      ) : null}

      {payslip ? (
        <div className="print-area min-w-0">
          <Paper payslip={payslip} />
        </div>
      ) : !error ? (
        <div className="h-96 animate-pulse rounded-2xl bg-[var(--accent-sand)]" />
      ) : null}
    </div>
  );
}
