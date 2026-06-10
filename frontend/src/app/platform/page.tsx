"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import {
  ApiError,
  createPlatformOrganization,
  fetchPlatformDashboard,
  fetchPlatformOrganizations,
  formatApiErrors,
  updateSuperAdminPassword,
} from "@/lib/api";
import type { PlatformDashboard, PlatformOrganization } from "@/lib/types";
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
  const [adminPassword, setAdminPassword] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [dashboard, orgs] = await Promise.all([
        fetchPlatformDashboard(),
        fetchPlatformOrganizations(),
      ]);
      setData(dashboard);
      setOrganizations(orgs);
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
        admin_password: adminPassword,
      });
      setCreateSuccess(response.message);
      setOrgName("");
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
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

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Platform overview
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Create organizations, assign their admin, and monitor tenant counts. No organization HR
              data is accessible from this account.
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
              Creates the organization and its primary admin account.
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
              <input
                required
                type="password"
                minLength={8}
                placeholder="Admin password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              />
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
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
              {organizations.length} organization{organizations.length === 1 ? "" : "s"} on the platform
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
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {organizations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    No organizations yet. Create the first one above.
                  </td>
                </tr>
              ) : (
                organizations.map((organization) => (
                  <tr key={organization.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{organization.name}</p>
                      <p className="text-xs text-zinc-500">{organization.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{organization.admin_name ?? "—"}</p>
                      <p className="text-xs text-zinc-500">{organization.admin_email ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">{organization.employee_count}</td>
                    <td className="px-4 py-3 capitalize">{organization.status}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {organization.created_at
                        ? new Date(organization.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
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
    </AppShell>
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
