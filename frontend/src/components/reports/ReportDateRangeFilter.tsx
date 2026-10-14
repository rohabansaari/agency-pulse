"use client";

import { DatePicker } from "@/components/ui/DatePicker";
import { cn } from "@/lib/cn";
import {
  compareDdMmYyyy,
  formatDateDdMmYyyy,
  isValidDdMmYyyy,
} from "@/lib/dates";
import { useEffect, useId, useState } from "react";

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

const PRESETS: ReadonlyArray<readonly [Preset, string]> = [
  ["today", "Today"],
  ["week", "This week"],
  ["month", "This month"],
];

function matchingPreset(range: ReportDateRange): Preset | null {
  for (const [preset] of PRESETS) {
    const candidate = presetDateRange(preset);
    if (candidate.start_date === range.start_date && candidate.end_date === range.end_date) {
      return preset;
    }
  }
  return null;
}

/* Restyles the shared compact DatePicker input to sit inside the Ledger field. */
const datePickerSkin =
  "[&_input]:min-h-9 [&_input]:w-[6.5rem] [&_input]:rounded-lg [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-2 [&_input]:text-[0.8125rem] [&_input]:text-[var(--foreground)] [&_input]:outline-none [&_input:focus-visible]:ring-2 [&_input:focus-visible]:ring-[var(--primary)]/25 [&_button[aria-label='Open calendar']]:text-[var(--muted)]";

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
  const fieldId = useId();

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

  const selectedPreset = activePreset ?? matchingPreset(value);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Date range preset"
          className="inline-flex flex-wrap gap-1 rounded-xl bg-[var(--accent-sand)] p-1"
        >
          {PRESETS.map(([preset, label]) => {
            const selected = selectedPreset === preset;
            return (
              <button
                key={preset}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => applyPreset(preset)}
                className={cn(
                  "min-h-9 rounded-lg px-3 text-[0.8125rem] transition disabled:opacity-50",
                  selected
                    ? "bg-[var(--card-elevated)] font-medium text-[var(--foreground)] shadow-[var(--shadow-sm)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div
          role="group"
          aria-label="Custom date range"
          className={cn(
            "flex min-h-11 items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-1.5 focus-within:border-[var(--primary)]",
            datePickerSkin,
          )}
        >
          <label htmlFor={`${fieldId}-start`} className="sr-only">
            Start date
          </label>
          <DatePicker
            id={`${fieldId}-start`}
            hideLabel
            value={draftStart}
            onChange={setDraftStart}
            disabled={disabled}
            compact
          />
          <span aria-hidden="true" className="text-xs text-[var(--muted-foreground)]">
            –
          </span>
          <label htmlFor={`${fieldId}-end`} className="sr-only">
            End date
          </label>
          <DatePicker
            id={`${fieldId}-end`}
            hideLabel
            value={draftEnd}
            onChange={setDraftEnd}
            minDate={draftStart}
            disabled={disabled}
            compact
          />
          <button
            type="button"
            disabled={disabled}
            onClick={applyCustom}
            className="ml-1 min-h-9 rounded-lg bg-[var(--primary)] px-3 text-[0.8125rem] font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
