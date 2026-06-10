"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { WorkTeamsManager } from "@/components/teams/WorkTeamsManager";
import { canManageWorkTeams } from "@/lib/navigation";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function TeamsContent() {
  const user = useAppUser();
  const router = useRouter();

  useEffect(() => {
    if (!canManageWorkTeams(user.role)) {
      router.replace(user.role === "manager" ? "/my-teams" : "/dashboard");
    }
  }, [user.role, router]);

  if (!canManageWorkTeams(user.role)) {
    return null;
  }

  return <WorkTeamsManager />;
}

export default function TeamsPage() {
  return (
    <AppShell>
      <TeamsContent />
    </AppShell>
  );
}
