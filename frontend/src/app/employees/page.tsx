"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { TeamManager } from "@/components/team/TeamManager";
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

  return <TeamManager user={user} />;
}

export default function EmployeesPage() {
  return (
    <AppShell>
      <EmployeesContent />
    </AppShell>
  );
}
