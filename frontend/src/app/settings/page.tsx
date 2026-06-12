"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import { PageTransition } from "@/components/motion/PageTransition";
import { PasswordChangeForm } from "@/components/settings/PasswordChangeForm";
import { PayrollPinChangeForm } from "@/components/settings/PayrollPinChangeForm";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import { isAdmin } from "@/lib/navigation";
import { KeyRound, Lock, User } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "payroll-pin", label: "Payroll PIN", icon: Lock },
  { id: "password", label: "Password", icon: KeyRound },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function SettingsContent() {
  const user = useAppUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSection = (searchParams.get("section") as SectionId) || "profile";

  useEffect(() => {
    if (!isAdmin(user.role)) {
      router.replace("/dashboard");
    }
  }, [user.role, router]);

  if (!isAdmin(user.role)) {
    return null;
  }

  function navigate(section: SectionId) {
    router.push(`/settings?section=${section}`);
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          description="Manage your account, payroll security, and organization preferences."
        />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <nav className="flex shrink-0 gap-1 overflow-x-auto rounded-xl border border-zinc-200/80 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900 lg:w-52 lg:flex-col">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => navigate(id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition",
                  activeSection === id
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          <div className="min-w-0 flex-1 space-y-6">
            {activeSection === "profile" ? (
              <Card>
                <CardHeader title="Profile" description="Your account details in this organization." />
                <dl className="space-y-4 text-sm">
                  <div className="flex justify-between gap-4 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                    <dt className="text-zinc-500">Name</dt>
                    <dd className="font-medium text-zinc-900 dark:text-zinc-50">{user.name}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                    <dt className="text-zinc-500">Email</dt>
                    <dd className="font-medium text-zinc-900 dark:text-zinc-50">{user.email}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Role</dt>
                    <dd>
                      <RoleBadge role={user.role} />
                    </dd>
                  </div>
                </dl>
              </Card>
            ) : null}

            {activeSection === "payroll-pin" ? (
              <Card>
                <CardHeader
                  title="Payroll PIN"
                  description="Change the PIN that protects payroll and salary data. Your current PIN is required."
                />
                <PayrollPinChangeForm />
              </Card>
            ) : null}

            {activeSection === "password" ? (
              <Card>
                <CardHeader
                  title="Password"
                  description="Update your account password. You will stay signed in after saving."
                />
                <PasswordChangeForm />
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

export default function SettingsPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <SettingsContent />
      </Suspense>
    </AppShell>
  );
}
