"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { InvoicesView } from "@/components/invoices/InvoicesView";
import { useRoleRedirect } from "@/components/leave/RoleRouteGuard";

function InvoicesContent() {
  const user = useAppUser();
  const allowed = useRoleRedirect(user.role, ["admin"], "/dashboard");

  return allowed ? <InvoicesView /> : null;
}

export default function InvoicesPage() {
  return (
    <AppShell>
      <InvoicesContent />
    </AppShell>
  );
}
