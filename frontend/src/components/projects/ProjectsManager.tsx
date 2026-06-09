"use client";

import { ProjectAssignPanel } from "@/components/projects/ProjectAssignPanel";
import { ProjectReportPanel } from "@/components/projects/ProjectReportPanel";
import { Modal } from "@/components/ui/Modal";
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
import { useCallback, useEffect, useState } from "react";

const STATUS_STYLES: Record<ProjectStatus, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  inactive: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  archived: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

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
      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Project name
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-600 dark:bg-zinc-950"
          placeholder="Website redesign"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Client name
        </label>
        <input
          required
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-600 dark:bg-zinc-950"
          placeholder="Acme Corp"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-600 dark:bg-zinc-950"
          placeholder="Scope, deliverables, or notes"
        />
      </div>
      <div className={`grid gap-4 ${showHourlyRate ? "sm:grid-cols-2" : ""}`}>
        {showHourlyRate ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Hourly rate
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-600 dark:bg-zinc-950"
              placeholder="125.00"
            />
            <p className="mt-1 text-xs text-zinc-500">Admin only — used for payroll calculations</p>
          </div>
        ) : null}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          >
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Saving..." : submitLabel}
        </button>
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
      <div className="space-y-4">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-zinc-200/60 dark:bg-zinc-800/60" />
        <div className="h-64 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {canManage ? "Projects" : "My Projects"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {canManage
              ? showHourlyRate
                ? "Full project control including billing rates"
                : "Manage project execution — rates are admin-only"
              : "Assigned projects — read-only view"}
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New project
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                statusFilter === filter
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
        {showArchive ? (
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Include archived in fetch
          </label>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white py-16 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No projects found</p>
          <p className="mt-1 text-xs text-zinc-500">
            {canManage
              ? "Create a project to start organizing client work."
              : "Ask your manager to assign you to a project."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/80 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/40">
                <tr>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  {showHourlyRate ? (
                    <th className="px-4 py-3 font-medium">Rate</th>
                  ) : null}
                  <th className="px-4 py-3 font-medium">Status</th>
                  {canManage ? (
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => (
                  <tr
                    key={project.id}
                    className="border-b border-zinc-50 transition hover:bg-zinc-50/80 dark:border-zinc-800/80 dark:hover:bg-zinc-800/30"
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{project.name}</p>
                      {project.description ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                          {project.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400">
                      {project.client_name}
                    </td>
                    {showHourlyRate ? (
                      <td className="px-4 py-3.5 font-mono text-zinc-600 tabular-nums dark:text-zinc-400">
                        {project.hourly_rate ? `$${project.hourly_rate}` : "—"}
                      </td>
                    ) : null}
                    <td className="px-4 py-3.5">
                      <StatusBadge status={project.status} />
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-2">
                          {project.status !== "archived" ? (
                            <button
                              type="button"
                              onClick={() => toggleActive(project)}
                              className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
                            >
                              {project.status === "active" ? "Deactivate" : "Activate"}
                            </button>
                          ) : null}
                          {showReports ? (
                            <button
                              type="button"
                              onClick={() => setReporting(project)}
                              className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:border-zinc-700 dark:hover:bg-emerald-950/30"
                            >
                              Report
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setAssigning(project)}
                            className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-violet-600 hover:bg-violet-50 dark:border-zinc-700 dark:hover:bg-violet-950/30"
                          >
                            Assign
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(project)}
                            className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:border-zinc-700 dark:hover:bg-blue-950/30"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
