"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { ProjectsManager } from "@/components/projects/ProjectsManager";

function ProjectsContent() {
  const user = useAppUser();
  return <ProjectsManager user={user} />;
}

export default function ProjectsPage() {
  return (
    <AppShell>
      <ProjectsContent />
    </AppShell>
  );
}
