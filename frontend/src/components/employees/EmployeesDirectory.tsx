"use client";

import { CreateEmployeeModal } from "@/components/employees/CreateEmployeeModal";
import { EmployeeActionsMenu } from "@/components/employees/EmployeeActionsMenu";
import { EmployeeCsvImport } from "@/components/onboarding/EmployeeCsvImport";
import { PageTransition } from "@/components/motion/PageTransition";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { Alert, Spinner } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormField, Input, Select } from "@/components/ui/Input";
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
import { motion } from "framer-motion";
import { Plus, Search, Upload } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_STYLES: Record<MemberStatus, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  invited: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  suspended: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export function EmployeesDirectory({ user }: { user: User }) {
  const canCreate = canManageOrgEmployees(user.role);
  const canEditStatus = canEditEmployeeStatus(user.role);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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

  if (loading) {
    return <Spinner label="Loading employees…" />;
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Employees"
          description="Organization directory — compensation data is managed under Payroll."
          actions={
            <>
              <ExportDropdown filename="employees" columns={EMPLOYEES_EXPORT_COLUMNS} rows={exportRows} />
              {canCreate ? (
                <>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      setShowImport((v) => !v);
                      setShowCreate(false);
                    }}
                  >
                    <Upload className="h-4 w-4" />
                    Import CSV
                  </Button>
                  <Button onClick={() => { setShowCreate(true); setShowImport(false); }}>
                    <Plus className="h-4 w-4" />
                    Create employee
                  </Button>
                </>
              ) : null}
            </>
          }
        />

        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search by name, email, or team…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <FormField label="Status">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as MemberStatus | "all")}
              className="min-w-[140px]"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="suspended">Suspended</option>
            </Select>
          </FormField>
        </div>

        {showImport && canCreate ? (
          <div className="ui-card rounded-xl p-4">
            <p className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">Import employees from CSV</p>
            <EmployeeCsvImport
              variant="employees"
              submitting={importing}
              onSubmittingChange={setImporting}
              onImported={() => void load()}
            />
          </div>
        ) : null}

        <CreateEmployeeModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={() => void load()}
          vaultStatus={vaultStatus}
          canSelectRole={canChangeEmployeeRoles(user.role)}
        />

        <div className="ui-table-wrap ui-card overflow-hidden rounded-xl">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50">
              <tr>
                <th className="px-3 py-2.5 font-medium">Employee</th>
                <th className="px-3 py-2.5 font-medium">Role</th>
                <th className="px-3 py-2.5 font-medium">Team</th>
                <th className="px-3 py-2.5 font-medium">Manager</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Join date</th>
                <th className="px-3 py-2.5 font-medium">Last activity</th>
                <th className="px-3 py-2.5 font-medium">Timer</th>
                <th className="px-3 py-2.5 font-medium">Projects</th>
                <th className="px-3 py-2.5 font-medium">Month hrs</th>
                <th className="px-3 py-2.5 font-medium">Leave</th>
                <th className="px-3 py-2.5 font-medium">OT reqs</th>
                <th className="px-3 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredMembers.map((member, index) => (
                <motion.tr
                  key={member.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02, duration: 0.2 }}
                >
                  <td className="px-3 py-3">
                    <Link
                      href={`/employees/${member.user_id}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {member.name}
                    </Link>
                    <p className="text-xs text-zinc-500">{member.email}</p>
                  </td>
                  <td className="px-3 py-3 capitalize">
                    <Badge variant={member.role === "manager" ? "primary" : member.role === "admin" ? "violet" : "default"}>
                      {member.role.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">{member.team_name ?? "—"}</td>
                  <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">{member.manager_name ?? "—"}</td>
                  <td className="px-3 py-3">
                    {canEditStatus && canEditMemberStatus(member.role) ? (
                      <Select
                        value={member.status}
                        onChange={async (event) => {
                          try {
                            await updateTeamMember(member.id, {
                              status: event.target.value as MemberStatus,
                            });
                            await load();
                          } catch (err) {
                            setError(err instanceof ApiError ? err.message : "Status update failed.");
                          }
                        }}
                        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs capitalize dark:border-zinc-700 dark:bg-zinc-950"
                      >
                        <option value="active">active</option>
                        <option value="invited">invited</option>
                        <option value="suspended">suspended</option>
                      </Select>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[member.status]}`}>
                        {member.status}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-zinc-600">{formatDate(member.joined_at)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-zinc-600">{formatDate(member.last_activity_at)}</td>
                  <td className="px-3 py-3">{member.has_active_timer ? "Running" : "Idle"}</td>
                  <td className="px-3 py-3">{member.assigned_projects_count ?? 0}</td>
                  <td className="px-3 py-3 font-mono text-xs">{formatDuration(member.time_tracked_month_seconds ?? 0)}</td>
                  <td className="px-3 py-3 font-mono text-xs">{formatDuration(member.approved_leave_seconds ?? 0)}</td>
                  <td className="px-3 py-3">{member.overtime_requests_count ?? 0}</td>
                  <td className="px-3 py-3">
                    <EmployeeActionsMenu viewer={user} member={member} onUpdated={load} />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageTransition>
  );
}
