import { cn } from "@/lib/cn";

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Initials in a plum-tinted circle. */
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-9 w-9 text-xs", lg: "h-16 w-16 text-xl" };
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--primary-muted)] font-semibold text-[var(--primary)]",
        sizes[size],
        className,
      )}
    >
      {initialsOf(name) || "?"}
    </span>
  );
}
