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
import { Select } from "@/components/ui/Input";
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
    <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Salary management</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Select an employee and enter a new salary contract. Values are encrypted and never displayed.
      </p>

      {error ? <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-green-600 dark:text-green-400">{success}</p> : null}

      {loading ? (
        <p className="mt-4 text-sm text-zinc-500">Loading employees…</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">Employee</span>
            <Select
              required
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : "")}
              className="w-full max-w-md rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Select employee…</option>
              {employees.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.name} ({member.email})
                </option>
              ))}
            </Select>
          </label>

          {selectedEmployee ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-950/50">
              <p className="text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">Contract status:</span>{" "}
                {hasSalary
                  ? `Active ${currentType ?? salaryType} contract (amount hidden)`
                  : "No active contract"}
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">Salary type</span>
              <Select
                value={salaryType}
                onChange={(e) => setSalaryType(e.target.value as SalaryType)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="hourly">Hourly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </label>
            {salaryType === "hourly" ? (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">Hourly rate</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            ) : (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">Monthly salary</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={monthlySalary}
                  onChange={(e) => setMonthlySalary(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            )}
            <LeaveDateInput
              id="salary-effective-from"
              label="Effective from"
              value={effectiveFrom}
              onChange={setEffectiveFrom}
              hint="dd/mm/yyyy"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !selectedUserId}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : hasSalary ? "Save new contract version" : "Create salary contract"}
          </button>
        </form>
      )}
    </section>
  );
}
