"use client";

import { LeaveBalanceSummary } from "@/components/leave/LeaveBalancePanel";
import {
  LeaveStatusFilter,
  type LeaveStatusFilter as LeaveStatusFilterValue,
} from "@/components/leave/LeaveStatusFilter";
import { LeaveApprovalQueue } from "@/components/time/LeaveApprovalQueue";
import { LeaveHistory } from "@/components/time/LeaveHistory";
import { LeaveRequestForm } from "@/components/time/LeaveRequestForm";
import { useState } from "react";

export function ManagerLeaveApprovalsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<LeaveStatusFilterValue>("all");

  function handleUpdated() {
    setRefreshKey((value) => value + 1);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Leave approvals
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Review team leave requests, request leave for yourself, and record approved leave for members.
        </p>
      </div>

      <LeaveApprovalQueue key={`queue-${refreshKey}`} onAction={handleUpdated} />

      <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Request leave for yourself
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Your request is sent to admin for approval.
        </p>
        <div className="mt-4 space-y-4">
          <LeaveBalanceSummary />
          <LeaveRequestForm role="manager" forSelf onSubmitted={handleUpdated} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Record team leave
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manager-created leave is approved by default and counts as paid leave.
        </p>
        <div className="mt-4">
          <LeaveRequestForm role="manager" onSubmitted={handleUpdated} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Team and personal leave history
          </h2>
          <LeaveStatusFilter value={statusFilter} onChange={setStatusFilter} />
        </div>
        <LeaveHistory
          key={`history-${refreshKey}-${statusFilter}`}
          showEmployee
          statusFilter={statusFilter}
        />
      </section>
    </div>
  );
}
