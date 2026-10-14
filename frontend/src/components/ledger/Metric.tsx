import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Tone = "default" | "attention";

/** Ledger KPI tile: label, large tabular value, optional detail and progress bar. */
export function Metric({
  label,
  value,
  detail,
  icon,
  progress,
  tone = "default",
  numeric = true,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  /** 0–100; renders a thin bar under the value. */
  progress?: number;
  tone?: Tone;
  numeric?: boolean;
}) {
  const attention = tone === "attention";

  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        attention
          ? "border-[var(--accent-copper)]/30 bg-[var(--accent-copper-soft)]"
          : "border-[var(--border)] bg-[var(--card)]",
      )}
    >
      <div className={cn("flex items-center justify-between text-[0.8125rem]", attention ? "text-[var(--accent-copper)]" : "text-[var(--muted)]")}>
        <p>{label}</p>
        {icon ? <span aria-hidden="true">{icon}</span> : null}
      </div>
      <p
        className={cn(
          "mt-2 truncate text-[1.75rem] font-semibold tracking-[-0.01em] text-[var(--foreground)]",
          numeric && "tnum",
        )}
      >
        {value}
      </p>
      {progress !== undefined ? (
        <div className="mt-3 h-1.5 rounded-full bg-[var(--border-subtle)]" aria-hidden="true">
          <div
            className="h-1.5 rounded-full bg-[var(--primary)]"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      ) : null}
      {detail ? <div className="mt-2 text-[0.8125rem] text-[var(--muted)]">{detail}</div> : null}
    </div>
  );
}
