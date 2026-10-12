"use client";

import { useAppUser } from "@/components/dashboard/AppShell";
import { RequestPanel } from "@/components/leave/approvals";
import { LeaveLimitsPanel } from "@/components/leave/LeaveBalancePanel";
import {
  LeaveStatusFilter,
  type LeaveStatusFilter as LeaveStatusFilterValue,
} from "@/components/leave/LeaveStatusFilter";
import { LeaveHistory } from "@/components/time/LeaveHistory";
import { LeaveRequestForm } from "@/components/time/LeaveRequestForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { useState } from "react";

export function AdminLeavePage() {
  const user = useAppUser();
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<LeaveStatusFilterValue>("all");

  function handleUpdated() {
    setRefreshKey((value) => value + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Approvals"
        title="Leave management"
        description="Organization-wide leave control — limits, assignments, and audit visibility."
      />

      <LeaveLimitsPanel />

      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-labelledby="assign-leave-heading"
          className="min-w-0 flex-[1_1_340px] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6"
        >
          <h2 id="assign-leave-heading" className="text-base font-semibold text-[var(--foreground)]">
            Assign paid leave
          </h2>
          <p className="mb-4 mt-0.5 text-[13px] text-[var(--muted)]">Recorded directly as approved paid leave.</p>
          <LeaveRequestForm role={user.role} onSubmitted={handleUpdated} />
        </section>

        <RequestPanel
          title="All leave entries"
          description="Audit visibility across the organization. Override status inline."
          action={<LeaveStatusFilter value={statusFilter} onChange={setStatusFilter} />}
          className="flex-[999_1_480px]"
        >
          <LeaveHistory
            key={`admin-${refreshKey}-${statusFilter}`}
            showEmployee
            statusFilter={statusFilter}
            adminEditable
            onUpdated={handleUpdated}
          />
        </RequestPanel>
      </div>
    </div>
  );
}
