"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { MyTeamsView } from "@/components/teams/MyTeamsView";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function MyTeamsContent() {
  const user = useAppUser();
  const router = useRouter();

  useEffect(() => {
    if (user.role !== "manager") {
      router.replace(user.role === "admin" ? "/teams" : "/dashboard");
    }
  }, [user.role, router]);

  if (user.role !== "manager") {
    return null;
  }

  return <MyTeamsView />;
}

export default function MyTeamsPage() {
  return (
    <AppShell>
      <MyTeamsContent />
    </AppShell>
  );
}
