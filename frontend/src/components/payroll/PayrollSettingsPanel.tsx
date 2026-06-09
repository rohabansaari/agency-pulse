"use client";

import {
  ApiError,
  fetchPayrollSettings,
  formatApiErrors,
  updatePayrollSettings,
} from "@/lib/api";
import { usePayrollVault } from "@/components/payroll/PayrollVaultProvider";
import type { OrganizationPayrollSettings } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export function PayrollSettingsPanel() {
  const { financialUnlocked } = usePayrollVault();
  const [settings, setSettings] = useState<OrganizationPayrollSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [workingDays, setWorkingDays] = useState("22");
  const [workingHours, setWorkingHours] = useState("8");
  const [incomeTax, setIncomeTax] = useState("0");
  const [eobi, setEobi] = useState("0");
  const [socialSecurity, setSocialSecurity] = useState("0");
  const [customDeduction, setCustomDeduction] = useState("0");
  const [overtimeEnabled, setOvertimeEnabled] = useState(false);
  const [overtimeRate, setOvertimeRate] = useState("125");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await fetchPayrollSettings();
      setSettings(data);
      setWorkingDays(String(data.working_days_per_month));
      setWorkingHours(String(data.working_hours_per_day));
      setIncomeTax(data.income_tax_percent ?? "0");
      setEobi(data.eobi_percent ?? "0");
      setSocialSecurity(data.social_security_percent ?? "0");
      setCustomDeduction(data.custom_deduction_percent ?? "0");
      setOvertimeEnabled(Boolean(data.overtime_enabled));
      setOvertimeRate(data.overtime_rate_percentage ?? "125");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load payroll settings.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, financialUnlocked]);

  const expectedHours =
    Number.parseInt(workingDays, 10) * Number.parseInt(workingHours, 10) || 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await updatePayrollSettings({
        working_days_per_month: Number.parseInt(workingDays, 10),
        working_hours_per_day: Number.parseInt(workingHours, 10),
        income_tax_percent: Number.parseFloat(incomeTax),
        eobi_percent: Number.parseFloat(eobi),
        social_security_percent: Number.parseFloat(socialSecurity),
        custom_deduction_percent: Number.parseFloat(customDeduction),
        overtime_enabled: overtimeEnabled,
        overtime_rate_percentage: Number.parseFloat(overtimeRate),
      });
      setSettings(response.settings);
      setSuccess("Payroll settings saved.");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to save payroll settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Payroll settings
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Configure working time assumptions and percentage-based deductions for Pakistan payroll.
        FBR tax slab mode can be enabled in a future release.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-zinc-500">Loading settings…</p>
      ) : (
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(e) => void handleSubmit(e)}>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Working days per month
            </span>
            <input
              type="number"
              min={1}
              max={31}
              value={workingDays}
              onChange={(e) => setWorkingDays(e.target.value)}
              disabled={!financialUnlocked}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Working hours per day
            </span>
            <input
              type="number"
              min={1}
              max={24}
              value={workingHours}
              onChange={(e) => setWorkingHours(e.target.value)}
              disabled={!financialUnlocked}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>
          <p className="sm:col-span-2 text-sm text-zinc-500">
            Expected monthly hours:{" "}
            <span className="font-mono text-zinc-700 dark:text-zinc-300">{expectedHours}</span>
            {settings ? (
              <span className="ml-2 text-xs">(saved: {settings.expected_monthly_hours})</span>
            ) : null}
          </p>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={overtimeEnabled}
              onChange={(event) => setOvertimeEnabled(event.target.checked)}
              disabled={!financialUnlocked}
            />
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Enable overtime</span>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Overtime rate %
            </span>
            <input
              type="number"
              min={100}
              max={500}
              step="0.01"
              value={overtimeRate}
              onChange={(e) => setOvertimeRate(e.target.value)}
              disabled={!financialUnlocked || !overtimeEnabled}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
            />
            <span className="mt-1 block text-xs text-zinc-500">
              125 = 1.25× hourly rate, 150 = 1.5×, 200 = 2×
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Income tax %</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={incomeTax}
              onChange={(e) => setIncomeTax(e.target.value)}
              disabled={!financialUnlocked}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">EOBI %</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={eobi}
              onChange={(e) => setEobi(e.target.value)}
              disabled={!financialUnlocked}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Social security %</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={socialSecurity}
              onChange={(e) => setSocialSecurity(e.target.value)}
              disabled={!financialUnlocked}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Custom deduction %</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={customDeduction}
              onChange={(e) => setCustomDeduction(e.target.value)}
              disabled={!financialUnlocked}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving || !financialUnlocked}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {saving ? "Saving…" : "Save settings"}
            </button>
          </div>
        </form>
      )}

      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {success ? (
        <p className="mt-3 text-sm text-green-600 dark:text-green-400">{success}</p>
      ) : null}
    </section>
  );
}
