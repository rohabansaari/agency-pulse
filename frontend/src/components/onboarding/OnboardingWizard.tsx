"use client";

import {
  ApiError,
  completeOnboarding,
  createOnboardingEmployee,
  createProject,
  createWorkTeam,
  fetchOnboardingStatus,
  formatApiErrors,
  importOnboardingEmployees,
  initializePayrollPin,
  onboardingSampleCsvUrl,
  updateOnboardingOrganization,
  updateOnboardingStep,
  updatePassword,
} from "@/lib/api";
import { clearToken, getOrganizationId, getToken } from "@/lib/auth";
import type { OnboardingStatus, UserRole } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

const STEPS = [
  { id: 1, title: "Organization", required: true },
  { id: 2, title: "Payroll PIN", required: true },
  { id: 3, title: "Employees", required: false },
  { id: 4, title: "Teams", required: false },
  { id: 5, title: "Projects", required: false },
  { id: 6, title: "Password", required: false },
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
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<string>("");

  const [teamName, setTeamName] = useState("");
  const [teamsCreated, setTeamsCreated] = useState<string[]>([]);

  const [projectName, setProjectName] = useState("");
  const [projectClient, setProjectClient] = useState("");
  const [projectsCreated, setProjectsCreated] = useState<string[]>([]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const loadStatus = useCallback(async () => {
    const next = await fetchOnboardingStatus();
    setStatus(next);
    setOrgName(next.organization.name ?? "");
    setTimezone(next.organization.timezone ?? "");
    setLogoUrl(next.organization.logo_url ?? "");
    setWebsite(next.organization.website ?? "");
    setStep(next.onboarding_step || 1);

    if (!next.requires_onboarding) {
      router.replace("/dashboard");
    }
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
    await updateOnboardingStep(nextStep).catch(() => undefined);
    setStep(nextStep);
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
      if (next.onboarding_completed) {
        await goToStep(3);
      } else {
        await goToStep(3);
      }
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

  async function handleCsvImport() {
    if (!csvFile) {
      setError("Choose a CSV file to import.");
      return;
    }
    setSubmitting(true);
    setError("");
    setImportResult("");
    try {
      const response = await importOnboardingEmployees(csvFile);
      setStatus(response.status);
      setImportResult(`${response.created} imported. ${response.failed.length} failed.`);
      setCsvFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "CSV import failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadSampleCsv() {
    const token = getToken();
    const organizationId = getOrganizationId();
    const response = await fetch(onboardingSampleCsvUrl(), {
      headers: {
        Accept: "text/csv",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(organizationId ? { "X-Organization-Id": String(organizationId) } : {}),
      },
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "employee-import-sample.csv";
    anchor.click();
    URL.revokeObjectURL(url);
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

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await updatePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setSuccess("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Unable to update password.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkipOptional() {
    setSubmitting(true);
    setError("");
    try {
      if (step < 6) {
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500">Loading onboarding…</p>
      </div>
    );
  }

  const completionPercent = status?.completion_percent ?? 0;
  const current = STEPS.find((item) => item.id === step) ?? STEPS[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 px-4 py-8 dark:from-zinc-950 dark:to-zinc-900">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-400">
              AgencyPulse
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Welcome — let&apos;s set up your workspace</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Complete required steps to unlock your dashboard. Optional steps can be skipped.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Progress</p>
            <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">{completionPercent}%</p>
          </div>
        </div>

        <div className="mb-8 overflow-x-auto">
          <ol className="flex min-w-max gap-2">
            {STEPS.map((item) => {
              const active = item.id === step;
              const done = item.id < step;
              return (
                <li
                  key={item.id}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                    active
                      ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-300"
                      : done
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                  }`}
                >
                  <span>{item.id}.</span>
                  <span>{item.title}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                      item.required ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {item.required ? "Required" : "Optional"}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Step {current.id}: {current.title}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {current.required ? "This step is required before you can use the dashboard." : "You can skip this step and finish later."}
            </p>
          </div>

          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              {success}
            </div>
          ) : null}

          {step === 1 ? (
            <form onSubmit={handleOrganizationSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Organization name *</label>
                <input required value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Timezone</label>
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950">
                  <option value="">Select timezone (optional)</option>
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Company logo URL</label>
                <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Company website</label>
                <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950" />
              </div>
              <ActionRow submitting={submitting} showBack={false} continueLabel="Save & Continue" />
            </form>
          ) : null}

          {step === 2 ? (
            <form onSubmit={handlePayrollPinSubmit} className="space-y-4">
              <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                Payroll PIN protects access to salaries, payroll generation, payroll exports, and salary updates.
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium">PIN *</label>
                <input required type="password" inputMode="numeric" pattern="\d{4,8}" value={payrollPin} onChange={(e) => setPayrollPin(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Confirm PIN *</label>
                <input required type="password" inputMode="numeric" pattern="\d{4,8}" value={payrollPinConfirmation} onChange={(e) => setPayrollPinConfirmation(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950" />
              </div>
              <ActionRow submitting={submitting} onBack={() => goToStep(1)} continueLabel="Save & Continue" />
            </form>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setEmployeeMode("manual")} className={`rounded-lg px-3 py-1.5 text-sm ${employeeMode === "manual" ? "bg-blue-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"}`}>Manual</button>
                <button type="button" onClick={() => setEmployeeMode("csv")} className={`rounded-lg px-3 py-1.5 text-sm ${employeeMode === "csv" ? "bg-blue-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"}`}>CSV import</button>
              </div>
              {employeeMode === "manual" ? (
                <form onSubmit={handleEmployeeManualSubmit} className="space-y-3">
                  <input required placeholder="Name *" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950" />
                  <input required type="email" placeholder="Email *" value={employeeEmail} onChange={(e) => setEmployeeEmail(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input required type="number" min="0" step="0.01" placeholder="Salary *" value={employeeSalary} onChange={(e) => setEmployeeSalary(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950" />
                    <select value={employeeSalaryType} onChange={(e) => setEmployeeSalaryType(e.target.value as "monthly" | "hourly")} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950">
                      <option value="monthly">Monthly</option>
                      <option value="hourly">Hourly</option>
                    </select>
                  </div>
                  <select value={employeeRole} onChange={(e) => setEmployeeRole(e.target.value as UserRole)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950">
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <button type="submit" disabled={submitting} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">Add employee</button>
                </form>
              ) : (
                <div className="space-y-3">
                  <button type="button" onClick={downloadSampleCsv} className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">Download sample CSV</button>
                  <input type="file" accept=".csv,text/csv" onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
                  <button type="button" disabled={submitting || !csvFile} onClick={handleCsvImport} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">Import CSV</button>
                  {importResult ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{importResult}</p> : null}
                </div>
              )}
              <OptionalActions submitting={submitting} onBack={() => goToStep(2)} onSkip={handleSkipOptional} onContinue={() => goToStep(4)} />
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <form onSubmit={handleTeamSubmit} className="flex flex-col gap-3 sm:flex-row">
                <input placeholder="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950" />
                <button type="submit" disabled={submitting || !teamName.trim()} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">Create team</button>
              </form>
              {teamsCreated.length > 0 ? (
                <ul className="text-sm text-zinc-600 dark:text-zinc-400">
                  {teamsCreated.map((name) => (
                    <li key={name}>✓ {name}</li>
                  ))}
                </ul>
              ) : null}
              <OptionalActions submitting={submitting} onBack={() => goToStep(3)} onSkip={handleSkipOptional} onContinue={() => goToStep(5)} />
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-4">
              <form onSubmit={handleProjectSubmit} className="space-y-3">
                <input required placeholder="Project name" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950" />
                <input required placeholder="Client name" value={projectClient} onChange={(e) => setProjectClient(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950" />
                <button type="submit" disabled={submitting} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">Create project</button>
              </form>
              {projectsCreated.length > 0 ? (
                <ul className="text-sm text-zinc-600 dark:text-zinc-400">
                  {projectsCreated.map((name) => (
                    <li key={name}>✓ {name}</li>
                  ))}
                </ul>
              ) : null}
              <OptionalActions submitting={submitting} onBack={() => goToStep(4)} onSkip={handleSkipOptional} onContinue={() => goToStep(6)} />
            </div>
          ) : null}

          {step === 6 ? (
            <div className="space-y-4">
              <form onSubmit={handlePasswordSubmit} className="space-y-3">
                <input required type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950" />
                <input required type="password" minLength={8} placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950" />
                <input required type="password" minLength={8} placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950" />
                <button type="submit" disabled={submitting} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">Update password</button>
              </form>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                <button type="button" onClick={() => goToStep(5)} className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400">Back</button>
                <div className="flex gap-2">
                  <button type="button" disabled={submitting} onClick={handleSkipOptional} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600">Skip</button>
                  <button type="button" disabled={submitting} onClick={handleFinish} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Finish & go to dashboard</button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 text-center">
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
        </div>
      </div>
    </div>
  );
}

function ActionRow({
  submitting,
  onBack,
  showBack = true,
  continueLabel,
}: {
  submitting: boolean;
  onBack?: () => void;
  showBack?: boolean;
  continueLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
      {showBack && onBack ? (
        <button type="button" onClick={onBack} className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400">Back</button>
      ) : (
        <span />
      )}
      <button type="submit" disabled={submitting} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
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
}: {
  submitting: boolean;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
      <button type="button" onClick={onBack} className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400">Back</button>
      <div className="flex gap-2">
        <button type="button" disabled={submitting} onClick={onSkip} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600">Skip</button>
        <button type="button" disabled={submitting} onClick={onContinue} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Save & Continue</button>
      </div>
    </div>
  );
}
