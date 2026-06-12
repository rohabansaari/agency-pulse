"use client";

import { EmployeeCsvImport } from "@/components/onboarding/EmployeeCsvImport";
import {
  ApiError,
  completeOnboarding,
  createOnboardingEmployee,
  createProject,
  createWorkTeam,
  fetchOnboardingStatus,
  formatApiErrors,
  initializePayrollPin,
  skipOnboardingStep,
  updateOnboardingOrganization,
  updateOnboardingStep,
} from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";
import type { OnboardingStatus, UserRole } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select } from "@/components/ui/Input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState, type ReactNode } from "react";

const STEPS = [
  { id: 1, title: "Organization", required: true, blurb: "Name your workspace and set regional preferences." },
  { id: 2, title: "Payroll PIN", required: true, blurb: "Secure salaries, payroll runs, and exports." },
  { id: 3, title: "Employees", required: false, blurb: "Invite your team now or add people later." },
  { id: 4, title: "Teams", required: false, blurb: "Group people for reporting and assignments." },
  { id: 5, title: "Projects", required: false, blurb: "Track client work and billable time." },
] as const;

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Singapore",
  "Australia/Sydney",
];

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Manager" },
  { value: "sub_admin", label: "Sub Admin" },
];

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

export function OnboardingWizard() {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [orgName, setOrgName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [website, setWebsite] = useState("");

  const [payrollPin, setPayrollPin] = useState("");
  const [payrollPinConfirmation, setPayrollPinConfirmation] = useState("");

  const [employeeMode, setEmployeeMode] = useState<"manual" | "csv">("manual");
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeeSalary, setEmployeeSalary] = useState("");
  const [employeeSalaryType, setEmployeeSalaryType] = useState<"monthly" | "hourly">("monthly");
  const [employeeRole, setEmployeeRole] = useState<UserRole>("employee");

  const [teamName, setTeamName] = useState("");
  const [teamsCreated, setTeamsCreated] = useState<string[]>([]);

  const [projectName, setProjectName] = useState("");
  const [projectClient, setProjectClient] = useState("");
  const [projectsCreated, setProjectsCreated] = useState<string[]>([]);

  const loadStatus = useCallback(async () => {
    const next = await fetchOnboardingStatus();
    setStatus(next);
    setOrgName(next.organization.name ?? "");
    setTimezone(next.organization.timezone ?? "");
    setLogoUrl(next.organization.logo_url ?? "");
    setWebsite(next.organization.website ?? "");
    setStep(next.onboarding_step || 1);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    loadStatus()
      .catch(() => setError("Unable to load onboarding status."))
      .finally(() => setLoading(false));
  }, [loadStatus, router]);

  async function goToStep(nextStep: number) {
    setError("");
    setSuccess("");
    setStep(nextStep);
    try {
      const response = await updateOnboardingStep(nextStep);
      setStatus(response.status);
    } catch {
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              onboarding_step: nextStep,
              completion_percent: Math.min(99, Math.round((nextStep / STEPS.length) * 100)),
            }
          : prev,
      );
    }
  }

  async function finishOnboarding() {
    const response = await completeOnboarding();
    setStatus(response.status);
    router.replace("/dashboard");
  }

  async function handleOrganizationSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await updateOnboardingOrganization({
        name: orgName.trim(),
        timezone: timezone || null,
        logo_url: logoUrl || null,
        website: website || null,
      });
      setStatus(response.status);
      await goToStep(2);
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Unable to save organization.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePayrollPinSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await initializePayrollPin(payrollPin, payrollPinConfirmation);
      const next = await fetchOnboardingStatus();
      setStatus(next);
      await goToStep(3);
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Unable to save payroll PIN.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEmployeeManualSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const response = await createOnboardingEmployee({
        name: employeeName.trim(),
        email: employeeEmail.trim(),
        salary: Number(employeeSalary),
        salary_type: employeeSalaryType,
        role: employeeRole,
      });
      setStatus(response.status);
      setSuccess(response.message);
      setEmployeeName("");
      setEmployeeEmail("");
      setEmployeeSalary("");
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Unable to add employee.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTeamSubmit(event: FormEvent) {
    event.preventDefault();
    if (!teamName.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await createWorkTeam(teamName.trim());
      setTeamsCreated((prev) => [...prev, teamName.trim()]);
      setTeamName("");
      setSuccess("Team created.");
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Unable to create team.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProjectSubmit(event: FormEvent) {
    event.preventDefault();
    if (!projectName.trim() || !projectClient.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await createProject({ name: projectName.trim(), client_name: projectClient.trim() });
      setProjectsCreated((prev) => [...prev, projectName.trim()]);
      setProjectName("");
      setProjectClient("");
      setSuccess("Project created.");
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Unable to create project.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkipOptional() {
    setSubmitting(true);
    setError("");
    try {
      if (step >= 3 && step <= 5) {
        const response = await skipOnboardingStep(step);
        setStatus(response.status);
      }
      if (step < 5) {
        await goToStep(step + 1);
      } else {
        await finishOnboarding();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to continue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinish() {
    setSubmitting(true);
    setError("");
    try {
      await finishOnboarding();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to finish onboarding.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="onboarding-shell flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500">Loading onboarding…</p>
      </div>
    );
  }

  const stepPercent = Math.round((step / STEPS.length) * 100);
  const completionPercent = status?.completion_percent ?? stepPercent;
  const displayPercent = Math.max(completionPercent, stepPercent);
  const current = STEPS.find((item) => item.id === step) ?? STEPS[0];

  return (
    <div className="onboarding-shell">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <header className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href="/" className="text-xs font-semibold tracking-widest text-blue-600 uppercase dark:text-blue-400">
              AgencyPulse
            </Link>
            <h1 className="mt-1 text-xl font-semibold text-zinc-900 sm:text-2xl dark:text-zinc-50">
              Set up your workspace
            </h1>
          </div>
          <span className="text-sm font-semibold text-blue-600 tabular-nums dark:text-blue-400">
            {displayPercent}%
          </span>
        </header>

        <OnboardingProgressTrack
          steps={STEPS}
          currentStep={step}
          percent={displayPercent}
        />

        <nav className="mb-4 flex shrink-0 flex-wrap gap-1.5 sm:gap-2" aria-label="Onboarding steps">
          {STEPS.map((item) => {
            const active = item.id === step;
            const done = item.id < step;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (done || active) void goToStep(item.id);
                }}
                disabled={!done && !active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition sm:px-3 sm:text-xs ${
                  active
                    ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-300"
                    : done
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "border-zinc-200 bg-white text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
                }`}
              >
                <span>{item.id}</span>
                <span className="hidden sm:inline">{item.title}</span>
                <span
                  className={`rounded px-1 py-0.5 text-[9px] uppercase ${
                    item.required
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {item.required ? "Req" : "Opt"}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-6">
          <aside className="onboarding-card hidden justify-center rounded-2xl border border-zinc-200/80 bg-white/80 p-6 backdrop-blur lg:flex dark:border-zinc-800 dark:bg-zinc-900/80">
            <div className="flex flex-col justify-center">
              <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-400">
                Step {current.id} of {STEPS.length}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{current.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{current.blurb}</p>
              <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
                {current.required ? "Required before dashboard access." : "Optional — skip anytime."}
              </p>
            </div>
          </aside>

          <section className="onboarding-card rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:p-5 lg:p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 lg:hidden">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Step {current.id}</p>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{current.title}</h2>
            </div>

            {error ? <Alert tone="error">{error}</Alert> : null}
            {success ? <Alert tone="success">{success}</Alert> : null}

            <div key={step} className="animate-fade-in">
              {step === 1 ? (
                <form onSubmit={handleOrganizationSubmit} className="grid gap-3 sm:grid-cols-2">
                  <Field label="Organization name *" className="sm:col-span-2">
                    <input required value={orgName} onChange={(e) => setOrgName(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Timezone">
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputClass}>
                      <option value="">Optional</option>
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Website">
                    <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className={inputClass} />
                  </Field>
                  <Field label="Logo URL" className="sm:col-span-2">
                    <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" className={inputClass} />
                  </Field>
                  <ActionRow submitting={submitting} showBack={false} continueLabel="Save & Continue" className="sm:col-span-2" />
                </form>
              ) : null}

              {step === 2 ? (
                <form onSubmit={handlePayrollPinSubmit} className="grid gap-3 sm:grid-cols-2">
                  <p className="rounded-lg bg-blue-50 px-3 py-2.5 text-sm text-blue-800 sm:col-span-2 dark:bg-blue-950 dark:text-blue-200">
                    Payroll PIN protects access to salaries, payroll generation, payroll exports, and salary updates.
                  </p>
                  <Field label="PIN *">
                    <input required type="password" inputMode="numeric" pattern="\d{4,8}" value={payrollPin} onChange={(e) => setPayrollPin(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Confirm PIN *">
                    <input required type="password" inputMode="numeric" pattern="\d{4,8}" value={payrollPinConfirmation} onChange={(e) => setPayrollPinConfirmation(e.target.value)} className={inputClass} />
                  </Field>
                  <ActionRow submitting={submitting} onBack={() => goToStep(1)} continueLabel="Save & Continue" className="sm:col-span-2" />
                </form>
              ) : null}

              {step === 3 ? (
                <div className="space-y-3">
                  <TabSwitch active={employeeMode} onChange={setEmployeeMode} />
                  {employeeMode === "manual" ? (
                    <form onSubmit={handleEmployeeManualSubmit} className="grid gap-3 sm:grid-cols-2">
                      <Field label="Name *">
                        <input required value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} className={inputClass} />
                      </Field>
                      <Field label="Email *">
                        <input required type="email" value={employeeEmail} onChange={(e) => setEmployeeEmail(e.target.value)} className={inputClass} />
                      </Field>
                      <Field label="Salary *">
                        <input required type="number" min="0" step="0.01" value={employeeSalary} onChange={(e) => setEmployeeSalary(e.target.value)} className={inputClass} />
                      </Field>
                      <Field label="Salary type *">
                        <select value={employeeSalaryType} onChange={(e) => setEmployeeSalaryType(e.target.value as "monthly" | "hourly")} className={inputClass}>
                          <option value="monthly">Monthly</option>
                          <option value="hourly">Hourly</option>
                        </select>
                      </Field>
                      <Field label="Role" className="sm:col-span-2">
                        <select value={employeeRole} onChange={(e) => setEmployeeRole(e.target.value as UserRole)} className={inputClass}>
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </Field>
                      <div className="sm:col-span-2">
                        <button type="submit" disabled={submitting} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                          Add employee
                        </button>
                      </div>
                    </form>
                  ) : (
                    <EmployeeCsvImport
                      submitting={submitting}
                      onSubmittingChange={setSubmitting}
                      onStatusChange={setStatus}
                    />
                  )}
                  <OptionalActions submitting={submitting} onBack={() => goToStep(2)} onSkip={handleSkipOptional} onContinue={() => goToStep(4)} />
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-3">
                  <form onSubmit={handleTeamSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <input placeholder="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} className={inputClass} />
                    <button type="submit" disabled={submitting || !teamName.trim()} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                      Create
                    </button>
                  </form>
                  {teamsCreated.length > 0 ? (
                    <CreatedList items={teamsCreated} />
                  ) : null}
                  <OptionalActions submitting={submitting} onBack={() => goToStep(3)} onSkip={handleSkipOptional} onContinue={() => goToStep(5)} />
                </div>
              ) : null}

              {step === 5 ? (
                <div className="space-y-3">
                  <form onSubmit={handleProjectSubmit} className="grid gap-3 sm:grid-cols-2">
                    <Field label="Project name *">
                      <input required value={projectName} onChange={(e) => setProjectName(e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Client *">
                      <input required value={projectClient} onChange={(e) => setProjectClient(e.target.value)} className={inputClass} />
                    </Field>
                    <div className="sm:col-span-2">
                      <button type="submit" disabled={submitting} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                        Create project
                      </button>
                    </div>
                  </form>
                  {projectsCreated.length > 0 ? (
                    <CreatedList items={projectsCreated} />
                  ) : null}
                  <OptionalActions submitting={submitting} onBack={() => goToStep(4)} onSkip={handleSkipOptional} onContinue={() => void handleFinish()} continueLabel="Finish setup" />
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <footer className="shrink-0 pt-3 text-center">
          <button
            type="button"
            onClick={() => {
              clearToken();
              router.push("/login");
            }}
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          >
            Sign out
          </button>
        </footer>
      </div>
    </div>
  );
}

function OnboardingProgressTrack({
  steps,
  currentStep,
  percent,
}: {
  steps: readonly { id: number; title: string; required: boolean }[];
  currentStep: number;
  percent: number;
}) {
  return (
    <div className="mb-4 shrink-0">
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          Step {currentStep} of {steps.length}
        </span>
        <span className="tabular-nums">{percent}% complete</span>
      </div>
      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-blue-600 transition-all duration-300 ease-out dark:bg-blue-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function Alert({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const styles =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
      : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
  return <div className={`mb-3 rounded-lg border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}

function TabSwitch({ active, onChange }: { active: "manual" | "csv"; onChange: (mode: "manual" | "csv") => void }) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
      {(["manual", "csv"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
            active === mode ? "bg-blue-600 text-white" : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          {mode === "csv" ? "CSV import" : "Manual"}
        </button>
      ))}
    </div>
  );
}

function CreatedList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2 text-sm text-zinc-600 dark:text-zinc-400">
      {items.map((name) => (
        <li key={name} className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">✓ {name}</li>
      ))}
    </ul>
  );
}

function ActionRow({
  submitting,
  onBack,
  showBack = true,
  continueLabel,
  className = "",
}: {
  submitting: boolean;
  onBack?: () => void;
  showBack?: boolean;
  continueLabel: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-700 ${className}`}>
      {showBack && onBack ? (
        <button type="button" onClick={onBack} className="text-sm text-zinc-600 dark:text-zinc-400">Back</button>
      ) : (
        <span />
      )}
      <button type="submit" disabled={submitting} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {submitting ? "Saving…" : continueLabel}
      </button>
    </div>
  );
}

function OptionalActions({
  submitting,
  onBack,
  onSkip,
  onContinue,
  continueLabel = "Continue",
}: {
  submitting: boolean;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
  continueLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
      <button type="button" onClick={onBack} className="text-sm text-zinc-600 dark:text-zinc-400">Back</button>
      <div className="flex gap-2">
        <button type="button" disabled={submitting} onClick={onSkip} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600">Skip</button>
        <button type="button" disabled={submitting} onClick={onContinue} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">{continueLabel}</button>
      </div>
    </div>
  );
}
