import Link from "next/link";
import { ArrowRight, Clock, Shield, Users } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-dvh" style={{ background: "var(--gradient-surface)" }}>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)] shadow-sm">
            AP
          </span>
          <span className="text-heading text-lg">AgencyPulse</span>
        </div>
        <Link
          href="/login"
          className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm transition hover:bg-[var(--primary-hover)]"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
        <section className="text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card-elevated)] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Premium HR for agencies
          </p>
          <h1 className="text-display mx-auto mt-8 max-w-3xl text-5xl text-[var(--foreground)] sm:text-[3.5rem]">
            Run your workforce with clarity
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
            Time tracking, payroll, leave, and team operations — unified in a warm, thoughtful
            platform designed for people-first agencies.
          </p>
          <div className="mt-12">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-8 py-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-md transition hover:bg-[var(--primary-hover)] hover:shadow-lg"
            >
              Sign in to your workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mt-28 grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: Clock,
              title: "Time & productivity",
              desc: "Track hours, manage projects, and capture screenshots automatically.",
              accent: "var(--accent-emerald)",
            },
            {
              icon: Users,
              title: "People operations",
              desc: "Leave limits, advance salary, and role-based team management.",
              accent: "var(--primary)",
            },
            {
              icon: Shield,
              title: "Secure payroll",
              desc: "PIN-protected vault with custom deductions and increments.",
              accent: "var(--accent-coral)",
            },
          ].map((feature) => (
            <div key={feature.title} className="ui-card-elevated p-7 transition hover:-translate-y-1 hover:shadow-lg">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: `color-mix(in srgb, ${feature.accent} 14%, transparent)` }}
              >
                <feature.icon className="h-5 w-5" style={{ color: feature.accent }} />
              </span>
              <h3 className="text-heading mt-5 text-lg">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{feature.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
