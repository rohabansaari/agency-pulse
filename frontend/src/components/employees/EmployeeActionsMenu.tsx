"use client";

import { RowMenu, RowMenuDivider, RowMenuItem } from "@/components/employees/employee-ui";
import { Modal } from "@/components/ui/Modal";
import { Dropdown } from "@/components/ui/Dropdown";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/EmptyState";
import { FormField, Input } from "@/components/ui/Input";
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
import {
  Ban,
  CircleCheck,
  Mail,
  Pencil,
  Repeat,
  ToggleLeft,
  Trash2,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ASSIGNABLE_ROLES: UserRole[] = MUTABLE_ROLES;

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "invited", label: "Pending invitation" },
  { value: "suspended", label: "Deactivated" },
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

  const hasDangerZone =
    (canEditStatus && !isSelf && (member.status === "active" || member.status === "suspended")) ||
    canDeleteThis;

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
      <RowMenu label={`Actions for ${member.name}`}>
        <RowMenuItem
          icon={<UserRound className="h-4 w-4" />}
          onClick={() => router.push(`/employees/${member.user_id}`)}
        >
          View profile
        </RowMenuItem>
        {canEditThis ? (
          <RowMenuItem
            icon={<Pencil className="h-4 w-4" />}
            onClick={() => {
              setName(member.name);
              setEmail(member.email);
              openModal("edit");
            }}
          >
            Edit name &amp; email
          </RowMenuItem>
        ) : null}
        {canChangeThisRole ? (
          <RowMenuItem
            icon={<Repeat className="h-4 w-4" />}
            onClick={() => {
              setSelectedRole(member.role);
              openModal("role");
            }}
          >
            Change role
          </RowMenuItem>
        ) : null}
        {canEditStatus ? (
          <RowMenuItem
            icon={<ToggleLeft className="h-4 w-4" />}
            onClick={() => {
              setSelectedStatus(member.status);
              openModal("status");
            }}
          >
            Update status
          </RowMenuItem>
        ) : null}
        {canResendInvitation ? (
          <RowMenuItem
            icon={<Mail className="h-4 w-4" />}
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
          </RowMenuItem>
        ) : null}
        {hasDangerZone ? <RowMenuDivider /> : null}
        {canEditStatus && !isSelf && member.status === "active" ? (
          <RowMenuItem icon={<Ban className="h-4 w-4" />} onClick={() => openModal("deactivate")}>
            Deactivate
          </RowMenuItem>
        ) : null}
        {canEditStatus && !isSelf && member.status === "suspended" ? (
          <RowMenuItem
            icon={<CircleCheck className="h-4 w-4" />}
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
          </RowMenuItem>
        ) : null}
        {canDeleteThis ? (
          <RowMenuItem tone="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => openModal("delete")}>
            Delete employee
          </RowMenuItem>
        ) : null}
      </RowMenu>

      {modal === "edit" ? (
        <Modal
          onClose={() => setModal(null)}
          title="Edit name & email"
          description={`Update how ${member.name} appears and signs in.`}
        >
          <form
            className="space-y-4"
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
            <FormField label="Name" htmlFor={`member-${member.id}-name`} required>
              <Input
                id={`member-${member.id}-name`}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>
            <FormField
              label="Email"
              htmlFor={`member-${member.id}-email`}
              required
              hint={`The employee signs in with this email.${
                member.status === "invited" ? " Resend the invitation after changing it." : ""
              }`}
            >
              <Input
                id={`member-${member.id}-email`}
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>
            {error ? <Alert variant="error">{error}</Alert> : null}
            <ModalActions onCancel={() => setModal(null)}>
              <Button type="submit" size="lg" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </ModalActions>
          </form>
        </Modal>
      ) : null}

      {modal === "role" ? (
        <Modal
          onClose={() => setModal(null)}
          title="Change role"
          description={`Choose what ${member.name} can see and manage.`}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveUpdate({ role: selectedRole });
            }}
          >
            <FormField label="Role">
              <Dropdown
                value={selectedRole}
                onChange={(v) => setSelectedRole(v as UserRole)}
                options={ASSIGNABLE_ROLES.map((role) => ({
                  value: role,
                  label: ROLE_LABELS[role],
                }))}
              />
            </FormField>
            {error ? <Alert variant="error">{error}</Alert> : null}
            <ModalActions onCancel={() => setModal(null)}>
              <Button type="submit" size="lg" disabled={saving || selectedRole === member.role}>
                {saving ? "Saving…" : "Save role"}
              </Button>
            </ModalActions>
          </form>
        </Modal>
      ) : null}

      {modal === "deactivate" ? (
        <Modal onClose={() => setModal(null)} title={`Deactivate ${member.name}?`}>
          <div className="space-y-4 text-sm">
            <p className="text-[var(--foreground)]">
              They lose access right away and can&apos;t sign in or track time until you reactivate
              them. A running timer is stopped.
            </p>
            <p className="rounded-xl bg-[var(--accent-sand)] px-4 py-3 text-[var(--muted)]">
              Their time, screenshots and payroll history are kept.
            </p>
            {error ? <Alert variant="error">{error}</Alert> : null}
            <ModalActions onCancel={() => setModal(null)}>
              <Button
                variant="danger"
                size="lg"
                disabled={saving}
                onClick={() => void saveUpdate({ status: "suspended" })}
              >
                {saving ? "Deactivating…" : "Deactivate"}
              </Button>
            </ModalActions>
          </div>
        </Modal>
      ) : null}

      {modal === "delete" ? (
        <Modal onClose={() => setModal(null)} title={`Delete ${member.name}?`}>
          <div className="space-y-4 text-sm">
            <p className="text-[var(--foreground)]">
              This permanently removes <span className="font-medium">{member.email}</span> and their
              time entries, screenshots, leave and salary records. It can&apos;t be undone.
            </p>
            <p className="rounded-xl border border-[var(--accent-copper)]/30 bg-[var(--accent-copper-soft)] px-4 py-3 text-[var(--accent-copper)]">
              Employees included in a finalized payroll run can&apos;t be deleted. Deactivate them
              instead to keep their history.
            </p>
            {error ? <Alert variant="error">{error}</Alert> : null}
            <ModalActions onCancel={() => setModal(null)}>
              <Button
                size="lg"
                disabled={saving}
                onClick={() => void removeMember()}
                className="bg-[var(--danger)] text-[var(--primary-foreground)] hover:bg-[var(--danger)] hover:brightness-110"
              >
                {saving ? "Deleting…" : "Delete permanently"}
              </Button>
            </ModalActions>
          </div>
        </Modal>
      ) : null}

      {modal === "status" ? (
        <Modal
          onClose={() => setModal(null)}
          title="Update status"
          description={`Currently ${STATUS_OPTIONS.find((o) => o.value === member.status)?.label ?? member.status}.`}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveUpdate({ status: selectedStatus });
            }}
          >
            <FormField label="Status">
              <Dropdown
                value={selectedStatus}
                onChange={(v) => setSelectedStatus(v as MemberStatus)}
                options={STATUS_OPTIONS}
              />
            </FormField>
            {error ? <Alert variant="error">{error}</Alert> : null}
            <ModalActions onCancel={() => setModal(null)}>
              <Button type="submit" size="lg" disabled={saving || selectedStatus === member.status}>
                {saving ? "Saving…" : "Save status"}
              </Button>
            </ModalActions>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

function ModalActions({ onCancel, children }: { onCancel: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 pt-2">
      <Button type="button" variant="secondary" size="lg" onClick={onCancel}>
        Cancel
      </Button>
      {children}
    </div>
  );
}
