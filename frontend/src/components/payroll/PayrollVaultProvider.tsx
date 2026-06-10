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

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-6 dark:border-amber-900/50 dark:bg-amber-950/20">
        <h1 className="text-xl font-semibold text-amber-900 dark:text-amber-100">
          {needsSetup ? "Set organization payroll PIN" : "Enter payroll PIN"}
        </h1>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
          Payroll is protected. You must enter the PIN every time you access this area —
          including page refresh and new tabs.
        </p>

        {(error || localError) && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{localError || error}</p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            required
            type="password"
            inputMode="numeric"
            autoComplete="off"
            pattern="\d{4,8}"
            minLength={4}
            maxLength={8}
            placeholder="Payroll PIN (4–8 digits)"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-800 dark:bg-zinc-900"
          />
          {needsSetup ? (
            <input
              required
              type="password"
              inputMode="numeric"
              autoComplete="off"
              pattern="\d{4,8}"
              minLength={4}
              maxLength={8}
              placeholder="Confirm payroll PIN"
              value={pinConfirmation}
              onChange={(event) => setPinConfirmation(event.target.value)}
              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-800 dark:bg-zinc-900"
            />
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60 dark:bg-amber-600"
          >
            {submitting ? "Verifying…" : needsSetup ? "Save payroll PIN" : "Continue to payroll"}
          </button>
        </form>
      </section>
    </div>
  );
}
