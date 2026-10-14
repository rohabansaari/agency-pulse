"use client";

import { Avatar } from "@/components/ledger/Avatar";
import { Panel } from "@/components/ledger/Panel";
import { ledgerTable, rowButton } from "@/components/ledger/table";
import { Button } from "@/components/ui/Button";
import { EmptyState, Spinner } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import {
  fetchLeaveBalances,
  fetchMyLeaveBalance,
  resetLeaveBalance,
  updateLeaveLimit,
} from "@/lib/api";
import type { LeaveBalance, LeaveBalanceEntry, LeaveCategory } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

const LEAVE_CATEGORIES: { key: LeaveCategory; label: string; limitKey: keyof LeaveBalance; usedKey: keyof LeaveBalance; remainingKey: keyof LeaveBalance }[] = [
  { key: "medical", label: "Medical Leave", limitKey: "medical_limit_days", usedKey: "medical_used_days", remainingKey: "medical_remaining_days" },
  { key: "casual", label: "Casual Leave", limitKey: "casual_limit_days", usedKey: "casual_used_days", remainingKey: "casual_remaining_days" },
  { key: "annual", label: "Annual Leave", limitKey: "annual_limit_days", usedKey: "used_days", remainingKey: "remaining_days" },
];

function toNumber(value: unknown): number {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div
      role="meter"
      aria-label={`${label} used`}
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={used}
      className="h-1.5 overflow-hidden rounded-full bg-[var(--border-subtle)]"
    >
      <div className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

function CategoryProgress({
  label,
  used,
  limit,
  remaining,
}: {
  label: string;
  used: number;
  limit: number;
  remaining: number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <p className="text-[0.8125rem] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-[1.75rem] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
        <span className="tnum">{remaining}</span>
        <span className="text-[0.9375rem] font-normal text-[var(--muted)]"> days left</span>
      </p>
      <div className="mt-3">
        <UsageBar used={used} limit={limit} label={label} />
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        <span className="tnum">{used}</span> of <span className="tnum">{limit}</span> used
      </p>
    </div>
  );
}

export function LeaveBalanceSummary() {
  const [balance, setBalance] = useState<LeaveBalance | null>(null);

  useEffect(() => {
    void fetchMyLeaveBalance()
      .then((res) => setBalance(res.balance))
      .catch(() => setBalance(null));
  }, []);

  if (!balance) return null;

  return (
    <section aria-labelledby="leave-balances-heading">
      <h2 id="leave-balances-heading" className="sr-only">
        Leave balances
      </h2>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {LEAVE_CATEGORIES.map((cat) => (
          <CategoryProgress
            key={cat.key}
            label={cat.label}
            used={toNumber(balance[cat.usedKey])}
            limit={Number(balance[cat.limitKey])}
            remaining={toNumber(balance[cat.remainingKey])}
          />
        ))}
      </div>
    </section>
  );
}

export function LeaveLimitsPanel() {
  const [entries, setEntries] = useState<LeaveBalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ userId: number; category: LeaveCategory } | null>(null);
  const [limitValue, setLimitValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchLeaveBalances();
      setEntries(res.balances);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSaveLimit(userId: number, category: LeaveCategory) {
    setSaving(true);
    try {
      await updateLeaveLimit(userId, category, Number.parseInt(limitValue, 10));
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleReset(userId: number, category: LeaveCategory) {
    setSaving(true);
    try {
      await resetLeaveBalance(userId, category);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      title="Leave limits by category"
      description="Set medical, casual, and annual limits. Reset usage per category."
      flush
    >
      {loading ? (
        <Spinner label="Loading leave balances…" />
      ) : entries.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState title="No employees yet" description="Leave balances appear here once employees are added." />
        </div>
      ) : (
        <div className={ledgerTable.wrap}>
          <table className={cn(ledgerTable.table, "min-w-[56.25rem]")}>
            <thead className={ledgerTable.thead}>
              <tr>
                <th scope="col" className={ledgerTable.th}>Employee</th>
                {LEAVE_CATEGORIES.map((cat) => (
                  <th key={cat.key} scope="col" className={ledgerTable.th}>
                    {cat.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={ledgerTable.tbody}>
              {entries.map((entry) => (
                <tr key={entry.user.id} className={ledgerTable.rowHover}>
                  <td className={cn(ledgerTable.td, "align-top")}>
                    <div className="flex items-center gap-3">
                      <Avatar name={entry.user.name} size="sm" />
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--foreground)]">{entry.user.name}</p>
                        <p className="truncate text-[0.8125rem] text-[var(--muted)]">{entry.user.email}</p>
                      </div>
                    </div>
                  </td>
                  {LEAVE_CATEGORIES.map((cat) => {
                    const used = toNumber(entry.balance[cat.usedKey]);
                    const limit = Number(entry.balance[cat.limitKey]);
                    const remaining = toNumber(entry.balance[cat.remainingKey]);
                    const isEditing = editing?.userId === entry.user.id && editing.category === cat.key;
                    const subject = `${cat.label} for ${entry.user.name}`;

                    return (
                      <td key={cat.key} className={cn(ledgerTable.td, "w-[14.375rem] align-top")}>
                        <p className="text-[var(--foreground)]">
                          <span className="tnum font-semibold">{remaining}</span>
                          <span className="text-[0.8125rem] text-[var(--muted)]"> left · </span>
                          <span className="tnum text-[0.8125rem] text-[var(--muted)]">
                            {used}/{limit} used
                          </span>
                        </p>
                        <div className="mt-2">
                          <UsageBar used={used} limit={limit} label={subject} />
                        </div>
                        {isEditing ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Input
                              type="number"
                              min={0}
                              max={365}
                              value={limitValue}
                              aria-label={`New limit, ${subject}`}
                              onChange={(e) => setLimitValue(e.target.value)}
                              className="tnum w-20 flex-1"
                            />
                            <Button
                              size="lg"
                              disabled={saving}
                              onClick={() => void handleSaveLimit(entry.user.id, cat.key)}
                            >
                              Save
                            </Button>
                            <Button size="lg" variant="ghost" onClick={() => setEditing(null)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              aria-label={`Edit limit, ${subject}`}
                              className={cn(rowButton, "min-h-11")}
                              onClick={() => {
                                setEditing({ userId: entry.user.id, category: cat.key });
                                setLimitValue(String(entry.balance[cat.limitKey]));
                              }}
                            >
                              Edit limit
                            </button>
                            <button
                              type="button"
                              aria-label={`Reset used days, ${subject}`}
                              className={cn(rowButton, "min-h-11 text-[var(--muted)]")}
                              disabled={saving}
                              onClick={() => void handleReset(entry.user.id, cat.key)}
                            >
                              Reset used
                            </button>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
