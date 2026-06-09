"use client";

import {
  ApiError,
  fetchPayrollVaultStatus,
  formatApiErrors,
  initializePayrollPin,
  lockPayrollVault,
  unlockPayrollVault,
} from "@/lib/api";
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
  unlock: (pin: string) => Promise<void>;
  initialize: (pin: string, confirmation: string) => Promise<void>;
  lock: () => Promise<void>;
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

  useEffect(() => {
    if (!status?.vault_unlocked || !status.unlock_expires_at) {
      return;
    }

    const expiresAt = new Date(status.unlock_expires_at).getTime();
    const delay = Math.max(expiresAt - Date.now(), 0);

    const timer = window.setTimeout(() => {
      void refresh();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [status?.vault_unlocked, status?.unlock_expires_at, refresh]);

  async function unlock(pin: string) {
    setError("");
    const response = await unlockPayrollVault(pin);
    setStatus(response.status);
  }

  async function initialize(pin: string, confirmation: string) {
    setError("");
    const response = await initializePayrollPin(pin, confirmation);
    setStatus(response.status);
  }

  async function lock() {
    setError("");
    const response = await lockPayrollVault();
    setStatus(response.status);
  }

  const value = useMemo(
    () => ({
      status,
      loading,
      error,
      refresh,
      unlock,
      initialize,
      lock,
      financialUnlocked: Boolean(status?.vault_unlocked),
    }),
    [status, loading, error, refresh],
  );

  return (
    <PayrollVaultContext.Provider value={value}>{children}</PayrollVaultContext.Provider>
  );
}

export function PayrollVaultUnlockCard() {
  const { status, loading, error, unlock, initialize } = usePayrollVault();
  const [pin, setPin] = useState("");
  const [pinConfirmation, setPinConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  if (loading || !status || status.vault_unlocked) {
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
        await unlock(pin);
      }
      setPin("");
      setPinConfirmation("");
    } catch (err) {
      setLocalError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Unable to unlock payroll vault.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
      <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
        {needsSetup ? "Set organization payroll PIN" : "Enter payroll PIN to view salaries"}
      </h2>
      <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
        {needsSetup
          ? "This PIN protects salary and payroll financial data for your organization."
          : "Salary amounts and payroll totals are hidden until you unlock the vault."}
      </p>

      {(error || localError) && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{localError || error}</p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:max-w-sm">
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
          className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-800 dark:bg-zinc-900"
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
            className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-800 dark:bg-zinc-900"
          />
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60 dark:bg-amber-600 dark:hover:bg-amber-500"
        >
          {submitting
            ? "Verifying…"
            : needsSetup
              ? "Save payroll PIN"
              : "Unlock payroll view"}
        </button>
      </form>
    </section>
  );
}
