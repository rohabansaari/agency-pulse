"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { useRoleRedirect } from "@/components/leave/RoleRouteGuard";
import { OvertimeApprovalQueue } from "@/components/time/OvertimeApprovalQueue";
import { PageHeader } from "@/components/ui/PageHeader";

function AdminOvertimePageContent() {
  const user = useAppUser();
  const allowed = useRoleRedirect(user.role, ["admin", "sub_admin"], "/dashboard");

  if (!allowed) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Approvals"
        title="Overtime management"
        description="Review and approve manager overtime requests across the organization."
      />
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
