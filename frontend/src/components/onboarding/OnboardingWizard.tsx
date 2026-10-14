"use client";

import { EmployeeCsvImport } from "@/components/onboarding/EmployeeCsvImport";
import { LogoUploadField } from "@/components/onboarding/LogoUploadField";
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
import { normalizeStepStates } from "@/lib/onboarding";
import type { OnboardingStatus, UserRole } from "@/lib/types";
import { PulseLogo } from "@/components/brand/PulseLogo";
import { Segmented } from "@/components/ledger/Segmented";
import { Select } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { Check, KeyRound, Plus, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

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
  "min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-muted)]";

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
    if (next.onboarding_completed) {
      router.replace("/dashboard");
      return;
    }
    setStatus(next);
    setOrgName(next.organization.name ?? "");
    setTimezone(next.organization.timezone ?? "");
    setLogoUrl(next.organization.logo_url ?? "");
    setWebsite(next.organization.website ?? "");
    setStep(next.onboarding_step || 1);
  }, [router]);

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

      if (!response.invitation_email_sent) {
        setError(
          `${response.delivery_issue || response.message} The employee was created — use Resend invitation instead of creating them again.`,
        );
        setEmployeeName("");
        setEmployeeEmail("");
        setEmployeeSalary("");
        return;
      }

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
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
        <p className="text-sm text-[var(--muted)]">Loading setup…</p>
      </div>
    );
  }

  const displayPercent = status?.completion_percent ?? 0;
  const stepStates = normalizeStepStates(status?.step_states);
  const current = STEPS.find((item) => item.id === step) ?? STEPS[0];

  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" aria-label="AgencyPulse home">
            <PulseLogo className="text-lg" markClassName="h-8 w-8" />
          </Link>
          <button
            type="button"
            onClick={() => {
              clearToken();
              router.push("/login");
            }}
            className="inline-flex min-h-9 items-center rounded-lg px-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-muted)]"
          >
            Save and finish later
          </button>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[16.25rem_minmax(0,1fr)] lg:gap-10">
          <aside aria-label="Setup progress" className="min-w-0">
            <h1 className="text-[1.375rem] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Set up your workspace</h1>
            <div className="mt-3 flex items-center gap-3">
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border-subtle)]"
                role="progressbar"
                aria-label="Setup progress"
                aria-valuenow={displayPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-[var(--primary)] transition-all duration-500 ease-out"
                  style={{ width: `${displayPercent}%` }}
                />
              </div>
              <span className="tnum text-[0.8125rem] text-[var(--muted)]">{displayPercent}%</span>
            </div>

            <ol className="mt-6 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible">
              {STEPS.map((item) => {
                const active = item.id === step;
                const state = stepStates.find((s) => s.step === item.id);
                const done = state?.completed ?? item.id < step;
                const reachable = done || active;
                return (
                  <li key={item.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (reachable) void goToStep(item.id);
                      }}
                      disabled={!reachable}
                      aria-current={active ? "step" : undefined}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition",
                        active ? "bg-[var(--card)] shadow-[var(--shadow-sm)]" : reachable ? "hover:bg-[var(--accent-sand)]" : "",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          done && !active
                            ? "bg-[var(--accent-emerald)] text-white"
                            : active
                              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                              : "border border-[var(--border)] text-[var(--muted)]",
                        )}
                      >
                        {done && !active ? <Check className="h-3.5 w-3.5" /> : item.id}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block text-sm font-medium",
                            active || done ? "text-[var(--foreground)]" : "text-[var(--muted)]",
                          )}
                        >
                          {item.title}
                        </span>
                        <span className="hidden text-xs text-[var(--muted)] lg:block">
                          {item.required ? "Required" : "Optional"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>

          <section
            aria-labelledby="onboarding-step-title"
            className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-8"
          >
            <p className="text-[0.8125rem] text-[var(--muted)]">
              Step {current.id} of {STEPS.length} · {current.required ? "Required" : "Optional"}
            </p>
            <h2 id="onboarding-step-title" className="mt-1 text-[1.625rem] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
              {STEP_HEADINGS[current.id]}
            </h2>
            <p className="mt-1.5 text-sm text-[var(--muted)]">{current.blurb}</p>

            <div className="mt-6">
              {error ? <Notice tone="error">{error}</Notice> : null}
              {success ? <Notice tone="success">{success}</Notice> : null}

              <div key={step} className="animate-fade-in">
                {step === 1 ? (
                  <form onSubmit={handleOrganizationSubmit} className="grid gap-4 sm:grid-cols-2">
                    <Field label="Organization name" required className="sm:col-span-2">
                      <input required value={orgName} onChange={(e) => setOrgName(e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Timezone">
                      <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                        <option value="">Optional</option>
                        {TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>{tz}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Website">
                      <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className={inputClass} />
                    </Field>
                    <Field label="Organization logo" className="sm:col-span-2">
                      <LogoUploadField value={logoUrl} onChange={setLogoUrl} disabled={submitting} />
                    </Field>
                    <StepFooter className="sm:col-span-2">
                      <span />
                      <PrimaryButton type="submit" disabled={submitting}>
                        {submitting ? "Saving…" : "Save and continue"}
                      </PrimaryButton>
                    </StepFooter>
                  </form>
                ) : null}

                {step === 2 ? (
                  <form onSubmit={handlePayrollPinSubmit} className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-start gap-3 rounded-xl bg-[var(--primary-muted)] px-4 py-3 text-sm text-[var(--foreground)] sm:col-span-2">
                      <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                      Payroll PIN protects access to salaries, payroll generation, payroll exports, and salary updates.
                    </div>
                    <Field label="PIN" required hint="4–8 digits">
                      <input required type="password" inputMode="numeric" pattern="\d{4,8}" value={payrollPin} onChange={(e) => setPayrollPin(e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Confirm PIN" required>
                      <input required type="password" inputMode="numeric" pattern="\d{4,8}" value={payrollPinConfirmation} onChange={(e) => setPayrollPinConfirmation(e.target.value)} className={inputClass} />
                    </Field>
                    <StepFooter className="sm:col-span-2">
                      <SecondaryButton onClick={() => goToStep(1)}>Back</SecondaryButton>
                      <PrimaryButton type="submit" disabled={submitting}>
                        {submitting ? "Saving…" : "Save and continue"}
                      </PrimaryButton>
                    </StepFooter>
                  </form>
                ) : null}

                {step === 3 ? (
                  <div className="flex flex-col gap-4">
                    <Segmented
                      label="How to add employees"
                      options={[
                        { value: "manual", label: "Add one by one" },
                        { value: "csv", label: "Import a CSV" },
                      ]}
                      value={employeeMode}
                      onChange={setEmployeeMode}
                      className="self-start"
                    />
                    {employeeMode === "manual" ? (
                      <form onSubmit={handleEmployeeManualSubmit} className="grid gap-4 sm:grid-cols-2">
                        <Field label="Name" required>
                          <input required value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} className={inputClass} />
                        </Field>
                        <Field label="Email" required>
                          <input required type="email" value={employeeEmail} onChange={(e) => setEmployeeEmail(e.target.value)} className={inputClass} />
                        </Field>
                        <Field label="Salary" required>
                          <input required type="number" min="0" step="0.01" value={employeeSalary} onChange={(e) => setEmployeeSalary(e.target.value)} className={inputClass} />
                        </Field>
                        <Field label="Salary type" required>
                          <Select value={employeeSalaryType} onChange={(e) => setEmployeeSalaryType(e.target.value as "monthly" | "hourly")}>
                            <option value="monthly">Monthly</option>
                            <option value="hourly">Hourly</option>
                          </Select>
                        </Field>
                        <Field label="Role" className="sm:col-span-2">
                          <Select value={employeeRole} onChange={(e) => setEmployeeRole(e.target.value as UserRole)}>
                            {ROLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </Select>
                        </Field>
                        <div className="sm:col-span-2">
                          <SecondaryButton type="submit" disabled={submitting}>
                            <UserPlus className="h-4 w-4" aria-hidden="true" />
                            Send invitation
                          </SecondaryButton>
                        </div>
                      </form>
                    ) : (
                      <EmployeeCsvImport
                        submitting={submitting}
                        onSubmittingChange={setSubmitting}
                        onStatusChange={setStatus}
                      />
                    )}
                    <OptionalFooter submitting={submitting} onBack={() => goToStep(2)} onSkip={handleSkipOptional} onContinue={() => goToStep(4)} />
                  </div>
                ) : null}

                {step === 4 ? (
                  <div className="flex flex-col gap-4">
                    <form onSubmit={handleTeamSubmit} className="flex flex-wrap items-end gap-3">
                      <Field label="Team name" className="min-w-0 flex-[1_1_15rem]">
                        <input placeholder="e.g. Creative" value={teamName} onChange={(e) => setTeamName(e.target.value)} className={inputClass} />
                      </Field>
                      <SecondaryButton type="submit" disabled={submitting || !teamName.trim()}>
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Add team
                      </SecondaryButton>
                    </form>
                    {teamsCreated.length > 0 ? <CreatedList items={teamsCreated} /> : null}
                    <OptionalFooter submitting={submitting} onBack={() => goToStep(3)} onSkip={handleSkipOptional} onContinue={() => goToStep(5)} />
                  </div>
                ) : null}

                {step === 5 ? (
                  <div className="flex flex-col gap-4">
                    <form onSubmit={handleProjectSubmit} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                      <Field label="Project name" required>
                        <input required value={projectName} onChange={(e) => setProjectName(e.target.value)} className={inputClass} />
                      </Field>
                      <Field label="Client" required>
                        <input required value={projectClient} onChange={(e) => setProjectClient(e.target.value)} className={inputClass} />
                      </Field>
                      <SecondaryButton type="submit" disabled={submitting}>
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Add project
                      </SecondaryButton>
                    </form>
                    {projectsCreated.length > 0 ? <CreatedList items={projectsCreated} /> : null}
                    <OptionalFooter
                      submitting={submitting}
                      onBack={() => goToStep(4)}
                      onSkip={handleSkipOptional}
                      onContinue={() => void handleFinish()}
                      continueLabel="Finish setup"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const STEP_HEADINGS: Record<number, string> = {
  1: "Name your workspace",
  2: "Protect payroll with a PIN",
  3: "Invite your team",
  4: "Create teams",
  5: "Add your first projects",
};

function Field({
  label,
  required = false,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
        {label}
        {required ? <span className="text-[var(--danger)]"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}

function Notice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "mb-4 rounded-xl border px-4 py-2.5 text-sm",
        tone === "error"
          ? "border-[var(--accent-coral)]/30 bg-[var(--accent-coral-soft)] text-[var(--danger)]"
          : "border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]",
      )}
    >
      {children}
    </div>
  );
}

function CreatedList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((name) => (
        <li
          key={name}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-emerald-soft)] px-3 py-1 text-[0.8125rem] font-medium text-[var(--accent-emerald)]"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {name}
        </li>
      ))}
    </ul>
  );
}

function StepFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-5", className)}>
      {children}
    </div>
  );
}

function PrimaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:opacity-60",
        className,
      )}
    />
  );
}

function SecondaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-4 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--accent-sand)] disabled:opacity-60",
        className,
      )}
    />
  );
}

function OptionalFooter({
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
    <StepFooter>
      <SecondaryButton onClick={onBack}>Back</SecondaryButton>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={submitting}
          onClick={onSkip}
          className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-medium text-[var(--muted)] hover:bg-[var(--accent-sand)] hover:text-[var(--foreground)] disabled:opacity-60"
        >
          Skip for now
        </button>
        <PrimaryButton disabled={submitting} onClick={onContinue}>
          {continueLabel}
        </PrimaryButton>
      </div>
    </StepFooter>
  );
}
