"use client";

import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ledger/Panel";
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
import { MinusCircle, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
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
    <Panel
      title="Payroll adjustments"
      description="Individual increments and deductions applied during payroll for this employee."
      action={
        canManage ? (
          <Button variant="secondary" size="lg" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add adjustment
          </Button>
        ) : null
      }
    >
      {error ? <div className="mb-4"><Alert variant="error">{error}</Alert></div> : null}

      {loading ? (
        <p className="text-sm text-[var(--muted)]" role="status">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
          No individual adjustments configured.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
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
            <FormField label="Name" htmlFor="adjustment-name" required>
              <Input
                id="adjustment-name"
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
            <FormField label={form.value_mode === "percentage" ? "Percentage" : "Amount (PKR)"} htmlFor="adjustment-value" required>
              <Input
                id="adjustment-value"
                className="num"
                required
                type="number"
                min={0}
                step="0.01"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              />
            </FormField>
            <FormField label="Effective month (optional)" htmlFor="adjustment-month" hint="YYYY-MM-01 — leave empty for all periods">
              <Input
                id="adjustment-month"
                type="date"
                value={form.effective_month}
                onChange={(e) => setForm((f) => ({ ...f, effective_month: e.target.value }))}
              />
            </FormField>
            <FormField label="Notes (optional)" htmlFor="adjustment-notes">
              <Input
                id="adjustment-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </FormField>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="lg" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="lg" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </Panel>
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
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card-elevated)]">
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-2.5">
        <Icon
          aria-hidden="true"
          className={positive ? "h-4 w-4 text-[var(--accent-emerald)]" : "h-4 w-4 text-[var(--accent-coral)]"}
        />
        <h3 className="text-[0.8125rem] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]">{title}</h3>
        <span className="tnum ml-auto text-[0.8125rem] text-[var(--muted)]">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-[0.8125rem] text-[var(--muted)]">None active</p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.name}</p>
                <p className="tnum text-[0.8125rem] text-[var(--muted)]">
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
                      aria-label={`Edit ${item.name}`}
                      onClick={() => onEdit(item)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--accent-sand)] hover:text-[var(--foreground)]"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${item.name}`}
                      onClick={() => onDelete(item.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--accent-coral-soft)] hover:text-[var(--danger)]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
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
