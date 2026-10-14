"use client";

import { Segmented } from "@/components/ledger/Segmented";
import { ProjectAssignPanel } from "@/components/projects/ProjectAssignPanel";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectReportPanel } from "@/components/projects/ProjectReportPanel";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { PROJECTS_EXPORT_COLUMNS } from "@/lib/export-columns";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Alert, EmptyState } from "@/components/ui/EmptyState";
import { FormField, Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  ApiError,
  createProject,
  fetchProjects,
  formatApiErrors,
  updateProject,
  updateProjectStatus,
} from "@/lib/api";
import {
  canArchiveProjects,
  canManageProjects,
  canSetProjectHourlyRate,
  canViewReports,
  isAdmin,
} from "@/lib/navigation";
import type { Project, ProjectStatus, User } from "@/lib/types";
import { FolderKanban, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_FILTER_LABELS: Record<"all" | ProjectStatus, string> = {
  all: "All",
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

const textareaClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

function ProjectFormFields({
  initial,
  showHourlyRate,
  showArchiveStatus,
  onSubmit,
  onCancel,
  loading,
  submitLabel,
}: {
  initial?: Partial<Project>;
  showHourlyRate: boolean;
  showArchiveStatus: boolean;
  onSubmit: (data: {
    name: string;
    client_name: string;
    description: string;
    hourly_rate: string;
    status: ProjectStatus;
  }) => void;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [clientName, setClientName] = useState(initial?.client_name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [hourlyRate, setHourlyRate] = useState(initial?.hourly_rate ?? "");
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? "active");

  const statusOptions: ProjectStatus[] = showArchiveStatus
    ? ["active", "inactive", "archived"]
    : ["active", "inactive"];

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, client_name: clientName, description, hourly_rate: hourlyRate, status });
      }}
    >
      <FormField label="Project name" htmlFor="project-name" required>
        <Input
          id="project-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Website redesign"
        />
      </FormField>
      <FormField label="Client name" htmlFor="project-client" required>
        <Input
          id="project-client"
          required
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Acme Corp"
        />
      </FormField>
      <FormField label="Description" htmlFor="project-description">
        <textarea
          id="project-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={textareaClass}
          placeholder="Scope, deliverables, or notes"
        />
      </FormField>
      <div className={`grid gap-4 ${showHourlyRate ? "sm:grid-cols-2" : ""}`}>
        {showHourlyRate ? (
          <FormField
            label="Hourly rate"
            htmlFor="project-rate"
            hint="Admin only — used for payroll calculations"
          >
            <Input
              id="project-rate"
              type="number"
              min="0"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className="num"
              placeholder="125.00"
            />
          </FormField>
        ) : null}
        <FormField label="Status" htmlFor="project-status">
          <Select
            id="project-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
          >
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" size="lg" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={loading}>
          {loading ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function ProjectsManager({ user }: { user: User }) {
  const canManage = canManageProjects(user.role);
  const showHourlyRate = canSetProjectHourlyRate(user.role);
  const showArchive = canArchiveProjects(user.role);
  const showReports = canViewReports(user.role);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [assigning, setAssigning] = useState<Project | null>(null);
  const [reporting, setReporting] = useState<Project | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");

  const load = useCallback(async () => {
    setError("");
    try {
      const list = await fetchProjects(isAdmin(user.role) && includeArchived);
      setProjects(list);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load projects.",
      );
    } finally {
      setLoading(false);
    }
  }, [user.role, includeArchived]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = projects.filter((p) =>
    statusFilter === "all" ? true : p.status === statusFilter,
  );

  const exportRows = useMemo(
    () =>
      filtered.map((project) => ({
        project_name: project.name,
        client: project.client_name,
        status: project.status,
        assigned_team: "—",
        members_count: project.members_count ?? 0,
        created_date: project.created_at
          ? new Date(project.created_at).toLocaleDateString()
          : "—",
      })),
    [filtered],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<"all" | ProjectStatus, number> = {
      all: projects.length,
      active: 0,
      inactive: 0,
      archived: 0,
    };
    for (const p of projects) counts[p.status] += 1;
    return counts;
  }, [projects]);

  const statusFilters: ("all" | ProjectStatus)[] = showArchive
    ? ["all", "active", "inactive", "archived"]
    : ["all", "active", "inactive"];

  async function handleSave(
    data: {
      name: string;
      client_name: string;
      description: string;
      hourly_rate: string;
      status: ProjectStatus;
    },
    project?: Project | null,
  ) {
    setSaving(true);
    setError("");

    const payload: {
      name: string;
      client_name: string;
      description: string | null;
      hourly_rate?: number | null;
    } = {
      name: data.name,
      client_name: data.client_name,
      description: data.description || null,
    };

    if (showHourlyRate) {
      payload.hourly_rate = data.hourly_rate ? Number(data.hourly_rate) : null;
    }

    try {
      if (project) {
        await updateProject(project.id, payload);
        if (project.status !== data.status) {
          await updateProjectStatus(project.id, data.status);
        }
        setEditing(null);
      } else {
        const created = await createProject(payload);
        if (data.status !== "active") {
          await updateProjectStatus(created.id, data.status);
        }
        setShowCreate(false);
      }
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Save failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(project: Project) {
    const next: ProjectStatus =
      project.status === "active" ? "inactive" : "active";
    setError("");
    try {
      await updateProjectStatus(project.id, next);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status update failed.");
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading projects">
        <div className="h-16 w-56 animate-pulse rounded-xl bg-[var(--accent-sand)]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-[var(--accent-sand)]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Work"
        title={canManage ? "Projects" : "My Projects"}
        description={
          canManage
            ? showHourlyRate
              ? "Full project control including billing rates"
              : "Manage project execution — rates are admin-only"
            : "Assigned projects — read-only view"
        }
        actions={
          <>
            <ExportDropdown
              filename="projects"
              columns={PROJECTS_EXPORT_COLUMNS}
              rows={exportRows}
            />
            {canManage ? (
              <Button size="lg" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New project
              </Button>
            ) : null}
          </>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Filter projects by status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusFilters.map((filter) => ({
            value: filter,
            label: STATUS_FILTER_LABELS[filter],
            count: statusCounts[filter],
          }))}
        />
        {showArchive ? (
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-3.5 text-[0.8125rem] text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="h-4 w-4 rounded accent-[var(--primary)]"
            />
            Include archived in fetch
          </label>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description={
            canManage
              ? "Create a project to start organizing client work."
              : "Ask your manager to assign you to a project."
          }
          className="bg-[var(--card)]"
        />
      ) : (
        <section
          aria-label="Project list"
          className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]"
        >
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              canManage={canManage}
              showHourlyRate={showHourlyRate}
              showReports={showReports}
              onToggleActive={() => toggleActive(project)}
              onReport={() => setReporting(project)}
              onAssign={() => setAssigning(project)}
              onEdit={() => setEditing(project)}
            />
          ))}
        </section>
      )}

      {showCreate ? (
        <Modal title="Create project" onClose={() => setShowCreate(false)}>
          <ProjectFormFields
            showHourlyRate={showHourlyRate}
            showArchiveStatus={showArchive}
            onSubmit={(data) => handleSave(data)}
            onCancel={() => setShowCreate(false)}
            loading={saving}
            submitLabel="Create project"
          />
        </Modal>
      ) : null}

      {assigning ? (
        <ProjectAssignPanel project={assigning} user={user} onClose={() => setAssigning(null)} />
      ) : null}

      {reporting ? (
        <ProjectReportPanel project={reporting} onClose={() => setReporting(null)} />
      ) : null}

      {editing ? (
        <Modal title="Edit project" onClose={() => setEditing(null)}>
          <ProjectFormFields
            initial={editing}
            showHourlyRate={showHourlyRate}
            showArchiveStatus={showArchive}
            onSubmit={(data) => handleSave(data, editing)}
            onCancel={() => setEditing(null)}
            loading={saving}
            submitLabel="Save changes"
          />
        </Modal>
      ) : null}
    </div>
  );
}
