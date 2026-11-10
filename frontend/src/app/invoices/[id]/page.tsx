"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { InvoiceDetailView } from "@/components/invoices/InvoiceDetailView";
import { useRoleRedirect } from "@/components/leave/RoleRouteGuard";
import { useParams } from "next/navigation";

function InvoiceContent() {
  const user = useAppUser();
  const allowed = useRoleRedirect(user.role, ["admin"], "/dashboard");
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  if (!allowed) return null;

  return Number.isInteger(id) && id > 0 ? <InvoiceDetailView key={id} id={id} /> : null;
}

export default function InvoicePage() {
  return (
    <AppShell>
      <InvoiceContent />
    </AppShell>
  );
}
