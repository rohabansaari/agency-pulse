"use client";

import { daysFromToday, hours, isoToDisplay, isoToLong, money, statusLabel } from "@/components/invoices/format";
import { InvoiceSettingsModal } from "@/components/invoices/InvoiceSettingsModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Alert } from "@/components/ui/EmptyState";
import { FormField, Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  ApiError,
  deleteInvoice,
  fetchInvoice,
  formatApiErrors,
  recordInvoicePayment,
  sendInvoice,
  updateInvoice,
  voidInvoice,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { todayDdMmYyyy } from "@/lib/dates";
import type { InvoiceDetail, InvoiceLineInput } from "@/lib/types";
import {
  ArrowLeft,
  Ban,
  Banknote,
  Check,
  Pencil,
  Plus,
  Printer,
  Send,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Draft = {
  bill_to: string;
  issue_date: string;
  due_date: string;
  notes: string;
  tax_percent: string;
  discount: string;
  lines: (InvoiceLineInput & { key: string; kind: string })[];
};

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? formatApiErrors(err.errors) || err.message : fallback;
}

function toDraft(invoice: InvoiceDetail): Draft {
  return {
    bill_to: invoice.bill_to ?? "",
    issue_date: isoToDisplay(invoice.issue_date),
    due_date: isoToDisplay(invoice.due_date),
    notes: invoice.notes ?? "",
    tax_percent: String(invoice.tax_percent),
    discount: String(invoice.discount),
    lines: invoice.lines.map((line) => ({
      key: `line-${line.id}`,
      id: line.id,
      kind: line.kind,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
    })),
  };
}

const num = (value: string | number) => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const paperInput =
  "w-full rounded-md border border-[#d9dde3] bg-white px-2 py-1.5 text-[#111723] outline-none focus:border-[#9d2a8c] focus:ring-2 focus:ring-[#9d2a8c]/20";

/** The invoice as the client sees it. Always light, so it prints like paper. */
function Paper({
  invoice,
  draft,
  setDraft,
}: {
  invoice: InvoiceDetail;
  draft: Draft | null;
  setDraft: (update: (draft: Draft) => Draft) => void;
}) {
  const s = invoice.settings;
  const editing = draft !== null;

  const lines = editing
    ? draft.lines.map((line) => ({ ...line, amount: Math.round(num(line.quantity) * num(line.unit_price) * 100) / 100 }))
    : invoice.lines.map((line) => ({ ...line, key: `line-${line.id}` }));
  const subtotal = editing ? lines.reduce((sum, line) => sum + line.amount, 0) : invoice.subtotal;
  const discount = editing ? Math.min(num(draft.discount), subtotal) : invoice.discount;
  const taxPercent = editing ? num(draft.tax_percent) : invoice.tax_percent;
  const tax = editing ? Math.round((subtotal - discount) * taxPercent) / 100 : invoice.tax_amount;
  const total = editing ? subtotal - discount + tax : invoice.total;

  function updateLine(key: string, patch: Partial<InvoiceLineInput>) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    }));
  }

  return (
    <article
      className="invoice-paper rounded-2xl border border-[var(--border)] bg-white p-6 text-[#111723] shadow-[0_24px_60px_-30px_rgb(23_15_28/0.35)] sm:p-10"
      aria-label={`Invoice ${invoice.number}`}
    >
      <header className="flex flex-wrap justify-between gap-8">
        <div className="min-w-0 max-w-sm">
          <p className="text-xl font-semibold tracking-[-0.01em]">{s.business_name}</p>
          {s.address ? <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#5b6472]">{s.address}</p> : null}
          {s.tax_id ? <p className="mt-1 text-sm text-[#5b6472]">NTN {s.tax_id}</p> : null}
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[2rem] font-semibold leading-none tracking-[-0.03em] text-[#9d2a8c]">Invoice</p>
          <p className="tnum mt-2 text-sm font-medium">{invoice.number}</p>
          <dl className="tnum mt-4 grid grid-cols-[auto_auto] justify-start gap-x-4 gap-y-1.5 text-sm sm:justify-end">
            <dt className="text-[#5b6472]">Issued</dt>
            <dd className="font-medium">
              {editing ? (
                <DatePicker hideLabel className="w-44" label="Issue date" value={draft.issue_date} onChange={(v) => setDraft((d) => ({ ...d, issue_date: v }))} />
              ) : (
                isoToLong(invoice.issue_date)
              )}
            </dd>
            <dt className="text-[#5b6472]">Due</dt>
            <dd className="font-medium">
              {editing ? (
                <DatePicker hideLabel className="w-44" label="Due date" value={draft.due_date} onChange={(v) => setDraft((d) => ({ ...d, due_date: v }))} />
              ) : (
                isoToLong(invoice.due_date)
              )}
            </dd>
            {invoice.period_start || invoice.period_end ? (
              <>
                <dt className="text-[#5b6472]">Period</dt>
                <dd>
                  {invoice.period_start && invoice.period_end
                    ? `${isoToLong(invoice.period_start)} – ${isoToLong(invoice.period_end)}`
                    : invoice.period_end
                      ? `Up to ${isoToLong(invoice.period_end)}`
                      : `From ${isoToLong(invoice.period_start)}`}
                </dd>
              </>
            ) : null}
          </dl>
        </div>
      </header>

      <section className="mt-10 border-t border-[#e3e6eb] pt-6">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#5b6472]">Bill to</p>
        <p className="mt-2 font-semibold">{invoice.client_name}</p>
        {editing ? (
          <textarea
            aria-label="Billing address"
            rows={3}
            placeholder="Address, contact, email (optional)"
            className={cn(paperInput, "mt-2 max-w-md text-sm")}
            value={draft.bill_to}
            onChange={(e) => setDraft((d) => ({ ...d, bill_to: e.target.value }))}
          />
        ) : invoice.bill_to ? (
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[#5b6472]">{invoice.bill_to}</p>
        ) : null}
      </section>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b-2 border-[#111723] text-left text-xs uppercase tracking-[0.06em] text-[#5b6472]">
              <th scope="col" className="pb-2 font-medium">Description</th>
              <th scope="col" className="w-24 pb-2 text-right font-medium">Qty</th>
              <th scope="col" className="w-32 pb-2 text-right font-medium">Rate</th>
              <th scope="col" className="w-36 pb-2 text-right font-medium">Amount</th>
              {editing ? <th scope="col" className="w-10 pb-2"><span className="sr-only">Remove</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.key} className="border-b border-[#eef0f3] align-top">
                <td className="py-3 pr-4">
                  {editing ? (
                    <input
                      aria-label="Description"
                      className={paperInput}
                      value={line.description}
                      onChange={(e) => updateLine(line.key, { description: e.target.value })}
                    />
                  ) : (
                    line.description
                  )}
                </td>
                <td className="tnum py-3 text-right">
                  {editing ? (
                    <input
                      aria-label="Quantity"
                      type="number"
                      min={0}
                      step="0.01"
                      className={cn(paperInput, "text-right")}
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value as unknown as number })}
                    />
                  ) : line.kind === "hourly" ? (
                    hours(line.quantity)
                  ) : (
                    line.quantity.toLocaleString("en-PK")
                  )}
                </td>
                <td className="tnum py-3 pl-3 text-right">
                  {editing ? (
                    <input
                      aria-label="Rate"
                      type="number"
                      min={0}
                      step="0.01"
                      className={cn(paperInput, "text-right")}
                      value={line.unit_price}
                      onChange={(e) => updateLine(line.key, { unit_price: e.target.value as unknown as number })}
                    />
                  ) : (
                    money(line.unit_price)
                  )}
                </td>
                <td className="tnum py-3 text-right font-medium">{money(line.amount)}</td>
                {editing ? (
                  <td className="py-3 pl-2 text-right">
                    <button
                      type="button"
                      aria-label={`Remove ${line.description || "line"}`}
                      onClick={() => setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.key !== line.key) }))}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5b6472] hover:bg-[#fdecea] hover:text-[#b42318]"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {editing ? (
          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                lines: [
                  ...d.lines,
                  { key: `new-${Date.now()}`, kind: "custom", description: "", quantity: 1, unit_price: 0 },
                ],
              }))
            }
            className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[#9d2a8c] hover:bg-[#faedf7]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add a line
          </button>
        ) : null}
      </div>

      <div className="mt-6 flex justify-end">
        <dl className="tnum grid w-full max-w-xs grid-cols-[1fr_auto] gap-y-2 text-sm [&>dd]:pl-6">
          <dt className="text-[#5b6472]">Subtotal</dt>
          <dd className="text-right">{money(subtotal)}</dd>
          {editing || discount > 0 ? (
            <>
              <dt className="self-center text-[#5b6472]">Discount</dt>
              <dd className="text-right">
                {editing ? (
                  <input
                    aria-label="Discount"
                    type="number"
                    min={0}
                    className={cn(paperInput, "w-28 min-w-[7rem] text-right")}
                    value={draft.discount}
                    onChange={(e) => setDraft((d) => ({ ...d, discount: e.target.value }))}
                  />
                ) : (
                  `−${money(discount)}`
                )}
              </dd>
            </>
          ) : null}
          {editing || taxPercent > 0 ? (
            <>
              <dt className="self-center text-[#5b6472]">
                {editing ? (
                  <span className="inline-flex items-center gap-2">
                    Tax
                    <input
                      aria-label="Tax percent"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      className={cn(paperInput, "w-20 min-w-[5rem] text-right")}
                      value={draft.tax_percent}
                      onChange={(e) => setDraft((d) => ({ ...d, tax_percent: e.target.value }))}
                    />
                    %
                  </span>
                ) : (
                  `Tax (${taxPercent.toLocaleString("en-PK")}%)`
                )}
              </dt>
              <dd className="self-center text-right">{money(tax)}</dd>
            </>
          ) : null}
          <dt className="border-t-2 border-[#111723] pt-2 text-base font-semibold">Total</dt>
          <dd className="border-t-2 border-[#111723] pt-2 text-right text-base font-semibold">{money(total)}</dd>
          {!editing && invoice.amount_paid > 0 ? (
            <>
              <dt className="text-[#0e7a4f]">Paid</dt>
              <dd className="text-right text-[#0e7a4f]">−{money(invoice.amount_paid)}</dd>
              <dt className="font-semibold">Balance due</dt>
              <dd className="text-right font-semibold">{money(invoice.balance)}</dd>
            </>
          ) : null}
        </dl>
      </div>

      {editing ? (
        <div className="mt-8">
          <label htmlFor="invoice-notes" className="text-xs font-medium uppercase tracking-[0.08em] text-[#5b6472]">
            Notes
          </label>
          <textarea
            id="invoice-notes"
            rows={2}
            className={cn(paperInput, "mt-2 text-sm")}
            value={draft.notes}
            placeholder="Thank you for your business."
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          />
        </div>
      ) : invoice.notes ? (
        <p className="mt-8 whitespace-pre-line text-sm text-[#5b6472]">{invoice.notes}</p>
      ) : null}

      {s.payment_details ? (
        <section className="mt-8 rounded-xl bg-[#f4f5f7] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#5b6472]">How to pay</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{s.payment_details}</p>
        </section>
      ) : null}

      {invoice.status === "void" ? (
        <p className="mt-8 text-center text-sm font-semibold uppercase tracking-[0.2em] text-[#b42318]">Void</p>
      ) : invoice.status === "paid" ? (
        <p className="mt-8 text-center text-sm font-semibold uppercase tracking-[0.2em] text-[#0e7a4f]">Paid in full</p>
      ) : null}
    </article>
  );
}

