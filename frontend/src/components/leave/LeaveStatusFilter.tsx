"use client";

import type { TimeEntryStatus } from "@/lib/types";

export type LeaveStatusFilter = "all" | TimeEntryStatus;

const FILTERS: { id: LeaveStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

export function LeaveStatusFilter({
  value,
  onChange,
}: {
  value: LeaveStatusFilter;
  onChange: (value: LeaveStatusFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={() => onChange(filter.id)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            value === filter.id
              ? "bg-blue-600 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
