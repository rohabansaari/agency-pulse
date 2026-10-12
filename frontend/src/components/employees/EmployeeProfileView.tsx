"use client";

import { RoleManagementPanel } from "@/components/employees/RoleManagementPanel";
import { EmployeePayrollAdjustmentsPanel } from "@/components/employees/EmployeePayrollAdjustmentsPanel";
import { LedgerRoleBadge, MemberStatusBadge, TimerBadge } from "@/components/employees/employee-ui";
import { Avatar } from "@/components/ledger/Avatar";
import { Metric } from "@/components/ledger/Metric";
import { Panel } from "@/components/ledger/Panel";
import { ledgerTable } from "@/components/ledger/table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/EmptyState";
import { Input, FormField } from "@/components/ui/Input";
import { ApiError, fetchEmployeeProfile, formatApiErrors, updateTeamMember } from "@/lib/api";
import { canEditEmployeeStatus, isOperationalAdmin, isPrivilegedMember } from "@/lib/navigation";
import { formatDuration } from "@/lib/time";
import type { EmployeeProfile, User } from "@/lib/types";
import { cn } from "@/lib/cn";
import { ArrowLeft, CalendarCheck, Clock, FolderKanban, Hourglass } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatDay(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function statusVariant(status: string): "success" | "warning" | "danger" | "primary" | "default" {
  switch (status.toLowerCase()) {
    case "approved":
    case "active":
    case "completed":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
    case "cancelled":
    case "canceled":
      return "danger";
    default:
      return "default";
  }
}

function StatusPill({ status }: { status: string }) {
  return (
    <Badge variant={statusVariant(status)} className="whitespace-nowrap px-2.5 py-1">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export function EmployeeProfileView({ userId, viewer }: { userId: number; viewer: User }) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const canEdit = canEditEmployeeStatus(viewer.role);
  const protectedMember = profile ? isPrivilegedMember(profile.role) : false;
  const canEditThis = canEdit && (viewer.role === "admin" || !protectedMember);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await fetchEmployeeProfile(userId);
      setProfile(data);
      setEditName(data.name);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load employee profile.",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSaveName() {
    if (!profile || !canEditThis) return;
    setSavingName(true);
    setError("");
    try {
      await updateTeamMember(profile.membership_id, { name: editName });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update name.");
    } finally {
      setSavingName(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6" role="status" aria-label="Loading employee profile">
        <div className="h-5 w-48 animate-pulse rounded-lg bg-[var(--accent-sand)]" />
        <div className="h-36 animate-pulse rounded-2xl bg-[var(--accent-sand)]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-28 animate-pulse rounded-2xl bg-[var(--accent-sand)]" />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return <Alert variant="error">{error || "Employee not found."}</Alert>;
  }

  const pendingOvertime = profile.overtime_history.filter((entry) => entry.status === "pending").length;
  const activeProjects = profile.assigned_projects.filter((p) => p.status === "active").length;
  const th = ledgerTable.th;
  const td = ledgerTable.td;

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--muted)]">
        <Link
          href="/employees"
          className="inline-flex min-h-9 items-center gap-1 rounded-lg font-medium text-[var(--primary)] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Employees
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="truncate text-[var(--foreground)]">{profile.name}</span>
      </nav>

      <header className="flex flex-wrap items-start gap-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
        <Avatar name={profile.name} size="lg" />
        <div className="min-w-0 flex-[1_1_260px]">
          <p className="text-[13px] text-[var(--muted)]">Employee profile</p>
          <h1 className="mt-0.5 break-words text-[28px] font-semibold leading-tight tracking-[-0.02em] text-[var(--foreground)]">
            {profile.name}
          </h1>
          <p className="mt-1 break-words text-sm text-[var(--muted)]">
            {profile.email}
            {profile.joined_at ? ` · Joined ${formatDay(profile.joined_at)}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <MemberStatusBadge status={profile.status} />
            <LedgerRoleBadge role={profile.role} />
            <TimerBadge running={profile.has_active_timer} />
            <Badge variant="outline" className="whitespace-nowrap px-2.5 py-1 normal-case">
              {profile.team ? `Team: ${profile.team.name}` : "No team"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/employees"
            className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-4 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--accent-sand)]"
          >
            Back to directory
          </Link>
        </div>
      </header>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <section aria-label="This month" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Hours this month"
          icon={<Clock className="h-4 w-4" />}
          value={<span className="num">{formatDuration(profile.time_summary.month_seconds)}</span>}
          detail={`Last activity ${formatDate(profile.last_activity_at)}`}
        />
        <Metric
          label="Approved paid leave"
          icon={<CalendarCheck className="h-4 w-4" />}
          value={<span className="num">{formatDuration(profile.time_summary.approved_leave_seconds)}</span>}
          detail={`${profile.leave_history.length} leave ${profile.leave_history.length === 1 ? "request" : "requests"}`}
        />
        <Metric
          label="Assigned projects"
          icon={<FolderKanban className="h-4 w-4" />}
          value={profile.assigned_projects.length}
          detail={`${activeProjects} active`}
        />
        <Metric
          label="Overtime requests"
          icon={<Hourglass className="h-4 w-4" />}
          value={profile.overtime_history.length}
          tone={pendingOvertime > 0 ? "attention" : "default"}
          detail={pendingOvertime > 0 ? `${pendingOvertime} pending` : "None pending"}
        />
      </section>

      {profile.role === "manager" && profile.manager_metrics ? (
        <Panel title="Manager metrics" description="Aggregated across all teams managed by this user.">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--border-subtle)] lg:grid-cols-4">
            <ManagerStat label="Teams managed" value={profile.manager_metrics.teams_managed} />
            <ManagerStat label="Projects managed" value={profile.manager_metrics.projects_managed} />
            <ManagerStat label="Active employees" value={profile.manager_metrics.active_employees} />
            <ManagerStat
              label="Team hours (month)"
              value={formatDuration(profile.manager_metrics.total_team_hours_month_seconds)}
              mono
            />
          </dl>
          {profile.manager_metrics.managed_teams.length > 0 ? (
            <ul className="mt-4 divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] text-sm">
              {profile.manager_metrics.managed_teams.map((team) => (
                <li key={team.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span className="font-medium text-[var(--foreground)]">{team.name}</span>
                  <span className="tnum text-[13px] text-[var(--muted)]">
                    {team.members_count} members · {team.active_projects} projects
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      ) : null}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <EmployeePayrollAdjustmentsPanel
            userId={profile.user_id}
            canManage={isOperationalAdmin(viewer.role)}
          />

          <Panel title={`Assigned projects (${profile.assigned_projects.length})`} flush>
            {profile.assigned_projects.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-[var(--muted)]">Not assigned to any projects.</p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border)]">
                {profile.assigned_projects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                    <span className="min-w-0 truncate font-medium text-[var(--foreground)]">{p.name}</span>
                    <StatusPill status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Leave history" flush>
            {profile.leave_history.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-[var(--muted)]">No leave recorded.</p>
            ) : (
              <div className={ledgerTable.wrap}>
                <table className={cn(ledgerTable.table, "min-w-[480px]")}>
                  <thead className={ledgerTable.thead}>
                    <tr>
                      <th scope="col" className={th}>Start date</th>
                      <th scope="col" className={cn(th, "text-right")}>Duration</th>
                      <th scope="col" className={th}>Pay</th>
                      <th scope="col" className={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody className={ledgerTable.tbody}>
                    {profile.leave_history.map((entry) => (
                      <tr key={entry.id}>
                        <td className={cn(td, "tnum whitespace-nowrap")}>{entry.start_date}</td>
                        <td className={cn(td, "num text-right text-[13px]")}>{formatDuration(entry.duration_seconds)}</td>
                        <td className={cn(td, "text-[var(--muted)]")}>{entry.is_paid ? "Paid" : "Unpaid"}</td>
                        <td className={td}><StatusPill status={entry.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Overtime history" flush>
            {profile.overtime_history.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-[var(--muted)]">No overtime recorded.</p>
            ) : (
              <div className={ledgerTable.wrap}>
                <table className={cn(ledgerTable.table, "min-w-[400px]")}>
                  <thead className={ledgerTable.thead}>
                    <tr>
                      <th scope="col" className={th}>Work date</th>
                      <th scope="col" className={cn(th, "text-right")}>Duration</th>
                      <th scope="col" className={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody className={ledgerTable.tbody}>
                    {profile.overtime_history.map((entry) => (
                      <tr key={entry.id}>
                        <td className={cn(td, "tnum whitespace-nowrap")}>{entry.work_date}</td>
                        <td className={cn(td, "num text-right text-[13px]")}>{formatDuration(entry.duration_seconds)}</td>
                        <td className={td}><StatusPill status={entry.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
          <Panel title="Basic information">
            {canEditThis ? (
              <form
                className="mb-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSaveName();
                }}
              >
                <FormField label="Full name" htmlFor="profile-full-name">
                  <div className="flex gap-2">
                    <Input
                      id="profile-full-name"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="min-w-0 flex-1"
                    />
                    <Button type="submit" size="lg" disabled={savingName || editName === profile.name}>
                      Save
                    </Button>
                  </div>
                </FormField>
              </form>
            ) : null}
            <dl className="divide-y divide-[var(--border-subtle)] text-sm">
              <InfoRow label="Role"><LedgerRoleBadge role={profile.role} /></InfoRow>
              <InfoRow label="Status"><MemberStatusBadge status={profile.status} /></InfoRow>
              <InfoRow label="Join date">{formatDate(profile.joined_at)}</InfoRow>
              <InfoRow label="Last activity">{formatDate(profile.last_activity_at)}</InfoRow>
              <InfoRow label="Timer"><TimerBadge running={profile.has_active_timer} /></InfoRow>
            </dl>
          </Panel>

          <Panel title="Team">
            {profile.team ? (
              <dl className="divide-y divide-[var(--border-subtle)] text-sm">
                <InfoRow label="Team">{profile.team.name}</InfoRow>
                <InfoRow label="Manager">{profile.team.manager?.name ?? "—"}</InfoRow>
              </dl>
            ) : (
              <p className="text-sm text-[var(--muted)]">Not assigned to a team.</p>
            )}
          </Panel>

          <RoleManagementPanel
            viewer={viewer}
            membershipId={profile.membership_id}
            userId={profile.user_id}
            currentRole={profile.role}
            memberName={profile.name}
            onUpdated={load}
          />
        </aside>
      </div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="text-right text-[var(--foreground)]">{children}</dd>
    </div>
  );
}

function ManagerStat({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="bg-[var(--card)] px-4 py-3">
      <dt className="text-[13px] text-[var(--muted)]">{label}</dt>
      <dd className={cn("mt-1 text-xl font-semibold text-[var(--foreground)]", mono ? "num" : "tnum")}>{value}</dd>
    </div>
  );
}
