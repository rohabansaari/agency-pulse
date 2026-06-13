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
import type { LeaveBalance, LeaveBalanceEntry, LeaveCategory } from "@/lib/types";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

const LEAVE_CATEGORIES: { key: LeaveCategory; label: string; limitKey: keyof LeaveBalance; usedKey: keyof LeaveBalance; remainingKey: keyof LeaveBalance }[] = [
  { key: "medical", label: "Medical Leave", limitKey: "medical_limit_days", usedKey: "medical_used_days", remainingKey: "medical_remaining_days" },
  { key: "casual", label: "Casual Leave", limitKey: "casual_limit_days", usedKey: "casual_used_days", remainingKey: "casual_remaining_days" },
  { key: "annual", label: "Annual Leave", limitKey: "annual_limit_days", usedKey: "used_days", remainingKey: "remaining_days" },
];

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
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-label">{label}</p>
      <div className="mt-2 flex items-end justify-between">
        <p className="text-numeric text-2xl font-bold text-[var(--foreground)]">{remaining}</p>
        <p className="text-xs text-[var(--muted)]">
          {used} / {limit} used
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border)]">
        <motion.div
          className="h-full rounded-full bg-[var(--accent-emerald)]"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
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
      <h2 className="text-heading text-lg">Leave balances</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {LEAVE_CATEGORIES.map((cat) => (
          <CategoryProgress
            key={cat.key}
            label={cat.label}
            used={Number.parseFloat(String(balance[cat.usedKey]))}
            limit={Number(balance[cat.limitKey])}
            remaining={Number.parseFloat(String(balance[cat.remainingKey]))}
          />
        ))}
      </div>
    </Card>
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
    <Card className="p-5">
      <h2 className="text-heading text-lg">Leave limits by category</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Set medical, casual, and annual limits. Reset usage per category.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Loading…</p>
      ) : (
        <div className="mt-4 space-y-4">
          {entries.map((entry) => (
            <div
              key={entry.user.id}
              className="rounded-xl border border-[var(--border)] p-4"
            >
              <div className="mb-4">
                <p className="font-semibold text-[var(--foreground)]">{entry.user.name}</p>
                <p className="text-xs text-[var(--muted)]">{entry.user.email}</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                {LEAVE_CATEGORIES.map((cat) => (
                  <div key={cat.key} className="space-y-2">
                    <CategoryProgress
                      label={cat.label}
                      used={Number.parseFloat(String(entry.balance[cat.usedKey]))}
                      limit={Number(entry.balance[cat.limitKey])}
                      remaining={Number.parseFloat(String(entry.balance[cat.remainingKey]))}
                    />
                    {editing?.userId === entry.user.id && editing.category === cat.key ? (
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={365}
                          value={limitValue}
                          onChange={(e) => setLimitValue(e.target.value)}
                          className="w-full"
                        />
                        <Button
                          size="sm"
                          disabled={saving}
                          onClick={() => void handleSaveLimit(entry.user.id, cat.key)}
                        >
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditing({ userId: entry.user.id, category: cat.key });
                            setLimitValue(String(entry.balance[cat.limitKey]));
                          }}
                        >
                          Edit limit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={saving}
                          onClick={() => void handleReset(entry.user.id, cat.key)}
                        >
                          Reset used
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
