"use client";

import { AdminAdvancePage } from "@/components/advances/AdvanceSalaryPage";
import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { useRoleRedirect } from "@/components/leave/RoleRouteGuard";

function AdminAdvancesPageContent() {
  const user = useAppUser();
  const allowed = useRoleRedirect(user.role, ["admin"], "/dashboard");

  if (!allowed) {
    return null;
  }

  return <AdminAdvancePage />;
}

export default function AdminAdvancesPage() {
  return (
    <AppShell>
      <AdminAdvancesPageContent />
    </AppShell>
  );
}
