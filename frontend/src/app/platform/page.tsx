"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { Modal } from "@/components/ui/Modal";
import {
  ApiError,
  createPlatformOrganization,
  deletePlatformOrganization,
  fetchPlatformDashboard,
  fetchPlatformMailStatus,
  fetchPlatformOrganizations,
  formatApiErrors,
  resendPlatformAdminInvitation,
  sendPlatformMailTest,
  updatePlatformOrganization,
  updateSuperAdminPassword,
} from "@/lib/api";
import type { PlatformDashboard, PlatformMailStatus, PlatformOrganization } from "@/lib/types";
import { FormEvent, useCallback, useEffect, useState } from "react";

export default function PlatformPage() {
  const [data, setData] = useState<PlatformDashboard | null>(null);
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [editingOrg, setEditingOrg] = useState<PlatformOrganization | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [rowActionId, setRowActionId] = useState<number | null>(null);
  const [rowMessage, setRowMessage] = useState("");
  const [rowMessageIsError, setRowMessageIsError] = useState(false);
  const [mailStatus, setMailStatus] = useState<PlatformMailStatus | null>(null);
  const [mailTestEmail, setMailTestEmail] = useState("");
  const [mailTestMessage, setMailTestMessage] = useState("");
  const [mailTestError, setMailTestError] = useState("");
  const [sendingMailTest, setSendingMailTest] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [dashboard, orgs, mail] = await Promise.all([
        fetchPlatformDashboard(),
        fetchPlatformOrganizations(),
        fetchPlatformMailStatus(),
      ]);
      setData(dashboard);
      setOrganizations(orgs);
      setMailStatus(mail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load platform dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    setCreateSuccess("");
    setSavingOrg(true);
    try {
      const response = await createPlatformOrganization({
        organization_name: orgName,
        admin_name: adminName,
        admin_email: adminEmail,
      });
      if (response.invitation_email_sent === false) {
        setCreateError(
          "Organization was created, but the invitation email was not delivered. Use Resend invitation after fixing mail settings.",
        );
      }
      setCreateSuccess(response.message);
      setOrgName("");
      setAdminName("");
      setAdminEmail("");
      setShowCreate(false);
      await load();
    } catch (err) {
      setCreateError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to create organization.",
      );
    } finally {
      setSavingOrg(false);
    }
  }

  async function handleMailTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMailTestMessage("");
    setMailTestError("");
    setSendingMailTest(true);
    try {
      const response = await sendPlatformMailTest(mailTestEmail.trim() || undefined);
      setMailTestMessage(response.message);
    } catch (err) {
      setMailTestError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Mail test failed.",
      );
    } finally {
      setSendingMailTest(false);
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    setSavingPassword(true);
    try {
      const response = await updateSuperAdminPassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setPasswordMessage(response.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Password update failed.",
      );
    } finally {
      setSavingPassword(false);
    }
  }

  function openEditEmail(organization: PlatformOrganization) {
    setEditingOrg(organization);
    setEditEmail(organization.admin_email ?? "");
    setEditError("");
  }

  async function handleEditEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingOrg) return;

    setEditError("");
    setSavingEdit(true);
    try {
      await updatePlatformOrganization(editingOrg.id, { admin_email: editEmail.trim() });
      setEditingOrg(null);
      setRowMessage("Admin email updated.");
      await load();
    } catch (err) {
      setEditError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to update admin email.",
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleSuspend(organization: PlatformOrganization) {
    if (
      !window.confirm(
        `Suspend "${organization.name}"? The organization will become inactive and can then be deleted.`,
      )
    ) {
      return;
    }

    setRowActionId(organization.id);
    setRowMessage("");
    setRowMessageIsError(false);
    try {
      await updatePlatformOrganization(organization.id, { status: "suspended" });
      setRowMessage(`"${organization.name}" suspended. Use Delete to remove it from the platform.`);
      await load();
    } catch (err) {
      setRowMessageIsError(true);
      setRowMessage(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to suspend organization.",
      );
    } finally {
      setRowActionId(null);
    }
  }

  async function handleReactivate(organization: PlatformOrganization) {
    setRowActionId(organization.id);
    setRowMessage("");
    setRowMessageIsError(false);
    try {
      await updatePlatformOrganization(organization.id, { status: "active" });
      setRowMessage(`"${organization.name}" reactivated.`);
      await load();
    } catch (err) {
      setRowMessageIsError(true);
      setRowMessage(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to reactivate organization.",
      );
    } finally {
      setRowActionId(null);
    }
  }

  async function handleResendAdminInvitation(organization: PlatformOrganization) {
    setRowActionId(organization.id);
    setRowMessage("");
    setRowMessageIsError(false);
    try {
      const response = await resendPlatformAdminInvitation(organization.id);
      setRowMessage(response.message);
      await load();
    } catch (err) {
      setRowMessageIsError(true);
      setRowMessage(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to resend admin invitation.",
      );
    } finally {
      setRowActionId(null);
    }
  }

  async function handleDelete(organization: PlatformOrganization) {
    if (
      !window.confirm(
        `Permanently delete "${organization.name}" and all tenant data? This cannot be undone.`,
      )
    ) {
      return;
    }

    setRowActionId(organization.id);
    setRowMessage("");
    setRowMessageIsError(false);
    try {
      await deletePlatformOrganization(organization.id);
      setOrganizations((current) => current.filter((org) => org.id !== organization.id));
      setRowMessage(`"${organization.name}" permanently deleted.`);
      await load();
    } catch (err) {
      setRowMessageIsError(true);
      setRowMessage(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to delete organization. Suspend the organization first, then click Delete.",
      );
    } finally {
      setRowActionId(null);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Platform overview
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Create organizations, manage admin accounts, suspend inactive tenants, and monitor
              counts. No organization HR data is accessible from this account.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate((value) => !value)}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showCreate ? "Cancel" : "Create organization"}
          </button>
        </div>

        {loading ? (
          <div className="h-40 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />
        ) : null}

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </p>
        ) : null}

        {rowMessage ? (
          <p
            className={
              rowMessageIsError
                ? "rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
                : "rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200"
            }
          >
            {rowMessage}
          </p>
        ) : null}

        {mailStatus && (!mailStatus.configured || mailStatus.render_smtp_blocked_hint) ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
            <h2 className="font-semibold text-amber-900 dark:text-amber-200">
              {mailStatus.configured ? "SMTP blocked on Render free tier" : "Email delivery not configured"}
            </h2>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
              {mailStatus.configured
                ? "Gmail SMTP credentials can be correct and still fail with a timeout on Render free services."
                : "Invitations will not reach inboxes until mail is configured on the API service (Render environment variables)."}
            </p>
            {mailStatus.issue ? (
              <p className="mt-2 text-sm font-medium text-amber-900 dark:text-amber-200">{mailStatus.issue}</p>
            ) : null}
            {mailStatus.render_smtp_blocked_hint ? (
              <p className="mt-2 text-sm text-amber-900 dark:text-amber-200">{mailStatus.render_smtp_blocked_hint}</p>
            ) : null}
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
              Current mailer: <span className="font-mono">{mailStatus.mailer}</span>
              {mailStatus.host ? (
                <>
                  {" "}
                  · {mailStatus.host}:{mailStatus.port}
                </>
              ) : null}
            </p>
          </section>
        ) : null}

        {mailStatus?.configured ? (
          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Test email delivery</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Sends a test message via {mailStatus.from_address} before inviting admins.
            </p>
            <form className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleMailTest}>
              <input
                type="email"
                placeholder="Recipient email (optional — defaults to you)"
                value={mailTestEmail}
                onChange={(event) => setMailTestEmail(event.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
              <button
                type="submit"
                disabled={sendingMailTest}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {sendingMailTest ? "Sending…" : "Send test email"}
              </button>
            </form>
            {mailTestError ? <p className="mt-2 text-sm text-red-600">{mailTestError}</p> : null}
            {mailTestMessage ? <p className="mt-2 text-sm text-green-600">{mailTestMessage}</p> : null}
          </section>
        ) : null}

        {data ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Organizations" value={data.organizations_total} />
            <MetricCard label="Active organizations" value={data.organizations_active} />
            <MetricCard label="Suspended organizations" value={data.organizations_suspended} />
            <MetricCard label="Tenant users" value={data.tenant_users_total} />
          </div>
        ) : null}

        {showCreate ? (
          <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-800/50">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">New organization</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Creates the organization and emails the admin an invitation to set their password.
            </p>
            <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleCreateOrganization}>
              <input
                required
                placeholder="Organization name"
                value={orgName}
                onChange={(event) => setOrgName(event.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              />
              <input
                required
                placeholder="Admin full name"
                value={adminName}
                onChange={(event) => setAdminName(event.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              />
              <input
                required
                type="email"
                placeholder="Admin email"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              />
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                <button
                  type="submit"
                  disabled={savingOrg}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {savingOrg ? "Creating…" : "Create organization"}
                </button>
                {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
                {createSuccess ? <p className="text-sm text-green-600">{createSuccess}</p> : null}
              </div>
            </form>
          </section>
        ) : null}

        <section className="ui-table-wrap rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Registered organizations</h2>
            <p className="text-xs text-zinc-500">
              {organizations.length} organization{organizations.length === 1 ? "" : "s"} on the platform.
              Suspending keeps a tenant visible — use <span className="font-medium">Delete</span> (after suspend)
              to remove it permanently.
            </p>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50">
              <tr>
                <th className="px-4 py-2 font-medium">Organization</th>
                <th className="px-4 py-2 font-medium">Admin</th>
                <th className="px-4 py-2 font-medium">Employees</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {organizations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    No organizations yet. Create the first one above.
                  </td>
                </tr>
              ) : (
                organizations.map((organization) => (
                  <OrganizationRow
                    key={organization.id}
                    organization={organization}
                    busy={rowActionId === organization.id}
                    onEditEmail={() => openEditEmail(organization)}
                    onSuspend={() => void handleSuspend(organization)}
                    onReactivate={() => void handleReactivate(organization)}
                    onResendInvitation={() => void handleResendAdminInvitation(organization)}
                    onDelete={() => void handleDelete(organization)}
                  />
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="max-w-lg rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Change password</h2>
          <p className="mt-1 text-xs text-zinc-500">Only you can update the super admin password.</p>
          <form className="mt-4 space-y-3" onSubmit={handlePasswordReset}>
            <input
              required
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
            <input
              required
              type="password"
              minLength={8}
              placeholder="New password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
            <input
              required
              type="password"
              minLength={8}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
            {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
            {passwordMessage ? <p className="text-sm text-green-600">{passwordMessage}</p> : null}
            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {savingPassword ? "Saving…" : "Update password"}
            </button>
          </form>
        </section>
      </div>

      {editingOrg ? (
        <Modal title={`Edit admin email — ${editingOrg.name}`} onClose={() => setEditingOrg(null)}>
          <form className="space-y-4" onSubmit={handleEditEmail}>
            <p className="text-sm text-zinc-500">
              Current admin: {editingOrg.admin_name ?? "Unknown"}
            </p>
            <input
              required
              type="email"
              value={editEmail}
              onChange={(event) => setEditEmail(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
            {editError ? <p className="text-sm text-red-600">{editError}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingOrg(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {savingEdit ? "Saving…" : "Save email"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </AppShell>
  );
}

function OrganizationRow({
  organization,
  busy,
  onEditEmail,
  onSuspend,
  onReactivate,
  onResendInvitation,
  onDelete,
}: {
  organization: PlatformOrganization;
  busy: boolean;
  onEditEmail: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onResendInvitation: () => void;
  onDelete: () => void;
}) {
  const isSuspended = organization.status === "suspended";
  const adminPending = organization.admin_status === "invited";

  return (
    <tr>
      <td className="px-4 py-3" data-label="Organization">
        <p className="font-medium text-zinc-900 dark:text-zinc-50">{organization.name}</p>
        <p className="text-xs text-zinc-500">{organization.slug}</p>
      </td>
      <td className="px-4 py-3" data-label="Admin">
        <p>{organization.admin_name ?? "—"}</p>
        <p className="text-xs text-zinc-500">{organization.admin_email ?? "—"}</p>
        {adminPending ? (
          <p className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-400">
            Pending invitation
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3" data-label="Employees">
        {organization.employee_count}
      </td>
      <td className="px-4 py-3 capitalize" data-label="Status">
        <StatusBadge status={organization.status} />
      </td>
      <td className="px-4 py-3 text-zinc-500" data-label="Created">
        {organization.created_at
          ? new Date(organization.created_at).toLocaleDateString()
          : "—"}
      </td>
      <td className="px-4 py-3" data-label="Actions">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !organization.admin_email}
            onClick={onEditEmail}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            Edit email
          </button>
          {adminPending ? (
            <button
              type="button"
              disabled={busy}
              onClick={onResendInvitation}
              className="rounded-md border border-violet-300 px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-800 dark:text-violet-300"
            >
              Resend invitation
            </button>
          ) : null}
          {isSuspended ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onReactivate}
                className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300"
              >
                Reactivate
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onDelete}
                className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300"
              >
                Delete
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={onSuspend}
              className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-800 dark:text-amber-300"
            >
              Suspend
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: PlatformOrganization["status"] }) {
  const styles =
    status === "active"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : status === "suspended"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles}`}>
      {status}
    </span>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}
