"use client";

import {
  ApiError,
  createEmployeePayrollAdjustment,
  createPayrollComponent,
  deletePayrollComponent,
  fetchPayrollComponents,
  fetchTeam,
  formatApiErrors,
  updatePayrollComponent,
} from "@/lib/api";
import { usePayrollVault } from "@/components/payroll/PayrollVaultProvider";
import { Alert, EmptyState, Spinner } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ledger/Panel";
import { ledgerTable, rowButton } from "@/components/ledger/table";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { FormField, Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Modal } from "@/components/ui/Modal";
import type { PayrollComponent, PayrollComponentType, PayrollComponentValueMode, TeamMember } from "@/lib/types";
import { MinusCircle, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";

type ComponentForm = {
  name: string;
  type: PayrollComponentType;
  value_mode: PayrollComponentValueMode;
  value: string;
  is_active: boolean;
  apply_scope: "all" | "selected";
  employee_ids: string[];
  effective_month: string;
};

const emptyForm = (): ComponentForm => ({
  name: "",
  type: "deduction",
  value_mode: "percentage",
  value: "",
  is_active: true,
  apply_scope: "all",
  employee_ids: [],
  effective_month: "",
});

function formatValue(component: PayrollComponent): string {
  if (component.financial_data_masked || component.value === null) return "—";
  return component.value_mode === "percentage" ? `${component.value}%` : component.value;
}

function ComponentTable({
  title,
  icon: Icon,
  components,
  onEdit,
  onDelete,
  canManage,
}: {
  title: string;
  icon: typeof MinusCircle;
  components: PayrollComponent[];
  onEdit: (c: PayrollComponent) => void;
  onDelete: (c: PayrollComponent) => void;
  canManage: boolean;
}) {
  if (components.length === 0) {
    return (
      <EmptyState
        icon={Icon}
        title={`No ${title.toLowerCase()} yet`}
        description={`Add custom ${title.toLowerCase()} to apply during payroll calculation.`}
        className="mx-5 mb-5 py-8"
      />
    );
  }

  return (
    <div className={ledgerTable.wrap}>
      <table className={cn(ledgerTable.table, "min-w-[560px]")}>
        <thead className={ledgerTable.thead}>
          <tr>
            <th scope="col" className={ledgerTable.th}>Name</th>
            <th scope="col" className={ledgerTable.th}>Mode</th>
            <th scope="col" className={cn(ledgerTable.th, "text-right")}>Value</th>
            <th scope="col" className={ledgerTable.th}>Status</th>
            {canManage ? (
              <th scope="col" className={cn(ledgerTable.th, "text-right")}>
                <span className="sr-only">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className={ledgerTable.tbody}>
          {components.map((component, index) => (
            <motion.tr
              key={component.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.2 }}
              className={ledgerTable.rowHover}
            >
              <td className={cn(ledgerTable.td, "font-medium text-[var(--foreground)]")}>{component.name}</td>
              <td className={cn(ledgerTable.td, "text-[var(--muted)]")}>
                {component.value_mode === "percentage" ? "Percentage" : "Fixed amount"}
              </td>
              <td className={cn(ledgerTable.td, "tnum text-right text-[var(--foreground)]")}>{formatValue(component)}</td>
              <td className={ledgerTable.td}>
                <Badge variant={component.is_active ? "success" : "default"}>
                  {component.is_active ? "Active" : "Inactive"}
                </Badge>
              </td>
              {canManage ? (
                <td className={ledgerTable.td}>
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit(component)}
                      className={cn(rowButton, "w-9 justify-center px-0")}
                      aria-label={`Edit ${component.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(component)}
                      className={cn(
                        rowButton,
                        "w-9 justify-center border-[var(--accent-coral)]/30 bg-[var(--accent-coral-soft)] px-0 text-[var(--danger)] hover:bg-[var(--accent-coral)]/20",
                      )}
                      aria-label={`Delete ${component.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              ) : null}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PayrollComponentsPanel() {
  const { financialUnlocked } = usePayrollVault();
  const [components, setComponents] = useState<PayrollComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PayrollComponent | null>(null);
  const [form, setForm] = useState<ComponentForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<TeamMember[]>([]);

  const employeeOptions = useMemo(
    () =>
      employees.map((member) => ({
        value: String(member.user_id),
        label: member.name,
        description: member.email,
      })),
    [employees],
  );

  const load = useCallback(async () => {
    setError("");
    try {
      setComponents(await fetchPayrollComponents());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load payroll components.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, financialUnlocked]);

  useEffect(() => {
    if (!modalOpen || editing) return;
    void fetchTeam()
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }, [modalOpen, editing]);

  const deductions = useMemo(
    () => components.filter((c) => c.type === "deduction"),
    [components],
  );
  const increments = useMemo(
    () => components.filter((c) => c.type === "increment"),
    [components],
  );

  function openCreate(type: PayrollComponentType) {
    setEditing(null);
    setForm({ ...emptyForm(), type });
    setModalOpen(true);
    setError("");
    setSuccess("");
  }

  function openEdit(component: PayrollComponent) {
    setEditing(component);
    setForm({
      name: component.name,
      type: component.type,
      value_mode: component.value_mode,
      value: component.value ?? "",
      is_active: component.is_active,
      apply_scope: "all",
      employee_ids: [],
      effective_month: "",
    });
    setModalOpen(true);
    setError("");
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      name: form.name.trim(),
      type: form.type,
      value_mode: form.value_mode,
      value: Number.parseFloat(form.value),
      is_active: form.is_active,
    };

    const effectiveMonth = form.effective_month
      ? `${form.effective_month}-01`
      : undefined;

    try {
      if (editing) {
        await updatePayrollComponent(editing.id, payload);
        setSuccess("Component updated.");
      } else if (form.apply_scope === "selected") {
        if (form.employee_ids.length === 0) {
          setError("Select at least one employee.");
          setSaving(false);
          return;
        }

        await Promise.all(
          form.employee_ids.map((userId) =>
            createEmployeePayrollAdjustment(Number(userId), {
              ...payload,
              effective_month: effectiveMonth,
            }),
          ),
        );
        setSuccess(
          `Applied to ${form.employee_ids.length} employee${form.employee_ids.length === 1 ? "" : "s"}.`,
        );
      } else {
        await createPayrollComponent(payload);
        setSuccess("Component created.");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to save component.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(component: PayrollComponent) {
    if (!window.confirm(`Delete "${component.name}"? This cannot be undone.`)) return;
    setError("");
    try {
      await deletePayrollComponent(component.id);
      setSuccess("Component deleted.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete component.");
    }
  }

  if (loading) {
    return (
      <Panel title="Custom payroll components">
        <Spinner label="Loading payroll components…" />
      </Panel>
    );
  }

  return (
    <Panel
      title="Custom payroll components"
      description="Define deductions and increments applied automatically during payroll runs."
      flush
    >
      {(error && !modalOpen) || success ? (
        <div className="space-y-3 px-5 pb-4">
          {error && !modalOpen ? <Alert variant="error">{error}</Alert> : null}
          {success ? <Alert variant="success">{success}</Alert> : null}
        </div>
      ) : null}

      <div>
        <section aria-labelledby="payroll-components-deduction" className="border-t border-[var(--border)]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="flex items-center gap-2">
              <MinusCircle className="h-4 w-4 text-[var(--accent-coral)]" aria-hidden="true" />
              <h3 id="payroll-components-deduction" className="text-sm font-semibold text-[var(--foreground)]">Deductions</h3>
            </div>
            <Button
              variant="secondary"
              size="lg"
              disabled={!financialUnlocked}
              onClick={() => openCreate("deduction")}
            >
              <Plus className="h-3.5 w-3.5" />
              Add deduction
            </Button>
          </div>
          <ComponentTable
            title="Deductions"
            icon={MinusCircle}
            components={deductions}
            onEdit={openEdit}
            onDelete={handleDelete}
            canManage={financialUnlocked}
          />
        </section>

        <section aria-labelledby="payroll-components-increment" className="border-t border-[var(--border)]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[var(--accent-emerald)]" aria-hidden="true" />
              <h3 id="payroll-components-increment" className="text-sm font-semibold text-[var(--foreground)]">Increments</h3>
            </div>
            <Button
              variant="secondary"
              size="lg"
              disabled={!financialUnlocked}
              onClick={() => openCreate("increment")}
            >
              <Plus className="h-3.5 w-3.5" />
              Add increment
            </Button>
          </div>
          <ComponentTable
            title="Increments"
            icon={TrendingUp}
            components={increments}
            onEdit={openEdit}
            onDelete={handleDelete}
            canManage={financialUnlocked}
          />
        </section>
      </div>

      {modalOpen ? (
        <Modal
          title={editing ? "Edit component" : form.type === "deduction" ? "Add deduction" : "Add increment"}
          description="Components are applied to gross pay during payroll calculation."
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSave} className="space-y-4">
            {error ? <Alert variant="error">{error}</Alert> : null}
            <FormField label="Name" htmlFor="component-name" required>
              <Input
                id="component-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Tax, Bonus, Allowance"
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Type" required>
                <Dropdown
                  value={form.type}
                  onChange={(v) => setForm((f) => ({ ...f, type: v as PayrollComponentType }))}
                  disabled={Boolean(editing)}
                  options={[
                    { value: "deduction", label: "Deduction" },
                    { value: "increment", label: "Increment" },
                  ]}
                />
              </FormField>
              <FormField label="Value mode" required>
                <Dropdown
                  value={form.value_mode}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, value_mode: v as PayrollComponentValueMode }))
                  }
                  options={[
                    { value: "percentage", label: "Percentage" },
                    { value: "fixed", label: "Fixed amount" },
                  ]}
                />
              </FormField>
            </div>
            <FormField
              label={form.value_mode === "percentage" ? "Value (%)" : "Value (amount)"}
              required
            >
              <Input
                required
                type="number"
                min={0}
                max={form.value_mode === "percentage" ? 100 : undefined}
                step="0.01"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              />
            </FormField>
            <label className="flex min-h-11 items-center gap-3 text-sm text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-5 w-5 rounded accent-[var(--primary)]"
              />
              Active
            </label>
            {!editing ? (
              <>
                <FormField label="Apply to" required>
                  <Dropdown
                    value={form.apply_scope}
                    onChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        apply_scope: v as "all" | "selected",
                        employee_ids: v === "all" ? [] : f.employee_ids,
                      }))
                    }
                    options={[
                      { value: "all", label: "All employees (organization-wide)" },
                      { value: "selected", label: "Selected employees only" },
                    ]}
                  />
                </FormField>
                {form.apply_scope === "selected" ? (
                  <>
                    <FormField
                      label="Employees"
                      required
                      hint="Select one, many, or use Select all"
                    >
                      <MultiSelect
                        values={form.employee_ids}
                        onChange={(employee_ids) => setForm((f) => ({ ...f, employee_ids }))}
                        options={employeeOptions}
                        placeholder="Choose employees…"
                        selectAllLabel="Select all employees"
                        searchable
                      />
                    </FormField>
                    <FormField
                      label="Effective month"
                      hint="Leave empty to apply every payroll period"
                    >
                      <Input
                        type="month"
                        value={form.effective_month}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, effective_month: e.target.value }))
                        }
                      />
                    </FormField>
                  </>
                ) : null}
              </>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" size="lg" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create component"}
              </Button>
              <Button type="button" variant="secondary" size="lg" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </Panel>
  );
}
