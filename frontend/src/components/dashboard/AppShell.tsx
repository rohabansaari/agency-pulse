"use client";

import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DesktopAgentBanner } from "@/components/screenshots/DesktopAgentBanner";
import { useAuthSession } from "@/hooks/useAuthSession";
import { PageTransition } from "@/components/motion/PageTransition";
import type { User } from "@/lib/types";
import { Menu } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useState, type ReactNode } from "react";

export interface AppSession {
  user: User;
  organizationName: string | null;
}

const AuthContext = createContext<AppSession | null>(null);

export function useAppUser(): User {
  return useAppSession().user;
}

export function useAppSession(): AppSession {
  const session = useContext(AuthContext);
  if (!session) {
    throw new Error("useAppSession must be used within AppShell");
  }
  return session;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, organizationName, loading, error, loggingOut, handleLogout } =
    useAuthSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (loading) {
    return (
      <div className="app-layout flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
          <p className="text-sm text-[var(--muted)]">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="app-layout flex items-center justify-center px-4">
        <div className="ui-card-elevated max-w-sm p-8 text-center">
          <p className="text-sm text-[var(--danger)]">{error || "Something went wrong."}</p>
          <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-[var(--primary)]">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  const session: AppSession = { user, organizationName };

  return (
    <AuthContext.Provider value={session}>
      <div className="app-layout min-h-screen">
        <aside className="app-sidebar hidden border-r border-[var(--sidebar-border)] md:block">
          <DashboardSidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} />
        </aside>

        <div className="app-main-with-sidebar flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--card)]/90 px-4 py-3 backdrop-blur-md md:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="rounded-xl p-2 text-[var(--muted)] transition hover:bg-[var(--sidebar-hover)] md:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="text-heading text-sm md:hidden">AgencyPulse</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] md:hidden"
            >
              {loggingOut ? "…" : "Logout"}
            </button>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-7xl">
              <PageTransition>
                {user.role === "employee" || user.role === "manager" ? (
                  <DesktopAgentBanner user={user} />
                ) : null}
                {children}
              </PageTransition>
            </div>
          </main>
        </div>

        {mobileNavOpen ? (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-[var(--foreground)]/20 backdrop-blur-sm md:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[var(--app-sidebar-width)] max-w-[85vw] border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] shadow-2xl transition-transform duration-300 ease-out md:hidden ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
          }`}
          aria-hidden={!mobileNavOpen}
        >
          <DashboardSidebar
            user={user}
            onLogout={handleLogout}
            loggingOut={loggingOut}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </aside>
      </div>
    </AuthContext.Provider>
  );
}
