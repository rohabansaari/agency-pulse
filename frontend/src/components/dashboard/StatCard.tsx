"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

const accentStyles = {
  default: "border-[var(--border)] bg-[var(--card)]",
  blue: "border-blue-200/80 bg-gradient-to-br from-blue-50/80 to-white dark:border-blue-900/40 dark:from-blue-950/30 dark:to-zinc-900",
  green: "border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-white dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-zinc-900",
  amber: "border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-white dark:border-amber-900/40 dark:from-amber-950/30 dark:to-zinc-900",
  violet: "border-violet-200/80 bg-gradient-to-br from-violet-50/80 to-white dark:border-violet-900/40 dark:from-violet-950/30 dark:to-zinc-900",
};

export function StatCard({
  label,
  value,
  sub,
  accent = "default",
  icon: Icon,
  index = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: keyof typeof accentStyles;
  icon?: LucideIcon;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: "easeOut" }}
      className={`rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5 ${accentStyles[accent]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          {label}
        </p>
        {Icon ? (
          <Icon className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" strokeWidth={1.75} />
        ) : null}
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums sm:text-[1.75rem] dark:text-zinc-50">
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p> : null}
    </motion.div>
  );
}
