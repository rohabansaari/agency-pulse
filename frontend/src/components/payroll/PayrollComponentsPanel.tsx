"use client";

import {
  ApiError,
  createPayrollComponent,
  deletePayrollComponent,
  fetchPayrollComponents,
  formatApiErrors,
  updatePayrollComponent,
} from "@/lib/api";
import { usePayrollVault } from "@/components/payroll/PayrollVaultProvider";
import { Alert, EmptyState, Spinner } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { PayrollComponent, PayrollComponentType, PayrollComponentValueMode } from "@/lib/types";
import { MinusCircle, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";

type ComponentForm = {
  name: string;
  type: PayrollComponentType;
  value_mode: PayrollComponentValueMode;
  value: string;
  is_active: boolean;
};

const emptyForm = (): ComponentForm => ({
  name: "",
  type: "deduction",
  value_mode: "percentage",
  value: "",
  is_active: true,
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
        className="py-8"
      />
    );
  }

  return (
    <div className="ui-table-wrap overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Mode</th>
            <th className="px-3 py-2 font-medium">Value</th>
            <th className="px-3 py-2 font-medium">Status</th>
            {canManage ? <th className="px-3 py-2 font-medium">Actions</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {components.map((component, index) => (
            <motion.tr
              key={component.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.2 }}
            >
              <td className="px-3 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{component.name}</td>
              <td className="px-3 py-2.5 capitalize text-zinc-600 dark:text-zinc-400">
                {component.value_mode === "percentage" ? "Percentage" : "Fixed amount"}
              </td>
              <td className="px-3 py-2.5 font-mono text-zinc-700 dark:text-zinc-300">{formatValue(component)}</td>
              <td className="px-3 py-2.5">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    component.is_active
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {component.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              {canManage ? (
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(component)}
                      className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800"
                      aria-label={`Edit ${component.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(component)}
                      className="rounded-md p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                      aria-label={`Delete ${component.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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

    try {
      if (editing) {
        await updatePayrollComponent(editing.id, payload);
        setSuccess("Component updated.");
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
      <Card>
        <Spinner label="Loading payroll components…" />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Custom payroll components"
        description="Define deductions and increments applied automatically during payroll runs."
      />

      {error && !modalOpen ? <Alert variant="error">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      <div className="space-y-8">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MinusCircle className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Deductions</h3>
            </div>
            <Button
              variant="secondary"
              size="sm"
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

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Increments</h3>
            </div>
            <Button
              variant="secondary"
              size="sm"
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
                <Select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PayrollComponentType }))}
                  disabled={Boolean(editing)}
                >
                  <option value="deduction">Deduction</option>
                  <option value="increment">Increment</option>
                </Select>
              </FormField>
              <FormField label="Value mode" required>
                <Select
                  value={form.value_mode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, value_mode: e.target.value as PayrollComponentValueMode }))
                  }
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </Select>
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4 rounded"
              />
              Active
            </label>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create component"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </Card>
  );
}
