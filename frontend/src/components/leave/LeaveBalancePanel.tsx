"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField, Input } from "@/components/ui/Input";
import {
  fetchLeaveBalances,
  fetchMyLeaveBalance,
  resetLeaveBalance,
  updateLeaveLimit,
} from "@/lib/api";
import type { LeaveBalance, LeaveBalanceEntry } from "@/lib/types";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

function LeaveProgress({ balance }: { balance: LeaveBalance }) {
  const used = Number.parseFloat(balance.used_days);
  const limit = balance.annual_limit_days;
  const remaining = Number.parseFloat(balance.remaining_days);
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold tracking-tight">{remaining}</p>
          <p className="text-sm text-[var(--muted)]">days remaining</p>
        </div>
        <p className="text-sm text-[var(--muted)]">
          {used} / {limit} used
        </p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
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
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Leave balance</h2>
      <div className="mt-4">
        <LeaveProgress balance={balance} />
      </div>
    </Card>
  );
}

export function LeaveLimitsPanel() {
  const [entries, setEntries] = useState<LeaveBalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
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

  async function handleSaveLimit(userId: number) {
    setSaving(true);
    try {
      await updateLeaveLimit(userId, Number.parseInt(limitValue, 10));
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleReset(userId: number) {
    setSaving(true);
    try {
      await resetLeaveBalance(userId);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Leave limits</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Set annual leave limits and reset balances for employees and managers.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Loading…</p>
      ) : (
        <div className="mt-4 space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.user.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--border)] p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{entry.user.name}</p>
                <p className="text-xs text-[var(--muted)]">{entry.user.email}</p>
                <div className="mt-2 max-w-xs">
                  <LeaveProgress balance={entry.balance} />
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                {editing === entry.user.id ? (
                  <>
                    <FormField label="Annual limit (days)">
                      <Input
                        type="number"
                        min={0}
                        max={365}
                        value={limitValue}
                        onChange={(e) => setLimitValue(e.target.value)}
                        className="w-28"
                      />
                    </FormField>
                    <Button
                      size="sm"
                      disabled={saving}
                      onClick={() => void handleSaveLimit(entry.user.id)}
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditing(entry.user.id);
                        setLimitValue(String(entry.balance.annual_limit_days));
                      }}
                    >
                      Edit limit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={saving}
                      onClick={() => void handleReset(entry.user.id)}
                    >
                      Reset used
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
