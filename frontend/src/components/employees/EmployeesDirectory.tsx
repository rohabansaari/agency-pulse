"use client";

import { CreateEmployeeModal } from "@/components/employees/CreateEmployeeModal";
import { EmployeeActionsMenu } from "@/components/employees/EmployeeActionsMenu";
import { EmployeeCsvImport } from "@/components/onboarding/EmployeeCsvImport";
import {
  LedgerRoleBadge,
  MEMBER_STATUS_LABELS,
  MemberStatusBadge,
  TimerBadge,
} from "@/components/employees/employee-ui";
import { Avatar } from "@/components/ledger/Avatar";
import { Panel } from "@/components/ledger/Panel";
import { SearchField } from "@/components/ledger/SearchField";
import { Segmented } from "@/components/ledger/Segmented";
import { ledgerTable } from "@/components/ledger/table";
import { PageTransition } from "@/components/motion/PageTransition";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { Alert, Spinner } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  ApiError,
  fetchPayrollVaultStatus,
  fetchTeam,
  formatApiErrors,
  updateTeamMember,
} from "@/lib/api";
import { EMPLOYEES_EXPORT_COLUMNS } from "@/lib/export-columns";
import { formatDuration } from "@/lib/time";
import {
  canChangeEmployeeRoles,
  canEditEmployeeStatus,
  canEditMemberStatus,
  canManageOrgEmployees,
} from "@/lib/navigation";
import type { MemberStatus, PayrollVaultStatus, TeamMember, User } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_OPTIONS = [
  { value: "active", label: MEMBER_STATUS_LABELS.active },
  { value: "invited", label: MEMBER_STATUS_LABELS.invited },
  { value: "suspended", label: MEMBER_STATUS_LABELS.suspended },
];

