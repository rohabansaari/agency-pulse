"use client";

import { RoleBadge } from "@/components/dashboard/RoleBadge";
import { useAppSession } from "@/components/dashboard/AppShell";

export function RoleDebugPanel() {
  const { user, organizationName } = useAppSession();

  return (
    <div className="mb-6 rounded-xl border border-amber-200/80 bg-amber-50/80 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
          Dev — Role context
        </p>
        <RoleBadge role={user.role} />
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-amber-700/80 dark:text-amber-400/80">Name</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-50">{user.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-amber-700/80 dark:text-amber-400/80">Email</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-50">{user.email}</dd>
        </div>
        <div>
          <dt className="text-xs text-amber-700/80 dark:text-amber-400/80">Role</dt>
          <dd>
            <RoleBadge role={user.role} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-amber-700/80 dark:text-amber-400/80">Organization</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-50">
            {organizationName ?? "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
