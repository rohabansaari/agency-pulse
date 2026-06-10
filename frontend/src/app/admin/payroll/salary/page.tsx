"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { useRoleRedirect } from "@/components/leave/RoleRouteGuard";
import { PayrollNav } from "@/components/payroll/PayrollNav";
import { PayrollVaultProvider } from "@/components/payroll/PayrollVaultProvider";
import { SalaryManagementPanel } from "@/components/payroll/SalaryManagementPanel";

function SalaryManagementPageContent() {
  const user = useAppUser();
  const allowed = useRoleRedirect(user.role, ["admin"], "/dashboard");

  if (!allowed) {
    return null;
  }

  return (
    <PayrollVaultProvider>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Payroll</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage payroll runs and encrypted salary contracts.
          </p>
        </div>
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
