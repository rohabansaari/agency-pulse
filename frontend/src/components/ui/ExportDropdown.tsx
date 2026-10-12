"use client";

import { exportTableData, type ExportFormat, type ExportSheet } from "@/lib/export";
import { useState } from "react";

type Column = { key: string; label: string };
type Row = Record<string, string | number | boolean | null | undefined>;

type ExportDropdownProps = {
  filename: string;
  columns: Column[];
  rows: Row[];
  formats?: ExportFormat[];
  disabled?: boolean;
  extraSheets?: ExportSheet[];
};

export function ExportDropdown({
  filename,
  columns,
  rows,
  formats = ["csv", "xlsx"],
  disabled = false,
  extraSheets = [],
}: ExportDropdownProps) {
  const [open, setOpen] = useState(false);

  if (rows.length === 0) {
    return null;
  }

  function handleExport(format: ExportFormat) {
    exportTableData(filename, columns, rows, format, extraSheets);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent-sand)] disabled:opacity-50"
      >
        Export
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Close export menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 min-w-[120px] rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] py-1 shadow-lg">
            {formats.map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => handleExport(format)}
                className="block w-full px-3 py-1.5 text-left text-sm uppercase text-[var(--foreground)] hover:bg-[var(--accent-sand)]"
              >
                {format}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
