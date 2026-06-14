"use client";

import { Modal } from "@/components/ui/Modal";
import { Dropdown } from "@/components/ui/Dropdown";
import { ActionMenu, ActionMenuItem } from "@/components/ui/ActionMenu";
import { ApiError, resetEmployeePassword, resendEmployeeInvitation, updateTeamMember, formatApiErrors } from "@/lib/api";
import {
  canChangeMemberRole,
  canEditEmployeeStatus,
  canEditMemberStatus,
  canManageOrgEmployees,
  canResetMemberPassword,
  MUTABLE_ROLES,
  ROLE_LABELS,
} from "@/lib/navigation";
import type { MemberStatus, TeamMember, User, UserRole } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ASSIGNABLE_ROLES: UserRole[] = MUTABLE_ROLES;

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "invited", label: "Pending invitation" },
  { value: "suspended", label: "Disabled" },
];

type EmployeeActionsMenuProps = {
  viewer: User;
  member: TeamMember;
  onUpdated: () => void;
};

export function EmployeeActionsMenu({ viewer, member, onUpdated }: EmployeeActionsMenuProps) {
  const router = useRouter();
  const [modal, setModal] = useState<"edit" | "role" | "status" | "password" | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [name, setName] = useState(member.name);
  const [selectedRole, setSelectedRole] = useState<UserRole>(member.role);
  const [selectedStatus, setSelectedStatus] = useState<MemberStatus>(member.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canResetPassword =
    canManageOrgEmployees(viewer.role) &&
    canResetMemberPassword(member.role) &&
    member.status === "active";
  const canResendInvitation =
    canManageOrgEmployees(viewer.role) && member.status === "invited";
  const canEdit = canEditEmployeeStatus(viewer.role);
  const isSelf = viewer.id === member.user_id;
  const canEditStatus = canEdit && canEditMemberStatus(member.role);
  const canEditThis = canEditStatus && (viewer.role === "admin" || member.role !== "admin");
  const canChangeThisRole = canChangeMemberRole(viewer.role, member.role, isSelf);

  async function saveUpdate(payload: Partial<{ name: string; role: UserRole; status: MemberStatus }>) {
    setSaving(true);
    setError("");
    try {
      await updateTeamMember(member.id, payload);
      setModal(null);
      onUpdated();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Update failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ActionMenu align="right">
        <ActionMenuItem
          onClick={() => router.push(`/employees/${member.user_id}`)}
        >
          View profile
        </ActionMenuItem>
        {canEditThis ? (
          <ActionMenuItem
            onClick={() => {
              setName(member.name);
              setModal("edit");
            }}
          >
            Edit profile
          </ActionMenuItem>
        ) : null}
        {canChangeThisRole ? (
          <ActionMenuItem
            onClick={() => {
              setSelectedRole(member.role);
              setModal("role");
            }}
          >
            Change role
          </ActionMenuItem>
        ) : null}
        {canEditStatus ? (
          <ActionMenuItem
            onClick={() => {
              setSelectedStatus(member.status);
              setModal("status");
            }}
          >
            Update status
          </ActionMenuItem>
        ) : null}
        {canResendInvitation ? (
          <ActionMenuItem
            onClick={() => {
              void (async () => {
                setSaving(true);
                setError("");
                try {
                  await resendEmployeeInvitation(member.user_id);
                  onUpdated();
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : "Failed to resend invitation.");
                } finally {
                  setSaving(false);
                }
              })();
            }}
          >
            Resend invitation
          </ActionMenuItem>
        ) : null}
        {canResetPassword ? (
          <ActionMenuItem
            onClick={() => {
              setNewPassword("");
              setModal("password");
            }}
          >
            Reset password
          </ActionMenuItem>
        ) : null}
      </ActionMenu>

      {modal === "edit" ? (
        <Modal onClose={() => setModal(null)} title="Edit profile">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void saveUpdate({ name });
            }}
          >
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              Save
            </button>
          </form>
        </Modal>
      ) : null}

      {modal === "role" ? (
        <Modal onClose={() => setModal(null)} title="Change role">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void saveUpdate({ role: selectedRole });
            }}
          >
            <Dropdown
              value={selectedRole}
              onChange={(v) => setSelectedRole(v as UserRole)}
              options={ASSIGNABLE_ROLES.map((role) => ({
                value: role,
                label: ROLE_LABELS[role],
              }))}
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={saving || selectedRole === member.role}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              Save role
            </button>
          </form>
        </Modal>
      ) : null}

      {modal === "status" ? (
        <Modal onClose={() => setModal(null)} title="Update status">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void saveUpdate({ status: selectedStatus });
            }}
          >
            <Dropdown
              value={selectedStatus}
              onChange={(v) => setSelectedStatus(v as MemberStatus)}
              options={STATUS_OPTIONS}
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={saving || selectedStatus === member.status}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              Save status
            </button>
          </form>
        </Modal>
      ) : null}

      {modal === "password" ? (
        <Modal onClose={() => setModal(null)} title="Reset password">
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setError("");
              try {
                await resetEmployeePassword(member.user_id, newPassword);
                setModal(null);
                onUpdated();
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "Password reset failed.");
              } finally {
                setSaving(false);
              }
            }}
          >
            <input
              required
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              Update password
            </button>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
