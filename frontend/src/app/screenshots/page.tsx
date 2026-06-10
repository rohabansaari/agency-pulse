"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { ScreenshotsView } from "@/components/screenshots/ScreenshotsView";

function ScreenshotsContent() {
  const user = useAppUser();

  return <ScreenshotsView user={user} />;
}

export default function ScreenshotsPage() {
  return (
    <AppShell>
      <ScreenshotsContent />
    </AppShell>
  );
}
