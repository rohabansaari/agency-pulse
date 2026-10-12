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
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ledger/Panel";
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
      <Panel title="Payroll configuration">
        <Spinner label="Loading payroll settings…" />
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Payroll configuration"
        description="Working hours, statutory deductions, and overtime rules for your organization."
        action={
          financialUnlocked ? null : (
            <Badge variant="warning" className="normal-case">Read-only · vault locked</Badge>
          )
        }
      >
        <div className="space-y-3">
          {error ? <Alert variant="error">{error}</Alert> : null}
          {success ? <Alert variant="success">{success}</Alert> : null}
        </div>
        <form onSubmit={handleSubmit} className="mt-2 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Working days / month" htmlFor="working-days" required>
              <Input
                id="working-days"
                type="number"
                className="tnum"
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
                className="tnum"
                min={1}
                max={24}
                value={workingHours}
                onChange={(e) => setWorkingHours(e.target.value)}
                disabled={!financialUnlocked}
              />
            </FormField>
            <FormField label="Expected monthly hours" hint="Auto-calculated from days × hours">
              <Input value={String(expectedHours)} readOnly disabled className="tnum bg-[var(--accent-sand)] text-[var(--muted)]" />
            </FormField>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.04em] text-[var(--muted)]">Statutory deductions (%)</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="Income tax">
                <Input
                  type="number"
                  className="tnum"
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
                  className="tnum"
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
                  className="tnum"
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
                  className="tnum"
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

          <div className="rounded-xl border border-[var(--border)] bg-[var(--accent-sand)]/40 p-4">
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={overtimeEnabled}
                onChange={(e) => setOvertimeEnabled(e.target.checked)}
                disabled={!financialUnlocked}
                className="h-5 w-5 rounded border-[var(--border)] accent-[var(--primary)]"
              />
              <span className="text-sm font-medium text-[var(--foreground)]">Enable overtime pay</span>
            </label>
            {overtimeEnabled ? (
              <div className="mt-3 max-w-xs">
                <FormField label="Overtime rate (%)" hint="125 = 1.25× base rate">
                  <Input
                    type="number"
                    className="tnum"
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

          <Button type="submit" size="lg" disabled={saving || !financialUnlocked}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </form>
      </Panel>

      <PayrollComponentsPanel />
    </div>
  );
}
