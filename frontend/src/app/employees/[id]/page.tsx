"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { EmployeeProfileView } from "@/components/employees/EmployeeProfileView";
import { useRoleRedirect } from "@/components/leave/RoleRouteGuard";
import { useParams } from "next/navigation";

function EmployeeProfilePageContent() {
  const user = useAppUser();
  const allowed = useRoleRedirect(user.role, ["admin", "sub_admin"], "/dashboard");
  const params = useParams();
  const userId = Number(params.id);

  if (!allowed || Number.isNaN(userId)) {
    return null;
  }

  return <EmployeeProfileView userId={userId} viewer={user} />;
}

export default function EmployeeProfilePage() {
  return (
    <AppShell>
      <EmployeeProfilePageContent />
    </AppShell>
  );
}
