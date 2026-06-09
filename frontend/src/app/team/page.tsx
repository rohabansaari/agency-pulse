"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function LegacyTeamRedirectContent() {
  const user = useAppUser();
  const router = useRouter();

  useEffect(() => {
    if (user.role === "admin") {
      router.replace("/employees");
    } else if (user.role === "manager") {
      router.replace("/my-teams");
    } else {
      router.replace("/dashboard");
    }
  }, [user.role, router]);

  return <div className="h-32 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />;
}

export default function LegacyTeamRedirectPage() {
  return (
    <AppShell>
      <LegacyTeamRedirectContent />
    </AppShell>
  );
}