function PaymentModal({ invoice, onClose, onDone }: { invoice: InvoiceDetail; onClose: () => void; onDone: (i: InvoiceDetail) => void }) {
  const [amount, setAmount] = useState(String(invoice.balance));
  const [paidOn, setPaidOn] = useState(todayDdMmYyyy());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      onDone(await recordInvoicePayment(invoice.id, { amount: num(amount), paid_on: paidOn }));
      onClose();
    } catch (err) {
      setError(errorText(err, "Couldn't record the payment."));
      setBusy(false);
    }
  }

  return (
    <Modal title="Record a payment" description={`Balance due ${money(invoice.balance)}`} onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        <FormField label="Amount received" htmlFor="pay-amount">
          <Input id="pay-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </FormField>
        <DatePicker label="Paid on" value={paidOn} onChange={setPaidOn} />
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || num(amount) <= 0}>
            {busy ? "Saving…" : "Record payment"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmModal({
  title,
  body,
  action,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  action: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <p className="text-sm text-[var(--muted)]">{body}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Keep it
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onConfirm().finally(() => setBusy(false));
          }}
        >
          {action}
        </Button>
      </div>
    </Modal>
  );
}

export function InvoiceDetailView({ id }: { id: number }) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"pay" | "void" | "delete" | "settings" | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchInvoice(id)
      .then((result) => {
        if (cancelled) return;
        setInvoice(result);
        // Fresh drafts open ready to edit.
        if (result.status === "draft") setDraft(toDraft(result));
      })
      .catch((err) => {
        if (!cancelled) setError(errorText(err, "Couldn't load this invoice."));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function run(action: () => Promise<InvoiceDetail>, keepEditing = false) {
    setBusy(true);
    setError("");
    try {
      const result = await action();
      setInvoice(result);
      setDraft(keepEditing && result.status === "draft" ? toDraft(result) : null);
    } catch (err) {
      setError(errorText(err, "That didn't work."));
    } finally {
      setBusy(false);
    }
  }

  function saveDraft(): Promise<InvoiceDetail> {
    if (!invoice || !draft) return Promise.reject(new Error("Nothing to save"));
    return updateInvoice(invoice.id, {
      bill_to: draft.bill_to || null,
      issue_date: draft.issue_date,
      due_date: draft.due_date,
      notes: draft.notes || null,
      tax_percent: num(draft.tax_percent),
      discount: num(draft.discount),
      lines: draft.lines.map((line) => ({
        id: line.id,
        description: line.description.trim() || "Item",
        quantity: num(line.quantity),
        unit_price: num(line.unit_price),
      })),
    });
  }

  if (!invoice) {
    return error ? (
      <div className="flex flex-col gap-4">
        <Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Invoices
        </Link>
        <Alert variant="error">{error}</Alert>
      </div>
    ) : (
      <div className="h-[36rem] animate-pulse rounded-2xl bg-[var(--accent-sand)]" aria-busy="true" />
    );
  }

  const status = statusLabel(invoice);
  const due = daysFromToday(invoice.due_date);

  return (
    <div className="flex flex-col gap-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/invoices"
            aria-label="Back to invoices"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div className="min-w-0">
            <p className="text-[0.8125rem] text-[var(--muted)]">Invoices</p>
            <h1 className="flex flex-wrap items-center gap-2 text-[1.5rem] font-semibold leading-tight tracking-[-0.02em]">
              {invoice.number}
              <span className="font-normal text-[var(--muted)]">· {invoice.client_name}</span>
              <Badge variant={status.tone}>{status.label}</Badge>
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {draft ? (
            <>
              <Button variant="secondary" onClick={() => setDraft(null)} disabled={busy}>
                <X className="h-4 w-4" aria-hidden="true" /> Cancel
              </Button>
              <Button onClick={() => void run(saveDraft)} disabled={busy}>
                <Check className="h-4 w-4" aria-hidden="true" /> {busy ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <>
              {invoice.status === "draft" ? (
                <>
                  <Button variant="secondary" onClick={() => setDraft(toDraft(invoice))}>
                    <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
                  </Button>
                  <Button onClick={() => void run(() => sendInvoice(invoice.id))} disabled={busy}>
                    <Send className="h-4 w-4" aria-hidden="true" /> Mark as sent
                  </Button>
                </>
              ) : null}
              {invoice.status === "sent" ? (
                <Button onClick={() => setModal("pay")}>
                  <Banknote className="h-4 w-4" aria-hidden="true" /> Record payment
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer className="h-4 w-4" aria-hidden="true" /> Print / PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {error ? (
        <div className="no-print">
          <Alert variant="error">{error}</Alert>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="print-area min-w-0">
          <Paper invoice={invoice} draft={draft} setDraft={(update) => setDraft((d) => (d ? update(d) : d))} />
        </div>

        <aside className="no-print flex flex-col gap-4">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h2 className="text-sm font-semibold">Status</h2>
            <dl className="tnum mt-3 grid grid-cols-[1fr_auto] gap-y-2 text-sm">
              <dt className="text-[var(--muted)]">Total</dt>
              <dd className="text-right font-medium">{money(invoice.total)}</dd>
              <dt className="text-[var(--muted)]">Paid</dt>
              <dd className="text-right">{money(invoice.amount_paid)}</dd>
              <dt className="text-[var(--muted)]">Balance</dt>
              <dd className="text-right font-semibold">{money(invoice.status === "void" ? 0 : invoice.balance)}</dd>
              {invoice.hours_billed > 0 ? (
                <>
                  <dt className="text-[var(--muted)]">Hours billed</dt>
                  <dd className="text-right">{hours(invoice.hours_billed)}</dd>
                </>
              ) : null}
            </dl>
            {invoice.status === "sent" ? (
              <p className={cn("mt-3 text-[0.8125rem]", invoice.overdue ? "text-[var(--accent-coral)]" : "text-[var(--muted)]")}>
                {due < 0 ? `${-due} day${due === -1 ? "" : "s"} overdue` : due === 0 ? "Due today" : `Due in ${due} day${due === 1 ? "" : "s"}`}
              </p>
            ) : null}
            <ol className="mt-4 flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-4 text-[0.8125rem]">
              <li className="flex justify-between gap-2">
                <span className="text-[var(--muted)]">Created</span>
                <span>{invoice.created_at ? isoToLong(invoice.created_at) : "—"}</span>
              </li>
              {invoice.sent_at ? (
                <li className="flex justify-between gap-2">
                  <span className="text-[var(--muted)]">Sent</span>
                  <span>{isoToLong(invoice.sent_at)}</span>
                </li>
              ) : null}
              {invoice.paid_at ? (
                <li className="flex justify-between gap-2">
                  <span className="text-[var(--accent-emerald)]">Paid</span>
                  <span>{isoToLong(invoice.paid_at)}</span>
                </li>
              ) : null}
              {invoice.voided_at ? (
                <li className="flex justify-between gap-2">
                  <span className="text-[var(--accent-coral)]">Voided</span>
                  <span>{isoToLong(invoice.voided_at)}</span>
                </li>
              ) : null}
            </ol>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-[0.8125rem] text-[var(--muted)]">
            {invoice.status === "draft"
              ? "Drafts can be edited. Once marked as sent, the invoice is locked and starts counting towards outstanding."
              : invoice.status === "sent"
                ? "Record payments as they arrive. Part payments keep the invoice open until the balance is zero."
                : invoice.status === "paid"
                  ? "Paid in full. The hours on this invoice stay billed."
                  : "Voided. Its hours and fixed fees are back in Ready to invoice."}
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="secondary" size="sm" onClick={() => setModal("settings")}>
                <Settings2 className="h-3.5 w-3.5" aria-hidden="true" /> Invoice details
              </Button>
              {invoice.status === "draft" ? (
                <Button variant="danger" size="sm" onClick={() => setModal("delete")}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete draft
                </Button>
              ) : null}
              {(invoice.status === "sent" && invoice.amount_paid === 0) ? (
                <Button variant="danger" size="sm" onClick={() => setModal("void")}>
                  <Ban className="h-3.5 w-3.5" aria-hidden="true" /> Void invoice
                </Button>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      {modal === "pay" ? <PaymentModal invoice={invoice} onClose={() => setModal(null)} onDone={setInvoice} /> : null}
      {modal === "settings" ? (
        <InvoiceSettingsModal
          onClose={() => setModal(null)}
          onSaved={(settings) => setInvoice((current) => (current ? { ...current, settings } : current))}
        />
      ) : null}
      {modal === "void" ? (
        <ConfirmModal
          title={`Void ${invoice.number}?`}
          body="The invoice stays on record as void, and its hours and fixed fees go back to Ready to invoice."
          action="Void invoice"
          onClose={() => setModal(null)}
          onConfirm={async () => {
            await run(() => voidInvoice(invoice.id));
            setModal(null);
          }}
        />
      ) : null}
      {modal === "delete" ? (
        <ConfirmModal
          title={`Delete ${invoice.number}?`}
          body="The draft is deleted and its hours go back to Ready to invoice."
          action="Delete draft"
          onClose={() => setModal(null)}
          onConfirm={async () => {
            try {
              await deleteInvoice(invoice.id);
              router.push("/invoices");
            } catch (err) {
              setError(errorText(err, "Couldn't delete the draft."));
              setModal(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
