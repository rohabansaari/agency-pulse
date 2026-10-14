import { cn } from "@/lib/cn";

type Tone = "high" | "medium" | "low";

/** ≥60% reads as healthy, 30–59% as worth a look, below 30% as low. */
export function activityTone(percent: number): Tone {
  if (percent >= 60) return "high";
  if (percent >= 30) return "medium";
  return "low";
}

const TONE: Record<Tone, { text: string; soft: string; bar: string }> = {
  high: { text: "text-[var(--accent-emerald)]", soft: "bg-[var(--accent-emerald-soft)]", bar: "bg-[var(--accent-emerald)]" },
  medium: { text: "text-[var(--accent-copper)]", soft: "bg-[var(--accent-copper-soft)]", bar: "bg-[var(--accent-copper)]" },
  low: { text: "text-[var(--danger)]", soft: "bg-[var(--accent-coral-soft)]", bar: "bg-[var(--accent-coral)]" },
};

const NO_DATA_TITLE = "No activity data (captured before activity tracking, or by an older agent)";

/** Keyboard/mouse activity pill, e.g. "72% active". Renders an em dash without data. */
export function ActivityBadge({ percent, className }: { percent: number | null | undefined; className?: string }) {
  if (percent === null || percent === undefined) {
    return (
      <span className={cn("tnum text-xs text-[var(--muted)]", className)} title={NO_DATA_TITLE}>
        —
      </span>
    );
  }

  const tone = TONE[activityTone(percent)];
  return (
    <span
      className={cn("tnum inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium", tone.soft, tone.text, className)}
      title="Share of this period with keyboard or mouse activity"
    >
      {percent}% active
    </span>
  );
}

/** Thin bar plus percentage, for table columns. */
export function ActivityMeter({ percent }: { percent: number | null | undefined }) {
  if (percent === null || percent === undefined) {
    return (
      <span className="tnum text-[0.8125rem] text-[var(--muted)]" title={NO_DATA_TITLE}>
        —
      </span>
    );
  }

  const tone = TONE[activityTone(percent)];
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 min-w-16 flex-1 rounded-full bg-[var(--border-subtle)]" aria-hidden="true">
        <div className={cn("h-1.5 rounded-full", tone.bar)} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      <span className={cn("tnum w-10 text-right text-[0.8125rem]", tone.text)}>{percent}%</span>
    </div>
  );
}
