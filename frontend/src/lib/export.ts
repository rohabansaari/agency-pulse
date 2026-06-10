import * as XLSX from "xlsx";

export type ExportFormat = "csv" | "xlsx" | "pdf";

export type ExportColumn = { key: string; label: string };

export type ExportRow = Record<string, string | number | boolean | null | undefined>;

export type ExportSheet = {
  name: string;
  columns: ExportColumn[];
  rows: ExportRow[];
};

function cellValue(value: ExportRow[string]): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

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

function rowsToMatrix(columns: ExportColumn[], rows: ExportRow[]): string[][] {
  const header = columns.map((column) => column.label);
  const body = rows.map((row) => columns.map((column) => cellValue(row[column.key])));
  return [header, ...body];
}

export function buildCsv(columns: ExportColumn[], rows: ExportRow[]): string {
  const matrix = rowsToMatrix(columns, rows);
  return matrix
    .map((line) => line.map((cell) => escapeCsv(cell)).join(","))
    .join("\n");
}

export function buildXlsxWorkbook(sheets: ExportSheet[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const matrix = rowsToMatrix(sheet.columns, sheet.rows);
    const worksheet = XLSX.utils.aoa_to_sheet(matrix);
    const safeName = sheet.name.slice(0, 31).replace(/[\\/?*[\]]/g, "");
    XLSX.utils.book_append_sheet(workbook, worksheet, safeName || "Sheet1");
  }

  return workbook;
}

export function exportTableData(
  filename: string,
  columns: ExportColumn[],
  rows: ExportRow[],
  format: ExportFormat,
  extraSheets: ExportSheet[] = [],
): void {
  const primarySheet: ExportSheet = { name: "Data", columns, rows };
  const sheets: ExportSheet[] = format === "csv" ? [primarySheet] : [primarySheet, ...extraSheets];

  if (format === "pdf") {
    const primary = sheets[0];
    const html = `
      <html><head><title>${filename}</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px}table{border-collapse:collapse;width:100%;margin-bottom:24px}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}th{background:#f4f4f5}h2{font-size:14px;margin:16px 0 8px}</style>
      </head><body>
      ${sheets
        .map(
          (sheet) => `
        <h2>${sheet.name}</h2>
        <table><thead><tr>${sheet.columns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
        <tbody>${sheet.rows.map((row) => `<tr>${sheet.columns.map((c) => `<td>${cellValue(row[c.key])}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
        )
        .join("")}
      </body></html>`;
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

  if (format === "xlsx") {
    const workbook = buildXlsxWorkbook(sheets);
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    downloadBlob(
      `${filename}.xlsx`,
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    return;
  }

  downloadBlob(`${filename}.csv`, new Blob([buildCsv(columns, rows)], { type: "text/csv;charset=utf-8" }));
}
