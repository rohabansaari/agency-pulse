"use client";

import { PulseLogo } from "@/components/brand/PulseLogo";
import { useAuthSession } from "@/hooks/useAuthSession";
import { KeyRound, LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Super admin console frame (Ledger design): a dark brand bar instead of the
 * tenant sidebar, since the platform account has no organization to navigate.
 */
export function PlatformShell({
  children,
  onChangePassword,
}: {
  children: ReactNode;
  onChangePassword: () => void;
}) {
  const { user, loading, error, loggingOut, handleLogout } = useAuthSession();

  if (loading) {
    return (
      <div className="theme-ledger flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
          <p className="text-sm text-[var(--muted)]">Loading platform console…</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="theme-ledger flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <p className="text-sm text-[var(--danger)]">{error || "Something went wrong."}</p>
          <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-[var(--primary)]">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-ledger min-h-screen">
      <header className="bg-[var(--night)] text-white">
        <div className="mx-auto flex min-h-16 max-w-[77.5rem] min-[100rem]:max-w-[120rem] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
          <Link href="/platform" aria-label="AgencyPulse platform home">
            <PulseLogo tone="dark" className="text-base" markClassName="h-7 w-7" />
          </Link>
          <span className="rounded-full bg-[#2a1f05] px-2.5 py-1 text-[0.6875rem] font-semibold tracking-[0.06em] text-[#f5c46b]">
            PLATFORM
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-1 sm:gap-2">
            <span className="hidden px-2 text-sm text-[var(--night-text)] sm:inline">{user.email}</span>
            <button
              type="button"
              onClick={onChangePassword}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-[var(--night-text)] transition hover:bg-[var(--night-raised)] hover:text-white"
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              <span className="hidden md:inline">Change password</span>
              <span className="md:hidden">Password</span>
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-[var(--night-text)] transition hover:bg-[var(--night-raised)] hover:text-white disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[77.5rem] min-[100rem]:max-w-[120rem] px-4 pb-16 pt-8 sm:px-6">{children}</main>
    </div>
  );
}
