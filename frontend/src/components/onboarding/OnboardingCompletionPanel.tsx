"use client";

import {
  fetchOnboardingStatus,
  updateOnboardingStepCompletion,
} from "@/lib/api";
import type { OnboardingStatus, OnboardingStepState } from "@/lib/types";
import { useAppUser } from "@/components/dashboard/AppShell";
import { Card } from "@/components/ui/Card";
import { motion } from "framer-motion";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const STEP_LABELS: Record<number, string> = {
  1: "Organization profile",
  2: "Payroll PIN",
  3: "Employees",
  4: "Teams",
  5: "Projects",
};

export function OnboardingCompletionPanel() {
  const user = useAppUser();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [saving, setSaving] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (user.role !== "admin") return;
    try {
      const next = await fetchOnboardingStatus();
      setStatus(next);
    } catch {
      setStatus(null);
    }
  }, [user.role]);

  useEffect(() => {
    if (user.role !== "admin") return;
    void load();
  }, [load, user.role]);

  if (user.role !== "admin") return null;
  if (!status?.onboarding_completed) return null;

  const steps = status.step_states ?? [];
  const incomplete = steps.filter((s) => !s.completed);

  if (incomplete.length === 0) return null;

  async function toggleStep(stepState: OnboardingStepState, completed: boolean) {
    setSaving(stepState.step);
    try {
      const response = await updateOnboardingStepCompletion(stepState.step, completed);
      setStatus(response.status);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-heading text-lg">Onboarding completion</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Manage skipped setup steps. Progress is {status.completion_percent}% across all steps.
          </p>
        </div>
        <div className="text-right">
          <p className="text-numeric text-2xl font-bold text-[var(--foreground)]">
            {status.completion_percent}%
          </p>
          <p className="text-xs text-[var(--muted)]">Overall progress</p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {steps.map((stepState) => (
          <div
            key={stepState.step}
            className="rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {stepState.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-[var(--accent-emerald)]" />
                ) : (
                  <CircleDashed className="h-4 w-4 text-[var(--muted)]" />
                )}
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {STEP_LABELS[stepState.step] ?? stepState.title}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {stepState.required ? "Required" : "Optional"}
                    {stepState.skipped ? " · Skipped" : ""}
                  </p>
                </div>
              </div>
              <span
                className={`text-xs font-medium ${
                  stepState.completed
                    ? "text-[var(--accent-emerald)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {stepState.completed ? "Complete" : "Pending"}
              </span>
            </div>

            {!stepState.required ? (
              <div className="space-y-2">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={1}
                  value={stepState.completed ? 1 : 0}
                  disabled={saving === stepState.step}
                  onChange={(e) =>
                    void toggleStep(stepState, e.target.value === "1")
                  }
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--border)] accent-[var(--accent-emerald)]"
                  aria-label={`Mark ${stepState.title} complete`}
                />
                <div className="flex justify-between text-[11px] text-[var(--muted)]">
                  <span>Skipped</span>
                  <span>Complete</span>
                </div>
              </div>
            ) : (
              <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
                <motion.div
                  className="h-full rounded-full bg-[var(--accent-emerald)]"
                  initial={{ width: 0 }}
                  animate={{ width: stepState.completed ? "100%" : "0%" }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
