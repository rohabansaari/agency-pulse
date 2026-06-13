"use client";

import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] shadow-sm active:scale-[0.98]",
  secondary:
    "border border-[var(--border)] bg-[var(--card-elevated)] text-[var(--foreground)] hover:bg-[var(--accent-sand)] active:scale-[0.98]",
  ghost:
    "text-[var(--muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)] active:scale-[0.98]",
  danger:
    "border border-[var(--accent-coral)]/30 bg-[var(--accent-coral-soft)] text-[var(--danger)] hover:bg-[var(--accent-coral)]/20 active:scale-[0.98]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-9 px-4 text-sm gap-2 rounded-xl",
  lg: "h-11 px-5 text-sm gap-2 rounded-xl font-semibold",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
