export type ExportFormat = "csv" | "xlsx" | "pdf";

type ExportRow = Record<string, string | number | boolean | null | undefined>;

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportTableData(
  filename: string,
  columns: { key: string; label: string }[],
  rows: ExportRow[],
  format: ExportFormat,
): void {
  if (format === "pdf") {
    const html = `
      <html><head><title>${filename}</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}th{background:#f4f4f5}</style>
      </head><body><h1>${filename}</h1><table><thead><tr>
      ${columns.map((c) => `<th>${c.label}</th>`).join("")}
      </tr></thead><tbody>
      ${rows.map((row) => `<tr>${columns.map((c) => `<td>${row[c.key] ?? ""}</td>`).join("")}</tr>`).join("")}
      </tbody></table></body></html>`;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    return;
  }

  const header = columns.map((c) => escapeCsv(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCsv(String(row[c.key] ?? ""))).join(","))
    .join("\n");
  const csv = `${header}\n${body}`;
  const mime = format === "xlsx" ? "application/vnd.ms-excel" : "text/csv;charset=utf-8";
  const ext = format === "xlsx" ? "xls" : "csv";
  downloadBlob(`${filename}.${ext}`, new Blob([csv], { type: mime }));
}
