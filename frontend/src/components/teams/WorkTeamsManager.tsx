"use client";

import {
  ApiError,
  addTeamMember,
  assignTeamManager,
  createWorkTeam,
  fetchTeam,
  fetchWorkTeams,
  formatApiErrors,
  removeTeamMember,
} from "@/lib/api";
import type { TeamMember, WorkTeam } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export function WorkTeamsManager() {
  const [teams, setTeams] = useState<WorkTeam[]>([]);
  const [orgMembers, setOrgMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [teamList, members] = await Promise.all([fetchWorkTeams(), fetchTeam()]);
      setTeams(teamList);
      setOrgMembers(members.filter((m) => m.status === "active"));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load teams.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const managers = orgMembers.filter((m) => m.role === "manager");
  const employees = orgMembers.filter((m) => m.role === "employee");

  const assignedEmployeeIds = new Set(
    teams.flatMap((t) => t.members?.map((m) => m.id) ?? []),
  );
  const unassignedEmployees = employees.filter((e) => !assignedEmployeeIds.has(e.user_id));

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createWorkTeam(newTeamName);
      setNewTeamName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAssignManager(teamId: number, managerId: string) {
    if (!managerId) return;
    try {
      await assignTeamManager(teamId, Number(managerId));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Assign manager failed.");
    }
  }

  async function handleAddMember(teamId: number, userId: string) {
    if (!userId) return;
    try {
      await addTeamMember(teamId, Number(userId));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Add member failed.");
    }
  }

  async function handleRemoveMember(teamId: number, userId: number) {
    try {
      await removeTeamMember(teamId, userId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Remove failed.");
    }
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Teams
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Create teams, assign managers, and place employees
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleCreateTeam}
        className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-end dark:border-zinc-700 dark:bg-zinc-800/50"
      >
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            New team name
          </label>
          <input
            required
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="e.g. Design Squad"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          Create team
        </button>
      </form>

      {unassignedEmployees.length > 0 ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          {unassignedEmployees.length} employee(s) not assigned to a team yet.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {teams.map((team) => (
          <div
            key={team.id}
            className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{team.name}</h2>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Manager</label>
                <select
                  value={team.manager_id ?? ""}
                  onChange={(e) => handleAssignManager(team.id, e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                >
                  <option value="">Select manager…</option>
                  {managers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Add employee</label>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    handleAddMember(team.id, e.target.value);
                    e.target.value = "";
                  }}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                >
                  <option value="">Select employee…</option>
                  {unassignedEmployees.map((e) => (
                    <option key={e.user_id} value={e.user_id}>
                      {e.name} ({e.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ul className="mt-4 space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              {(team.members ?? []).length === 0 ? (
                <li className="text-xs text-zinc-500">No members yet.</li>
              ) : (
                team.members!.map((member) => (
                  <li key={member.id} className="flex items-center justify-between text-sm">
                    <span>{member.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(team.id, member.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
