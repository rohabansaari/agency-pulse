"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { useRoleRedirect } from "@/components/leave/RoleRouteGuard";
import { PayrollVaultProvider } from "@/components/payroll/PayrollVaultProvider";
import { ProfitabilityView } from "@/components/reports/ProfitabilityView";

function ProfitabilityContent() {
  const user = useAppUser();
  const allowed = useRoleRedirect(user.role, ["admin"], "/reports");

  if (!allowed) {
    return null;
  }

  // Cost comes from salary contracts, so the page sits behind the payroll PIN.
  return (
    <PayrollVaultProvider>
      <ProfitabilityView />
    </PayrollVaultProvider>
  );
}

export default function ProfitabilityPage() {
  return (
    <AppShell>
      <ProfitabilityContent />
    </AppShell>
  );
}
