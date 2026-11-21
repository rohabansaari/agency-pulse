"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { useRoleRedirect } from "@/components/leave/RoleRouteGuard";
import { PayslipList } from "@/components/payslips/PayslipList";

function PayslipsContent() {
  const user = useAppUser();
  const allowed = useRoleRedirect(user.role, ["employee", "manager"], "/dashboard");

  return allowed ? <PayslipList /> : null;
}

export default function PayslipsPage() {
  return (
    <AppShell>
      <PayslipsContent />
    </AppShell>
  );
}
