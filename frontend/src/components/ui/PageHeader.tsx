"use client";

import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  className,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  eyebrow?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-[0.8125rem] text-[var(--muted)]">{eyebrow}</p> : null}
        <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--foreground)]">
          {title}
        </h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-[var(--muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
