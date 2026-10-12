"use client";

import { Segmented } from "@/components/ledger/Segmented";
import type { TimeEntryStatus } from "@/lib/types";

export type LeaveStatusFilter = "all" | TimeEntryStatus;

const FILTERS: { value: LeaveStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export function LeaveStatusFilter({
  value,
  onChange,
}: {
  value: LeaveStatusFilter;
  onChange: (value: LeaveStatusFilter) => void;
}) {
  return <Segmented options={FILTERS} value={value} onChange={onChange} label="Filter leave by status" />;
}
