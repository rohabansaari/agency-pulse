"use client";

import { LeaveDateInput } from "@/components/leave/LeaveDateInput";
import {
  ApiError,
  fetchSalaryContracts,
  formatApiErrors,
  updateSalaryContract,
} from "@/lib/api";
import { todayDdMmYyyy } from "@/lib/dates";
import { usePayrollVault } from "@/components/payroll/PayrollVaultProvider";
import type { SalaryContract, SalaryType } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export function SalaryContractsPanel() {
  const { financialUnlocked } = usePayrollVault();
  const [contracts, setContracts] = useState<SalaryContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [salaryType, setSalaryType] = useState<SalaryType>("hourly");
  const [hourlyRate, setHourlyRate] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayDdMmYyyy());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setContracts(await fetchSalaryContracts());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load salary contracts.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, financialUnlocked]);

  function startEdit(contract: SalaryContract) {
    setEditingUserId(contract.user_id);
    setSalaryType(contract.salary_type);
    setHourlyRate("");
    setMonthlySalary("");
    setEffectiveFrom(todayDdMmYyyy());
    setSuccess("");
    setError("");
  }

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (!editingUserId) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await updateSalaryContract(editingUserId, {
        salary_type: salaryType,
        hourly_rate: salaryType === "hourly" ? Number(hourlyRate) : undefined,
        monthly_salary: salaryType === "monthly" ? Number(monthlySalary) : undefined,
        effective_from: effectiveFrom,
      });
      setSuccess(response.message);
      setEditingUserId(null);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to update salary contract.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Employee salary contracts
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Compensation is encrypted at rest and never displayed. Updates create a new contract version.
      </p>

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {success ? (
        <p className="mt-4 text-sm text-green-600 dark:text-green-400">{success}</p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-zinc-500">Loading contracts…</p>
      ) : contracts.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No active salary contracts yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-700">
              <tr>
                <th className="px-3 py-2 font-medium">Employee</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Salary</th>
                <th className="px-3 py-2 font-medium">Effective from</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {contracts.map((contract) => (
                <tr key={contract.id}>
                  <td className="px-3 py-3 text-zinc-900 dark:text-zinc-100">
                    {contract.user_name ?? `User #${contract.user_id}`}
                  </td>
                  <td className="px-3 py-3 capitalize text-zinc-600 dark:text-zinc-400">
                    {contract.salary_type}
                  </td>
                  <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">
                    {contract.has_salary ? "Configured (hidden)" : "—"}
                  </td>
                  <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">
                    {contract.effective_from}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      disabled={!financialUnlocked}
                      onClick={() => startEdit(contract)}
                      className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingUserId ? (
        <form onSubmit={handleUpdate} className="mt-6 space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            New salary version (values are never shown after save)
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
                Salary type
              </span>
              <select
                value={salaryType}
                onChange={(e) => setSalaryType(e.target.value as SalaryType)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="hourly">Hourly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            {salaryType === "hourly" ? (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
                  Hourly rate
                </span>
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
                <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
                  Monthly salary
                </span>
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
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !financialUnlocked}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save new version"}
            </button>
            <button
              type="button"
              onClick={() => setEditingUserId(null)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
