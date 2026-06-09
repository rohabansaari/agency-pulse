"use client";

import { formatDuration } from "@/lib/time";
import type { LeaveBreakdownPeriod } from "@/lib/types";

export function LeaveBreakdownCard({
  title,
  breakdown,
}: {
  title: string;
  breakdown: LeaveBreakdownPeriod;
}) {
  return (
    <div className="rounded-lg border border-zinc-100 px-4 py-3 dark:border-zinc-800">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <p className="text-zinc-500">Paid leave</p>
          <p className="font-mono font-semibold tabular-nums text-green-700 dark:text-green-400">
            {formatDuration(breakdown.paid_seconds)}
          </p>
        </div>
        <div>
          <p className="text-zinc-500">Pending leave</p>
          <p className="font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-400">
            {formatDuration(breakdown.pending_seconds)}
          </p>
        </div>
        <div>
          <p className="text-zinc-500">Rejected leave</p>
          <p className="font-mono font-semibold tabular-nums text-red-700 dark:text-red-400">
            {formatDuration(breakdown.rejected_seconds)}
          </p>
        </div>
      </div>
    </div>
  );
}
