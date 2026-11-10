"use client";

import { Alert } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import {
  ApiError,
  fetchSampleDataStatus,
  formatApiErrors,
  loadSampleData,
  removeSampleData,
  type SampleDataStatus,
} from "@/lib/api";
import { useEffect, useState } from "react";

const LABELS: Record<string, string> = {
  time_entry: "time and leave entries",
  project: "projects",
  project_assignment: "project assignments",
  salary_contract: "salary contracts",
  overtime_request: "overtime requests",
  salary_advance: "salary advances",
  team: "team",
  team_member: "team memberships",
  user: "sample people",
  invoice: "invoices",
};

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? formatApiErrors(err.errors) || err.message : fallback;
}

export function SampleDataPanel() {
  const [status, setStatus] = useState<SampleDataStatus | null>(null);
  const [busy, setBusy] = useState<"load" | "remove" | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchSampleDataStatus()
      .then((result) => {
        if (!cancelled) setStatus(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorText(err, "Couldn't check for sample data."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLoad(sampleTeam = false) {
    setBusy("load");
    setError("");
    setSuccess("");
    try {
      setStatus(await loadSampleData({ sampleTeam }));
      setSuccess("Sample data loaded. Open the dashboard, Reports or Profitability to see it.");
    } catch (err) {
      setError(errorText(err, "Loading sample data failed."));
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    setBusy("remove");
    setError("");
    setSuccess("");
    try {
      setStatus(await removeSampleData());
      setConfirmRemove(false);
      setSuccess("Sample data removed. Your own data was not touched.");
    } catch (err) {
      setError(errorText(err, "Removing sample data failed."));
    } finally {
      setBusy(null);
    }
  }

  if (!status) {
    return error ? <Alert variant="error">{error}</Alert> : <p className="text-sm text-[var(--muted)]">Checking…</p>;
  }

  const summary = Object.entries(status.counts)
    .filter(([type]) => LABELS[type])
    .map(([type, count]) => `${count} ${LABELS[type]}`)
    .join(", ");

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      {status.loaded ? (
        <>
          <p className="text-sm text-[var(--foreground)]">
            Sample data is loaded: <span className="text-[var(--muted)]">{summary}.</span>
          </p>
          <p className="text-sm text-[var(--muted)]">
            Removing it deletes only these rows. Your employees and anything you created yourself stay. Payroll runs
            you created while sample data was loaded keep their totals, so delete those separately.
          </p>
          {confirmRemove ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[var(--foreground)]">Remove all sample data?</span>
              <Button variant="danger" onClick={handleRemove} disabled={busy !== null}>
                {busy === "remove" ? "Removing…" : "Yes, remove it"}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmRemove(false)} disabled={busy !== null}>
                Cancel
              </Button>
            </div>
          ) : (
            <div>
              <Button variant="secondary" onClick={() => setConfirmRemove(true)}>
                Remove sample data
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
            <li>6 client projects with budgets, bill rates and fixed fees</li>
            <li>About 2 months of tracked and manual hours for your employees, with a few awaiting approval</li>
            <li>Salary contracts for employees who don&apos;t have one yet</li>
            <li>Leave, overtime and salary advance requests</li>
          </ul>
          {status.employees > 0 ? (
            <>
              <p className="text-sm text-[var(--muted)]">
                It uses your {status.employees} active {status.employees === 1 ? "employee" : "employees"}. Every row is
                tracked, so you can remove it all in one click later.
              </p>
              <div>
                <Button onClick={() => void handleLoad()} disabled={busy !== null}>
                  {busy === "load" ? "Loading… (up to a minute)" : "Load sample data"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--muted)]">
                You don&apos;t have employees yet, so this also adds a sample team of six people and a manager. They
                can&apos;t sign in and are removed with the rest of the sample data.
              </p>
              <div>
                <Button onClick={() => void handleLoad(true)} disabled={busy !== null}>
                  {busy === "load" ? "Loading… (up to a minute)" : "Load sample data with a sample team"}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
