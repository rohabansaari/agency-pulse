import { cn } from "@/lib/cn";
import type { PayrollRun, PayrollRunStatus } from "@/lib/types";
import { Check } from "lucide-react";

type StepState = "done" | "now" | "todo";

const ORDER: PayrollRunStatus[] = ["draft", "finalized", "locked"];

function shortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function joinParts(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(" · ");
}

/** Draft → Finalized → Locked progress for a payroll run. */
export function PayrollRunStepper({ run }: { run: PayrollRun }) {
  const current = ORDER.indexOf(run.status);

  const steps: { key: PayrollRunStatus; label: string; sub: string }[] = [
    {
      key: "draft",
      label: "Draft",
      sub: joinParts(
        shortDate(run.created_at) ? `Created ${shortDate(run.created_at)}` : null,
        run.created_by_name,
      ) || "Hours & adjustments editable",
    },
    {
      key: "finalized",
      label: "Finalized",
      sub: run.finalized_at
        ? joinParts(`Finalized ${shortDate(run.finalized_at)}`, run.finalized_by_name)
        : "Amounts frozen",
    },
    {
      key: "locked",
      label: "Locked",
      sub: run.locked_at
        ? joinParts(`Locked ${shortDate(run.locked_at)}`, run.locked_by_name)
        : "Secured audit record",
    },
  ];

  return (
    <ol aria-label="Payroll run progress" className="grid gap-2 sm:grid-cols-3">
      {steps.map((step, index) => {
        const state: StepState =
          index < current || (run.status === "locked" && index === current)
            ? "done"
            : index === current
              ? "now"
              : "todo";

        return (
          <li
            key={step.key}
            aria-current={index === current ? "step" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-2xl bg-[var(--card)] px-4 py-3",
              state === "now"
                ? "border-2 border-[var(--primary)]"
                : "border border-[var(--border)]",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
                state === "done" && "bg-[var(--accent-emerald)] text-[var(--card)]",
                state === "now" && "bg-[var(--primary)] text-[var(--primary-foreground)]",
                state === "todo" && "bg-[var(--accent-sand)] text-[var(--muted)]",
              )}
            >
              {state === "done" ? <Check className="h-4 w-4" /> : index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--foreground)]">
                {step.label}
                <span className="sr-only">
                  {state === "done" ? " (complete)" : state === "now" ? " (current)" : " (upcoming)"}
                </span>
              </span>
              <span className="block truncate text-[13px] text-[var(--muted)]">{step.sub}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
