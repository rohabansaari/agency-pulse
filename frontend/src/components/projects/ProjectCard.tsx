"use client";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { Project, ProjectStatus } from "@/lib/types";
import { BarChart3, Pencil, Power, UserPlus, Users } from "lucide-react";

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

const STATUS_VARIANT: Record<ProjectStatus, "success" | "default" | "warning"> = {
  active: "success",
  inactive: "default",
  archived: "warning",
};

/** Token-only swatch tones, rotated by project id. */
const SWATCHES = [
  "bg-[var(--primary-muted)] text-[var(--primary)]",
  "bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]",
  "bg-[var(--accent-copper-soft)] text-[var(--accent-copper)]",
  "bg-[var(--accent-sand)] text-[var(--foreground)]",
];

/** Colour-free base so tone classes don't fight (cn() does not merge). */
const actionBase =
  "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-[0.8125rem] font-medium transition disabled:opacity-50";
const neutral = "border-[var(--border)] bg-[var(--card-elevated)] text-[var(--foreground)] hover:bg-[var(--accent-sand)]";

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className="shrink-0">
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function trackedLabel(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function dateLabel(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function ProjectCard({
  project,
  canManage,
  showHourlyRate,
  showReports,
  onToggleActive,
  onReport,
  onAssign,
  onEdit,
}: {
  project: Project;
  canManage: boolean;
  showHourlyRate: boolean;
  showReports: boolean;
  onToggleActive: () => void;
  onReport: () => void;
  onAssign: () => void;
  onEdit: () => void;
}) {
  const members = project.members_count ?? 0;
  const dimmed = project.status !== "active";

  return (
    <article
      aria-labelledby={`project-${project.id}-name`}
      className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
              SWATCHES[project.id % SWATCHES.length],
              dimmed && "opacity-70",
            )}
          >
            {project.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <h2
              id={`project-${project.id}-name`}
              className="truncate text-base font-semibold text-[var(--foreground)]"
            >
              {project.name}
            </h2>
            <p className="truncate text-[0.8125rem] text-[var(--muted)]">{project.client_name}</p>
          </div>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>

      {project.description ? (
        <p className="line-clamp-2 text-sm text-[var(--muted)]">{project.description}</p>
      ) : null}

      {showHourlyRate || project.total_tracked_seconds !== undefined ? (
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-[var(--accent-sand)]/60 px-4 py-3 text-[0.8125rem]">
          {showHourlyRate ? (
            <div>
              <dt className="text-[var(--muted)]">Hourly rate</dt>
              <dd className="num mt-0.5 text-sm font-semibold text-[var(--foreground)]">
                {project.hourly_rate ? `$${project.hourly_rate}` : "—"}
              </dd>
            </div>
          ) : null}
          {project.total_tracked_seconds !== undefined ? (
            <div>
              <dt className="text-[var(--muted)]">Tracked</dt>
              <dd className="tnum mt-0.5 text-sm font-semibold text-[var(--foreground)]">
                {trackedLabel(project.total_tracked_seconds)}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3.5 text-[0.8125rem] text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span className="tnum">{members}</span> {members === 1 ? "member" : "members"}
        </span>
        {project.created_at ? <span>Since {dateLabel(project.created_at)}</span> : null}
      </div>

      {canManage ? (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={onEdit} className={cn(actionBase, neutral)} aria-label={`Edit ${project.name}`}>
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            onClick={onAssign}
            className={cn(actionBase, "border-[var(--border)] bg-[var(--card-elevated)] text-[var(--primary)] hover:bg-[var(--primary-muted)]")}
            aria-label={`Assign employees to ${project.name}`}
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Assign
          </button>
          {showReports ? (
            <button
              type="button"
              onClick={onReport}
              className={cn(actionBase, neutral)}
              aria-label={`View report for ${project.name}`}
            >
              <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
              Report
            </button>
          ) : null}
          {project.status !== "archived" ? (
            <button
              type="button"
              onClick={onToggleActive}
              className={cn(
                actionBase,
                project.status === "active"
                  ? "border-[var(--accent-coral)]/40 bg-[var(--card-elevated)] text-[var(--accent-coral)] hover:bg-[var(--accent-coral-soft)]"
                  : "border-transparent bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)] hover:brightness-95",
              )}
              aria-label={`${project.status === "active" ? "Deactivate" : "Activate"} ${project.name}`}
            >
              <Power className="h-3.5 w-3.5" aria-hidden="true" />
              {project.status === "active" ? "Deactivate" : "Activate"}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
