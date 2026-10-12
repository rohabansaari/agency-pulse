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
  emails_sent: number;
  emails_failed: number;
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
      <div className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary-muted)] p-4">
        <button
          type="button"
          onClick={() => void downloadSampleCsv()}
          className="text-sm font-medium text-[var(--primary)] hover:underline"
        >
          Download sample CSV
        </button>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-[var(--card)] p-3 text-xs">
            <p className="font-semibold text-[var(--foreground)]">Allowed roles</p>
            <p className="mt-1 text-[var(--muted)]">employee, manager, sub_admin</p>
            <p className="mt-2 text-[var(--muted)]">Admin and Super Admin cannot be imported.</p>
          </div>
          <div className="rounded-lg bg-[var(--card)] p-3 text-xs">
            <p className="font-semibold text-[var(--foreground)]">Allowed salary types</p>
            <p className="mt-1 text-[var(--muted)]">monthly, hourly</p>
            <p className="mt-2 text-[var(--muted)]">Extra columns are ignored automatically.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
          className="text-sm text-[var(--muted)] file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-xl file:border file:border-[var(--border)] file:bg-[var(--card-elevated)] file:px-4 file:text-sm file:font-medium file:text-[var(--foreground)] hover:file:bg-[var(--accent-sand)] sm:col-span-2"
        />
        <button
          type="button"
          disabled={submitting || !csvFile}
          onClick={() => void handleCsvImport()}
          className="inline-flex min-h-11 items-center justify-center justify-self-start rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] disabled:opacity-60 sm:col-span-2"
        >
          {submitting ? "Importing…" : "Import CSV"}
        </button>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {importReport ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--accent-sand)] p-4">
          <p className="text-sm font-semibold text-[var(--foreground)]">Import complete</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{importReport.message}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
            <span>Total records: {importReport.total}</span>
            <span>Created: {importReport.created}</span>
            <span>Emails sent: {importReport.emails_sent}</span>
            <span>Invalid rows: {importReport.failed_count}</span>
          </div>
          {importReport.emails_failed > 0 ? (
            <p className="mt-2 text-sm text-[var(--accent-copper)]">
              {importReport.emails_failed} invitation email
              {importReport.emails_failed === 1 ? "" : "s"} could not be delivered. Resend from Employees
              after verifying your MailerSend domain.
            </p>
          ) : null}
          {importReport.failed_count > 0 ? (
            <p className="mt-2 text-sm text-[var(--accent-copper)]">
              {importReport.failed_count} record{importReport.failed_count === 1 ? "" : "s"} require attention.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {importReport.failed_count > 0 ? (
              <button
                type="button"
                onClick={downloadFailedRecords}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium"
              >
                Download failed records
              </button>
            ) : null}
            <button
              type="button"
              onClick={downloadImportResults}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium"
            >
              Download import results
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
