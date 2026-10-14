"use client";

import { Badge } from "@/components/ui/Badge";
import { Alert, EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { Check, Inbox, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Ledger approval building blocks shared by the leave, overtime, manual time
 * and salary advance screens. Lists are container-query driven so the same
 * queue reads well in a ~340px dashboard column and at full page width.
 */

export type RequestKind = "time" | "leave" | "overtime" | "advance";

const KIND_STYLE: Record<RequestKind, { label: string; className: string }> = {
  time: { label: "Time", className: "bg-[var(--primary-muted)] text-[var(--primary)]" },
  leave: { label: "Leave", className: "bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]" },
  overtime: { label: "OT", className: "bg-[var(--accent-copper-soft)] text-[var(--accent-copper)]" },
  advance: { label: "Adv", className: "bg-[var(--accent-sand)] text-[var(--foreground)]" },
};

const KIND_NAME: Record<RequestKind, string> = {
  time: "Manual time",
  leave: "Leave",
  overtime: "Overtime",
  advance: "Salary advance",
};

/** Small labelled square identifying the request type. */
export function TypeChip({ kind, className }: { kind: RequestKind; className?: string }) {
  const style = KIND_STYLE[kind];
  return (
    <span
      title={KIND_NAME[kind]}
      className={cn(
        "inline-flex h-8 w-10 shrink-0 items-center justify-center rounded-lg text-[0.6875rem] font-semibold",
        style.className,
        className,
      )}
    >
      <span aria-hidden="true">{style.label}</span>
      <span className="sr-only">{KIND_NAME[kind]}</span>
    </span>
  );
}

const STATUS_VARIANT: Record<string, "default" | "primary" | "success" | "warning" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  deducted: "primary",
  running: "primary",
  stopped: "default",
};

/** Pill with a word for request status (never colour alone). */
export function StatusPill({ status, label, className }: { status: string; label?: ReactNode; className?: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "default"} className={cn("shrink-0 py-1", className)}>
      {label ?? status}
    </Badge>
  );
}

/** Approve (solid success) and Reject (danger outline) buttons, ≥44px tall. */
export function ApproveRejectButtons({
  onApprove,
  onReject,
  disabled,
  subject,
  className,
}: {
  onApprove: () => void;
  onReject: () => void;
  disabled?: boolean;
  /** Spoken context, e.g. "Bilal Ahmed's manual time". */
  subject: string;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={onReject}
        aria-label={`Reject ${subject}`}
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--accent-coral)]/40 bg-[var(--card)] px-4 text-sm font-medium text-[var(--danger)] transition hover:bg-[var(--accent-coral-soft)] disabled:pointer-events-none disabled:opacity-50 @lg:flex-none"
      >
        <X className="h-4 w-4" aria-hidden="true" />
        Reject
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onApprove}
        aria-label={`Approve ${subject}`}
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-emerald)] px-4 text-sm font-semibold text-[var(--card)] transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50 @lg:flex-none"
      >
        <Check className="h-4 w-4" aria-hidden="true" />
        Approve
      </button>
    </div>
  );
}

/** Ledger card wrapping a request list; establishes the container for queries. */
export function RequestPanel({
  title,
  description,
  count,
  action,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = `requests-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      className={cn("@container min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
            {title}
            {count !== undefined ? (
              <span className="tnum inline-flex min-w-6 justify-center rounded-full bg-[var(--accent-sand)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
                {count}
              </span>
            ) : null}
          </h2>
          {description ? <p className="mt-0.5 text-[0.8125rem] text-[var(--muted)]">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** One request row: type chip, who, what/when, optional note and actions. */
export function RequestItem({
  kind,
  who,
  what,
  note,
  meta,
  status,
  actions,
}: {
  kind?: RequestKind;
  who: ReactNode;
  what: ReactNode;
  note?: ReactNode;
  /** Right-aligned secondary info (age, reviewer…). */
  meta?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 px-5 py-4 @lg:flex-row @lg:items-start @lg:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {kind ? <TypeChip kind={kind} className="mt-0.5" /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 text-sm font-medium text-[var(--foreground)]">{who}</p>
            {status}
          </div>
          <p className="mt-0.5 text-[0.8125rem] text-[var(--muted)]">{what}</p>
          {note ? <p className="mt-2 text-sm leading-relaxed text-[var(--foreground)]/80">{note}</p> : null}
          {meta ? <p className="mt-1 text-xs text-[var(--muted-foreground)]">{meta}</p> : null}
        </div>
      </div>
      {actions ? <div className="shrink-0 @lg:pt-0.5">{actions}</div> : null}
    </li>
  );
}

/** Divided list body for RequestItem rows. */
export function RequestList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">{children}</ul>;
}

/** Inline error + empty states inside a RequestPanel. */
export function PanelMessage({ error }: { error: string }) {
  return error ? (
    <div className="px-5 pb-3">
      <Alert variant="error">{error}</Alert>
    </div>
  ) : null;
}

export function PanelEmpty({ title, description, icon = Inbox }: { title: string; description?: string; icon?: LucideIcon }) {
  return (
    <div className="px-5 pb-5">
      <EmptyState icon={icon} title={title} description={description} className="py-8" />
    </div>
  );
}

/** Loading placeholder sized like a short queue. */
export function QueueSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("h-32 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--accent-sand)]", className)}
    />
  );
}

/** Short locale date ("10 Oct 2026"), or an em dash when missing. */
export function formatShortDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
