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
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
          <div className="absolute right-0 z-20 mt-1 min-w-[120px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {formats.map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => handleExport(format)}
                className="block w-full px-3 py-1.5 text-left text-xs uppercase text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
