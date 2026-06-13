"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MoneyAmount } from "@/components/ui/MoneyAmount";
import { Alert } from "@/components/ui/EmptyState";
import { FormField, Input } from "@/components/ui/Input";
import {
  ApiError,
  approveSalaryAdvance,
  createSalaryAdvance,
  fetchPendingSalaryAdvances,
  fetchSalaryAdvances,
  formatApiErrors,
  rejectSalaryAdvance,
} from "@/lib/api";
import type { SalaryAdvanceRequest } from "@/lib/types";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  deducted: "default",
};

export function EmployeeAdvancePage() {
  const [requests, setRequests] = useState<SalaryAdvanceRequest[]>([]);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await fetchSalaryAdvances());
    } catch {
      setError("Unable to load advance requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await createSalaryAdvance({
        amount: Number.parseFloat(amount),
        reason: reason.trim() || undefined,
      });
      setAmount("");
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Advance salary</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Request an advance against your upcoming salary. Approved advances are deducted automatically from payroll.
        </p>
      </div>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">New request</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error ? <Alert variant="error">{error}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Amount" required>
              <Input
                type="number"
                min={1}
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000"
              />
            </FormField>
            <FormField label="Reason (optional)">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Brief reason for the advance"
              />
            </FormField>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit request"}
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">Request history</h2>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No advance requests yet.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((req, i) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-4"
              >
                <div>
                  <MoneyAmount amount={req.amount} size="md" />
                  {req.reason ? <p className="mt-1 text-sm text-[var(--muted)]">{req.reason}</p> : null}
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {req.created_at ? new Date(req.created_at).toLocaleDateString() : ""}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[req.status] ?? "default"}>{req.status_label}</Badge>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export function AdminAdvancePage() {
  const [pending, setPending] = useState<SalaryAdvanceRequest[]>([]);
  const [history, setHistory] = useState<SalaryAdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingItems, all] = await Promise.all([
        fetchPendingSalaryAdvances(),
        fetchSalaryAdvances(),
      ]);
      setPending(pendingItems);
      setHistory(all.filter((r) => r.status !== "pending"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleApprove(id: number) {
    setActing(id);
    try {
      await approveSalaryAdvance(id);
      await load();
    } finally {
      setActing(null);
    }
  }

  async function handleReject(id: number) {
    setActing(id);
    try {
      await rejectSalaryAdvance(id);
      await load();
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Advance salary management</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Review and approve employee advance requests. Approved amounts are deducted from the next payroll run.
        </p>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">Pending approval</h2>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No pending requests.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((req) => (
              <div
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--border)] p-4"
              >
                <div>
                  <p className="font-medium">{req.user?.name ?? `User #${req.user_id}`}</p>
                  <MoneyAmount amount={req.amount} size="lg" />
                  {req.reason ? <p className="mt-1 text-sm text-[var(--muted)]">{req.reason}</p> : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={acting === req.id}
                    onClick={() => void handleApprove(req.id)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={acting === req.id}
                    onClick={() => void handleReject(req.id)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No reviewed requests yet.</p>
        ) : (
          <div className="ui-table-wrap overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-3 py-2 text-left">Employee</th>
                  <th className="px-3 py-2 text-left">Amount</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {history.map((req) => (
                  <tr key={req.id} className="border-b border-[var(--border-subtle)]">
                    <td className="px-3 py-3">{req.user?.name}</td>
                    <td className="px-3 py-3">
                      <MoneyAmount amount={req.amount} size="sm" />
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={STATUS_VARIANT[req.status] ?? "default"}>
                        {req.status_label}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-[var(--muted)]">
                      {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
