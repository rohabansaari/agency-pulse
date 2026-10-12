"use client";

import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export type SegmentedOption<T extends string> = { value: T; label: ReactNode; count?: number };

/** Ledger segmented control / tab strip (role=tablist). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex flex-wrap gap-1 rounded-xl bg-[var(--accent-sand)] p-1", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-9 rounded-lg px-3 text-[13px] transition",
              selected
                ? "bg-[var(--card-elevated)] font-medium text-[var(--foreground)] shadow-[var(--shadow-sm)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {option.label}
            {option.count !== undefined ? <span className="tnum ml-1.5 text-[var(--muted)]">{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
