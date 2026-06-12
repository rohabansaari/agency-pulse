"use client";

import { PayrollComponentsPanel } from "@/components/payroll/PayrollComponentsPanel";
import {
  ApiError,
  fetchPayrollSettings,
  formatApiErrors,
  updatePayrollSettings,
} from "@/lib/api";
import { usePayrollVault } from "@/components/payroll/PayrollVaultProvider";
import { Alert } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/EmptyState";
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

  if (loading) {
    return (
      <Card>
        <Spinner label="Loading payroll settings…" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Payroll configuration"
          description="Working hours, statutory deductions, and overtime rules for your organization."
        />
        {error ? <Alert variant="error">{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}
        <form onSubmit={handleSubmit} className="mt-4 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Working days / month" htmlFor="working-days" required>
              <Input
                id="working-days"
                type="number"
                min={1}
                max={31}
                value={workingDays}
                onChange={(e) => setWorkingDays(e.target.value)}
                disabled={!financialUnlocked}
              />
            </FormField>
            <FormField label="Working hours / day" htmlFor="working-hours" required>
              <Input
                id="working-hours"
                type="number"
                min={1}
                max={24}
                value={workingHours}
                onChange={(e) => setWorkingHours(e.target.value)}
                disabled={!financialUnlocked}
              />
            </FormField>
            <FormField label="Expected monthly hours" hint="Auto-calculated from days × hours">
              <Input value={String(expectedHours)} readOnly disabled className="bg-zinc-50 dark:bg-zinc-900/50" />
            </FormField>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Statutory deductions (%)</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="Income tax">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={incomeTax}
                  onChange={(e) => setIncomeTax(e.target.value)}
                  disabled={!financialUnlocked}
                />
              </FormField>
              <FormField label="EOBI">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={eobi}
                  onChange={(e) => setEobi(e.target.value)}
                  disabled={!financialUnlocked}
                />
              </FormField>
              <FormField label="Social security">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={socialSecurity}
                  onChange={(e) => setSocialSecurity(e.target.value)}
                  disabled={!financialUnlocked}
                />
              </FormField>
              <FormField label="Custom deduction">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={customDeduction}
                  onChange={(e) => setCustomDeduction(e.target.value)}
                  disabled={!financialUnlocked}
                />
              </FormField>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={overtimeEnabled}
                onChange={(e) => setOvertimeEnabled(e.target.checked)}
                disabled={!financialUnlocked}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Enable overtime pay</span>
            </label>
            {overtimeEnabled ? (
              <div className="mt-3 max-w-xs">
                <FormField label="Overtime rate (%)" hint="125 = 1.25× base rate">
                  <Input
                    type="number"
                    min={100}
                    max={500}
                    value={overtimeRate}
                    onChange={(e) => setOvertimeRate(e.target.value)}
                    disabled={!financialUnlocked}
                  />
                </FormField>
              </div>
            ) : null}
          </div>

          <Button type="submit" disabled={saving || !financialUnlocked}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </form>
      </Card>

      <PayrollComponentsPanel />
    </div>
  );
}
