"use client";

import { cn } from "@/lib/cn";
import type { PlatformOrganization } from "@/lib/types";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

type StatusFilter = "all" | PlatformOrganization["status"];

const STATUS_LABELS: Record<PlatformOrganization["status"], string> = {
  active: "Active",
  trial: "Trial",
  suspended: "Suspended",
};

const STATUS_BADGE: Record<PlatformOrganization["status"], string> = {
  active: "bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]",
  trial: "bg-[var(--primary-muted)] text-[var(--primary)]",
  suspended: "bg-[var(--accent-coral-soft)] text-[var(--accent-coral)]",
};

const rowButton =
  "inline-flex min-h-9 items-center rounded-lg border px-3 text-[13px] font-medium transition disabled:opacity-50";

export type OrganizationActions = {
  onEditEmail: (organization: PlatformOrganization) => void;
  onResendInvitation: (organization: PlatformOrganization) => void;
  onSuspend: (organization: PlatformOrganization) => void;
  onReactivate: (organization: PlatformOrganization) => void;
  onDelete: (organization: PlatformOrganization) => void;
};

export function OrganizationsTable({
  organizations,
  busyId,
  actions,
}: {
  organizations: PlatformOrganization[];
  busyId: number | null;
  actions: OrganizationActions;
}) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = { all: organizations.length, active: 0, trial: 0, suspended: 0 };
    for (const org of organizations) result[org.status] += 1;
    return result;
  }, [organizations]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return organizations.filter((org) => {
      if (filter !== "all" && org.status !== filter) return false;
      if (!needle) return true;
      return [org.name, org.slug, org.admin_name, org.admin_email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [organizations, filter, query]);

  const tabs: StatusFilter[] = ["all", "active", ...(counts.trial ? (["trial"] as const) : []), "suspended"];

  return (
    <section
      aria-labelledby="organizations-heading"
      className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <h2 id="organizations-heading" className="text-base font-semibold">
          Registered organizations
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-1 rounded-xl bg-[var(--accent-sand)] p-1">
            {tabs.map((tab) => {
              const selected = filter === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilter(tab)}
                  className={cn(
                    "min-h-9 rounded-lg px-3 text-[13px] transition",
                    selected
                      ? "bg-[var(--card-elevated)] font-medium text-[var(--foreground)] shadow-[var(--shadow-sm)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]",
                  )}
                >
                  {tab === "all" ? "All" : STATUS_LABELS[tab]}{" "}
                  <span className="num text-[var(--muted)]">{counts[tab]}</span>
                </button>
              );
            })}
          </div>
          <label className="flex min-h-11 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-3">
            <Search className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
            <span className="sr-only">Search organizations</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or admin email"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
            />
          </label>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-y border-[var(--border)] bg-[var(--accent-sand)]/60 text-xs uppercase tracking-[0.04em] text-[var(--muted)]">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">Organization</th>
              <th scope="col" className="px-5 py-3 font-medium">Admin</th>
              <th scope="col" className="px-5 py-3 font-medium">Status</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Employees</th>
              <th scope="col" className="px-5 py-3 font-medium">Created</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-[var(--muted)]">
                  {organizations.length === 0
                    ? "No organizations yet. Create the first one with “New organization”."
                    : "No organizations match this filter."}
                </td>
              </tr>
            ) : (
              visible.map((org) => (
                <OrganizationRow key={org.id} organization={org} busy={busyId === org.id} actions={actions} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OrganizationRow({
  organization,
  busy,
  actions,
}: {
  organization: PlatformOrganization;
  busy: boolean;
  actions: OrganizationActions;
}) {
  const suspended = organization.status === "suspended";
  const adminPending = organization.admin_status === "invited";

  return (
    <tr className={cn(suspended && "text-[var(--muted)]")}>
      <td className="px-5 py-4">
        <p className="font-medium text-[var(--foreground)]">{organization.name}</p>
        <p className="text-[13px] text-[var(--muted)]">{organization.slug}</p>
      </td>
      <td className="px-5 py-4">
        <p>{organization.admin_name ?? "—"}</p>
        <p className="text-[13px] text-[var(--muted)]">{organization.admin_email ?? "—"}</p>
        {adminPending ? (
          <span className="mt-1 inline-flex rounded-full bg-[var(--primary-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--primary)]">
            Invitation pending
          </span>
        ) : null}
      </td>
      <td className="px-5 py-4">
        <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", STATUS_BADGE[organization.status])}>
          {STATUS_LABELS[organization.status]}
        </span>
      </td>
      <td className="num px-5 py-4 text-right">{organization.employee_count}</td>
      <td className="px-5 py-4 text-[var(--muted)]">
        {organization.created_at
          ? new Date(organization.created_at).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "—"}
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-wrap justify-end gap-1.5">
          <button
            type="button"
            disabled={busy || !organization.admin_email}
            onClick={() => actions.onEditEmail(organization)}
            className={cn(rowButton, "border-[var(--border)] bg-[var(--card-elevated)] hover:bg-[var(--accent-sand)]")}
          >
            Edit email
          </button>
          {adminPending ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => actions.onResendInvitation(organization)}
              className={cn(rowButton, "border-[var(--border)] bg-[var(--card-elevated)] text-[var(--primary)] hover:bg-[var(--primary-muted)]")}
            >
              Resend invite
            </button>
          ) : null}
          {suspended ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => actions.onReactivate(organization)}
                className={cn(rowButton, "border-transparent bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)] hover:brightness-95")}
              >
                Reactivate
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => actions.onDelete(organization)}
                className={cn(rowButton, "border-transparent bg-[var(--danger)] text-[var(--primary-foreground)] hover:brightness-110")}
              >
                Delete
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => actions.onSuspend(organization)}
              className={cn(rowButton, "border-[var(--accent-coral)]/40 bg-[var(--card-elevated)] text-[var(--accent-coral)] hover:bg-[var(--accent-coral-soft)]")}
            >
              Suspend
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
