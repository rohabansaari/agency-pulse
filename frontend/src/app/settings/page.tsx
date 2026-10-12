"use client";

import { AppShell, useAppUser } from "@/components/dashboard/AppShell";
import { Avatar } from "@/components/ledger/Avatar";
import { PageTransition } from "@/components/motion/PageTransition";
import { PasswordChangeForm } from "@/components/settings/PasswordChangeForm";
import { PayrollPinChangeForm } from "@/components/settings/PayrollPinChangeForm";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import { isAdmin, ROLE_LABELS } from "@/lib/navigation";
import { KeyRound, Lock, User } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";

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

  const activeMeta = SECTIONS.find((section) => section.id === activeSection);

  return (
    <PageTransition>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Settings"
          description="Manage your account, payroll security, and organization preferences."
        />

        <div className="flex flex-wrap items-start gap-6">
          <nav
            aria-label="Settings sections"
            className="flex w-full min-w-0 gap-1 overflow-x-auto lg:w-[220px] lg:flex-none lg:flex-col"
          >
            {SECTIONS.map(({ id, label, icon: Icon }) => {
              const selected = activeSection === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigate(id)}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 text-sm transition",
                    selected
                      ? "bg-[var(--primary-muted)] font-medium text-[var(--primary)]"
                      : "text-[var(--muted)] hover:bg-[var(--accent-sand)] hover:text-[var(--foreground)]",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-6">
            {activeSection === "profile" ? (
              <SettingsSection
                id="settings-profile"
                title="Profile"
                description="Your account details in this organization."
              >
                <div className="mb-5 flex items-center gap-4">
                  <Avatar name={user.name} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-[var(--foreground)]">{user.name}</p>
                    <p className="truncate text-sm text-[var(--muted)]">{user.email}</p>
                  </div>
                </div>
                <dl className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)] text-sm">
                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3.5">
                    <dt className="text-[var(--muted)]">Name</dt>
                    <dd className="min-w-0 break-words font-medium text-[var(--foreground)]">{user.name}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3.5">
                    <dt className="text-[var(--muted)]">Email</dt>
                    <dd className="min-w-0 break-all font-medium text-[var(--foreground)]">{user.email}</dd>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-3.5">
                    <dt className="text-[var(--muted)]">Role</dt>
                    <dd>
                      <Badge variant="primary" className="normal-case">
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              </SettingsSection>
            ) : null}

            {activeSection === "payroll-pin" ? (
              <SettingsSection
                id="settings-payroll-pin"
                title="Payroll PIN"
                description="Change the PIN that protects payroll and salary data. Your current PIN is required."
              >
                <PayrollPinChangeForm />
              </SettingsSection>
            ) : null}

            {activeSection === "password" ? (
              <SettingsSection
                id="settings-password"
                title="Password"
                description="Update your account password. You will stay signed in after saving."
              >
                <PasswordChangeForm />
              </SettingsSection>
            ) : null}

            {activeMeta ? null : (
              <p className="text-sm text-[var(--muted)]">Choose a section to see its settings.</p>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6"
    >
      <div className="mb-5">
        <h2 id={id} className="text-lg font-semibold text-[var(--foreground)]">
          {title}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
      </div>
      {children}
    </section>
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
