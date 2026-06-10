"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { AdminLeavePage } from "@/components/leave/AdminLeavePage";
import { useRoleRedirect } from "@/components/leave/RoleRouteGuard";
import { leaveHomeForRole } from "@/lib/navigation";

function AdminLeavePageContent() {
  const user = useAppUser();
  const allowed = useRoleRedirect(user.role, ["admin", "sub_admin"], leaveHomeForRole(user.role));

  if (!allowed) {
    return null;
  }

  return <AdminLeavePage />;
}

export default function AdminLeavePageRoute() {
  return (
    <AppShell>
      <AdminLeavePageContent />
    </AppShell>
  );
}
