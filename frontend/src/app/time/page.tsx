"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { TimeTracker } from "@/components/TimeTracker";

function TimePageContent() {
  const user = useAppUser();
  return <TimeTracker user={user} />;
}

export default function TimePage() {
  return (
    <AppShell>
      <TimePageContent />
    </AppShell>
  );
}
