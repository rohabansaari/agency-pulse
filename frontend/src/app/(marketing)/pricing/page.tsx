import { Arrow, Heading, PageIntro, Section, Split, vars } from "@/components/marketing/parts";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing — AgencyPulse",
  description: "One price per person who tracks time, with payroll and profitability included.",
};

const PLANS = [
  {
    name: "Starter",
    price: "$5",
    unit: "per person / month",
    blurb: "For studios up to 15 people that want time and approvals in order.",
    features: ["Desktop agent and screenshots", "Manual time with approvals", "Leave and overtime", "Reports and CSV export"],
    featured: false,
  },
  {
    name: "Agency",
    price: "$8",
    unit: "per person / month",
    blurb: "Everything you need to pay people and price your work.",
    features: [
      "Everything in Starter",
      "Payroll in PKR with deductions",
      "Salary advances",
      "Profitability by project and client",
      "Payroll vault PIN",
    ],
    featured: true,
  },
  {
    name: "Group",
    price: "Custom",
    unit: "volume pricing",
    blurb: "Several companies, or more than 100 people.",
    features: ["Everything in Agency", "Several organisations", "Onboarding for your team", "Priority support"],
    featured: false,
  },
];

const FAQ = [
  [
    "Do you take screenshots when the timer is off?",
    "No. The desktop agent records only during a running timer session, and shows a tray icon while it does.",
  ],
  ["Who can see salaries?", "Only admins who enter the payroll PIN. Everyone else sees hours, not pay."],
  [
    "Can we try it without our real data?",
    "Yes. Settings → Sample data loads a full sample company into your own account, and removes it again in one click.",
  ],
  [
    "Does payroll handle EOBI and income tax?",
    "Yes. Set the percentages once; every run applies them, along with any salary advances to repay.",
  ],
  ["Who pays for managers and admins?", "Nobody. You pay for the people who track time."],
];

function Plan({ plan, index }: { plan: (typeof PLANS)[number]; index: number }) {
  const dark = plan.featured;
  const card = (
    <div
      className={dark ? "mk-night" : "mk-card"}
      style={{
        borderRadius: 18,
        padding: 36,
        display: "flex",
        flexDirection: "column",
        gap: 22,
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 22, color: dark ? "#fff" : "var(--foreground)" }}>{plan.name}</span>
        {plan.featured ? (
          <span style={{ fontSize: 12, fontWeight: 500, background: "#9d2a8c", color: "#fff", borderRadius: 999, padding: "4px 10px" }}>
            Most agencies
          </span>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span className="mk-tnum" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.6, color: dark ? "#fff" : "var(--foreground)" }}>
          {plan.price}
        </span>
        <span style={{ fontSize: 15, color: dark ? "var(--night-muted)" : "var(--muted)" }}>{plan.unit}</span>
      </div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: dark ? "var(--night-text)" : "var(--muted)" }}>{plan.blurb}</p>
      <Link href={plan.name === "Group" ? "/demo" : "/register"} className={dark ? "mk-btn mk-btn-primary" : "mk-btn mk-btn-ghost"}>
        {plan.name === "Group" ? "Talk to us" : "Start free trial"} <Arrow />
      </Link>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: "22px 0 0",
          borderTop: `1px solid ${dark ? "var(--night-border)" : "var(--border)"}`,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          fontSize: 15,
          color: dark ? "var(--night-text)" : "var(--foreground)",
        }}
      >
        {plan.features.map((feature) => (
          <li key={feature} style={{ display: "flex", gap: 10 }}>
            <span aria-hidden="true" style={{ color: dark ? "var(--pulse-on-dark)" : "var(--accent-emerald)" }}>
              ✓
            </span>
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="mk-rv" style={vars({ "--d": `${index * 140}ms` })}>
      {plan.featured ? <div className="mk-ring">{card}</div> : card}
    </div>
  );
}

export default function PricingPage() {
  return (
    <>
      <PageIntro
        eyebrow="Pricing"
        title="One price per person. Payroll included."
        lead="No setup fee and no screenshot add-on. Pay for the people who track time; managers and admins who don't track are free. Billed monthly in US dollars."
        actions={false}
      />

      <section className="mk-pad">
        <div className="mk-wrap mk-g3" style={{ gap: 24, alignItems: "stretch" }}>
          {PLANS.map((plan, index) => (
            <Plan key={plan.name} plan={plan} index={index} />
          ))}
        </div>
      </section>

      <Section style={{ paddingBottom: 128 }}>
        <Split columns="minmax(0,4fr) minmax(0,7fr)" align="start">
          <Heading eyebrow="Questions" title="Things people ask before they switch." />
          <div>
            {FAQ.map(([question, answer], index) => (
              <details
                key={question}
                className="mk-faq mk-rv"
                open={index === 0}
                style={vars({ "--d": `${index * 80}ms`, borderTop: "1px solid var(--border)", padding: "22px 0" })}
              >
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p style={{ margin: "12px 0 0", color: "var(--muted)", fontSize: 16, lineHeight: 1.6 }}>{answer}</p>
              </details>
            ))}
          </div>
        </Split>
      </Section>
    </>
  );
}
