"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { EmployeeLeavePage } from "@/components/leave/EmployeeLeavePage";
import { useRoleRedirect } from "@/components/leave/RoleRouteGuard";
import { leaveHomeForRole } from "@/lib/navigation";

function LeavePageContent() {
  const user = useAppUser();
  const allowed = useRoleRedirect(user.role, ["employee"], leaveHomeForRole(user.role));

  if (!allowed) {
    return null;
  }

  return <EmployeeLeavePage />;
}

export default function LeavePage() {
  return (
    <AppShell>
      <LeavePageContent />
    </AppShell>
  );
}
