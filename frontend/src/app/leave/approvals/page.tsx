"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { ManagerLeaveApprovalsPage } from "@/components/leave/ManagerLeaveApprovalsPage";
import { useRoleRedirect } from "@/components/leave/RoleRouteGuard";
import { leaveHomeForRole } from "@/lib/navigation";

function ManagerLeaveApprovalsContent() {
  const user = useAppUser();
  const allowed = useRoleRedirect(user.role, ["manager"], leaveHomeForRole(user.role));

  if (!allowed) {
    return null;
  }

  return <ManagerLeaveApprovalsPage />;
}

export default function ManagerLeaveApprovalsPageRoute() {
  return (
    <AppShell>
      <ManagerLeaveApprovalsContent />
    </AppShell>
  );
}
