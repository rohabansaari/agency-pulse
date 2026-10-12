"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { useRoleRedirect } from "@/components/leave/RoleRouteGuard";
import { PayrollNav } from "@/components/payroll/PayrollNav";
import { PayrollVaultProvider } from "@/components/payroll/PayrollVaultProvider";
import { SalaryManagementPanel } from "@/components/payroll/SalaryManagementPanel";
import { PageHeader } from "@/components/ui/PageHeader";

function SalaryManagementPageContent() {
  const user = useAppUser();
  const allowed = useRoleRedirect(user.role, ["admin"], "/dashboard");

  if (!allowed) {
    return null;
  }

  return (
    <PayrollVaultProvider>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Payroll"
          title="Salary management"
          description="Manage payroll runs and encrypted salary contracts."
        />
        <PayrollNav />
        <SalaryManagementPanel />
      </div>
    </PayrollVaultProvider>
  );
}

export default function SalaryManagementPage() {
  return (
    <AppShell>
      <SalaryManagementPageContent />
    </AppShell>
  );
}
