"use client";

import { ApiError, changePayrollPin, formatApiErrors } from "@/lib/api";
import { Alert } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { FormField, PasswordInput } from "@/components/ui/Input";
import { FormEvent, useState } from "react";

export function PayrollPinChangeForm() {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (newPin !== confirmPin) {
      setError("New PIN and confirmation do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await changePayrollPin({
        current_pin: currentPin,
        payroll_pin: newPin,
        payroll_pin_confirmation: confirmPin,
      });
      setSuccess(response.message);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Unable to update payroll PIN.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Current payroll PIN" required>
          <PasswordInput
            required
            inputMode="numeric"
            pattern="\d{4,8}"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value)}
            autoComplete="off"
          />
        </FormField>
        <FormField label="New payroll PIN" required hint="4–8 digits">
          <PasswordInput
            required
            inputMode="numeric"
            pattern="\d{4,8}"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            autoComplete="new-password"
          />
        </FormField>
        <FormField label="Confirm new PIN" required>
          <PasswordInput
            required
            inputMode="numeric"
            pattern="\d{4,8}"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            autoComplete="new-password"
          />
        </FormField>
      </div>
      <Button type="submit" disabled={submitting || !currentPin}>
        {submitting ? "Updating…" : "Update payroll PIN"}
      </Button>
    </form>
  );
}
