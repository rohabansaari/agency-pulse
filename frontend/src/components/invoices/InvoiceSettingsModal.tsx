"use client";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/EmptyState";
import { FormField, Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ApiError, fetchInvoiceSettings, formatApiErrors, updateInvoiceSettings } from "@/lib/api";
import type { InvoiceSettings } from "@/lib/types";
import { useEffect, useState } from "react";

const textarea =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";

/** Company details printed on every invoice, plus numbering and defaults. */
export function InvoiceSettingsModal({ onClose, onSaved }: { onClose: () => void; onSaved?: (settings: InvoiceSettings) => void }) {
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchInvoiceSettings()
      .then((result) => {
        if (!cancelled) setSettings(result);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load invoice details.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError("");
    try {
      const saved = await updateInvoiceSettings({
        ...settings,
        default_due_days: Number(settings.default_due_days) || 0,
        default_tax_percent: Number(settings.default_tax_percent) || 0,
        next_number: Math.max(1, Number(settings.next_number) || 1),
      });
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Couldn't save.");
      setSaving(false);
    }
  }

  return (
    <Modal title="Invoice details" description="Printed on every invoice you send." onClose={onClose} size="lg">
      {!settings ? (
        error ? <Alert variant="error">{error}</Alert> : <div className="h-64 animate-pulse rounded-xl bg-[var(--accent-sand)]" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Business name" htmlFor="inv-business">
              <Input id="inv-business" value={settings.business_name} onChange={(e) => set("business_name", e.target.value)} />
            </FormField>
            <FormField label="Tax / NTN number" htmlFor="inv-tax-id">
              <Input id="inv-tax-id" value={settings.tax_id} onChange={(e) => set("tax_id", e.target.value)} />
            </FormField>
          </div>
          <FormField label="Address" htmlFor="inv-address">
            <textarea
              id="inv-address"
              rows={3}
              className={textarea}
              value={settings.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </FormField>
          <FormField label="Payment details" htmlFor="inv-payment" hint="Bank name, account title, IBAN: whatever clients need to pay you.">
            <textarea
              id="inv-payment"
              rows={3}
              className={textarea}
              value={settings.payment_details}
              onChange={(e) => set("payment_details", e.target.value)}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-4">
            <FormField label="Number prefix" htmlFor="inv-prefix">
              <Input id="inv-prefix" value={settings.number_prefix} onChange={(e) => set("number_prefix", e.target.value)} />
            </FormField>
            <FormField label="Next number" htmlFor="inv-next">
              <Input
                id="inv-next"
                type="number"
                min={1}
                value={settings.next_number}
                onChange={(e) => set("next_number", Number(e.target.value))}
              />
            </FormField>
            <FormField label="Due after (days)" htmlFor="inv-due">
              <Input
                id="inv-due"
                type="number"
                min={0}
                value={settings.default_due_days}
                onChange={(e) => set("default_due_days", Number(e.target.value))}
              />
            </FormField>
            <FormField label="Default tax %" htmlFor="inv-tax">
              <Input
                id="inv-tax"
                type="number"
                min={0}
                step="0.01"
                value={settings.default_tax_percent}
                onChange={(e) => set("default_tax_percent", Number(e.target.value))}
              />
            </FormField>
          </div>
          {error ? <Alert variant="error">{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save details"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
