"use client";

import { Avatar } from "@/components/ledger/Avatar";
import { ledgerTable, rowButton } from "@/components/ledger/table";
import { PayrollBreakdown } from "@/components/payroll/PayrollBreakdown";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatPKRCompact } from "@/lib/currency";
import { formatDuration } from "@/lib/time";
import type { PayrollRunEmployeeRecord } from "@/lib/types";
import { ChevronDown } from "lucide-react";
import { Fragment, useState } from "react";

const COLUMN_COUNT = 9;

function Amount({ value, masked, strong = false }: { value: string | null | undefined; masked: boolean; strong?: boolean }) {
  if (masked) {
    return <span className="text-[var(--muted)]">—</span>;
  }
  return (
    <span className={cn("tnum", strong ? "font-semibold text-[var(--foreground)]" : "text-[var(--foreground)]")}>
      {formatPKRCompact(value)}
    </span>
  );
}

/** Employee lines of a payroll run: hours and PKR amounts, right-aligned, with a per-line breakdown. */
export function PayrollEmployeeLines({
  records,
  financialUnlocked,
}: {
  records: PayrollRunEmployeeRecord[] | undefined;
  financialUnlocked: boolean;
}) {
  const [openId, setOpenId] = useState<number | null>(null);

  if (!records?.length) {
    return <p className="px-5 py-6 text-sm text-[var(--muted)]">No employee payroll records.</p>;
  }

  return (
    <div className={ledgerTable.wrap}>
      <table className={cn(ledgerTable.table, "min-w-[56.25rem]")}>
        <thead className={ledgerTable.thead}>
          <tr>
            <th scope="col" className={ledgerTable.th}>Employee</th>
            <th scope="col" className={ledgerTable.th}>Type</th>
            <th scope="col" className={cn(ledgerTable.th, "text-right")}>Hours</th>
            <th scope="col" className={cn(ledgerTable.th, "text-right")}>Overtime</th>
            <th scope="col" className={cn(ledgerTable.th, "text-right")}>Gross</th>
            <th scope="col" className={cn(ledgerTable.th, "text-right")}>Income tax</th>
            <th scope="col" className={cn(ledgerTable.th, "text-right")}>EOBI</th>
            <th scope="col" className={cn(ledgerTable.th, "text-right")}>Net pay</th>
            <th scope="col" className={cn(ledgerTable.th, "text-right")}>
              <span className="sr-only">Breakdown</span>
            </th>
          </tr>
        </thead>
        <tbody className={ledgerTable.tbody}>
          {records.map((record) => {
            const masked = Boolean(record.financial_data_masked) || !financialUnlocked;
            const name = record.user_name ?? `User #${record.user_id}`;
            const open = openId === record.id;
            const panelId = `payroll-line-${record.id}`;

            return (
              <Fragment key={record.id}>
                <tr className={ledgerTable.rowHover}>
                  <td className={ledgerTable.td}>
                    <div className="flex items-center gap-3">
                      <Avatar name={name} size="sm" />
                      <span className="font-medium text-[var(--foreground)]">{name}</span>
                    </div>
                  </td>
                  <td className={ledgerTable.td}>
                    <Badge variant="outline">{record.salary_type}</Badge>
                  </td>
                  <td className={cn(ledgerTable.td, "num text-right text-[var(--foreground)]")}>
                    {formatDuration(record.regular_hours_seconds ?? record.payable_hours_seconds)}
                  </td>
                  <td className={cn(ledgerTable.td, "num text-right text-[var(--muted)]")}>
                    {record.overtime_hours_seconds ? formatDuration(record.overtime_hours_seconds) : "—"}
                  </td>
                  <td className={cn(ledgerTable.td, "text-right")}>
                    <Amount value={record.gross_salary_snapshot} masked={masked} />
                  </td>
                  <td className={cn(ledgerTable.td, "text-right")}>
                    <Amount value={record.income_tax_snapshot} masked={masked} />
                  </td>
                  <td className={cn(ledgerTable.td, "text-right")}>
                    <Amount value={record.eobi_snapshot} masked={masked} />
                  </td>
                  <td className={cn(ledgerTable.td, "text-right")}>
                    <Amount value={record.net_salary_snapshot} masked={masked} strong />
                  </td>
                  <td className={cn(ledgerTable.td, "text-right")}>
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={panelId}
                      aria-label={`${open ? "Hide" : "Show"} breakdown for ${name}`}
                      onClick={() => setOpenId(open ? null : record.id)}
                      className={cn(rowButton, "w-9 justify-center px-0")}
                    >
                      <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
                {open ? (
                  <tr id={panelId}>
                    <td colSpan={COLUMN_COUNT} className="bg-[var(--accent-sand)]/40 px-5 py-4">
                      <PayrollBreakdown
                        gross={record.gross_salary_snapshot}
                        net={record.net_salary_snapshot}
                        lines={record.adjustment_lines_snapshot}
                        masked={masked}
                        className="max-w-xl"
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
