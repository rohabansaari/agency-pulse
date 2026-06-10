"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { ApiError, fetchPlatformDashboard, formatApiErrors, updateSuperAdminPassword } from "@/lib/api";
import type { PlatformDashboard } from "@/lib/types";
import { FormEvent, useCallback, useEffect, useState } from "react";

export default function PlatformPage() {
  const [data, setData] = useState<PlatformDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fetchPlatformDashboard());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load platform dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Platform overview
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Aggregate platform metrics only. Organization HR data is not accessible from this account.
          </p>
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
