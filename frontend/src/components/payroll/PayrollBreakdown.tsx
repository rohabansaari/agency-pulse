import type { PayrollAdjustmentLine } from "@/lib/types";
import { MoneyAmount } from "@/components/ui/MoneyAmount";
import { cn } from "@/lib/cn";

type PayrollBreakdownProps = {
  gross: string | number | null;
  net: string | number | null;
  lines?: PayrollAdjustmentLine[] | null;
  masked?: boolean;
  className?: string;
};

export function PayrollBreakdown({ gross, net, lines, masked, className }: PayrollBreakdownProps) {
  if (masked) {
    return (
      <div className={cn("rounded-xl border border-[var(--border)] bg-[var(--card)] p-4", className)}>
        <p className="text-sm text-[var(--muted)]">Unlock payroll vault to view breakdown.</p>
      </div>
    );
  }

  const increments = (lines ?? []).filter((l) => l.type === "increment");
  const deductions = (lines ?? []).filter((l) => l.type === "deduction");

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] p-5 shadow-sm",
        className,
      )}
    >
      <p className="text-label mb-4">Salary breakdown</p>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4 py-1">
          <span className="text-sm font-medium text-[var(--foreground)]">Base salary</span>
          <MoneyAmount amount={gross} size="md" />
        </div>

        {increments.length > 0 ? (
          <div className="space-y-1 border-t border-[var(--border-subtle)] pt-3">
            {increments.map((line) => (
              <div key={`inc-${line.name}-${line.amount}`} className="flex justify-between gap-4 text-sm">
                <span className="text-[var(--accent-emerald)]">+ {line.name}</span>
                <MoneyAmount amount={line.amount} variant="positive" size="sm" />
              </div>
            ))}
          </div>
        ) : null}

        {deductions.length > 0 ? (
          <div className="space-y-1 border-t border-[var(--border-subtle)] pt-3">
            {deductions.map((line) => (
              <div key={`ded-${line.name}-${line.amount}`} className="flex justify-between gap-4 text-sm">
                <span className="text-[var(--danger)]">− {line.name}</span>
                <MoneyAmount amount={line.amount} variant="negative" size="sm" />
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4 border-t border-[var(--border)] pt-4 mt-2">
          <span className="text-heading text-sm text-[var(--foreground)]">Net salary</span>
          <MoneyAmount amount={net} size="lg" className="!text-[var(--accent-copper)]" />
        </div>
      </div>
    </div>
  );
}
