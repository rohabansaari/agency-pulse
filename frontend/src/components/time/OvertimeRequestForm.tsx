"use client";

import {
  ApiError,
  fetchOvertimeContext,
  formatApiErrors,
  submitOvertimeRequest,
} from "@/lib/api";
import type { UserRole } from "@/lib/types";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Input";
import { ddMmYyyyToIso, todayDdMmYyyy } from "@/lib/dates";
import { useCallback, useEffect, useState } from "react";

const DURATION_PRESETS = [
  { label: "30 min", hours: 0.5 },
  { label: "1 hour", hours: 1 },
  { label: "2 hours", hours: 2 },
  { label: "4 hours", hours: 4 },
  { label: "8 hours", hours: 8 },
];

function hoursToSeconds(hours: string): number {
  const value = Number.parseFloat(hours);
  if (Number.isNaN(value) || value <= 0) {
    return 0;
  }
  return Math.round(value * 3600);
}

export function OvertimeRequestForm({
  role,
  onSubmitted,
}: {
  role: UserRole;
  onSubmitted?: () => void;
}) {
  const [context, setContext] = useState<Awaited<ReturnType<typeof fetchOvertimeContext>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [forSelf, setForSelf] = useState(role === "manager");
  const [date, setDate] = useState(todayDdMmYyyy());
  const [hours, setHours] = useState("1");
  const [reason, setReason] = useState("");
  const [projectId, setProjectId] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await fetchOvertimeContext();
      setContext(data);
      const projects = forSelf ? data.self_projects ?? [] : data.projects ?? [];
      if (projects.length > 0) {
        setProjectId(String(projects[0].id));
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load overtime context.",
      );
    } finally {
      setLoading(false);
    }
  }, [forSelf]);

  useEffect(() => {
    void load();
  }, [load]);

  const canSubmit =
    role === "employee"
      ? context?.can_create
      : forSelf
        ? context?.can_create_self
        : false;

  const projects =
    role === "employee"
      ? context?.projects ?? []
      : forSelf
        ? context?.self_projects ?? []
        : [];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    const duration = hoursToSeconds(hours);
    if (duration < 900) {
      setError("Minimum overtime duration is 15 minutes.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await submitOvertimeRequest({
        date: ddMmYyyyToIso(date),
        duration,
        reason,
        project_id: Number.parseInt(projectId, 10),
        for_self: role === "manager" ? forSelf : undefined,
      });
      setSuccess(response.message);
      setReason("");
      setHours("1");
      onSubmitted?.();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to submit overtime request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="ui-card h-28 animate-pulse bg-[var(--accent-sand)]" />;
  }

  const blockedReason =
    role === "employee"
      ? context?.reason
      : forSelf
        ? context?.reason_self
        : "Managers can only request overtime for themselves here.";

  if (!canSubmit) {
    const message = blockedReason ?? error ?? "Overtime requests are unavailable.";

    return (
      <section className="ui-card p-5">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Overtime request</h2>
        <p className={`mt-2 text-sm ${error && !blockedReason ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
          {message}
        </p>
        {!blockedReason && !error ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Employees need overtime enabled, team membership with a manager, and at least one assigned project.
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="ui-card p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Request overtime</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {role === "manager" && forSelf
              ? "Submitted to admin for approval — never auto-approved."
              : "Submitted to your manager for approval"}
          </p>
          {role === "employee" && context?.manager?.name ? (
            <p className="mt-1 text-xs text-[var(--muted)]">Approver: {context.manager.name}</p>
          ) : null}
        </div>
        {role === "manager" ? (
          <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={forSelf}
              onChange={(event) => setForSelf(event.target.checked)}
            />
            For myself
          </label>
        ) : null}
      </div>

      {error ? <p className="mb-3 rounded-lg bg-[var(--accent-coral-soft)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p> : null}
      {success ? <p className="mb-3 rounded-lg bg-[var(--accent-emerald-soft)] px-3 py-2 text-sm text-[var(--accent-emerald)]">{success}</p> : null}

      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <DatePicker
          id="overtime-date"
          label="Work date"
          value={date}
          onChange={setDate}
          required
        />
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-[var(--foreground)]">Duration (hours)</span>
          <input
            type="number"
            required
            min={0.25}
            step={0.25}
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-muted)]"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setHours(String(preset.hours))}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  Number.parseFloat(hours) === preset.hours
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "bg-[var(--accent-sand)] text-[var(--muted)]"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1.5 block font-medium text-[var(--foreground)]">Project</span>
          <Select
            required
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.client_name ? `${project.name} — ${project.client_name}` : project.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1.5 block font-medium text-[var(--foreground)]">Reason</span>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-muted)]"
            placeholder="Describe the work completed during overtime"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="min-h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit overtime request"}
          </button>
        </div>
      </form>
    </section>
  );
}
