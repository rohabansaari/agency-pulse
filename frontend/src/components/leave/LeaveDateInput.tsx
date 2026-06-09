"use client";

import {
  formatAsDdMmYyyyTyping,
  isBeforeDdMmYyyy,
  isValidDdMmYyyy,
  normalizeDdMmYyyy,
} from "@/lib/dates";

export function LeaveDateInput({
  id,
  label,
  value,
  onChange,
  minDate,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  hint?: string;
}) {
  function handleChange(next: string) {
    onChange(formatAsDdMmYyyyTyping(next));
  }

  function handleBlur() {
    if (!value.trim()) {
      return;
    }

    const normalized = normalizeDdMmYyyy(value);
    onChange(normalized);

    if (minDate && isValidDdMmYyyy(normalized) && isBeforeDdMmYyyy(normalized, minDate)) {
      onChange(minDate);
    }
  }

  return (
    <label className="block text-sm" htmlFor={id}>
      <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <input
        id={id}
        required
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/yyyy"
        pattern="\d{2}/\d{2}/\d{4}"
        title={hint}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
        maxLength={10}
        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      {hint ? (
        <span className="mt-1 block text-xs text-zinc-500">{hint}</span>
      ) : null}
    </label>
  );
}
