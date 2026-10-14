"use client";

import { LedgerRoleBadge } from "@/components/employees/employee-ui";
import { Panel } from "@/components/ledger/Panel";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/EmptyState";
import { ApiError, updateTeamMember, formatApiErrors } from "@/lib/api";
import {
  canChangeMemberRole,
  canChangeEmployeeRoles,
  MUTABLE_ROLES,
  ROLE_LABELS,
} from "@/lib/navigation";
import type { User, UserRole } from "@/lib/types";
import { Label, Select } from "@/components/ui/Input";
import { useState } from "react";

type RoleManagementPanelProps = {
  viewer: User;
  membershipId: number;
  userId: number;
  currentRole: UserRole;
  memberName: string;
  onUpdated: () => void;
};

export function RoleManagementPanel({
  viewer,
  membershipId,
  userId,
  currentRole,
  memberName,
  onUpdated,
}: RoleManagementPanelProps) {
  const isSelf = viewer.id === userId;
  const canChangeRole = canChangeMemberRole(viewer.role, currentRole, isSelf);
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSaveRole() {
    if (!canChangeRole) {
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateTeamMember(membershipId, { role: selectedRole });
      setSuccess("Role updated successfully.");
      onUpdated();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to update role.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      title="Role"
      description={
        canChangeEmployeeRoles(viewer.role)
          ? "Employee and manager roles can be changed by admins. Admin and sub admin roles are fixed at creation."
          : "View-only. Role changes require an organization admin."
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--accent-sand)]/60 px-4 py-3">
          <span className="text-[0.8125rem] text-[var(--muted)]">Current role</span>
          <LedgerRoleBadge role={currentRole} />
        </div>

        {canChangeRole ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[10rem] flex-1">
              <Label htmlFor={`role-select-${membershipId}`}>Change role</Label>
              <Select
                id={`role-select-${membershipId}`}
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value as UserRole)}
              >
                {MUTABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              size="lg"
              disabled={saving || selectedRole === currentRole}
              onClick={() => void handleSaveRole()}
            >
              {saving ? "Saving…" : "Save role"}
            </Button>
          </div>
        ) : null}

        {isSelf ? (
          <p className="rounded-xl bg-[var(--accent-copper-soft)] px-4 py-2.5 text-[0.8125rem] text-[var(--accent-copper)]">
            You cannot change your own role.
          </p>
        ) : null}

        {!canChangeRole && !isSelf && canChangeEmployeeRoles(viewer.role) ? (
          <p className="text-[0.8125rem] text-[var(--muted)]">
            {ROLE_LABELS[currentRole]} roles cannot be changed after account creation.
          </p>
        ) : null}

        {error ? <Alert variant="error">{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}
        {!canChangeEmployeeRoles(viewer.role) ? (
          <p className="text-[0.8125rem] text-[var(--muted)]">
            {memberName} is assigned the {ROLE_LABELS[currentRole]} role.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
