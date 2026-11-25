"use client";

import { PulseLogo } from "@/components/brand/PulseLogo";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/EmptyState";
import { acceptAgreements, ApiError, formatApiErrors } from "@/lib/api";
import type { User } from "@/lib/types";
import { Camera, Clock, KeyboardOff, Lock, MousePointerClick, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

const POINTS: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <Clock className="h-4 w-4" />,
    title: "Your working time",
    text: "When you start, pause and stop the timer, plus any manual time, leave and overtime you add.",
  },
  {
    icon: <Camera className="h-4 w-4" />,
    title: "Screenshots, only while your timer runs",
    text: "The desktop agent takes a screenshot about every 5 minutes. Nothing is captured when the timer is off.",
  },
  {
    icon: <MousePointerClick className="h-4 w-4" />,
    title: "Activity level",
    text: "How many seconds had keyboard or mouse input. After a period with no input, the timer pauses and you choose what to keep.",
  },
  {
    icon: <KeyboardOff className="h-4 w-4" />,
    title: "Never what you type",
    text: "No keystrokes, passwords, microphone or camera are recorded.",
  },
  {
    icon: <Lock className="h-4 w-4" />,
    title: "Who sees it",
    text: "You, your managers and your company's admins. Salaries need the payroll PIN.",
  },
  {
    icon: <Trash2 className="h-4 w-4" />,
    title: "How long",
    text: "Screenshots are deleted after 60 days.",
  },
];

/**
 * Shown before the app the first time someone signs in (and again when the
 * notice changes): the time, activity and screenshot notice, plus the Terms
 * for admins who haven't accepted them yet.
 */
export function AgreementGate({
  user,
  organizationName,
  onAccepted,
  onLogout,
}: {
  user: User;
  organizationName: string | null;
  onAccepted: (user: User) => void;
  onLogout: () => void;
}) {
  const needsTerms = Boolean(user.terms_acceptance_required);
  const [notice, setNotice] = useState(false);
  const [terms, setTerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const ready = notice && (!needsTerms || terms);
  const company = organizationName ?? "your company";

  async function handleAccept() {
    setSaving(true);
    setError("");
    try {
      const response = await acceptAgreements({ monitoring_notice: true, ...(needsTerms ? { terms: true } : {}) });
      onAccepted(response.user);
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Could not save. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="theme-ledger app-layout flex min-h-screen items-center justify-center px-4 py-10">
      <div className="ui-card-elevated w-full max-w-2xl p-6 sm:p-8">
        <PulseLogo className="text-sm" markClassName="h-7 w-7" />
        <h1 className="mt-6 text-xl font-semibold text-[var(--foreground)]">Before you start tracking time</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {company} uses AgencyPulse to record working time for pay, approvals and client billing. Here is exactly what is
          recorded about you.
        </p>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {POINTS.map((point) => (
            <li key={point.title} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-sand)] text-[var(--primary)]">
                {point.icon}
              </span>
              <span>
                <span className="block text-sm font-semibold text-[var(--foreground)]">{point.title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-[var(--muted)]">{point.text}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-sm text-[var(--muted)]">
          Read the full{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-[var(--primary)] hover:underline">
            Privacy Policy
          </Link>
          . Questions about how {company} uses this data are best asked to your manager or HR.
        </p>

        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4">
          <label className="flex items-start gap-2.5 text-sm text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={notice}
              onChange={(event) => setNotice(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
            />
            <span>I have read this notice and agree that my time, activity level and screenshots are recorded while my timer runs.</span>
          </label>
          {needsTerms ? (
            <label className="flex items-start gap-2.5 text-sm text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={terms}
                onChange={(event) => setTerms(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
              />
              <span>
                On behalf of {company}, I agree to the{" "}
                <Link href="/terms" target="_blank" className="font-medium text-[var(--primary)] hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className="font-medium text-[var(--primary)] hover:underline">
                  Privacy Policy
                </Link>
                , and will tell my team that time, activity and screenshots are recorded.
              </span>
            </label>
          ) : null}
        </div>

        {error ? (
          <div className="mt-4">
            <Alert variant="error">{error}</Alert>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onLogout}
            className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Not now, sign out
          </button>
          <Button size="lg" onClick={handleAccept} disabled={!ready || saving}>
            {saving ? "Saving…" : "Agree and continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
