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
    return <div className="h-24 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />;
  }

  const blockedReason =
    role === "employee"
      ? context?.reason
      : forSelf
        ? context?.reason_self
        : "Managers can only request overtime for themselves here.";

  if (!canSubmit) {
    return (
      <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Overtime request</h2>
        <p className="mt-2 text-sm text-zinc-500">{blockedReason ?? "Overtime requests are unavailable."}</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Request overtime</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {role === "manager" && forSelf
              ? "Submitted to admin for approval"
              : "Submitted to your manager for approval"}
          </p>
        </div>
        {role === "manager" ? (
          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={forSelf}
              onChange={(event) => setForSelf(event.target.checked)}
            />
            For myself
          </label>
        ) : null}
      </div>

      {error ? <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {success ? <p className="mb-3 text-sm text-green-600 dark:text-green-400">{success}</p> : null}

      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
        <DatePicker
          id="overtime-date"
          label="Date"
          value={date}
          onChange={setDate}
          required
        />
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Hours</span>
          <input
            type="number"
            required
            min={0.25}
            step={0.25}
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-zinc-600 dark:text-zinc-400">Project</span>
          <select
            required
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-zinc-600 dark:text-zinc-400">Reason</span>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Describe why overtime was needed"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {submitting ? "Submitting…" : "Submit overtime request"}
          </button>
        </div>
      </form>
    </section>
  );
}
