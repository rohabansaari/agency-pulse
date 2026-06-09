"use client";



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

import { canManageOrgEmployees, isAdmin } from "@/lib/navigation";

import type { MemberStatus, PayrollVaultStatus, TeamMember, User, UserRole } from "@/lib/types";

import { useCallback, useEffect, useState } from "react";



const STATUS_STYLES: Record<MemberStatus, string> = {

  active: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",

  invited: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",

  suspended: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",

};



export function TeamManager({ user }: { user: User }) {

  const admin = isAdmin(user.role);

  const canEditMembers = canManageOrgEmployees(user.role);

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

          : "Failed to load team.",

      );

    } finally {

      setLoading(false);

    }

  }, []);



  useEffect(() => {

    load();

  }, [load]);



  useEffect(() => {

    if (!showCreate || !admin) {

      return;

    }



    void fetchPayrollVaultStatus()

      .then(setVaultStatus)

      .catch(() => setVaultStatus(null));

  }, [showCreate, admin]);



  async function handleCreateEmployee(e: React.FormEvent) {

    e.preventDefault();

    setSaving(true);

    setError("");

    try {

      await createEmployee({
        name: createName,
        email: createEmail,
        password: createPassword,
        payroll_pin: vaultStatus?.requires_pin_on_employee_create
          ? createPayrollPin
          : undefined,
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

          : "Create failed.",

      );

    } finally {

      setSaving(false);

    }

  }



  async function handleResetPassword(e: React.FormEvent) {

    e.preventDefault();

    if (!resetTarget) return;

    setSaving(true);

    setError("");

    try {

      await resetEmployeePassword(resetTarget.user_id, newPassword);

      setResetTarget(null);

      setNewPassword("");

    } catch (err) {

      setError(

        err instanceof ApiError

          ? formatApiErrors(err.errors) || err.message

          : "Password reset failed.",

      );

    } finally {

      setSaving(false);

    }

  }



  async function handleStatusChange(member: TeamMember, status: MemberStatus) {

    try {

      await updateTeamMember(member.id, { status });

      await load();

    } catch (err) {

      setError(err instanceof ApiError ? err.message : "Update failed.");

    }

  }



  async function handleRoleChange(member: TeamMember, role: UserRole) {

    try {

      await updateTeamMember(member.id, { role });

      await load();

    } catch (err) {

      setError(err instanceof ApiError ? err.message : "Update failed.");

    }

  }



  if (loading) {

    return (

      <div className="h-64 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />

    );

  }



  return (

    <div className="space-y-6">

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">

            Employees

          </h1>

          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">

            Create employee accounts, then assign them to teams on the Teams page.

          </p>

        </div>

        {admin ? (

          <button

            type="button"

            onClick={() => setShowCreate(true)}

            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"

          >

            Create employee

          </button>

        ) : null}

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

          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">

            New employee account

          </p>

          <div className="grid gap-4 sm:grid-cols-3">

            <input

              required

              placeholder="Full name"

              value={createName}

              onChange={(e) => setCreateName(e.target.value)}

              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"

            />

            <input

              required

              type="email"

              placeholder="Email"

              value={createEmail}

              onChange={(e) => setCreateEmail(e.target.value)}

              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"

            />

            <input

              required

              type="password"

              minLength={8}

              placeholder="Password (min 8 chars)"

              value={createPassword}

              onChange={(e) => setCreatePassword(e.target.value)}

              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"

            />

          </div>

          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
            Salary contracts are configured under Payroll after the employee is created. No
            compensation data is collected here.
          </p>

          {vaultStatus?.requires_pin_on_employee_create ? (

            <div className="grid gap-4 sm:grid-cols-2">

              <input

                required

                type="password"

                inputMode="numeric"

                autoComplete="off"

                pattern="\d{4,8}"

                minLength={4}

                maxLength={8}

                placeholder="Organization payroll PIN"

                value={createPayrollPin}

                onChange={(e) => setCreatePayrollPin(e.target.value)}

                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"

              />

              <input

                required

                type="password"

                inputMode="numeric"

                autoComplete="off"

                pattern="\d{4,8}"

                minLength={4}

                maxLength={8}

                placeholder="Confirm payroll PIN"

                value={createPayrollPinConfirmation}

                onChange={(e) => setCreatePayrollPinConfirmation(e.target.value)}

                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"

              />

            </div>

          ) : null}

          <div className="flex gap-2">

            <button

              type="submit"

              disabled={saving}

              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"

            >

              {saving ? "Creating..." : "Create account"}

            </button>

            <button

              type="button"

              onClick={() => setShowCreate(false)}

              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"

            >

              Cancel

            </button>

          </div>

        </form>

      ) : null}



      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">

        <table className="min-w-full text-left text-sm">

          <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50">

            <tr>

              <th className="px-4 py-3 font-medium">Name</th>

              <th className="px-4 py-3 font-medium">Email</th>

              <th className="px-4 py-3 font-medium">Role</th>

              <th className="px-4 py-3 font-medium">Status</th>

              <th className="px-4 py-3 font-medium">Projects</th>

              {canEditMembers ? <th className="px-4 py-3 font-medium">Actions</th> : null}

            </tr>

          </thead>

          <tbody>

            {members.map((member) => (

              <tr key={member.id} className="border-b border-zinc-50 dark:border-zinc-800/80">

                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">

                  {member.name}

                </td>

                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{member.email}</td>

                <td className="px-4 py-3 capitalize text-zinc-600 dark:text-zinc-400">

                  {canEditMembers && member.user_id !== user.id ? (

                    <select

                      value={member.role}

                      onChange={(e) =>

                        handleRoleChange(member, e.target.value as UserRole)

                      }

                      className="rounded border border-zinc-200 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"

                    >

                      <option value="employee">Employee</option>

                      <option value="manager">Manager</option>

                      <option value="admin">Admin</option>

                    </select>

                  ) : (

                    member.role.replace("_", " ")

                  )}

                </td>

                <td className="px-4 py-3">

                  <span

                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[member.status]}`}

                  >

                    {member.status}

                  </span>

                </td>

                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">

                  {member.assigned_projects_count ?? 0}

                </td>

                {canEditMembers ? (

                  <td className="px-4 py-3">

                    {member.user_id !== user.id ? (

                      <div className="flex flex-wrap gap-2">

                        {member.role === "employee" ? (

                          <button

                            type="button"

                            onClick={() => {

                              setResetTarget(member);

                              setNewPassword("");

                            }}

                            className="text-xs font-medium text-violet-600 hover:underline"

                          >

                            Reset password

                          </button>

                        ) : null}

                        {member.status !== "active" ? (

                          <button

                            type="button"

                            onClick={() => handleStatusChange(member, "active")}

                            className="text-xs text-green-600 hover:underline"

                          >

                            Activate

                          </button>

                        ) : (

                          <button

                            type="button"

                            onClick={() => handleStatusChange(member, "suspended")}

                            className="text-xs text-red-600 hover:underline"

                          >

                            Deactivate

                          </button>

                        )}

                      </div>

                    ) : (

                      <span className="text-xs text-zinc-400">You</span>

                    )}

                  </td>

                ) : null}

              </tr>

            ))}

          </tbody>

        </table>

      </div>



      {resetTarget ? (

        <Modal

          title={`Reset password — ${resetTarget.name}`}

          onClose={() => setResetTarget(null)}

        >

          <form onSubmit={handleResetPassword} className="space-y-4">

            <p className="text-sm text-zinc-500">

              Set a new password for {resetTarget.email}. The employee will use this to log in.

            </p>

            <input

              required

              type="password"

              minLength={8}

              placeholder="New password (min 8 chars)"

              value={newPassword}

              onChange={(e) => setNewPassword(e.target.value)}

              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"

            />

            <div className="flex justify-end gap-2">

              <button

                type="button"

                onClick={() => setResetTarget(null)}

                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"

              >

                Cancel

              </button>

              <button

                type="submit"

                disabled={saving}

                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"

              >

                {saving ? "Saving..." : "Update password"}

              </button>

            </div>

          </form>

        </Modal>

      ) : null}

    </div>

  );

}

