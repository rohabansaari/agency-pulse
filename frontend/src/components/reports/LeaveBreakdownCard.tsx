"use client";

import { formatDuration } from "@/lib/time";
import type { LeaveBreakdownPeriod } from "@/lib/types";

const ROWS = [
  { key: "paid_seconds", label: "Paid", dot: "bg-[var(--accent-emerald)]" },
  { key: "pending_seconds", label: "Pending", dot: "bg-[var(--accent-copper)]" },
  { key: "rejected_seconds", label: "Rejected", dot: "bg-[var(--accent-coral)]" },
] as const;

export function LeaveBreakdownCard({
  title,
  breakdown,
}: {
  title: string;
  breakdown: LeaveBreakdownPeriod;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--card-elevated)] px-4 py-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.04em] text-[var(--muted)]">{title}</p>
      <dl className="flex flex-col gap-1.5 text-sm">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-[var(--muted)]">
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${row.dot}`} />
              {row.label} leave
            </dt>
            <dd className="num font-medium text-[var(--foreground)]">{formatDuration(breakdown[row.key])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
