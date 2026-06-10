"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { EmployeesDirectory } from "@/components/employees/EmployeesDirectory";
import { isAdmin } from "@/lib/navigation";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function EmployeesContent() {
  const user = useAppUser();
  const router = useRouter();

  useEffect(() => {
    if (!isAdmin(user.role)) {
      router.replace("/dashboard");
    }
  }, [user.role, router]);

  if (!isAdmin(user.role)) {
    return null;
  }

  return <EmployeesDirectory user={user} />;
}

export default function EmployeesPage() {
  return (
    <AppShell>
      <EmployeesContent />
    </AppShell>
  );
}
