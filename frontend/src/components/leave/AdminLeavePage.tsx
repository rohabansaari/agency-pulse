"use client";

import {
  LeaveStatusFilter,
  type LeaveStatusFilter as LeaveStatusFilterValue,
} from "@/components/leave/LeaveStatusFilter";
import { LeaveHistory } from "@/components/time/LeaveHistory";
import { LeaveRequestForm } from "@/components/time/LeaveRequestForm";
import { useState } from "react";

export function AdminLeavePage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<LeaveStatusFilterValue>("all");

  function handleUpdated() {
    setRefreshKey((value) => value + 1);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Leave management
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Organization-wide leave control — assign, backdate, and override statuses.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Assign paid leave
        </h2>
        <div className="mt-4">
          <LeaveRequestForm role="admin" onSubmitted={handleUpdated} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              All leave entries
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Audit visibility across the organization. Override status inline.
            </p>
          </div>
          <LeaveStatusFilter value={statusFilter} onChange={setStatusFilter} />
        </div>
        <LeaveHistory
          key={`admin-${refreshKey}-${statusFilter}`}
          showEmployee
          statusFilter={statusFilter}
          adminEditable
          onUpdated={handleUpdated}
        />
      </section>
    </div>
  );
}