const STATUS_FILTERS: (MemberStatus | "all")[] = ["all", "active", "invited", "suspended"];

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function EmployeesDirectory({ user }: { user: User }) {
  const canCreate = canManageOrgEmployees(user.role);
  const canEditStatus = canEditEmployeeStatus(user.role);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [vaultStatus, setVaultStatus] = useState<PayrollVaultStatus | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "all">("all");

  const load = useCallback(async () => {
    setError("");
    try {
      setMembers(await fetchTeam());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load employees.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canCreate) return;
    void fetchPayrollVaultStatus().then(setVaultStatus).catch(() => setVaultStatus(null));
  }, [canCreate]);

  const exportRows = useMemo(
    () =>
      members.map((m) => ({
        name: m.name,
        email: m.email,
        role: m.role.replace("_", " "),
        team: m.team_name ?? "—",
        manager: m.manager_name ?? "—",
        status: m.status,
        join_date: formatDate(m.joined_at),
        last_activity: formatDate(m.last_activity_at),
      })),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.team_name?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [members, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const result: Record<MemberStatus | "all", number> = { all: members.length, active: 0, invited: 0, suspended: 0 };
    for (const m of members) result[m.status] += 1;
    return result;
  }, [members]);

  if (loading) {
    return <Spinner label="Loading employees…" />;
  }

  const th = ledgerTable.th;
  const td = ledgerTable.td;

  return (
    <PageTransition>
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="People"
          title="Employees"
          description="Organization directory — compensation data is managed under Payroll."
          actions={
            <>
              <ExportDropdown filename="employees" columns={EMPLOYEES_EXPORT_COLUMNS} rows={exportRows} />
              {canCreate ? (
                <>
                  <Button
                    variant="secondary"
                    size="lg"
                    aria-expanded={showImport}
                    onClick={() => {
                      setShowImport((v) => !v);
                      setShowCreate(false);
                    }}
                  >
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Import CSV
                  </Button>
                  <Button size="lg" onClick={() => { setShowCreate(true); setShowImport(false); }}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Create employee
                  </Button>
                </>
              ) : null}
            </>
          }
        />

        {feedback ? <Alert variant={feedback.variant}>{feedback.message}</Alert> : null}
        {error ? <Alert variant="error">{error}</Alert> : null}

        {showImport && canCreate ? (
          <Panel title="Import employees from CSV" description="Upload a spreadsheet to invite several people at once.">
            <EmployeeCsvImport
              variant="employees"
              submitting={importing}
              onSubmittingChange={setImporting}
              onImported={() => void load()}
            />
          </Panel>
        ) : null}

        <CreateEmployeeModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={(message) => {
            if (message) {
              setFeedback({ variant: "success", message });
            }
            void load();
          }}
          vaultStatus={vaultStatus}
          canSelectRole={canChangeEmployeeRoles(user.role)}
        />

        <section aria-label="Employee list" className={ledgerTable.card}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <Segmented
              label="Filter by status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_FILTERS.map((value) => ({
                value,
                label: value === "all" ? "All" : MEMBER_STATUS_LABELS[value],
                count: statusCounts[value],
              }))}
            />
            <SearchField
              label="Search employees"
              placeholder="Search by name, email, or team…"
              value={search}
              onChange={setSearch}
              className="min-w-0 flex-[1_1_220px] sm:max-w-sm"
            />
          </div>

          <div className={ledgerTable.wrap}>
            <table className={cn(ledgerTable.table, "min-w-[1080px]")}>
              <thead className={ledgerTable.thead}>
                <tr>
                  <th scope="col" className={th}>Employee</th>
                  <th scope="col" className={th}>Role</th>
                  <th scope="col" className={th}>Team</th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={th}>Timer</th>
                  <th scope="col" className={cn(th, "text-right")}>Month hrs</th>
                  <th scope="col" className={cn(th, "text-right")}>Leave</th>
                  <th scope="col" className={cn(th, "text-right")}>Projects</th>
                  <th scope="col" className={cn(th, "text-right")}>OT reqs</th>
                  <th scope="col" className={th}>Joined</th>
                  <th scope="col" className={cn(th, "text-right")}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className={ledgerTable.tbody}>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-5 py-12 text-center text-[var(--muted)]">
                      {members.length === 0
                        ? "No employees yet. Invite the first one with “Create employee”."
                        : "No employees match this filter."}
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => (
                    <tr
                      key={member.id}
                      className={cn(ledgerTable.rowHover, member.status === "suspended" && "text-[var(--muted)]")}
                    >
                      <td className={td}>
                        <div className="flex items-center gap-3">
                          <Avatar name={member.name} size="sm" />
                          <span className="min-w-0">
                            <Link
                              href={`/employees/${member.user_id}`}
                              className="block truncate font-medium text-[var(--foreground)] hover:text-[var(--primary)] hover:underline"
                            >
                              {member.name}
                            </Link>
                            <span className="block truncate text-[13px] text-[var(--muted)]">{member.email}</span>
                          </span>
                        </div>
                      </td>
                      <td className={td}>
                        <LedgerRoleBadge role={member.role} />
                      </td>
                      <td className={td}>
                        <span className="block text-[var(--foreground)]">{member.team_name ?? "—"}</span>
                        {member.manager_name ? (
                          <span className="block text-[13px] text-[var(--muted)]">Mgr. {member.manager_name}</span>
                        ) : null}
                      </td>
                      <td className={td}>
                        {canEditStatus && canEditMemberStatus(member.role) ? (
                          <Dropdown
                            size="sm"
                            className="w-[132px]"
                            value={member.status}
                            onChange={async (value) => {
                              try {
                                await updateTeamMember(member.id, {
                                  status: value as MemberStatus,
                                });
                                await load();
                              } catch (err) {
                                setError(err instanceof ApiError ? err.message : "Status update failed.");
                              }
                            }}
                            options={STATUS_OPTIONS}
                          />
                        ) : (
                          <MemberStatusBadge status={member.status} />
                        )}
                      </td>
                      <td className={td}>
                        <TimerBadge running={Boolean(member.has_active_timer)} />
                      </td>
                      <td className={cn(td, "num text-right text-[13px]")}>
                        {formatDuration(member.time_tracked_month_seconds ?? 0)}
                      </td>
                      <td className={cn(td, "num text-right text-[13px] text-[var(--muted)]")}>
                        {formatDuration(member.approved_leave_seconds ?? 0)}
                      </td>
                      <td className={cn(td, "tnum text-right")}>{member.assigned_projects_count ?? 0}</td>
                      <td className={cn(td, "tnum text-right")}>{member.overtime_requests_count ?? 0}</td>
                      <td className={cn(td, "whitespace-nowrap")}>
                        <span className="block">{shortDate(member.joined_at)}</span>
                        <span className="block text-[13px] text-[var(--muted)]">
                          Active {shortDate(member.last_activity_at)}
                        </span>
                      </td>
                      <td className={cn(td, "py-2 text-right")}>
                        <EmployeeActionsMenu
                          viewer={user}
                          member={member}
                          onUpdated={load}
                          onFeedback={(message, variant) => setFeedback({ message, variant })}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
