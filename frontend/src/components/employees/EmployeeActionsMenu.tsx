"use client";

import { Modal } from "@/components/ui/Modal";
import { ApiError, resetEmployeePassword, updateTeamMember, formatApiErrors } from "@/lib/api";
import {
  canChangeMemberRole,
  canEditEmployeeStatus,
  canManageOrgEmployees,
  isPrivilegedMember,
  MUTABLE_ROLES,
  ROLE_LABELS,
} from "@/lib/navigation";
import type { MemberStatus, TeamMember, User, UserRole } from "@/lib/types";
import Link from "next/link";
import { useState } from "react";

const ASSIGNABLE_ROLES: UserRole[] = MUTABLE_ROLES;

type EmployeeActionsMenuProps = {
  viewer: User;
  member: TeamMember;
  onUpdated: () => void;
};

export function EmployeeActionsMenu({ viewer, member, onUpdated }: EmployeeActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<"edit" | "role" | "status" | "password" | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [name, setName] = useState(member.name);
  const [selectedRole, setSelectedRole] = useState<UserRole>(member.role);
  const [selectedStatus, setSelectedStatus] = useState<MemberStatus>(member.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canResetPassword = canManageOrgEmployees(viewer.role) && member.role === "employee";
  const canEdit = canEditEmployeeStatus(viewer.role);
  const isSelf = viewer.id === member.user_id;
  const isProtectedFromSubAdmin = isPrivilegedMember(member.role);
  const canEditThis = canEdit && (viewer.role === "admin" || !isProtectedFromSubAdmin);
  const canChangeThisRole = canChangeMemberRole(viewer.role, member.role, isSelf);

  async function saveUpdate(payload: Partial<{ name: string; role: UserRole; status: MemberStatus }>) {
    setSaving(true);
    setError("");
    try {
      await updateTeamMember(member.id, payload);
      setModal(null);
      setOpen(false);
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
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-600"
      >
        Actions ▾
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Close actions menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <Link
              href={`/employees/${member.user_id}`}
              className="block px-3 py-1.5 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
              onClick={() => setOpen(false)}
            >
              View profile
            </Link>
            {canEditThis ? (
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                onClick={() => {
                  setName(member.name);
                  setModal("edit");
                  setOpen(false);
                }}
              >
                Edit profile
              </button>
            ) : null}
            {canChangeThisRole ? (
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                onClick={() => {
                  setSelectedRole(member.role);
                  setModal("role");
                  setOpen(false);
                }}
              >
                Change role
              </button>
            ) : null}
            {canEditThis ? (
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                onClick={() => {
                  setSelectedStatus(member.status);
                  setModal("status");
                  setOpen(false);
                }}
              >
                Activate / deactivate
              </button>
            ) : null}
            {canResetPassword ? (
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                onClick={() => {
                  setNewPassword("");
                  setModal("password");
                  setOpen(false);
                }}
              >
                Reset password
              </button>
            ) : null}
          </div>
        </>
      ) : null}

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
            <select
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as UserRole)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
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
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as MemberStatus)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm capitalize dark:border-zinc-600 dark:bg-zinc-900"
            >
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="suspended">Suspended</option>
            </select>
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
    </div>
  );
}
