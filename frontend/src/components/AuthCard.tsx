import Link from "next/link";
import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <div className="auth-hero-glow" style={{ top: "10%", left: "10%" }} />
        <div
          className="auth-hero-glow"
          style={{ bottom: "15%", right: "5%", animationDelay: "2s" }}
        />
        <div className="relative z-10 max-w-lg">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white shadow-md">
              AP
            </span>
            AgencyPulse
          </Link>
          <h1 className="mt-10 text-4xl font-bold tracking-tight text-[var(--foreground)]">
            Workforce intelligence for modern agencies
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-[var(--muted)]">
            Track time, manage teams, run payroll, and keep your people aligned — all in one
            premium platform built for how agencies actually work.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-[var(--muted)]">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              Real-time time tracking & screenshots
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              Payroll, leave & advance salary in one place
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-500" />
              Role-based access for every team member
            </li>
          </ul>
        </div>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="text-sm font-semibold text-indigo-600">
              AgencyPulse
            </Link>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white/80 p-8 shadow-lg backdrop-blur-sm dark:bg-zinc-900/80">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              {title}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer ? (
              <div className="mt-6 text-center text-sm text-[var(--muted)]">{footer}</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use AuthShell instead */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <AuthShell title={title} subtitle={subtitle} footer={footer}>
      {children}
    </AuthShell>
  );
}
