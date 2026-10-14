import { PulseLogo } from "@/components/brand/PulseLogo";
import Link from "next/link";
import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Ledger auth layout: night brand panel (desktop) beside a plain form column. */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-[var(--background)] lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[var(--night)] p-14 lg:flex">
        <Link href="/" aria-label="AgencyPulse home" className="self-start">
          <PulseLogo tone="dark" className="text-xl" markClassName="h-9 w-9" />
        </Link>

        <div className="max-w-lg">
          <p className="text-[2.5rem] font-semibold leading-[1.15] tracking-[-0.025em] text-white">
            Time, screenshots and payroll for your agency — in one place.
          </p>
          <svg viewBox="0 0 520 72" className="mt-10 h-16 w-full max-w-[32.5rem]" aria-hidden="true">
            <path
              d="M0 36h150l22-34 30 68 22-34h296"
              fill="none"
              stroke="var(--pulse-on-dark)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className="text-[0.8125rem] text-[var(--night-muted)]">© {new Date().getFullYear()} AgencyPulse</p>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10 lg:justify-center lg:px-16">
        <Link href="/" aria-label="AgencyPulse home" className="self-start lg:hidden">
          <PulseLogo className="text-lg" markClassName="h-8 w-8" />
        </Link>
        <div className="mx-auto mt-14 w-full max-w-[25rem] lg:mt-0">
          <h1 className="text-[1.75rem] font-semibold tracking-[-0.02em] text-[var(--foreground)]">{title}</h1>
          <p className="mt-1.5 text-sm text-[var(--muted)]">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-6 text-center text-sm text-[var(--muted)]">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}

/** @deprecated Use AuthShell instead */
export function AuthCard(props: AuthShellProps) {
  return <AuthShell {...props} />;
}
