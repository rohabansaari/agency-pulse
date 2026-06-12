import Link from "next/link";
import { ArrowRight, Clock, Shield, Users } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-dvh bg-[var(--gradient-surface)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-md">
            AP
          </span>
          <span className="text-lg font-semibold tracking-tight">AgencyPulse</span>
        </div>
        <Link
          href="/login"
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--primary-hover)]"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-8">
        <section className="text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-medium text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300">
            Premium HR platform for agencies
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold tracking-tight text-[var(--foreground)] sm:text-6xl">
            Run your agency workforce with clarity
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
            Time tracking, payroll, leave management, and team operations — unified in a
            modern platform designed for agencies that care about their people.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:from-indigo-500 hover:to-violet-500"
            >
              Sign in to your workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mt-24 grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: Clock,
              title: "Time & productivity",
              desc: "Track hours, manage projects, and capture screenshots automatically.",
            },
            {
              icon: Users,
              title: "People operations",
              desc: "Leave limits, advance salary, and role-based team management.",
            },
            {
              icon: Shield,
              title: "Secure payroll",
              desc: "PIN-protected payroll vault with custom deductions and increments.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="ui-card rounded-2xl p-6 transition hover:-translate-y-0.5"
            >
              <feature.icon className="h-8 w-8 text-indigo-500" />
              <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{feature.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
