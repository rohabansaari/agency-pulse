"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { useRoleRedirect } from "@/components/leave/RoleRouteGuard";
import { PayslipView } from "@/components/payslips/PayslipView";
import { useParams } from "next/navigation";

function PayslipContent() {
  const user = useAppUser();
  const allowed = useRoleRedirect(user.role, ["employee", "manager", "admin"], "/dashboard");
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  if (!allowed || !Number.isInteger(id) || id <= 0) return null;

  return user.role === "admin" ? (
    <PayslipView key={id} id={id} backHref="/admin/payroll" backLabel="Payroll" />
  ) : (
    <PayslipView key={id} id={id} backHref="/payslips" backLabel="All payslips" />
  );
}

export default function PayslipPage() {
  return (
    <AppShell>
      <PayslipContent />
    </AppShell>
  );
}
