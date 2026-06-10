"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { useRoleRedirect } from "@/components/leave/RoleRouteGuard";
import { OvertimeApprovalQueue } from "@/components/time/OvertimeApprovalQueue";

function AdminOvertimePageContent() {
  const user = useAppUser();
  const allowed = useRoleRedirect(user.role, ["admin", "sub_admin"], "/dashboard");

  if (!allowed) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Overtime management
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Review and approve manager overtime requests across the organization.
        </p>
      </div>
      <OvertimeApprovalQueue title="Pending overtime approvals" />
    </div>
  );
}

export default function AdminOvertimePage() {
  return (
    <AppShell>
      <AdminOvertimePageContent />
    </AppShell>
  );
}
