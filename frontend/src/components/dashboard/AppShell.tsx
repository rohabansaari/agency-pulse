"use client";

import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { useAuthSession } from "@/hooks/useAuthSession";
import type { User } from "@/lib/types";
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
      <div className="app-layout flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-400" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="app-layout flex items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-red-600 dark:text-red-400">
            {error || "Something went wrong."}
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  const session: AppSession = { user, organizationName };

  return (
    <AuthContext.Provider value={session}>
      <div className="app-layout min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <aside className="app-sidebar hidden border-r border-zinc-200/80 bg-white md:block dark:border-zinc-800 dark:bg-zinc-900">
          <DashboardSidebar
            user={user}
            onLogout={handleLogout}
            loggingOut={loggingOut}
          />
        </aside>

        <div className="app-main-with-sidebar flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between border-b border-zinc-200/80 bg-white/95 px-4 py-3 backdrop-blur md:px-6 dark:border-zinc-800 dark:bg-zinc-900/95">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="rounded-lg p-2 text-zinc-600 transition hover:bg-zinc-100 md:hidden dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label="Open navigation"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-zinc-900 md:hidden dark:text-zinc-50">
                AgencyPulse
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900 md:hidden dark:text-zinc-400"
            >
              {loggingOut ? "..." : "Logout"}
            </button>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>

        {mobileNavOpen ? (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-zinc-900/50 backdrop-blur-sm md:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-zinc-200 bg-white shadow-xl transition-transform duration-300 ease-out md:hidden dark:border-zinc-800 dark:bg-zinc-900 ${
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
