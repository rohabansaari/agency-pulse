"use client";

import {
  ApproveRejectButtons,
  formatShortDate,
  PanelEmpty,
  RequestItem,
  RequestList,
  RequestPanel,
  StatusPill,
} from "@/components/leave/approvals";
import { Avatar } from "@/components/ledger/Avatar";
import { ledgerTable } from "@/components/ledger/table";
import { Button } from "@/components/ui/Button";
import { Alert, Spinner } from "@/components/ui/EmptyState";
import { FormField, Input } from "@/components/ui/Input";
import { MoneyAmount } from "@/components/ui/MoneyAmount";
import { PageHeader } from "@/components/ui/PageHeader";
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
import { cn } from "@/lib/cn";
import { Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
    <div className="space-y-6">
      <PageHeader
        eyebrow="My requests"
        title="Advance salary"
        description="Request an advance against your upcoming salary. Approved advances are deducted automatically from payroll."
      />

      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-labelledby="advance-new-heading"
          className="min-w-0 flex-[1_1_340px] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6"
        >
          <h2 id="advance-new-heading" className="text-lg font-semibold text-[var(--foreground)]">
            New request
          </h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error ? <Alert variant="error">{error}</Alert> : null}
            <FormField label="Amount" htmlFor="advance-amount" required>
              <Input
                id="advance-amount"
                type="number"
                inputMode="decimal"
                min={1}
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="tnum"
              />
            </FormField>
            <FormField label="Reason (optional)" htmlFor="advance-reason">
              <Input
                id="advance-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Brief reason for the advance"
              />
            </FormField>
            <p className="text-[13px] text-[var(--muted)]">
              Goes to your admin for approval. Approved amounts are deducted from the next payroll run.
            </p>
            <Button type="submit" size="lg" disabled={submitting} className="min-h-12 w-full">
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          </form>
        </section>

        <RequestPanel title="Request history" className="flex-[999_1_460px]">
          {loading ? (
            <Spinner />
          ) : requests.length === 0 ? (
            <PanelEmpty icon={Wallet} title="No advance requests yet" description="Requests you submit appear here with their status." />
          ) : (
            <RequestList>
              {requests.map((req) => (
                <RequestItem
                  key={req.id}
                  kind="advance"
                  who={<MoneyAmount amount={req.amount} size="sm" className="font-medium" />}
                  status={<StatusPill status={req.status} label={req.status_label} />}
                  what={req.created_at ? `Requested ${formatShortDate(req.created_at)}` : "Salary advance"}
                  note={req.reason || undefined}
                />
              ))}
            </RequestList>
          )}
        </RequestPanel>
      </div>
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
      const pendingItems = await fetchPendingSalaryAdvances();
      setPending(pendingItems);

      try {
        const all = await fetchSalaryAdvances();
        setHistory(all.filter((r) => r.status !== "pending"));
      } catch {
        setHistory([]);
      }
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Approvals"
        title="Advance salary management"
        description="Review and approve employee advance requests. Approved amounts are deducted from the next payroll run."
      />

      <RequestPanel title="Pending approval" count={loading ? undefined : pending.length}>
        {loading ? (
          <Spinner />
        ) : pending.length === 0 ? (
          <PanelEmpty title="All caught up" description="No pending requests." />
        ) : (
          <RequestList>
            {pending.map((req) => {
              const who = req.user?.name ?? `User #${req.user_id}`;
              return (
                <RequestItem
                  key={req.id}
                  kind="advance"
                  who={who}
                  status={<StatusPill status={req.status} label={req.status_label} />}
                  what={
                    <>
                      Salary advance · <MoneyAmount amount={req.amount} size="sm" className="font-medium" />
                      {req.created_at ? ` · requested ${formatShortDate(req.created_at)}` : ""}
                    </>
                  }
                  note={req.reason || undefined}
                  actions={
                    <ApproveRejectButtons
                      subject={`${who}'s salary advance`}
                      disabled={acting === req.id}
                      onApprove={() => void handleApprove(req.id)}
                      onReject={() => void handleReject(req.id)}
                    />
                  }
                />
              );
            })}
          </RequestList>
        )}
      </RequestPanel>

      <section aria-labelledby="advance-history-heading" className={ledgerTable.card}>
        <div className="px-5 pb-3 pt-4">
          <h2 id="advance-history-heading" className="text-base font-semibold text-[var(--foreground)]">
            History
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--muted)]">Reviewed and deducted requests.</p>
        </div>
        {history.length === 0 ? (
          <PanelEmpty title="No reviewed requests yet" />
        ) : (
          <div className={ledgerTable.wrap}>
            <table className={cn(ledgerTable.table, "min-w-[560px]")}>
              <thead className={ledgerTable.thead}>
                <tr>
                  <th scope="col" className={ledgerTable.th}>Employee</th>
                  <th scope="col" className={cn(ledgerTable.th, "text-right")}>Amount</th>
                  <th scope="col" className={ledgerTable.th}>Status</th>
                  <th scope="col" className={ledgerTable.th}>Reviewed</th>
                </tr>
              </thead>
              <tbody className={ledgerTable.tbody}>
                {history.map((req) => (
                  <tr key={req.id} className={ledgerTable.rowHover}>
                    <td className={ledgerTable.td}>
                      <div className="flex items-center gap-3">
                        <Avatar name={req.user?.name ?? ""} size="sm" />
                        <span className="font-medium text-[var(--foreground)]">{req.user?.name}</span>
                      </div>
                    </td>
                    <td className={cn(ledgerTable.td, "text-right")}>
                      <MoneyAmount amount={req.amount} size="sm" />
                    </td>
                    <td className={ledgerTable.td}>
                      <StatusPill status={req.status} label={req.status_label} />
                    </td>
                    <td className={cn(ledgerTable.td, "tnum text-[var(--muted)]")}>
                      {req.reviewed_at ? formatShortDate(req.reviewed_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
