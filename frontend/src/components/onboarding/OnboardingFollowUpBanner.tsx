"use client";

import { fetchOnboardingStatus } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const FOLLOW_UP_META: Record<number, { title: string; href: string; description: string }> = {
  3: {
    title: "Add employees",
    href: "/employees",
    description: "Import or create team members you skipped during setup.",
  },
  4: {
    title: "Create teams",
    href: "/teams",
    description: "Organize people into teams for reporting and assignments.",
  },
  5: {
    title: "Create projects",
    href: "/projects",
    description: "Set up client projects for time tracking and overtime.",
  },
};

export function OnboardingFollowUpBanner() {
  const [steps, setSteps] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const status = await fetchOnboardingStatus();
      setSteps(status.follow_up_steps ?? []);
    } catch {
      setSteps([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || steps.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-[var(--primary)]/25 bg-[var(--card)] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-[var(--primary)]">
            Complete your setup
          </p>
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {steps.length} optional step{steps.length === 1 ? "" : "s"} still pending
          </h2>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {steps.map((step) => {
          const meta = FOLLOW_UP_META[step];
          if (!meta) return null;
          return (
            <Link
              key={step}
              href={meta.href}
              className="min-w-[220px] shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 transition hover:border-[var(--primary)]/40 hover:bg-[var(--primary-muted)]"
            >
              <p className="text-sm font-medium text-[var(--foreground)]">{meta.title}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{meta.description}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
