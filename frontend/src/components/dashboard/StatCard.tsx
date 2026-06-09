export function StatCard({
  label,
  value,
  sub,
  accent = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "default" | "blue" | "green" | "amber";
}) {
  const accentClass = {
    default: "border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900",
    blue: "border-blue-100 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/20",
    green: "border-green-100 bg-green-50/60 dark:border-green-900/50 dark:bg-green-950/20",
    amber: "border-amber-100 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20",
  }[accent];

  return (
    <div
      className={`rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md ${accentClass}`}
    >
      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums sm:text-3xl dark:text-zinc-50">
        {value}
      </p>
      {sub ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>
      ) : null}
    </div>
  );
}
