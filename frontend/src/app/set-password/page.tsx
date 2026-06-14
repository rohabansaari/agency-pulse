"use client";

import { AuthShell } from "@/components/AuthCard";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/EmptyState";
import { FormField, PasswordInput } from "@/components/ui/Input";
import {
  acceptInvitation,
  ApiError,
  fetchInvitationPreview,
  formatApiErrors,
} from "@/lib/api";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

type Preview = {
  name: string;
  email: string;
  organization_name: string;
  expires_at: string;
};

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setPreviewError("This invitation link is missing a token.");
      setLoadingPreview(false);
      return;
    }

    void fetchInvitationPreview(token)
      .then((response) => setPreview(response.invitation))
      .catch((err) => {
        setPreviewError(
          err instanceof ApiError
            ? formatApiErrors(err.errors) || err.message
            : "This invitation link is invalid or has expired.",
        );
      })
      .finally(() => setLoadingPreview(false));
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    if (password !== passwordConfirmation) {
      setSubmitError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await acceptInvitation(token, password, passwordConfirmation);
      setSuccess(true);
      window.setTimeout(() => router.push("/login"), 2500);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Unable to activate your account.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingPreview) {
    return (
      <AuthShell title="Checking invitation" subtitle="Please wait while we verify your link.">
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </AuthShell>
    );
  }

  if (previewError) {
    return (
      <AuthShell
        title="Invitation unavailable"
        subtitle="This link cannot be used to activate an account."
      >
        <Alert variant="error">{previewError}</Alert>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Ask your administrator to resend the invitation, or contact support if you need help.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-[var(--primary)]">
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell title="Account activated" subtitle="Your AgencyPulse account is ready.">
        <div className="rounded-xl border border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald-soft)] px-4 py-4 text-sm text-[var(--foreground)]">
          <p className="font-medium">Password saved successfully.</p>
          <p className="mt-1 text-[var(--muted)]">Redirecting you to sign in…</p>
        </div>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-[var(--primary)]">
          Sign in now
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set your password"
      subtitle={
        preview
          ? `Activate your ${preview.organization_name} account`
          : "Complete your AgencyPulse setup"
      }
    >
      {preview ? (
        <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm">
          <p className="font-medium text-[var(--foreground)]">{preview.name}</p>
          <p className="text-[var(--muted)]">{preview.email}</p>
        </div>
      ) : null}

      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {submitError ? <Alert variant="error">{submitError}</Alert> : null}

        <FormField label="Password" htmlFor="password" required hint="Minimum 8 characters">
          <PasswordInput
            id="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>

        <FormField label="Confirm password" htmlFor="password-confirmation" required>
          <PasswordInput
            id="password-confirmation"
            required
            minLength={8}
            autoComplete="new-password"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
          />
        </FormField>

        <Button type="submit" disabled={submitting} className="w-full" size="lg">
          {submitting ? "Saving…" : "Activate account"}
        </Button>
      </motion.form>
    </AuthShell>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Set your password" subtitle="Loading invitation…">
          <p className="text-sm text-[var(--muted)]">Please wait…</p>
        </AuthShell>
      }
    >
      <SetPasswordForm />
    </Suspense>
  );
}
