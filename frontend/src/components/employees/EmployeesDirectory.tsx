"use client";

import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { Modal } from "@/components/ui/Modal";
import {
  ApiError,
  createEmployee,
  fetchPayrollVaultStatus,
  fetchTeam,
  formatApiErrors,
  resetEmployeePassword,
  updateTeamMember,
} from "@/lib/api";
import { formatDuration } from "@/lib/time";
import { canEditEmployeeStatus, canManageOrgEmployees } from "@/lib/navigation";
import type { MemberStatus, PayrollVaultStatus, TeamMember, User, UserRole } from "@/lib/types";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_STYLES: Record<MemberStatus, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  invited: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  suspended: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export function EmployeesDirectory({ user }: { user: User }) {
  const canCreate = canManageOrgEmployees(user.role);
  const canEditStatus = canEditEmployeeStatus(user.role);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createPayrollPin, setCreatePayrollPin] = useState("");
  const [createPayrollPinConfirmation, setCreatePayrollPinConfirmation] = useState("");
  const [vaultStatus, setVaultStatus] = useState<PayrollVaultStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState<TeamMember | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setMembers(await fetchTeam());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load employees.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!showCreate || !canCreate) return;
    void fetchPayrollVaultStatus().then(setVaultStatus).catch(() => setVaultStatus(null));
  }, [showCreate, canCreate]);

  const exportRows = useMemo(
    () =>
      members.map((m) => ({
        name: m.name,
        email: m.email,
        role: m.role,
        team: m.team_name ?? "—",
        manager: m.manager_name ?? "—",
        status: m.status,
        joined_at: formatDate(m.joined_at),
        last_activity: formatDate(m.last_activity_at),
        active_timer: m.has_active_timer ? "Running" : "Idle",
        projects: m.assigned_projects_count ?? 0,
        leave_hours: formatDuration(m.approved_leave_seconds ?? 0),
        overtime_requests: m.overtime_requests_count ?? 0,
        month_hours: formatDuration(m.time_tracked_month_seconds ?? 0),
      })),
    [members],
  );

  async function handleCreateEmployee(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createEmployee({
        name: createName,
        email: createEmail,
        password: createPassword,
        payroll_pin: vaultStatus?.requires_pin_on_employee_create ? createPayrollPin : undefined,
        payroll_pin_confirmation: vaultStatus?.requires_pin_on_employee_create
          ? createPayrollPinConfirmation
          : undefined,
      });
      setShowCreate(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreatePayrollPin("");
      setCreatePayrollPinConfirmation("");
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to create employee.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Employees
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Organization directory — no compensation data is shown here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportDropdown
            filename="employees"
            columns={[
              { key: "name", label: "Name" },
              { key: "email", label: "Email" },
              { key: "role", label: "Role" },
              { key: "team", label: "Team" },
              { key: "manager", label: "Manager" },
              { key: "status", label: "Status" },
              { key: "joined_at", label: "Join Date" },
              { key: "month_hours", label: "Time This Month" },
            ]}
            rows={exportRows}
          />
          {canCreate ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create employee
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {showCreate ? (
        <form
          onSubmit={handleCreateEmployee}
          className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50"
        >
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">New employee account</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input required placeholder="Full name" value={createName} onChange={(e) => setCreateName(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900" />
            <input required type="email" placeholder="Email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900" />
            <input required type="password" minLength={8} placeholder="Password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900" />
          </div>
          {vaultStatus?.requires_pin_on_employee_create ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <input required type="password" inputMode="numeric" placeholder="Payroll PIN" value={createPayrollPin} onChange={(e) => setCreatePayrollPin(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900" />
              <input required type="password" inputMode="numeric" placeholder="Confirm payroll PIN" value={createPayrollPinConfirmation} onChange={(e) => setCreatePayrollPinConfirmation(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900" />
            </div>
          ) : null}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {saving ? "Creating…" : "Create"}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600">
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/50">
            <tr>
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Team</th>
              <th className="px-3 py-2 font-medium">Manager</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Join date</th>
              <th className="px-3 py-2 font-medium">Last activity</th>
              <th className="px-3 py-2 font-medium">Timer</th>
              <th className="px-3 py-2 font-medium">Projects</th>
              <th className="px-3 py-2 font-medium">Month hrs</th>
              <th className="px-3 py-2 font-medium">Leave</th>
              <th className="px-3 py-2 font-medium">OT reqs</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-3 py-3">
                  <Link href={`/employees/${member.user_id}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                    {member.name}
                  </Link>
                  <p className="text-xs text-zinc-500">{member.email}</p>
                </td>
                <td className="px-3 py-3 capitalize">{member.role}</td>
                <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">{member.team_name ?? "—"}</td>
                <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">{member.manager_name ?? "—"}</td>
                <td className="px-3 py-3">
                  {canEditStatus && member.role !== "admin" && member.role !== "sub_admin" ? (
                    <select
                      value={member.status}
                      onChange={async (event) => {
                        try {
                          await updateTeamMember(member.id, {
                            status: event.target.value as MemberStatus,
                          });
                          await load();
                        } catch (err) {
                          setError(err instanceof ApiError ? err.message : "Status update failed.");
                        }
                      }}
                      className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs capitalize dark:border-zinc-600 dark:bg-zinc-900"
                    >
                      <option value="active">active</option>
                      <option value="invited">invited</option>
                      <option value="suspended">suspended</option>
                    </select>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[member.status]}`}>
                      {member.status}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-zinc-600">{formatDate(member.joined_at)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-zinc-600">{formatDate(member.last_activity_at)}</td>
                <td className="px-3 py-3">{member.has_active_timer ? "Running" : "Idle"}</td>
                <td className="px-3 py-3">{member.assigned_projects_count ?? 0}</td>
                <td className="px-3 py-3 font-mono text-xs">{formatDuration(member.time_tracked_month_seconds ?? 0)}</td>
                <td className="px-3 py-3 font-mono text-xs">{formatDuration(member.approved_leave_seconds ?? 0)}</td>
                <td className="px-3 py-3">{member.overtime_requests_count ?? 0}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    <Link href={`/employees/${member.user_id}`} className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-600">
                      Profile
                    </Link>
                    {canCreate && member.role === "employee" ? (
                      <button type="button" onClick={() => setResetTarget(member)} className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-600">
                        Reset pwd
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetTarget ? (
        <Modal onClose={() => setResetTarget(null)} title="Reset password">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                await resetEmployeePassword(resetTarget.user_id, newPassword);
                setResetTarget(null);
                setNewPassword("");
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "Password reset failed.");
              } finally {
                setSaving(false);
              }
            }}
            className="space-y-3"
          >
            <p className="text-sm text-zinc-600">Reset password for {resetTarget.name}</p>
            <input required type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900" />
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
              Update password
            </button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
