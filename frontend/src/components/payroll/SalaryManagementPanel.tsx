"use client";

import { LeaveDateInput } from "@/components/leave/LeaveDateInput";
import {
  ApiError,
  fetchSalaryContractStatus,
  fetchTeam,
  formatApiErrors,
  updateSalaryContract,
} from "@/lib/api";
import { todayDdMmYyyy } from "@/lib/dates";
import type { SalaryType, TeamMember } from "@/lib/types";
import { FormField, Input, Select } from "@/components/ui/Input";
import { Avatar } from "@/components/ledger/Avatar";
import { Panel } from "@/components/ledger/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert, Spinner } from "@/components/ui/EmptyState";
import { Lock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function SalaryManagementPanel() {
  const [employees, setEmployees] = useState<TeamMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [hasSalary, setHasSalary] = useState(false);
  const [currentType, setCurrentType] = useState<SalaryType | null>(null);
  const [salaryType, setSalaryType] = useState<SalaryType>("hourly");
  const [hourlyRate, setHourlyRate] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayDdMmYyyy());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadEmployees = useCallback(async () => {
    setError("");
    try {
      setEmployees(await fetchTeam());
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
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (!selectedUserId) {
      setHasSalary(false);
      setCurrentType(null);
      return;
    }

    void fetchSalaryContractStatus(selectedUserId)
      .then((status) => {
        setHasSalary(status.has_salary);
        setCurrentType(status.salary_type);
        if (status.salary_type) {
          setSalaryType(status.salary_type);
        }
      })
      .catch(() => {
        setHasSalary(false);
        setCurrentType(null);
      });
  }, [selectedUserId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedUserId) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await updateSalaryContract(selectedUserId, {
        salary_type: salaryType,
        hourly_rate: salaryType === "hourly" ? Number(hourlyRate) : undefined,
        monthly_salary: salaryType === "monthly" ? Number(monthlySalary) : undefined,
        effective_from: effectiveFrom,
      });
      setSuccess(response.message);
      setHourlyRate("");
      setMonthlySalary("");
      setHasSalary(true);
      setCurrentType(salaryType);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to save salary contract.",
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedEmployee = employees.find((e) => e.user_id === selectedUserId);

  return (
    <Panel
      title="Salary management"
      description="Select an employee and enter a new salary contract. Values are encrypted and never displayed."
    >
      <div className="space-y-4">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        {loading ? (
          <Spinner label="Loading employees…" />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,28rem)_1fr] lg:items-end">
              <FormField label="Employee" htmlFor="salary-employee" required>
                <Select
                  id="salary-employee"
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full"
                >
                  <option value="">Select employee…</option>
                  {employees.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </Select>
              </FormField>

              {selectedEmployee ? (
                <div className="flex min-h-11 flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--accent-sand)]/60 px-4 py-2">
                  <Avatar name={selectedEmployee.name} size="sm" />
                  <span className="text-sm font-medium text-[var(--foreground)]">{selectedEmployee.name}</span>
                  <span className="text-[13px] text-[var(--muted)]">Contract status</span>
                  {hasSalary ? (
                    <Badge variant="success" className="gap-1 normal-case">
                      <Lock className="h-3 w-3" aria-hidden="true" />
                      Active {currentType ?? salaryType} contract (amount hidden)
                    </Badge>
                  ) : (
                    <Badge variant="default" className="normal-case">No active contract</Badge>
                  )}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Salary type" htmlFor="salary-type">
                <Select
                  id="salary-type"
                  value={salaryType}
                  onChange={(e) => setSalaryType(e.target.value as SalaryType)}
                  className="w-full"
                >
                  <option value="hourly">Hourly</option>
                  <option value="monthly">Monthly</option>
                </Select>
              </FormField>
              {salaryType === "hourly" ? (
                <FormField label="Hourly rate (PKR)" htmlFor="salary-hourly-rate" required>
                  <Input
                    id="salary-hourly-rate"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="tnum text-right"
                  />
                </FormField>
              ) : (
                <FormField label="Monthly salary (PKR)" htmlFor="salary-monthly" required>
                  <Input
                    id="salary-monthly"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlySalary}
                    onChange={(e) => setMonthlySalary(e.target.value)}
                    className="tnum text-right"
                  />
                </FormField>
              )}
              <LeaveDateInput
                id="salary-effective-from"
                label="Effective from"
                value={effectiveFrom}
                onChange={setEffectiveFrom}
                hint="dd/mm/yyyy"
              />
            </div>

            <Button type="submit" size="lg" disabled={saving || !selectedUserId}>
              {saving ? "Saving…" : hasSalary ? "Save new contract version" : "Create salary contract"}
            </Button>
          </form>
        )}
      </div>
    </Panel>
  );
}
