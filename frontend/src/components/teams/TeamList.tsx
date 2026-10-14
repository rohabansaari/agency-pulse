"use client";

import { cn } from "@/lib/cn";
import type { WorkTeam } from "@/lib/types";

/** Ledger team selector: a vertical list of team cards; the selected one gets a plum outline. */
export function TeamList({
  teams,
  selectedId,
  onSelect,
  managerNameOf,
  label = "Teams",
}: {
  teams: WorkTeam[];
  selectedId: number | null;
  onSelect: (teamId: number) => void;
  managerNameOf: (team: WorkTeam) => string;
  label?: string;
}) {
  return (
    <ul aria-label={label} className="flex flex-col gap-2.5">
      {teams.map((team) => {
        const selected = team.id === selectedId;
        const count = team.members?.length ?? team.members_count ?? 0;
        return (
          <li key={team.id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(team.id)}
              className={cn(
                "flex min-h-11 w-full flex-col gap-1.5 rounded-2xl border bg-[var(--card)] px-[1.125rem] py-4 text-left transition",
                selected
                  ? "border-[var(--primary)] ring-1 ring-[var(--primary)]"
                  : "border-[var(--border)] hover:bg-[var(--accent-sand)]/40",
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="truncate text-[0.9375rem] font-semibold text-[var(--foreground)]">{team.name}</span>
                <span className="tnum shrink-0 text-[0.8125rem] text-[var(--muted)]">
                  {count} {count === 1 ? "person" : "people"}
                </span>
              </span>
              <span className="truncate text-[0.8125rem] text-[var(--muted)]">Manager: {managerNameOf(team)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Small sand stat tile used inside a team's detail card. */
export function TeamStat({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-xl bg-[var(--accent-sand)] p-3.5">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className={cn("mt-1.5 text-[1.375rem] font-semibold text-[var(--foreground)]", mono ? "num" : "tnum")}>{value}</p>
    </div>
  );
}
