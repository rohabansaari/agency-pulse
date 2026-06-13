"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/EmptyState";
import { FormField, Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { MoneyAmount } from "@/components/ui/MoneyAmount";
import { Modal } from "@/components/ui/Modal";
import {
  ApiError,
  createEmployeePayrollAdjustment,
  deleteEmployeePayrollAdjustment,
  fetchEmployeePayrollAdjustments,
  formatApiErrors,
  updateEmployeePayrollAdjustment,
} from "@/lib/api";
import type {
  EmployeePayrollAdjustment,
  PayrollComponentType,
  PayrollComponentValueMode,
} from "@/lib/types";
import { MinusCircle, Pencil, Plus, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type FormState = {
  name: string;
  type: PayrollComponentType;
  value_mode: PayrollComponentValueMode;
  value: string;
  effective_month: string;
  notes: string;
  is_active: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  type: "increment",
  value_mode: "fixed",
  value: "",
  effective_month: "",
  notes: "",
  is_active: true,
});

export function EmployeePayrollAdjustmentsPanel({
  userId,
  canManage,
}: {
  userId: number;
  canManage: boolean;
}) {
  const [items, setItems] = useState<EmployeePayrollAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeePayrollAdjustment | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchEmployeePayrollAdjustments(userId));
    } catch {
      setError("Unable to load payroll adjustments.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(item: EmployeePayrollAdjustment) {
    setEditing(item);
    setForm({
      name: item.name,
      type: item.type,
      value_mode: item.value_mode,
      value: item.value ?? "",
      effective_month: item.effective_month ?? "",
      notes: item.notes ?? "",
      is_active: item.is_active,
    });
    setModalOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        value_mode: form.value_mode,
        value: Number.parseFloat(form.value),
        effective_month: form.effective_month || undefined,
        notes: form.notes.trim() || undefined,
        is_active: form.is_active,
      };

      if (editing) {
        await updateEmployeePayrollAdjustment(editing.id, payload);
      } else {
        await createEmployeePayrollAdjustment(userId, payload);
      }

      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this adjustment?")) return;
    try {
      await deleteEmployeePayrollAdjustment(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed.");
    }
  }

  const increments = items.filter((i) => i.type === "increment" && i.is_active);
  const deductions = items.filter((i) => i.type === "deduction" && i.is_active);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-heading text-lg text-[var(--foreground)]">Payroll adjustments</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Individual increments and deductions applied during payroll for this employee.
          </p>
        </div>
        {canManage ? (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add adjustment
          </Button>
        ) : null}
      </div>

      {error ? <div className="mt-4"><Alert variant="error">{error}</Alert></div> : null}

      {loading ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No individual adjustments configured.</p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <AdjustmentGroup
            title="Increments"
            icon={TrendingUp}
            items={increments}
            canManage={canManage}
            onEdit={openEdit}
            onDelete={handleDelete}
            positive
          />
          <AdjustmentGroup
            title="Deductions"
            icon={MinusCircle}
            items={deductions}
            canManage={canManage}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        </div>
      )}

      {canManage && modalOpen ? (
        <Modal
          title={editing ? "Edit adjustment" : "New adjustment"}
          description="Applied on top of organization-wide payroll rules."
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Name" required>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Laptop damage, Fuel reimbursement"
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Type" required>
                <Dropdown
                  value={form.type}
                  onChange={(v) => setForm((f) => ({ ...f, type: v as PayrollComponentType }))}
                  options={[
                    { value: "increment", label: "Increment" },
                    { value: "deduction", label: "Deduction" },
                  ]}
                />
              </FormField>
              <FormField label="Mode" required>
                <Dropdown
                  value={form.value_mode}
                  onChange={(v) => setForm((f) => ({ ...f, value_mode: v as PayrollComponentValueMode }))}
                  options={[
                    { value: "fixed", label: "Fixed amount" },
                    { value: "percentage", label: "Percentage" },
                  ]}
                />
              </FormField>
            </div>
            <FormField label={form.value_mode === "percentage" ? "Percentage" : "Amount (PKR)"} required>
              <Input
                required
                type="number"
                min={0}
                step="0.01"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              />
            </FormField>
            <FormField label="Effective month (optional)" hint="YYYY-MM-01 — leave empty for all periods">
              <Input
                type="date"
                value={form.effective_month}
                onChange={(e) => setForm((f) => ({ ...f, effective_month: e.target.value }))}
              />
            </FormField>
            <FormField label="Notes (optional)">
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </FormField>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
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

function AdjustmentGroup({
  title,
  icon: Icon,
  items,
  canManage,
  onEdit,
  onDelete,
  positive,
}: {
  title: string;
  icon: typeof TrendingUp;
  items: EmployeePayrollAdjustment[];
  canManage: boolean;
  onEdit: (item: EmployeePayrollAdjustment) => void;
  onDelete: (id: number) => void;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon
          className={positive ? "h-4 w-4 text-[var(--accent-emerald)]" : "h-4 w-4 text-[var(--danger)]"}
        />
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">None active</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-[var(--muted)]">
                  {item.value_mode === "percentage" ? `${item.value}%` : formatPKRLabel(item.value)}
                  {item.effective_month ? ` · ${item.effective_month.slice(0, 7)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <MoneyAmount
                  amount={item.value}
                  variant={positive ? "positive" : "negative"}
                  size="sm"
                />
                {canManage ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--sidebar-hover)]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--accent-coral-soft)] hover:text-[var(--danger)]"
                    >
                      <MinusCircle className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatPKRLabel(value: string | null): string {
  if (!value) return "—";
  return `Rs. ${value}`;
}
