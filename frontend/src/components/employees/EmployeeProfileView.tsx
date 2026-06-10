"use client";

import { ApiError, fetchEmployeeProfile, formatApiErrors } from "@/lib/api";
import { formatDuration } from "@/lib/time";
import type { EmployeeProfile } from "@/lib/types";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function EmployeeProfileView({ userId }: { userId: number }) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setProfile(await fetchEmployeeProfile(userId));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load employee profile.",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />;
  }

  if (!profile) {
    return <p className="text-sm text-red-600">{error || "Employee not found."}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/employees" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Back to employees
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{profile.name}</h1>
        <p className="text-sm text-zinc-500">{profile.email}</p>
      </div>

      {profile.role === "manager" && profile.manager_metrics ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Manager metrics</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Aggregated across all teams managed by this user.
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
              <dt className="text-xs text-zinc-500">Teams managed</dt>
              <dd className="text-lg font-semibold">{profile.manager_metrics.teams_managed}</dd>
            </div>
            <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
              <dt className="text-xs text-zinc-500">Projects managed</dt>
              <dd className="text-lg font-semibold">{profile.manager_metrics.projects_managed}</dd>
            </div>
            <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
              <dt className="text-xs text-zinc-500">Active employees</dt>
              <dd className="text-lg font-semibold">{profile.manager_metrics.active_employees}</dd>
            </div>
            <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
              <dt className="text-xs text-zinc-500">Team hours (month)</dt>
              <dd className="text-lg font-semibold">
                {formatDuration(profile.manager_metrics.total_team_hours_month_seconds)}
              </dd>
            </div>
          </dl>
          {profile.manager_metrics.managed_teams.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm">
              {profile.manager_metrics.managed_teams.map((team) => (
                <li key={team.id} className="flex justify-between rounded border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  <span>{team.name}</span>
                  <span className="text-xs text-zinc-500">
                    {team.members_count} members · {team.active_projects} projects
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Basic information</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">Role</dt><dd className="capitalize">{profile.role}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">Status</dt><dd className="capitalize">{profile.status}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">Join date</dt><dd>{formatDate(profile.joined_at)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">Last activity</dt><dd>{formatDate(profile.last_activity_at)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">Timer</dt><dd>{profile.has_active_timer ? "Running" : "Idle"}</dd></div>
          </dl>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Team information</h2>
          {profile.team ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Team</dt><dd>{profile.team.name}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Manager</dt><dd>{profile.team.manager?.name ?? "—"}</dd></div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">Not assigned to a team.</p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Time tracking summary</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div><span className="text-zinc-500">This month:</span> {formatDuration(profile.time_summary.month_seconds)}</div>
          <div><span className="text-zinc-500">Approved paid leave:</span> {formatDuration(profile.time_summary.approved_leave_seconds)}</div>
        </dl>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Assigned projects ({profile.assigned_projects.length})</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {profile.assigned_projects.map((p) => (
            <li key={p.id} className="flex justify-between gap-4">
              <span>{p.name}</span>
              <span className="capitalize text-zinc-500">{p.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Leave history</h2>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
            {profile.leave_history.map((entry) => (
              <li key={entry.id} className="rounded border border-zinc-100 p-2 dark:border-zinc-800">
                <div className="flex justify-between"><span>{entry.start_date}</span><span className="capitalize text-zinc-500">{entry.status}</span></div>
                <div className="text-xs text-zinc-500">{formatDuration(entry.duration_seconds)} · {entry.is_paid ? "Paid" : "Unpaid"}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Overtime history</h2>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
            {profile.overtime_history.map((entry) => (
              <li key={entry.id} className="rounded border border-zinc-100 p-2 dark:border-zinc-800">
                <div className="flex justify-between"><span>{entry.work_date}</span><span className="capitalize text-zinc-500">{entry.status}</span></div>
                <div className="text-xs text-zinc-500">{formatDuration(entry.duration_seconds)}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
