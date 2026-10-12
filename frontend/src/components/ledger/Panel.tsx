import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/** Ledger section card with a heading row. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  flush = false,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Let content (tables, lists) run edge to edge. */
  flush?: boolean;
}) {
  const id = `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <section
      aria-labelledby={id}
      className={cn("overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div>
          <h2 id={id} className="text-base font-semibold text-[var(--foreground)]">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-[13px] text-[var(--muted)]">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className={flush ? undefined : "px-5 pb-5"}>{children}</div>
    </section>
  );
}
