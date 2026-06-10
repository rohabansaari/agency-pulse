"use client";

import {
  ApiError,
  fetchOvertimeContext,
  formatApiErrors,
  submitOvertimeRequest,
} from "@/lib/api";
import type { UserRole } from "@/lib/types";
import { DatePicker } from "@/components/ui/DatePicker";
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
    return <div className="ui-card h-28 animate-pulse bg-zinc-200/60 dark:bg-zinc-800/60" />;
  }

  const blockedReason =
    role === "employee"
      ? context?.reason
      : forSelf
        ? context?.reason_self
        : "Managers can only request overtime for themselves here.";

  if (!canSubmit) {
    return (
      <section className="ui-card p-5">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Overtime request</h2>
        <p className="mt-2 text-sm text-zinc-500">{blockedReason ?? "Overtime requests are unavailable."}</p>
      </section>
    );
  }

  return (
    <section className="ui-card p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Request overtime</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            {role === "manager" && forSelf
              ? "Submitted to admin for approval — never auto-approved."
              : "Submitted to your manager for approval"}
          </p>
          {role === "employee" && context?.manager?.name ? (
            <p className="mt-1 text-xs text-zinc-400">Approver: {context.manager.name}</p>
          ) : null}
        </div>
        {role === "manager" ? (
          <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={forSelf}
              onChange={(event) => setForSelf(event.target.checked)}
            />
            For myself
          </label>
        ) : null}
      </div>

      {error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">{error}</p> : null}
      {success ? <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{success}</p> : null}

      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <DatePicker
          id="overtime-date"
          label="Work date"
          value={date}
          onChange={setDate}
          required
        />
        <label className="block text-sm">
          <span className="font-medium text-zinc-600 dark:text-zinc-400">Duration (hours)</span>
          <input
            type="number"
            required
            min={0.25}
            step={0.25}
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setHours(String(preset.hours))}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  Number.parseFloat(hours) === preset.hours
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-zinc-600 dark:text-zinc-400">Project</span>
          <select
            required
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
                {project.client_name ? ` — ${project.client_name}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-zinc-600 dark:text-zinc-400">Reason</span>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Describe the work completed during overtime"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit overtime request"}
          </button>
        </div>
      </form>
    </section>
  );
}
