"use client";

import { Modal } from "@/components/ui/Modal";
import {
  ApiError,
  assignProjectEmployee,
  fetchProjectAssignees,
  fetchTeam,
  fetchWorkTeams,
  formatApiErrors,
  unassignProjectEmployee,
} from "@/lib/api";
import type { Project, ProjectAssignee, TeamMember, User } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export function ProjectAssignPanel({
  project,
  user,
  onClose,
}: {
  project: Project;
  user: User;
  onClose: () => void;
}) {
  const [assignees, setAssignees] = useState<ProjectAssignee[]>([]);
  const [employees, setEmployees] = useState<TeamMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [roleInProject, setRoleInProject] = useState<"worker" | "reviewer">("worker");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const assigneeList = await fetchProjectAssignees(project.id);
      setAssignees(assigneeList);

      if (user.role === "admin") {
        const roster = await fetchTeam();
        setEmployees(roster.filter((m) => m.status === "active" && m.role === "employee"));
      } else {
        const teams = await fetchWorkTeams();
        const seen = new Set<number>();
        const fromTeams: TeamMember[] = [];
        for (const team of teams) {
          for (const member of team.members ?? []) {
            if (seen.has(member.id)) continue;
            seen.add(member.id);
            fromTeams.push({
              id: 0,
              user_id: member.id,
              name: member.name,
              email: member.email,
              role: "employee",
              status: "active",
              joined_at: null,
              created_at: "",
            });
          }
        }
        setEmployees(fromTeams);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load assignments.",
      );
    } finally {
      setLoading(false);
    }
  }, [project.id, user.role]);

  useEffect(() => {
    load();
  }, [load]);

  const assignedIds = new Set(assignees.map((a) => a.id));
  const available = employees.filter((e) => !assignedIds.has(e.user_id));

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) return;
    setSaving(true);
    setError("");
    try {
      await assignProjectEmployee(project.id, Number(selectedUserId), roleInProject);
      setSelectedUserId("");
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Assign failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUnassign(userId: number) {
    setError("");
    try {
      await unassignProjectEmployee(project.id, userId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unassign failed.");
    }
  }

  return (
    <Modal title={`Assign employees — ${project.name}`} onClose={onClose}>
      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="h-32 animate-pulse rounded-lg bg-zinc-200/60 dark:bg-zinc-800/60" />
      ) : (
        <div className="space-y-6">
          <form onSubmit={handleAssign} className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Add employee
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                required
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              >
                <option value="">Select employee…</option>
                {available.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.name} ({member.email})
                  </option>
                ))}
              </select>
              <select
                value={roleInProject}
                onChange={(e) =>
                  setRoleInProject(e.target.value as "worker" | "reviewer")
                }
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              >
                <option value="worker">Worker</option>
                <option value="reviewer">Reviewer</option>
              </select>
              <button
                type="submit"
                disabled={saving || !selectedUserId}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Assigning…" : "Assign"}
              </button>
            </div>
          </form>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Assigned ({assignees.length})
            </p>
            {assignees.length === 0 ? (
              <p className="text-sm text-zinc-500">No employees assigned yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700">
                {assignees.map((assignee) => (
                  <li
                    key={assignee.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {assignee.name}
                      </p>
                      <p className="text-xs text-zinc-500">{assignee.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {assignee.role_in_project ?? "worker"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUnassign(assignee.id)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
