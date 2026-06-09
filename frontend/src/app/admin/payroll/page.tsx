"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { useRoleRedirect } from "@/components/leave/RoleRouteGuard";
import { AdminPayrollPage } from "@/components/payroll/AdminPayrollPage";
import { PayrollVaultProvider } from "@/components/payroll/PayrollVaultProvider";

function AdminPayrollPageContent() {
  const user = useAppUser();
  const allowed = useRoleRedirect(user.role, ["admin"], "/dashboard");

  if (!allowed) {
    return null;
  }

  return (
    <PayrollVaultProvider>
      <AdminPayrollPage />
    </PayrollVaultProvider>
  );
}

export default function AdminPayrollPageRoute() {
  return (
    <AppShell>
      <AdminPayrollPageContent />
    </AppShell>
  );
}
