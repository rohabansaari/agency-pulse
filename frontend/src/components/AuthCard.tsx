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
        <div className="relative z-10 max-w-lg">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)] shadow-sm">
              AP
            </span>
            <span className="text-heading text-base text-[var(--foreground)]">AgencyPulse</span>
          </Link>
          <h1 className="text-display mt-12 text-4xl text-[var(--foreground)]">
            Workforce intelligence for modern agencies
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-[var(--muted)]">
            Track time, manage teams, run payroll, and keep your people aligned — built for how
            agencies actually work.
          </p>
          <ul className="mt-10 space-y-4 text-sm text-[var(--muted)]">
            {[
              { color: "var(--accent-emerald)", text: "Real-time time tracking & screenshots" },
              { color: "var(--primary)", text: "Payroll, leave & advance salary" },
              { color: "var(--accent-coral)", text: "Role-based team management" },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-3">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: item.color }}
                />
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="text-heading text-sm text-[var(--primary)]">
              AgencyPulse
            </Link>
          </div>
          <div className="ui-card-elevated p-8">
            <h2 className="text-display text-2xl text-[var(--foreground)]">{title}</h2>
            <p className="mt-2 text-body-muted">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-6 text-center text-sm text-[var(--muted)]">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use AuthShell instead */
export function AuthCard(props: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return <AuthShell {...props} />;
}
