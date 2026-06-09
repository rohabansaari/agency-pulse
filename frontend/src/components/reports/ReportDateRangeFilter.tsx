"use client";

import {
  compareDdMmYyyy,
  formatDateDdMmYyyy,
  isValidDdMmYyyy,
  todayDdMmYyyy,
} from "@/lib/dates";
import { DatePicker } from "@/components/ui/DatePicker";
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

  useEffect(() => {
    setDraftStart(value.start_date);
    setDraftEnd(value.end_date);
  }, [value.end_date, value.start_date]);

  function applyPreset(preset: Preset) {
    setError("");
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
    onChange({ start_date: draftStart, end_date: draftEnd });
  }

  return (
    <div className={`flex flex-col items-end gap-1 ${className}`}>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {(
          [
            ["today", "Today"],
            ["week", "Week"],
            ["month", "Month"],
          ] as const
        ).map(([preset, label]) => (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            onClick={() => applyPreset(preset)}
            className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {label}
          </button>
        ))}
        <DatePicker
          hideLabel
          value={draftStart}
          onChange={setDraftStart}
          disabled={disabled}
          compact
        />
        <span className="text-[11px] text-zinc-400">–</span>
        <DatePicker
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
          className="rounded-md bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Apply
        </button>
      </div>
      {error ? <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
