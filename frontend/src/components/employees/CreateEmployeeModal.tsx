"use client";

import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { FormField, Input, PasswordInput, Select } from "@/components/ui/Input";
import { ApiError, createEmployee, formatApiErrors } from "@/lib/api";
import { CREATION_ROLES, ROLE_LABELS } from "@/lib/navigation";
import type { PayrollVaultStatus, SalaryType, UserRole } from "@/lib/types";
import { useState } from "react";

type CreateEmployeeModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  vaultStatus: PayrollVaultStatus | null;
  canSelectRole: boolean;
};

export function CreateEmployeeModal({
  open,
  onClose,
  onCreated,
  vaultStatus,
  canSelectRole,
}: CreateEmployeeModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("employee");
  const [salaryType, setSalaryType] = useState<SalaryType>("hourly");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [payrollPin, setPayrollPin] = useState("");
  const [payrollPinConfirmation, setPayrollPinConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setRole("employee");
    setSalaryType("hourly");
    setSalaryAmount("");
    setPayrollPin("");
    setPayrollPinConfirmation("");
    setError("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const amount = Number.parseFloat(salaryAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Salary amount must be greater than zero.");
      setSaving(false);
      return;
    }

    try {
      await createEmployee({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        salary_type: salaryType,
        hourly_rate: salaryType === "hourly" ? amount : undefined,
        monthly_salary: salaryType === "monthly" ? amount : undefined,
        payroll_pin: vaultStatus?.requires_pin_on_employee_create ? payrollPin : undefined,
        payroll_pin_confirmation: vaultStatus?.requires_pin_on_employee_create
          ? payrollPinConfirmation
          : undefined,
      });
      resetForm();
      onCreated();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to create employee.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <Modal
      title="Create employee"
      description="Set up a new team member with salary and role. Admin roles should only be assigned when necessary."
      onClose={handleClose}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Full name" htmlFor="emp-name" required>
            <Input id="emp-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Email" htmlFor="emp-email" required>
            <Input
              id="emp-email"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          <FormField label="Password" htmlFor="emp-password" required hint="Minimum 8 characters">
            <PasswordInput
              id="emp-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          {canSelectRole ? (
            <FormField label="Role" required>
              <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)} required>
                {CREATION_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}
        </div>

        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">Compensation</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Salary type" required>
              <Select
                value={salaryType}
                onChange={(e) => setSalaryType(e.target.value as SalaryType)}
                required
              >
                <option value="hourly">Hourly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </FormField>
            <FormField
              label={salaryType === "hourly" ? "Hourly rate" : "Monthly salary"}
              required
            >
              <Input
                required
                type="number"
                min={0.01}
                step="0.01"
                value={salaryAmount}
                onChange={(e) => setSalaryAmount(e.target.value)}
                placeholder={salaryType === "hourly" ? "e.g. 25.00" : "e.g. 5000.00"}
              />
            </FormField>
          </div>
        </div>

        {vaultStatus?.requires_pin_on_employee_create ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Payroll PIN" required>
              <PasswordInput
                required
                inputMode="numeric"
                pattern="\d{4,8}"
                value={payrollPin}
                onChange={(e) => setPayrollPin(e.target.value)}
              />
            </FormField>
            <FormField label="Confirm payroll PIN" required>
              <PasswordInput
                required
                inputMode="numeric"
                pattern="\d{4,8}"
                value={payrollPinConfirmation}
                onChange={(e) => setPayrollPinConfirmation(e.target.value)}
              />
            </FormField>
          </div>
        ) : null}

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create employee"}
          </Button>
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
