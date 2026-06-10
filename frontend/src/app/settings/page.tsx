"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import { PasswordChangeForm } from "@/components/settings/PasswordChangeForm";
import { PayrollPinChangeForm } from "@/components/settings/PayrollPinChangeForm";
import { isAdmin } from "@/lib/navigation";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function SettingsContent() {
  const user = useAppUser();
  const router = useRouter();

  useEffect(() => {
    if (!isAdmin(user.role)) {
      router.replace("/dashboard");
    }
  }, [user.role, router]);

  if (!isAdmin(user.role)) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Account and organization preferences
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Profile</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Name</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-50">{user.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Email</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-50">{user.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Role</dt>
            <dd>
              <RoleBadge role={user.role} />
            </dd>
          </div>
        </dl>
      </div>
      <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Payroll PIN</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Change the PIN that protects payroll and salary data.
        </p>
        <div className="mt-4">
          <PayrollPinChangeForm />
        </div>
      </div>
      <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Password</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Update your account password. You will stay signed in after saving.
        </p>
        <div className="mt-4">
          <PasswordChangeForm />
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsContent />
    </AppShell>
  );
}
