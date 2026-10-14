"use client";

import { Avatar } from "@/components/ledger/Avatar";
import { Metric } from "@/components/ledger/Metric";
import { TeamList, TeamStat } from "@/components/teams/TeamList";
import { Alert, EmptyState, Spinner } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApiError, fetchWorkTeams, formatApiErrors } from "@/lib/api";
import { formatDuration } from "@/lib/time";
import type { WorkTeam } from "@/lib/types";
import { Clock, FolderKanban, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function MyTeamsView() {
  const [teams, setTeams] = useState<WorkTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

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
    return <Spinner label="Loading your teams…" />;
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? teams[0] ?? null;
  const totalMembers = teams.reduce((sum, t) => sum + (t.members?.length ?? t.members_count ?? 0), 0);
  const totalTodaySeconds = teams.reduce((sum, t) => sum + (t.team_hours_today_seconds ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="People" title="My teams" description="Teams you manage — view members and time summaries" />

      {error ? <Alert variant="error">{error}</Alert> : null}

      <section aria-label="At a glance" className="grid gap-4 sm:grid-cols-3">
        <Metric label="Teams managed" icon={<Users className="h-4 w-4" />} value={teams.length} />
        <Metric label="People" icon={<Users className="h-4 w-4" />} value={totalMembers} detail="Across your teams" />
        <Metric
          label="Hours today"
          icon={<Clock className="h-4 w-4" />}
          value={<span className="num">{formatDuration(totalTodaySeconds)}</span>}
          detail="All teams combined"
        />
      </section>

      {teams.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teams assigned"
          description="An admin will assign you as manager to a team."
        />
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          <section aria-label="Team list" className="min-w-0 flex-[1_1_18.75rem] lg:max-w-[23.75rem]">
            <TeamList
              teams={teams}
              selectedId={selectedTeam?.id ?? null}
              onSelect={setSelectedTeamId}
              managerNameOf={(team) => team.manager_name ?? "You"}
            />
          </section>

          {selectedTeam ? (
            <section
              aria-labelledby="my-team-heading"
              className="flex min-w-0 flex-[999_1_32.5rem] flex-col gap-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6"
            >
              <div>
                <h2 id="my-team-heading" className="text-xl font-semibold text-[var(--foreground)]">
                  {selectedTeam.name}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  <span className="tnum">{(selectedTeam.members ?? []).length}</span>{" "}
                  {(selectedTeam.members ?? []).length === 1 ? "employee" : "employees"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <TeamStat label="Hours today" value={formatDuration(selectedTeam.team_hours_today_seconds ?? 0)} mono />
                <TeamStat
                  label="Active projects"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <FolderKanban className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
                      {selectedTeam.active_projects_count ?? 0}
                    </span>
                  }
                />
              </div>

              <div>
                <h3 className="text-xs font-medium uppercase tracking-[0.04em] text-[var(--muted)]">Members</h3>
                <ul className="mt-2 divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
                  {(selectedTeam.members ?? []).length === 0 ? (
                    <li className="py-6 text-sm text-[var(--muted)]">No employees on this team.</li>
                  ) : (
                    selectedTeam.members!.map((member) => (
                      <li key={member.id} className="flex items-center gap-3 py-3">
                        <Avatar name={member.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[var(--foreground)]">
                            {member.name}
                          </span>
                          <span className="block truncate text-[0.8125rem] text-[var(--muted)]">{member.email}</span>
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
