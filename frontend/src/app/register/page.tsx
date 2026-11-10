"use client";

import { AuthShell } from "@/components/AuthCard";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/EmptyState";
import { FormField, Input, PasswordInput } from "@/components/ui/Input";
import { ApiError, formatApiErrors, register, resolvePostAuthPath } from "@/lib/api";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const PASSWORD_RULES = [
  { label: "8+ characters", test: (value: string) => value.length >= 8 },
  { label: "a letter", test: (value: string) => /[A-Za-z]/.test(value) },
  { label: "a number", test: (value: string) => /\d/.test(value) },
];

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agency, setAgency] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordOk = PASSWORD_RULES.every((rule) => rule.test(password));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await register({ name, organization_name: agency, email, password, website });
      router.push(await resolvePostAuthPath(response.user.role));
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("Too many sign-ups from this network. Please try again in a little while.");
      } else if (err instanceof ApiError && err.status === 404) {
        setError("New sign-ups are closed right now. Book a demo and we'll set you up.");
      } else if (err instanceof ApiError) {
        setError(formatApiErrors(err.errors) || err.message);
      } else {
        setError("Unable to create your workspace. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your agency workspace"
      subtitle="Free during your trial. You'll set up teams, projects and payroll next."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {error ? <Alert variant="error">{error}</Alert> : null}

        <FormField label="Your name" htmlFor="name" required>
          <Input
            id="name"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>

        <FormField label="Agency name" htmlFor="agency" required>
          <Input
            id="agency"
            required
            minLength={2}
            maxLength={120}
            autoComplete="organization"
            value={agency}
            onChange={(event) => setAgency(event.target.value)}
            placeholder="Lumen Studio"
          />
        </FormField>

        <FormField label="Work email" htmlFor="email" required>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@agency.com"
          />
        </FormField>

        <FormField label="Password" htmlFor="password" required>
          <PasswordInput
            id="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="password-rules"
          />
          <ul id="password-rules" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(password);
              return (
                <li
                  key={rule.label}
                  className={ok ? "flex items-center gap-1 text-[var(--accent-emerald)]" : "flex items-center gap-1 text-[var(--muted)]"}
                >
                  <Check className={ok ? "h-3 w-3" : "h-3 w-3 opacity-30"} aria-hidden="true" />
                  {rule.label}
                </li>
              );
            })}
          </ul>
        </FormField>

        {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </div>

        <Button type="submit" disabled={loading || !passwordOk} className="w-full" size="lg">
          {loading ? "Creating your workspace…" : "Create workspace"}
        </Button>

        <p className="text-center text-xs text-[var(--muted)]">
          You&apos;ll be the admin. Invite your team once you&apos;re in.
        </p>
      </motion.form>
    </AuthShell>
  );
}
