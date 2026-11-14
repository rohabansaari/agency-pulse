"use client";

import { READ_ONLY_EVENT, READ_ONLY_MESSAGE } from "@/lib/read-only";
import { Eye, Lock } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Shown while a self sign-up waits for approval: the whole app is visible
 * (with the sample company) and nothing can be changed yet.
 */
export function PreviewModeBanner({ organizationName }: { organizationName: string | null }) {
  const [notice, setNotice] = useState(0);

  useEffect(() => {
    const onBlocked = () => setNotice((value) => value + 1);
    window.addEventListener(READ_ONLY_EVENT, onBlocked);
    return () => window.removeEventListener(READ_ONLY_EVENT, onBlocked);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(0), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <>
      <div
        role="status"
        className="mb-6 flex flex-col gap-3 rounded-2xl border border-[var(--primary)]/25 bg-[var(--primary-muted)] px-5 py-4 sm:flex-row sm:items-center"
      >
        <span
          aria-hidden="true"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--card)] text-[var(--primary)]"
        >
          <Eye className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Preview mode{organizationName ? ` · ${organizationName}` : ""} is waiting for approval
          </p>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Look around every screen with the sample company. Adding your own people, projects and time unlocks as
            soon as your workspace is approved.
          </p>
        </div>
      </div>

      {notice ? (
        <div
          role="alert"
          className="ap-rise fixed bottom-5 left-1/2 z-[60] flex w-[min(92vw,30rem)] -translate-x-1/2 items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-elevated)] px-4 py-3 shadow-xl"
        >
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
          <p className="text-sm text-[var(--foreground)]">{READ_ONLY_MESSAGE}</p>
        </div>
      ) : null}
    </>
  );
}
