"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { ScreenshotsView } from "@/components/screenshots/ScreenshotsView";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function ScreenshotsContent() {
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

  return <ScreenshotsView user={user} />;
}

export default function ScreenshotsPage() {
  return (
    <AppShell>
      <ScreenshotsContent />
    </AppShell>
  );
}
