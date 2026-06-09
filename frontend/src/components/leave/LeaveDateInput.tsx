"use client";

import { DatePicker } from "@/components/ui/DatePicker";

export function LeaveDateInput({
  id,
  label,
  value,
  onChange,
  minDate,
  hint,
  compact = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  hint?: string;
  compact?: boolean;
}) {
  return (
    <DatePicker
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      minDate={minDate}
      hint={hint}
      required
      compact={compact}
    />
  );
}
