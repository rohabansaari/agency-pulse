import { cn } from "@/lib/cn";

const variants = {
  default: "bg-[var(--accent-sand)] text-[var(--muted)]",
  primary: "bg-[var(--primary-muted)] text-[var(--primary)]",
  success: "bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]",
  warning: "bg-[var(--accent-copper-soft)] text-[var(--accent-copper)]",
  danger: "bg-[var(--accent-coral-soft)] text-[var(--accent-coral)]",
  violet: "bg-[var(--primary-muted)] text-[var(--primary)]",
  outline: "border border-[var(--border)] bg-transparent text-[var(--muted)]",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
