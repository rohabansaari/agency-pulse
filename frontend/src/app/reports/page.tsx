"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { ReportsView } from "@/components/reports/ReportsView";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function ReportsContent() {
  const user = useAppUser();
  const router = useRouter();

  useEffect(() => {
    if (user.role === "employee") {
      router.replace("/dashboard");
    }
  }, [user.role, router]);

  if (user.role === "employee") {
    return null;
  }

  return <ReportsView user={user} />;
}

export default function ReportsPage() {
  return (
    <AppShell>
      <ReportsContent />
    </AppShell>
  );
}
