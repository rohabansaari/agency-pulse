"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { ApiError, fetchWorkTeams, formatApiErrors } from "@/lib/api";
import { formatDuration } from "@/lib/time";
import type { WorkTeam } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export function MyTeamsView() {
  const [teams, setTeams] = useState<WorkTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setTeams(await fetchWorkTeams());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load your teams.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          My teams
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Teams you manage — view members and time summaries
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <StatCard label="Teams managed" value={String(teams.length)} accent="blue" />

      {teams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 py-16 text-center dark:border-zinc-800">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No teams assigned</p>
          <p className="mt-1 text-xs text-zinc-500">
            An admin will assign you as manager to a team.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {teams.map((team) => (
            <div
              key={team.id}
              className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{team.name}</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
                  <p className="text-zinc-500">Hours today</p>
                  <p className="font-mono font-semibold">
                    {formatDuration(team.team_hours_today_seconds ?? 0)}
                  </p>
                </div>
                <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
                  <p className="text-zinc-500">Active projects</p>
                  <p className="font-semibold">{team.active_projects_count ?? 0}</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                {(team.members ?? []).length === 0 ? (
                  <li className="text-xs text-zinc-500">No employees on this team.</li>
                ) : (
                  team.members!.map((member) => (
                    <li key={member.id} className="flex justify-between text-sm">
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">
                        {member.name}
                      </span>
                      <span className="text-xs text-zinc-500">{member.email}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
