"use client";

import { DatePicker } from "@/components/ui/DatePicker";
import { cn } from "@/lib/cn";
import {
  compareDdMmYyyy,
  formatDateDdMmYyyy,
  isValidDdMmYyyy,
} from "@/lib/dates";
import { useEffect, useState } from "react";

export type ReportDateRange = {
  start_date: string;
  end_date: string;
};

type Preset = "today" | "week" | "month";

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function presetDateRange(preset: Preset): ReportDateRange {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (preset === "today") {
    const value = formatDateDdMmYyyy(today);
    return { start_date: value, end_date: value };
  }

  if (preset === "month") {
    return {
      start_date: formatDateDdMmYyyy(startOfMonth(today)),
      end_date: formatDateDdMmYyyy(today),
    };
  }

  return {
    start_date: formatDateDdMmYyyy(startOfWeek(today)),
    end_date: formatDateDdMmYyyy(today),
  };
}

export function defaultReportDateRange(): ReportDateRange {
  return presetDateRange("week");
}

export function ReportDateRangeFilter({
  value,
  onChange,
  disabled = false,
  className = "",
}: {
  value: ReportDateRange;
  onChange: (range: ReportDateRange) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [draftStart, setDraftStart] = useState(value.start_date);
  const [draftEnd, setDraftEnd] = useState(value.end_date);
  const [error, setError] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);

  useEffect(() => {
    setDraftStart(value.start_date);
    setDraftEnd(value.end_date);
  }, [value.end_date, value.start_date]);

  function applyPreset(preset: Preset) {
    setError("");
    setActivePreset(preset);
    onChange(presetDateRange(preset));
  }

  function applyCustom() {
    if (!isValidDdMmYyyy(draftStart) || !isValidDdMmYyyy(draftEnd)) {
      setError("Invalid date format.");
      return;
    }
    if (compareDdMmYyyy(draftEnd, draftStart) < 0) {
      setError("End before start.");
      return;
    }
    setError("");
    setActivePreset(null);
    onChange({ start_date: draftStart, end_date: draftEnd });
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["today", "Today"],
            ["week", "This week"],
            ["month", "This month"],
          ] as const
        ).map(([preset, label]) => (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            onClick={() => applyPreset(preset)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              activePreset === preset
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:border-[var(--primary)]/30 hover:text-[var(--foreground)]",
            )}
          >
            {label}
          </button>
        ))}
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2 py-1">
          <DatePicker hideLabel value={draftStart} onChange={setDraftStart} disabled={disabled} compact />
          <span className="text-xs text-[var(--muted-foreground)]">→</span>
          <DatePicker hideLabel value={draftEnd} onChange={setDraftEnd} minDate={draftStart} disabled={disabled} compact />
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={applyCustom}
          className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-xs font-semibold text-[var(--background)] transition hover:opacity-90 disabled:opacity-50"
        >
          Apply
        </button>
      </div>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
