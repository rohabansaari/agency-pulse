"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { EmployeeAdvancePage } from "@/components/advances/AdvanceSalaryPage";
import { useRoleRedirect } from "@/components/leave/RoleRouteGuard";

function AdvancesPageContent() {
  const user = useAppUser();
  const allowed = useRoleRedirect(user.role, ["employee", "manager"], "/dashboard");

  if (!allowed) {
    return null;
  }

  return <EmployeeAdvancePage />;
}

export default function AdvancesPage() {
  return (
    <AppShell>
      <AdvancesPageContent />
    </AppShell>
  );
}
