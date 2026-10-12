"use client";

import { RequestPanel } from "@/components/leave/approvals";
import { LeaveBalanceSummary } from "@/components/leave/LeaveBalancePanel";
import {
  LeaveStatusFilter,
  type LeaveStatusFilter as LeaveStatusFilterValue,
} from "@/components/leave/LeaveStatusFilter";
import { LeaveApprovalQueue } from "@/components/time/LeaveApprovalQueue";
import { LeaveHistory } from "@/components/time/LeaveHistory";
import { LeaveRequestForm } from "@/components/time/LeaveRequestForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { useState } from "react";

function FormCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="min-w-0 flex-[1_1_340px] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6"
    >
      <h2 id={id} className="text-base font-semibold text-[var(--foreground)]">
        {title}
      </h2>
      <p className="mt-0.5 text-[13px] text-[var(--muted)]">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ManagerLeaveApprovalsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<LeaveStatusFilterValue>("all");

  function handleUpdated() {
    setRefreshKey((value) => value + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Approvals"
        title="Leave approvals"
        description="Review team leave requests, request leave for yourself, and record approved leave for members."
      />

      <LeaveApprovalQueue key={`queue-${refreshKey}`} onAction={handleUpdated} />

      <div className="flex flex-wrap items-start gap-6">
        <FormCard
          id="manager-self-leave-heading"
          title="Request leave for yourself"
          description="Your request is sent to admin for approval."
        >
          <div className="space-y-4">
            <LeaveBalanceSummary />
            <LeaveRequestForm role="manager" forSelf onSubmitted={handleUpdated} />
          </div>
        </FormCard>

        <FormCard
          id="manager-team-leave-heading"
          title="Record team leave"
          description="Manager-created leave is approved by default and counts as paid leave."
        >
          <LeaveRequestForm role="manager" onSubmitted={handleUpdated} />
        </FormCard>
      </div>

      <RequestPanel
        title="Team and personal leave history"
        action={<LeaveStatusFilter value={statusFilter} onChange={setStatusFilter} />}
      >
        <LeaveHistory
          key={`history-${refreshKey}-${statusFilter}`}
          showEmployee
          statusFilter={statusFilter}
        />
      </RequestPanel>
    </div>
  );
}
