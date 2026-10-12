/**
 * Ledger table class names. Wrap tables in `tableWrap` (relative + horizontal
 * scroll on phones) inside a Panel with `flush`, or a rounded card.
 */
export const ledgerTable = {
  card: "overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]",
  wrap: "relative overflow-x-auto",
  table: "w-full text-left text-sm",
  thead: "border-y border-[var(--border)] bg-[var(--accent-sand)]/60 text-xs uppercase tracking-[0.04em] text-[var(--muted)]",
  th: "px-5 py-2.5 font-medium",
  tbody: "divide-y divide-[var(--border-subtle)]",
  td: "px-5 py-3 align-middle",
  rowHover: "transition-colors hover:bg-[var(--accent-sand)]/40",
} as const;

/** Small bordered action button used inside table rows. */
export const rowButton =
  "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card-elevated)] px-3 text-[13px] font-medium text-[var(--foreground)] transition hover:bg-[var(--accent-sand)] disabled:opacity-50";
