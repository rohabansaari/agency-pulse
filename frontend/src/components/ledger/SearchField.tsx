"use client";

import { cn } from "@/lib/cn";
import { Search } from "lucide-react";

/** Search input with a leading icon and a visually hidden label. */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 min-w-[13.75rem] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-3 focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/15",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
      />
    </label>
  );
}
