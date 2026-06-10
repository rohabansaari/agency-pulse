"use client";

import {
  ApiError,
  formatApiErrors,
  importOnboardingEmployees,
  importTeamEmployees,
  onboardingSampleCsvUrl,
  teamSampleCsvUrl,
} from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import type { CsvImportResult, OnboardingStatus } from "@/lib/types";
import { getOrganizationId, getToken } from "@/lib/auth";
import { useState } from "react";

type ImportResponse = {
  message: string;
  created: number;
  failed_count: number;
  total: number;
  failed: { row: number; data: Record<string, string>; errors: string[] }[];
  results: CsvImportResult[];
  status?: OnboardingStatus;
};

function resultHeaders(results: CsvImportResult[], includeStatus = true): string[] {
  const keys = new Set<string>();
  for (const result of results) {
    Object.keys(result.data).forEach((key) => keys.add(key));
  }
  const ordered = Array.from(keys);
  if (includeStatus) {
    ordered.push("status", "error");
  } else {
    ordered.push("error");
  }
  return ordered;
}

function resultRows(results: CsvImportResult[], headers: string[], includeStatus = true): string[][] {
  return results.map((result) =>
    headers.map((header) => {
      if (header === "status") {
        return includeStatus ? (result.status === "imported" ? "Imported" : "Failed") : "";
      }
      if (header === "error") {
        return result.error ?? "";
      }
      return result.data[header] ?? "";
    }),
  );
}

export function EmployeeCsvImport({
  variant = "onboarding",
  submitting,
  onSubmittingChange,
  onStatusChange,
  onImported,
}: {
  variant?: "onboarding" | "employees";
  submitting: boolean;
  onSubmittingChange: (value: boolean) => void;
  onStatusChange?: (status: OnboardingStatus) => void;
  onImported?: () => void;
}) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [importReport, setImportReport] = useState<ImportResponse | null>(null);

  async function downloadSampleCsv() {
    const sampleUrl = variant === "employees" ? teamSampleCsvUrl() : onboardingSampleCsvUrl();
    const token = getToken();
    const organizationId = getOrganizationId();
    const response = await fetch(sampleUrl, {
      headers: {
        Accept: "text/csv",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(organizationId ? { "X-Organization-Id": String(organizationId) } : {}),
      },
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "employee-import-sample.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleCsvImport() {
    if (!csvFile) {
      setError("Choose a CSV file to import.");
      return;
    }
    onSubmittingChange(true);
    setError("");
    setImportReport(null);
    try {
      const response =
        variant === "employees"
          ? await importTeamEmployees(csvFile)
          : await importOnboardingEmployees(csvFile);
      setImportReport(response);
      if (response.status && onStatusChange) {
        onStatusChange(response.status);
      }
      if (response.created > 0) {
        onImported?.();
      }
      setCsvFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "CSV import failed.");
    } finally {
      onSubmittingChange(false);
    }
  }

  function downloadFailedRecords() {
    if (!importReport) return;
    const failedResults = importReport.results.filter((result) => result.status === "failed");
    if (failedResults.length === 0) return;
    const headers = resultHeaders(failedResults, false);
    downloadCsv("employee-import-failed-records.csv", headers, resultRows(failedResults, headers, false));
  }

  function downloadImportResults() {
    if (!importReport) return;
    const headers = resultHeaders(importReport.results, true);
    downloadCsv("employee-import-results.csv", headers, resultRows(importReport.results, headers, true));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
        <button
          type="button"
          onClick={() => void downloadSampleCsv()}
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Download sample CSV
        </button>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md bg-white/80 p-3 text-xs dark:bg-zinc-900/80">
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">Allowed roles</p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">employee, manager, sub_admin</p>
            <p className="mt-2 text-zinc-500">Admin and Super Admin cannot be imported.</p>
          </div>
          <div className="rounded-md bg-white/80 p-3 text-xs dark:bg-zinc-900/80">
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">Allowed salary types</p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">monthly, hourly</p>
            <p className="mt-2 text-zinc-500">Extra columns are ignored automatically.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
          className="text-sm sm:col-span-2"
        />
        <button
          type="button"
          disabled={submitting || !csvFile}
          onClick={() => void handleCsvImport()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 sm:col-span-2 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {submitting ? "Importing…" : "Import CSV"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {importReport ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/60">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Import complete</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {importReport.created} employee{importReport.created === 1 ? "" : "s"} imported successfully.
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-500">
            <span>Total records: {importReport.total}</span>
            <span>Valid: {importReport.created}</span>
            <span>Invalid: {importReport.failed_count}</span>
          </div>
          {importReport.failed_count > 0 ? (
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
              {importReport.failed_count} record{importReport.failed_count === 1 ? "" : "s"} require attention.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {importReport.failed_count > 0 ? (
              <button
                type="button"
                onClick={downloadFailedRecords}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
              >
                Download failed records
              </button>
            ) : null}
            <button
              type="button"
              onClick={downloadImportResults}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
            >
              Download import results
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
