"use client";

import { RequestPanel } from "@/components/leave/approvals";
import { LeaveBalanceSummary } from "@/components/leave/LeaveBalancePanel";
import { LeaveHistory } from "@/components/time/LeaveHistory";
import { LeaveRequestForm } from "@/components/time/LeaveRequestForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { useState } from "react";

export function EmployeeLeavePage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My requests"
        title="Leave"
        description="Request paid leave and track your remaining balance."
      />

      <LeaveBalanceSummary />

      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-labelledby="request-leave-heading"
          className="min-w-0 flex-[1_1_340px] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6"
        >
          <h2 id="request-leave-heading" className="mb-4 text-lg font-semibold text-[var(--foreground)]">
            Request leave
          </h2>
          <LeaveRequestForm
            role="employee"
            onSubmitted={() => setRefreshKey((value) => value + 1)}
          />
        </section>

        <RequestPanel title="My leave history" className="flex-[999_1_460px]">
          <LeaveHistory key={refreshKey} />
        </RequestPanel>
      </div>
    </div>
  );
}
