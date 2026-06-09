"use client";

import { compareDdMmYyyy, formatDateDdMmYyyy, isValidDdMmYyyy, parseDdMmYyyy } from "@/lib/dates";
import { useEffect, useId, useRef, useState } from "react";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function startOfCalendarMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildCalendarDays(viewMonth: Date): (Date | null)[] {
  const first = startOfCalendarMonth(viewMonth);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0,
  ).getDate();

  const cells: (Date | null)[] = Array.from({ length: startOffset }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function DatePicker({
  id,
  label,
  value,
  onChange,
  minDate,
  hint,
  disabled = false,
  required = false,
  compact = false,
  hideLabel = false,
  className = "",
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  compact?: boolean;
  hideLabel?: boolean;
  className?: string;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const parsed = parseDdMmYyyy(value);
    return parsed ?? new Date();
  });

  useEffect(() => {
    const parsed = parseDdMmYyyy(value);
    if (parsed) {
      setViewMonth(parsed);
    }
  }, [value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function selectDate(date: Date) {
    const formatted = formatDateDdMmYyyy(date);
    if (minDate && isValidDdMmYyyy(minDate) && compareDdMmYyyy(formatted, minDate) < 0) {
      return;
    }

    onChange(formatted);
    setOpen(false);
  }

  function isDisabledDay(date: Date): boolean {
    if (!minDate || !isValidDdMmYyyy(minDate)) {
      return false;
    }

    return compareDdMmYyyy(formatDateDdMmYyyy(date), minDate) < 0;
  }

  const inputClasses = compact
    ? "w-[88px] rounded-md border border-zinc-200 px-2 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-900"
    : "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && !hideLabel && !compact ? (
        <label
          htmlFor={inputId}
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          {label}
        </label>
      ) : null}

      <div className="relative">
        <input
          id={inputId}
          readOnly
          required={required}
          disabled={disabled}
          value={value}
          placeholder="dd/mm/yyyy"
          onClick={() => !disabled && setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (!disabled) {
                setOpen(true);
              }
            }
          }}
          className={`${inputClasses} cursor-pointer pr-8`}
          aria-haspopup="dialog"
          aria-expanded={open}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          aria-label="Open calendar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </button>
      </div>

      {hint ? <span className="mt-1 block text-xs text-zinc-500">{hint}</span> : null}

      {open ? (
        <div
          role="dialog"
          aria-label="Choose date"
          className="absolute right-0 z-50 mt-1 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => setViewMonth((current) => addMonths(current, -1))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              {monthLabel(viewMonth)}
            </span>
            <button
              type="button"
              className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => setViewMonth((current) => addMonths(current, 1))}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-zinc-500">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {buildCalendarDays(viewMonth).map((date, index) => {
              if (!date) {
                return <span key={`empty-${index}`} />;
              }

              const selected = isValidDdMmYyyy(value) && sameDay(date, parseDdMmYyyy(value)!);
              const isToday = sameDay(date, new Date());
              const dayDisabled = isDisabledDay(date);

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  disabled={dayDisabled}
                  onClick={() => selectDate(date)}
                  className={`h-8 rounded-md text-sm transition ${
                    selected
                      ? "bg-blue-600 font-semibold text-white"
                      : isToday
                        ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  } ${dayDisabled ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
