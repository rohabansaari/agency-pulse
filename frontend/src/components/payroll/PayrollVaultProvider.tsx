"use client";

import {
  ApiError,
  fetchPayrollVaultStatus,
  formatApiErrors,
  initializePayrollPin,
  unlockPayrollVault,
} from "@/lib/api";
import { clearPayrollPin, setPayrollPin } from "@/lib/payroll-pin";
import type { PayrollVaultStatus } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/EmptyState";
import { FormField, Input } from "@/components/ui/Input";
import { KeyRound, LockKeyhole } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type PayrollVaultContextValue = {
  status: PayrollVaultStatus | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  verifyPin: (pin: string) => Promise<void>;
  initialize: (pin: string, confirmation: string) => Promise<void>;
  financialUnlocked: boolean;
};

const PayrollVaultContext = createContext<PayrollVaultContextValue | null>(null);

export function usePayrollVault(): PayrollVaultContextValue {
  const context = useContext(PayrollVaultContext);
  if (!context) {
    throw new Error("usePayrollVault must be used within PayrollVaultProvider");
  }
  return context;
}

export function PayrollVaultProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<PayrollVaultStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    clearPayrollPin();
    setVerified(false);
  }, []);

  const refresh = useCallback(async () => {
    setError("");
    try {
      setStatus(await fetchPayrollVaultStatus());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load payroll vault status.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function verifyPin(pin: string) {
    setError("");
    await unlockPayrollVault(pin);
    setPayrollPin(pin);
    setVerified(true);
    await refresh();
  }

  async function initialize(pin: string, confirmation: string) {
    setError("");
    const response = await initializePayrollPin(pin, confirmation);
    setStatus(response.status);
    setPayrollPin(pin);
    setVerified(true);
  }

  const value = useMemo(
    () => ({
      status,
      loading,
      error,
      refresh,
      verifyPin,
      initialize,
      financialUnlocked: verified,
    }),
    [status, loading, error, refresh, verified],
  );

  return (
    <PayrollVaultContext.Provider value={value}>
      {!loading && status && !verified ? (
        <PayrollVaultGate />
      ) : (
        children
      )}
    </PayrollVaultContext.Provider>
  );
}

function PayrollVaultGate() {
  const { status, error, verifyPin, initialize } = usePayrollVault();
  const [pin, setPin] = useState("");
  const [pinConfirmation, setPinConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  if (!status) {
    return null;
  }

  const needsSetup = !status.pin_configured;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setLocalError("");

    try {
      if (needsSetup) {
        await initialize(pin, pinConfirmation);
      } else {
        await verifyPin(pin);
      }
      setPin("");
      setPinConfirmation("");
    } catch (err) {
      setLocalError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Incorrect payroll PIN.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const pinProps = {
    required: true,
    type: "password",
    inputMode: "numeric" as const,
    autoComplete: "off",
    pattern: "\\d{4,8}",
    minLength: 4,
    maxLength: 8,
    className: "num tracking-[0.3em]",
  };

  return (
    <div className="mx-auto max-w-md px-0 py-10">
      <section
        aria-labelledby="payroll-vault-title"
        className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-copper-soft)] text-[var(--accent-copper)]"
          >
            {needsSetup ? <KeyRound className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="text-[0.8125rem] text-[var(--muted)]">Payroll vault</p>
            <h1 id="payroll-vault-title" className="text-xl font-semibold tracking-[-0.01em] text-[var(--foreground)]">
              {needsSetup ? "Set organization payroll PIN" : "Enter payroll PIN"}
            </h1>
          </div>
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Payroll is protected. You must enter the PIN every time you access this area —
          including page refresh and new tabs.
        </p>

        {(error || localError) && (
          <div className="mt-4">
            <Alert variant="error">{localError || error}</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <FormField label="Payroll PIN" htmlFor="payroll-vault-pin" hint="4–8 digits">
            <Input
              {...pinProps}
              id="payroll-vault-pin"
              placeholder="••••"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
          </FormField>
          {needsSetup ? (
            <FormField label="Confirm payroll PIN" htmlFor="payroll-vault-pin-confirm">
              <Input
                {...pinProps}
                id="payroll-vault-pin-confirm"
                placeholder="••••"
                value={pinConfirmation}
                onChange={(event) => setPinConfirmation(event.target.value)}
              />
            </FormField>
          ) : null}
          <Button type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting ? "Verifying…" : needsSetup ? "Save payroll PIN" : "Continue to payroll"}
          </Button>
        </form>
      </section>
    </div>
  );
}
