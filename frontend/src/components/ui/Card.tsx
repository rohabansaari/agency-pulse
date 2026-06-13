"use client";

import { cn } from "@/lib/cn";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function Card({
  children,
  className,
  animate = true,
  elevated = false,
}: {
  children: ReactNode;
  className?: string;
  animate?: boolean;
  elevated?: boolean;
}) {
  const Wrapper = animate ? motion.section : "section";
  const motionProps = animate
    ? {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
      }
    : {};

  return (
    <Wrapper
      {...motionProps}
      className={cn(
        elevated ? "ui-card-elevated" : "ui-card",
        "p-5",
        className,
      )}
    >
      {children}
    </Wrapper>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-heading text-lg text-[var(--foreground)]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
