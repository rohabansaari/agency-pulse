"use client";

import { Modal } from "@/components/ui/Modal";
import { Dropdown } from "@/components/ui/Dropdown";
import { ActionMenu, ActionMenuItem } from "@/components/ui/ActionMenu";
import { Button } from "@/components/ui/Button";
import {
  ApiError,
  deleteTeamMember,
  formatApiErrors,
  resendEmployeeInvitation,
  updateTeamMember,
} from "@/lib/api";
import {
  canChangeMemberRole,
  canEditEmployeeStatus,
  canEditMemberStatus,
  canManageOrgEmployees,
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
  onFeedback?: (message: string, variant: "success" | "error") => void;
};

export function EmployeeActionsMenu({ viewer, member, onUpdated, onFeedback }: EmployeeActionsMenuProps) {
  const router = useRouter();
  const [modal, setModal] = useState<
    "edit" | "role" | "status" | "deactivate" | "delete" | null
  >(null);
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email);
  const [selectedRole, setSelectedRole] = useState<UserRole>(member.role);
  const [selectedStatus, setSelectedStatus] = useState<MemberStatus>(member.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canResendInvitation =
    canManageOrgEmployees(viewer.role) && member.status === "invited";
  const canEdit = canEditEmployeeStatus(viewer.role);
  const isSelf = viewer.id === member.user_id;
  const canEditStatus = canEdit && canEditMemberStatus(member.role);
  const canEditThis = canEditStatus && (viewer.role === "admin" || member.role !== "admin");
  const canChangeThisRole = canChangeMemberRole(viewer.role, member.role, isSelf);
  const canDeleteThis =
    canManageOrgEmployees(viewer.role) && canEditMemberStatus(member.role) && !isSelf;

  function openModal(next: NonNullable<typeof modal>) {
    setError("");
    setModal(next);
  }

  async function removeMember() {
    setSaving(true);
    setError("");
    try {
      await deleteTeamMember(member.id);
      setModal(null);
      onFeedback?.(`${member.name} was deleted.`, "success");
      onUpdated();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Delete failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveUpdate(
    payload: Partial<{ name: string; email: string; role: UserRole; status: MemberStatus }>,
  ) {
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
              setEmail(member.email);
              openModal("edit");
            }}
          >
            Edit profile
          </ActionMenuItem>
        ) : null}
        {canChangeThisRole ? (
          <ActionMenuItem
            onClick={() => {
              setSelectedRole(member.role);
              openModal("role");
            }}
          >
            Change role
          </ActionMenuItem>
        ) : null}
        {canEditStatus ? (
          <ActionMenuItem
            onClick={() => {
              setSelectedStatus(member.status);
              openModal("status");
            }}
          >
            Update status
          </ActionMenuItem>
        ) : null}
        {canEditStatus && !isSelf && member.status === "active" ? (
          <ActionMenuItem onClick={() => openModal("deactivate")}>Deactivate</ActionMenuItem>
        ) : null}
        {canEditStatus && !isSelf && member.status === "suspended" ? (
          <ActionMenuItem
            onClick={() => {
              void (async () => {
                try {
                  await updateTeamMember(member.id, { status: "active" });
                  onFeedback?.(`${member.name} was reactivated.`, "success");
                  onUpdated();
                } catch (err) {
                  onFeedback?.(
                    err instanceof ApiError
                      ? formatApiErrors(err.errors) || err.message
                      : "Reactivation failed.",
                    "error",
                  );
                }
              })();
            }}
          >
            Reactivate
          </ActionMenuItem>
        ) : null}
        {canDeleteThis ? (
          <ActionMenuItem className="text-[var(--danger)]" onClick={() => openModal("delete")}>
            Delete employee
          </ActionMenuItem>
        ) : null}
        {canResendInvitation ? (
          <ActionMenuItem
            onClick={() => {
              void (async () => {
                setSaving(true);
                setError("");
                try {
                  const response = await resendEmployeeInvitation(member.user_id);

                  if (!response.invitation_email_sent) {
                    onFeedback?.(
                      response.delivery_issue || response.message,
                      "error",
                    );
                    return;
                  }

                  onFeedback?.(response.message, "success");
                  onUpdated();
                } catch (err) {
                  const message =
                    err instanceof ApiError ? err.message : "Failed to resend invitation.";
                  onFeedback?.(message, "error");
                  setError(message);
                } finally {
                  setSaving(false);
                }
              })();
            }}
          >
            Resend invitation
          </ActionMenuItem>
        ) : null}
      </ActionMenu>

      {modal === "edit" ? (
        <Modal onClose={() => setModal(null)} title="Edit profile">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmedEmail = email.trim();
              void saveUpdate(
                trimmedEmail.toLowerCase() === member.email.toLowerCase()
                  ? { name }
                  : { name, email: trimmedEmail },
              );
            }}
          >
            <label className="block space-y-1 text-sm">
              <span className="text-label">Name</span>
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-label">Email</span>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              />
              <span className="block text-xs text-[var(--muted)]">
                The employee signs in with this email.
                {member.status === "invited" ? " Resend the invitation after changing it." : ""}
              </span>
            </label>
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

      {modal === "deactivate" ? (
        <Modal onClose={() => setModal(null)} title={`Deactivate ${member.name}?`}>
          <div className="space-y-3 text-sm">
            <p>
              They lose access right away and can&apos;t sign in or track time until you reactivate
              them. A running timer is stopped. Their time, screenshots and payroll history are
              kept.
            </p>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={saving}
                onClick={() => void saveUpdate({ status: "suspended" })}
              >
                {saving ? "Deactivating…" : "Deactivate"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {modal === "delete" ? (
        <Modal onClose={() => setModal(null)} title={`Delete ${member.name}?`}>
          <div className="space-y-3 text-sm">
            <p>
              This permanently removes {member.email} and their time entries, screenshots, leave
              and salary records. It can&apos;t be undone.
            </p>
            <p className="text-[var(--muted)]">
              Employees included in a finalized payroll run can&apos;t be deleted. Deactivate them
              instead to keep their history.
            </p>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={saving} onClick={() => void removeMember()}>
                {saving ? "Deleting…" : "Delete permanently"}
              </Button>
            </div>
          </div>
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
    </>
  );
}
