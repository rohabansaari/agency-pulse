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
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="space-y-2">
        {eyebrow ? <p className="text-label">{eyebrow}</p> : null}
        <h1 className="text-display text-3xl text-[var(--foreground)] sm:text-[2rem]">{title}</h1>
        {description ? <p className="text-body-muted max-w-2xl">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
