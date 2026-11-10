"use client";

import { daysFromToday, hours, isoToLong, money, statusLabel } from "@/components/invoices/format";
import { InvoiceSettingsModal } from "@/components/invoices/InvoiceSettingsModal";
import { ledgerTable } from "@/components/ledger/table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Alert, EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { ApiError, createInvoice, fetchInvoices, fetchUnbilledWork, formatApiErrors } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { InvoiceList, UnbilledClient } from "@/lib/types";
import { ArrowRight, FileText, Plus, ReceiptText, Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const FILTERS = [
  { id: "", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "sent", label: "Sent" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
  { id: "void", label: "Void" },
] as const;

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? formatApiErrors(err.errors) || err.message : fallback;
}

function SummaryTile({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "danger" | "success" | "primary";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        tone === "danger"
          ? "border-[var(--accent-coral)]/30 bg-[var(--accent-coral-soft)]"
          : "border-[var(--border)] bg-[var(--card)]",
      )}
    >
      <p className={cn("text-[0.8125rem]", tone === "danger" ? "text-[var(--accent-coral)]" : "text-[var(--muted)]")}>{label}</p>
      <p
        className={cn(
          "tnum mt-2 text-[1.625rem] font-semibold leading-none tracking-[-0.02em]",
          tone === "danger" && "text-[var(--accent-coral)]",
          tone === "success" && "text-[var(--accent-emerald)]",
          tone === "primary" && "text-[var(--primary)]",
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-[0.8125rem] text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function CreateInvoiceModal({
  client,
  onClose,
}: {
  client: UnbilledClient;
  onClose: () => void;
}) {
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setBusy(true);
    setError("");
    try {
      const invoice = await createInvoice({
        client_name: client.client_name,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(errorText(err, "Couldn't create the invoice."));
      setBusy(false);
    }
  }

  return (
    <Modal title={`Invoice ${client.client_name}`} description="A draft you can edit before sending." onClose={onClose}>
      <div className="flex flex-col gap-5">
        <ul className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border)]">
          {client.projects.map((project) => (
            <li key={project.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{project.name}</span>
                <span className="text-[0.8125rem] text-[var(--muted)]">
                  {project.billing_type === "fixed" ? "Fixed fee not yet invoiced" : `${hours(project.hours)} approved, not invoiced`}
                </span>
              </span>
              <span className="tnum shrink-0 font-semibold">{money(project.amount)}</span>
            </li>
          ))}
        </ul>
        <div>
          <p className="text-sm font-medium">Period (optional)</p>
          <p className="mt-0.5 text-[0.8125rem] text-[var(--muted)]">
            Leave empty to bill all unbilled hours up to today. Fixed fees are billed in full either way.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <DatePicker label="From" value={startDate} onChange={setStartDate} />
            <DatePicker label="To" value={endDate} onChange={setEndDate} />
          </div>
        </div>
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void create()} disabled={busy}>
            {busy ? "Creating…" : "Create draft"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function InvoicesView() {
  const [filter, setFilter] = useState<string>("");
  const [list, setList] = useState<InvoiceList | null>(null);
  const [unbilled, setUnbilled] = useState<UnbilledClient[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState<UnbilledClient | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchInvoices({ status: filter }), fetchUnbilledWork()])
      .then(([invoices, work]) => {
        if (cancelled) return;
        setList(invoices);
        setUnbilled(work.clients);
        setError("");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorText(err, "Couldn't load invoices."));
      });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const summary = list?.summary;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.8125rem] text-[var(--muted)]">Insights</p>
          <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-[-0.02em]">Invoices</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--muted)]">
            Bill clients from approved hours and fixed fees. Every hour is billed once.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-4 w-4" aria-hidden="true" />
          Invoice details
        </Button>
      </header>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          label="Ready to invoice"
          value={summary ? money(summary.unbilled) : "—"}
          detail="Approved work not yet billed"
          tone="primary"
        />
        <SummaryTile
          label="Outstanding"
          value={summary ? money(summary.outstanding) : "—"}
          detail={summary ? `${summary.outstanding_count} sent and unpaid` : " "}
        />
        <SummaryTile
          label="Overdue"
          value={summary ? money(summary.overdue) : "—"}
          detail={summary ? `${summary.overdue_count} past the due date` : " "}
          tone={summary && summary.overdue_count > 0 ? "danger" : "default"}
        />
        <SummaryTile
          label="Paid this month"
          value={summary ? money(summary.paid_this_month) : "—"}
          detail={summary ? `${summary.drafts} draft${summary.drafts === 1 ? "" : "s"} waiting to send` : " "}
          tone="success"
        />
      </section>

      <section aria-labelledby="unbilled-heading" className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pb-3 pt-5 sm:px-7">
          <div>
            <h2 id="unbilled-heading" className="text-base font-semibold">
              Ready to invoice
            </h2>
            <p className="mt-0.5 text-[0.8125rem] text-[var(--muted)]">Approved hours and fixed fees no invoice has billed yet.</p>
          </div>
        </div>
        {unbilled === null ? (
          <div className="px-5 pb-6 sm:px-7">
            <div className="h-20 animate-pulse rounded-xl bg-[var(--accent-sand)]" />
          </div>
        ) : unbilled.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-[var(--muted)] sm:px-7">
            Nothing to bill. Approved hours on hourly projects and fixed fees will show up here.
          </p>
        ) : (
          <ul>
            {unbilled.map((client) => (
              <li
                key={client.client_name}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-[var(--border-subtle)] px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-7"
              >
                <div className="min-w-0">
                  <p className="font-medium">{client.client_name}</p>
                  <p className="tnum truncate text-[0.8125rem] text-[var(--muted)]">
                    {client.projects.map((project) => project.name).join(" · ")}
                    {client.hours > 0 ? ` · ${hours(client.hours)}` : ""}
                    {client.first_date ? ` · since ${isoToLong(client.first_date)}` : ""}
                  </p>
                </div>
                <span className="tnum text-right text-base font-semibold">{money(client.amount)}</span>
                <Button size="sm" className="col-span-2 sm:col-span-1" onClick={() => setCreating(client)}>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Create invoice
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="invoices-heading" className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 sm:px-7">
          <h2 id="invoices-heading" className="text-base font-semibold">
            All invoices
          </h2>
          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1 rounded-xl bg-[var(--accent-sand)] p-1">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "min-h-9 rounded-lg px-3 text-[0.8125rem] font-medium transition",
                  filter === item.id
                    ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {list === null ? (
          <div className="p-5 sm:px-7">
            <div className="h-40 animate-pulse rounded-xl bg-[var(--accent-sand)]" />
          </div>
        ) : list.invoices.length === 0 ? (
          <div className="p-5 sm:px-7">
            <EmptyState
              icon={filter ? FileText : ReceiptText}
              title={filter ? "No invoices here" : "No invoices yet"}
              description={
                filter
                  ? "Try another filter."
                  : "Create one from the work above. It starts as a draft you can edit before sending."
              }
            />
          </div>
        ) : (
          <div className={cn(ledgerTable.wrap, "mt-4")}>
            <table className={cn(ledgerTable.table, "min-w-[52rem]")}>
              <thead className={ledgerTable.thead}>
                <tr>
                  <th scope="col" className={ledgerTable.th}>Invoice</th>
                  <th scope="col" className={ledgerTable.th}>Client</th>
                  <th scope="col" className={ledgerTable.th}>Issued</th>
                  <th scope="col" className={ledgerTable.th}>Due</th>
                  <th scope="col" className={cn(ledgerTable.th, "text-right")}>Total</th>
                  <th scope="col" className={cn(ledgerTable.th, "text-right")}>Balance</th>
                  <th scope="col" className={ledgerTable.th}>Status</th>
                  <th scope="col" className={ledgerTable.th}>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className={ledgerTable.tbody}>
                {list.invoices.map((invoice) => {
                  const status = statusLabel(invoice);
                  const due = daysFromToday(invoice.due_date);
                  return (
                    <tr key={invoice.id} className={cn(ledgerTable.rowHover, "group")}>
                      <td className={cn(ledgerTable.td, "font-medium")}>
                        <Link href={`/invoices/${invoice.id}`} className="hover:text-[var(--primary)] hover:underline">
                          {invoice.number}
                        </Link>
                      </td>
                      <td className={ledgerTable.td}>{invoice.client_name}</td>
                      <td className={cn(ledgerTable.td, "tnum whitespace-nowrap")}>{isoToLong(invoice.issue_date)}</td>
                      <td className={cn(ledgerTable.td, "tnum whitespace-nowrap")}>
                        {isoToLong(invoice.due_date)}
                        {invoice.status === "sent" ? (
                          <span className={cn("block text-xs", invoice.overdue ? "text-[var(--accent-coral)]" : "text-[var(--muted)]")}>
                            {due < 0 ? `${-due} day${due === -1 ? "" : "s"} late` : due === 0 ? "Due today" : `in ${due} day${due === 1 ? "" : "s"}`}
                          </span>
                        ) : null}
                      </td>
                      <td className={cn(ledgerTable.td, "tnum whitespace-nowrap text-right")}>{money(invoice.total)}</td>
                      <td className={cn(ledgerTable.td, "tnum whitespace-nowrap text-right font-medium")}>
                        {invoice.status === "void" || invoice.status === "draft" ? "—" : money(invoice.balance)}
                      </td>
                      <td className={ledgerTable.td}>
                        <Badge variant={status.tone}>{status.label}</Badge>
                      </td>
                      <td className={cn(ledgerTable.td, "text-right")}>
                        <Link
                          href={`/invoices/${invoice.id}`}
                          aria-label={`Open ${invoice.number}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--accent-sand)] hover:text-[var(--foreground)]"
                        >
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {creating ? <CreateInvoiceModal client={creating} onClose={() => setCreating(null)} /> : null}
      {settingsOpen ? <InvoiceSettingsModal onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  );
}
