"use client";

import { LeaveBalanceSummary } from "@/components/leave/LeaveBalancePanel";
import { LeaveHistory } from "@/components/time/LeaveHistory";
import { LeaveRequestForm } from "@/components/time/LeaveRequestForm";
import { useState } from "react";

export function EmployeeLeavePage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Leave
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Request paid leave and track your remaining balance.
        </p>
      </div>

      <LeaveBalanceSummary />

      <section className="ui-card p-5">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Request leave
        </h2>
        <div className="mt-4">
          <LeaveRequestForm
            role="employee"
            onSubmitted={() => setRefreshKey((value) => value + 1)}
          />
        </div>
      </section>

      <section className="ui-card p-5">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          My leave history
        </h2>
        <LeaveHistory key={refreshKey} />
      </section>
    </div>
  );
}
