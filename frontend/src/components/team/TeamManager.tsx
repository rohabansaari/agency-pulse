"use client";

import { Avatar } from "@/components/ledger/Avatar";
import { Panel } from "@/components/ledger/Panel";
import { ledgerTable, rowButton } from "@/components/ledger/table";
import { Button } from "@/components/ui/Button";
import { Alert, Spinner } from "@/components/ui/EmptyState";
import { FormField, Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import {
  ApiError,
  createEmployee,
  fetchPayrollVaultStatus,
  fetchTeam,
  formatApiErrors,
  resendEmployeeInvitation,
  updateTeamMember,
} from "@/lib/api";
import { canManageOrgEmployees, CREATION_ROLES, isAdmin, ROLE_LABELS } from "@/lib/navigation";
import type { MemberStatus, PayrollVaultStatus, TeamMember, User, UserRole } from "@/lib/types";
import { UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const STATUS_BADGE: Record<MemberStatus, string> = {
  active: "bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]",
  invited: "bg-[var(--primary-muted)] text-[var(--primary)]",
  suspended: "bg-[var(--accent-coral-soft)] text-[var(--accent-coral)]",
};

function statusLabel(status: MemberStatus): string {
  if (status === "invited") return "Pending invitation";
  if (status === "suspended") return "Disabled";
  return "Active";
}

export function TeamManager({ user }: { user: User }) {
  const admin = isAdmin(user.role);
  const canEditMembers = canManageOrgEmployees(user.role);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>("employee");
  const [createPayrollPin, setCreatePayrollPin] = useState("");
  const [createPayrollPinConfirmation, setCreatePayrollPinConfirmation] = useState("");
  const [vaultStatus, setVaultStatus] = useState<PayrollVaultStatus | null>(null);
  const [saving, setSaving] = useState(false);

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
    void load();
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
    setSuccess("");
    try {
      const response = await createEmployee({
        name: createName,
        email: createEmail,
        role: createRole,
        salary_type: "hourly",
        hourly_rate: 25,
        payroll_pin: vaultStatus?.requires_pin_on_employee_create
          ? createPayrollPin
          : undefined,
        payroll_pin_confirmation: vaultStatus?.requires_pin_on_employee_create
          ? createPayrollPinConfirmation
          : undefined,
      });

      if (!response.invitation_email_sent) {
        setError(
          `${response.delivery_issue || response.message} The employee was created — use Resend invitation instead of creating them again.`,
        );
        setShowCreate(false);
        setCreateName("");
        setCreateEmail("");
        setCreateRole("employee");
        setCreatePayrollPin("");
        setCreatePayrollPinConfirmation("");
        await load();
        return;
      }
      setCreateName("");
      setCreateEmail("");
      setCreateRole("employee");
      setCreatePayrollPin("");
      setCreatePayrollPinConfirmation("");
      setSuccess(response.message);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Invitation failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleResendInvitation(member: TeamMember) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await resendEmployeeInvitation(member.user_id);

      if (!response.invitation_email_sent) {
        setError(response.delivery_issue || response.message);
        return;
      }

      setSuccess(response.message);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to resend invitation.",
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
    return <Spinner label="Loading employees…" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="People"
        title="Employees"
        description="Invite team members by email. They set their password from the invitation link."
        actions={
          admin ? (
            <Button size="lg" onClick={() => setShowCreate(true)}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Invite employee
            </Button>
          ) : null
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      {showCreate ? (
        <Panel
          title="Send invitation"
          description="No password is set here. The employee receives an email to activate their account."
        >
          <form onSubmit={handleCreateEmployee} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Full name" htmlFor="invite-name" required>
                <Input
                  id="invite-name"
                  required
                  placeholder="Full name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                />
              </FormField>
              <FormField label="Email" htmlFor="invite-email" required>
                <Input
                  id="invite-email"
                  required
                  type="email"
                  placeholder="Email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                />
              </FormField>
              <FormField label="Role" htmlFor="invite-role">
                <Select
                  id="invite-role"
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as UserRole)}
                >
                  {CREATION_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <p className="rounded-xl bg-[var(--accent-sand)] px-4 py-3 text-[0.8125rem] text-[var(--muted)]">
              Salary contracts are configured under Payroll after the employee activates their account.
            </p>
            {vaultStatus?.requires_pin_on_employee_create ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Organization payroll PIN" htmlFor="invite-pin" required>
                  <Input
                    id="invite-pin"
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
                  />
                </FormField>
                <FormField label="Confirm payroll PIN" htmlFor="invite-pin-confirm" required>
                  <Input
                    id="invite-pin-confirm"
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
                  />
                </FormField>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="lg" disabled={saving}>
                {saving ? "Sending…" : "Send invitation"}
              </Button>
              <Button type="button" variant="secondary" size="lg" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}

      <Panel title="Members" description={`${members.length} in your organization`} flush>
        <div className={ledgerTable.wrap}>
          <table className={cn(ledgerTable.table, "min-w-[47.5rem]")}>
            <thead className={ledgerTable.thead}>
              <tr>
                <th scope="col" className={ledgerTable.th}>Name</th>
                <th scope="col" className={ledgerTable.th}>Role</th>
                <th scope="col" className={ledgerTable.th}>Status</th>
                <th scope="col" className={cn(ledgerTable.th, "text-right")}>Projects</th>
                {canEditMembers ? (
                  <th scope="col" className={cn(ledgerTable.th, "text-right")}>
                    <span className="sr-only">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className={ledgerTable.tbody}>
              {members.map((member) => (
                <tr key={member.id} className={ledgerTable.rowHover}>
                  <td className={ledgerTable.td}>
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[var(--foreground)]">{member.name}</span>
                        <span className="block truncate text-[0.8125rem] text-[var(--muted)]">{member.email}</span>
                      </span>
                    </div>
                  </td>
                  <td className={cn(ledgerTable.td, "capitalize text-[var(--muted)]")}>
                    {canEditMembers && member.user_id !== user.id ? (
                      <Select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member, e.target.value as UserRole)}
                        className="min-w-[8.75rem]"
                      >
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="sub_admin">Sub Admin</option>
                      </Select>
                    ) : (
                      member.role.replace("_", " ")
                    )}
                  </td>
                  <td className={ledgerTable.td}>
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", STATUS_BADGE[member.status])}>
                      {statusLabel(member.status)}
                    </span>
                  </td>
                  <td className={cn(ledgerTable.td, "tnum text-right")}>{member.assigned_projects_count ?? 0}</td>
                  {canEditMembers ? (
                    <td className={ledgerTable.td}>
                      {member.user_id !== user.id ? (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {member.status === "invited" ? (
                            <button
                              type="button"
                              onClick={() => void handleResendInvitation(member)}
                              className={cn(rowButton, "text-[var(--primary)] hover:bg-[var(--primary-muted)]")}
                            >
                              Resend invitation
                            </button>
                          ) : null}
                          {member.status !== "active" ? (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(member, "active")}
                              className={cn(rowButton, "border-transparent bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)] hover:brightness-95")}
                            >
                              Activate
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(member, "suspended")}
                              className={cn(rowButton, "border-[var(--accent-coral)]/40 text-[var(--accent-coral)] hover:bg-[var(--accent-coral-soft)]")}
                            >
                              Disable
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-right text-[0.8125rem] text-[var(--muted)]">You</p>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
