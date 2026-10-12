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
import { Avatar } from "@/components/ledger/Avatar";
import { TeamList, TeamStat } from "@/components/teams/TeamList";
import { Button } from "@/components/ui/Button";
import { Alert, EmptyState, Spinner } from "@/components/ui/EmptyState";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { FormField, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { TEAMS_EXPORT_COLUMNS } from "@/lib/export-columns";
import type { TeamMember, WorkTeam } from "@/lib/types";
import { Plus, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

export function WorkTeamsManager() {
  const [teams, setTeams] = useState<WorkTeam[]>([]);
  const [orgMembers, setOrgMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

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

  const exportRows = useMemo(
    () =>
      teams.map((team) => {
        const managerName =
          orgMembers.find((m) => m.user_id === team.manager_id)?.name ?? "Unassigned";
        return {
          team_name: team.name,
          manager_name: managerName,
          total_members: team.members?.length ?? team.members_count ?? 0,
          total_projects: team.active_projects_count ?? 0,
          active_status: (team.members?.length ?? 0) > 0 ? "Active" : "Empty",
        };
      }),
    [teams, orgMembers],
  );

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createWorkTeam(newTeamName);
      setNewTeamName("");
      await load();
      setShowCreate(false);
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

  const managerNameOf = (team: WorkTeam) =>
    team.manager_name ?? orgMembers.find((m) => m.user_id === team.manager_id)?.name ?? "Unassigned";

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? teams[0] ?? null;

  if (loading) {
    return <Spinner label="Loading teams…" />;
  }

  const createModal = showCreate ? (
    <Modal title="New team" description="Name the team. You can assign a manager and members next." onClose={() => setShowCreate(false)} size="sm">
      <form onSubmit={handleCreateTeam} className="flex flex-col gap-4">
        {error ? <Alert variant="error">{error}</Alert> : null}
        <FormField label="Team name" htmlFor="new-team-name" required>
          <Input
            id="new-team-name"
            required
            autoFocus
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="e.g. Design Squad"
          />
        </FormField>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" size="lg" onClick={() => setShowCreate(false)}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Creating…" : "Create team"}
          </Button>
        </div>
      </form>
    </Modal>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="People"
        title="Teams"
        description="Create teams, assign managers, and place employees"
        actions={
          <>
            <ExportDropdown filename="teams" columns={TEAMS_EXPORT_COLUMNS} rows={exportRows} />
            <Button size="lg" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New team
            </Button>
          </>
        }
      />

      {error && !showCreate ? <Alert variant="error">{error}</Alert> : null}

      {unassignedEmployees.length > 0 ? (
        <p
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--accent-copper)]/30 bg-[var(--accent-copper-soft)] px-4 py-3 text-sm text-[var(--accent-copper)]"
        >
          <span className="tnum font-semibold">{unassignedEmployees.length}</span>
          {unassignedEmployees.length === 1 ? "employee is" : "employees are"} not assigned to a team yet.
        </p>
      ) : null}

      {teams.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teams yet"
          description="Create a team, then assign a manager and add employees to it."
          action={
            <Button size="lg" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New team
            </Button>
          }
        />
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          <section aria-label="Team list" className="min-w-0 flex-[1_1_300px] lg:max-w-[380px]">
            <TeamList
              teams={teams}
              selectedId={selectedTeam?.id ?? null}
              onSelect={setSelectedTeamId}
              managerNameOf={managerNameOf}
            />
          </section>

          {selectedTeam ? (
            <section
              aria-labelledby="team-detail-heading"
              className="flex min-w-0 flex-[999_1_520px] flex-col gap-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6"
            >
              <div>
                <h2 id="team-detail-heading" className="text-xl font-semibold text-[var(--foreground)]">
                  {selectedTeam.name}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  <span className="tnum">{selectedTeam.members?.length ?? selectedTeam.members_count ?? 0}</span>{" "}
                  {(selectedTeam.members?.length ?? selectedTeam.members_count ?? 0) === 1 ? "member" : "members"} ·{" "}
                  {selectedTeam.manager_id ? `managed by ${managerNameOf(selectedTeam)}` : "no manager assigned"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <TeamStat label="Members" value={selectedTeam.members?.length ?? selectedTeam.members_count ?? 0} />
                <TeamStat label="Active projects" value={selectedTeam.active_projects_count ?? 0} />
                <TeamStat
                  label="Status"
                  value={(selectedTeam.members?.length ?? 0) > 0 ? "Active" : "Empty"}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Manager" htmlFor={`team-${selectedTeam.id}-manager`}>
                  <Select
                    key={`manager-${selectedTeam.id}`}
                    id={`team-${selectedTeam.id}-manager`}
                    value={selectedTeam.manager_id ?? ""}
                    onChange={(e) => handleAssignManager(selectedTeam.id, e.target.value)}
                  >
                    <option value="">Select manager…</option>
                    {managers.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField
                  label="Add employee"
                  htmlFor={`team-${selectedTeam.id}-add`}
                  hint={unassignedEmployees.length === 0 ? "Every active employee is already on a team." : undefined}
                >
                  <Select
                    key={`add-${selectedTeam.id}`}
                    id={`team-${selectedTeam.id}-add`}
                    defaultValue=""
                    onChange={(e) => {
                      handleAddMember(selectedTeam.id, e.target.value);
                      e.target.value = "";
                    }}
                  >
                    <option value="">Select employee…</option>
                    {unassignedEmployees.map((e) => (
                      <option key={e.user_id} value={e.user_id}>
                        {e.name} ({e.email})
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <div>
                <h3 className="text-xs font-medium uppercase tracking-[0.04em] text-[var(--muted)]">Members</h3>
                <ul className="mt-2 divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
                  {(selectedTeam.members ?? []).length === 0 ? (
                    <li className="py-6 text-sm text-[var(--muted)]">
                      No members yet. Use “Add employee” to place someone on this team.
                    </li>
                  ) : (
                    selectedTeam.members!.map((member) => (
                      <li key={member.id} className="flex items-center gap-3 py-3">
                        <Avatar name={member.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[var(--foreground)]">
                            {member.name}
                          </span>
                          <span className="block truncate text-[13px] text-[var(--muted)]">{member.email}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(selectedTeam.id, member.id)}
                          aria-label={`Remove ${member.name} from ${selectedTeam.name}`}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--accent-coral-soft)] hover:text-[var(--accent-coral)]"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </section>
          ) : null}
        </div>
      )}

      {createModal}
    </div>
  );
}
