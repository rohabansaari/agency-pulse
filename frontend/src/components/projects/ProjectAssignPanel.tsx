"use client";

import { Modal } from "@/components/ui/Modal";
import { Alert, Spinner } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { SearchField } from "@/components/ledger/SearchField";
import { Avatar } from "@/components/ledger/Avatar";
import {
  ApiError,
  assignProjectEmployees,
  fetchProjectAssignees,
  fetchTeam,
  fetchWorkTeams,
  formatApiErrors,
  unassignProjectEmployee,
} from "@/lib/api";
import type { Project, ProjectAssignee, TeamMember, User } from "@/lib/types";
import { Check, UserMinus, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const assigneeList = await fetchProjectAssignees(project.id);
      setAssignees(assigneeList);

      if (user.role === "admin" || user.role === "sub_admin") {
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
    void load();
  }, [load]);

  const assignedIds = useMemo(() => new Set(assignees.map((a) => a.id)), [assignees]);

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (assignedIds.has(e.user_id)) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
    });
  }, [employees, assignedIds, search]);

  const selectedEmployees = useMemo(
    () => employees.filter((e) => selectedIds.has(e.user_id)),
    [employees, selectedIds],
  );

  function toggleEmployee(userId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleAssign() {
    if (selectedIds.size === 0) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await assignProjectEmployees(project.id, [...selectedIds]);
      setSuccess(result.message);
      setSelectedIds(new Set());
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
    <Modal
      title="Assign employees"
      description={`Add team members to ${project.name}. Select one or more employees, then assign.`}
      onClose={onClose}
      size="lg"
    >
      {error ? <Alert variant="error">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      {loading ? (
        <Spinner label="Loading employees…" />
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Select employees</h3>
            </div>

            {selectedEmployees.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {selectedEmployees.map((emp) => (
                  <span
                    key={emp.user_id}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-muted)] py-1 pl-2.5 pr-1 text-xs font-medium text-[var(--primary)]"
                  >
                    {emp.name}
                    <button
                      type="button"
                      onClick={() => toggleEmployee(emp.user_id)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-[var(--primary)]/15"
                      aria-label={`Remove ${emp.name}`}
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <SearchField
              label="Search employees"
              placeholder="Search by name or email…"
              value={search}
              onChange={setSearch}
              className="mb-3 min-w-0"
            />

            <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] p-1">
              {available.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-[var(--muted)]">
                  {search ? "No matching employees." : "All employees are already assigned."}
                </p>
              ) : (
                available.map((member) => {
                  const checked = selectedIds.has(member.user_id);
                  return (
                    <button
                      key={member.user_id}
                      type="button"
                      onClick={() => toggleEmployee(member.user_id)}
                      aria-pressed={checked}
                      className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-[var(--foreground)] transition ${
                        checked
                          ? "bg-[var(--primary-muted)]"
                          : "hover:bg-[var(--accent-sand)]"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                            : "border-[var(--border)] bg-[var(--card)]"
                        }`}
                      >
                        {checked ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{member.name}</span>
                        <span className="block truncate text-xs text-[var(--muted)]">{member.email}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-3 flex justify-end">
              <Button
                size="lg"
                onClick={() => void handleAssign()}
                disabled={saving || selectedIds.size === 0}
              >
                {saving ? "Assigning…" : `Assign ${selectedIds.size || ""} employee${selectedIds.size === 1 ? "" : "s"}`}
              </Button>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Assigned <span className="tnum text-[var(--muted)]">{assignees.length}</span>
              </h3>
            </div>
            {assignees.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--border)] py-8 text-center text-sm text-[var(--muted)]">
                No employees assigned yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
                {assignees.map((assignee) => (
                  <li
                    key={assignee.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={assignee.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">
                        {assignee.name}
                      </p>
                      <p className="truncate text-xs text-[var(--muted)]">{assignee.email}</p>
                    </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleUnassign(assignee.id)}
                      aria-label={`Remove ${assignee.name} from ${project.name}`}
                      className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--accent-coral)]/40 bg-[var(--card-elevated)] px-3 text-[13px] font-medium text-[var(--accent-coral)] transition hover:bg-[var(--accent-coral-soft)]"
                    >
                      <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
