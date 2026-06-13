import { cn } from "@/lib/cn";
import { formatPKR } from "@/lib/currency";
import type { ReactNode } from "react";

type MoneyAmountProps = {
  amount: number | string | null | undefined;
  className?: string;
  variant?: "default" | "positive" | "negative" | "muted";
  size?: "sm" | "md" | "lg" | "xl";
  showSign?: boolean;
  children?: ReactNode;
};

const variantClass = {
  default: "text-[var(--foreground)]",
  positive: "text-[var(--accent-emerald)]",
  negative: "text-[var(--danger)]",
  muted: "text-[var(--muted)]",
};

const sizeClass = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
  xl: "text-2xl sm:text-3xl",
};

export function MoneyAmount({
  amount,
  className,
  variant = "default",
  size = "md",
  showSign = false,
}: MoneyAmountProps) {
  const value = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  const formatted = formatPKR(amount);

  let display = formatted;
  if (showSign && value != null && Number.isFinite(value) && value !== 0) {
    display = value > 0 ? `+ ${formatted}` : formatted;
  }

  return (
    <span
      className={cn(
        "text-numeric font-semibold tabular-nums tracking-tight",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
    >
      {display}
    </span>
  );
}
