"use client";

import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-muted)] text-[var(--primary)]">
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-[var(--muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
      <p className="text-sm text-[var(--muted)]">{label}</p>
    </div>
  );
}

export function Alert({
  variant,
  children,
}: {
  variant: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    error: "border-[var(--accent-coral)]/30 bg-[var(--accent-coral-soft)] text-[var(--accent-coral)]",
    success: "border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]",
    info: "border-[var(--primary)]/25 bg-[var(--primary-muted)] text-[var(--primary)]",
  };

  return (
    <p role={variant === "error" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", styles[variant])}>{children}</p>
  );
}
