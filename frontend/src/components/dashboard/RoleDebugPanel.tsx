"use client";

import { RoleBadge } from "@/components/dashboard/RoleBadge";
import { useAppSession } from "@/components/dashboard/AppShell";

export function RoleDebugPanel() {
  const { user, organizationName } = useAppSession();

  return (
    <div className="mb-6 rounded-xl border border-[var(--accent-copper)]/30 bg-[var(--accent-copper-soft)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-copper)]">
          Dev — Role context
        </p>
        <RoleBadge role={user.role} />
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-[var(--accent-copper)]">Name</dt>
          <dd className="font-medium text-[var(--foreground)]">{user.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--accent-copper)]">Email</dt>
          <dd className="font-medium text-[var(--foreground)]">{user.email}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--accent-copper)]">Role</dt>
          <dd>
            <RoleBadge role={user.role} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--accent-copper)]">Organization</dt>
          <dd className="font-medium text-[var(--foreground)]">
            {organizationName ?? "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
