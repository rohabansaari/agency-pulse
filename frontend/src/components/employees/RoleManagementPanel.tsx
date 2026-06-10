"use client";

import { RoleBadge } from "@/components/dashboard/RoleBadge";
import { ApiError, updateTeamMember, formatApiErrors } from "@/lib/api";
import {
  canChangeMemberRole,
  canChangeEmployeeRoles,
  MUTABLE_ROLES,
  ROLE_LABELS,
} from "@/lib/navigation";
import type { User, UserRole } from "@/lib/types";
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
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Role management</h2>
      <p className="mt-1 text-xs text-zinc-500">
        {canChangeEmployeeRoles(viewer.role)
          ? "Employee and manager roles can be changed by admins. Admin and sub admin roles are fixed at creation."
          : "View-only. Role changes require an organization admin."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs text-zinc-500">Current role</p>
          <RoleBadge role={currentRole} className="mt-1" />
        </div>

        {canChangeRole ? (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Change role</label>
              <select
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value as UserRole)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              >
                {MUTABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={saving || selectedRole === currentRole}
              onClick={() => void handleSaveRole()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save role"}
            </button>
          </div>
        ) : null}

        {isSelf ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            You cannot change your own role.
          </p>
        ) : null}

        {!canChangeRole && !isSelf && canChangeEmployeeRoles(viewer.role) ? (
          <p className="text-xs text-zinc-500">
            {ROLE_LABELS[currentRole]} roles cannot be changed after account creation.
          </p>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-green-600">{success}</p> : null}
      {!canChangeEmployeeRoles(viewer.role) ? (
        <p className="mt-3 text-xs text-zinc-500">
          {memberName} is assigned the {ROLE_LABELS[currentRole]} role.
        </p>
      ) : null}
    </section>
  );
}
