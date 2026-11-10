import { Crop, CtaBand, Heading, Heartbeat, MoreLink, Notes, Section, Shot, Split, vars, Words } from "@/components/marketing/parts";
import attention from "@/components/marketing/img/crop-attention.jpg";
import projectTable from "@/components/marketing/img/crop-projects.jpg";
import profitability from "@/components/marketing/img/profitability.jpg";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profitability — AgencyPulse",
  description: "Margin by project, client and person, from approved hours costed at real salaries.",
};

const FIGURES = [
  { label: "Revenue", to: 394234, pre: "Rs. ", suf: "", dec: 0, color: "var(--foreground)" },
  { label: "Salary cost", to: 229665, pre: "Rs. ", suf: "", dec: 0, color: "var(--foreground)" },
  { label: "Profit", to: 164569, pre: "Rs. ", suf: "", dec: 0, color: "var(--accent-emerald)" },
  { label: "Margin", to: 41.7, pre: "", suf: "%", dec: 1, color: "var(--primary)" },
];

const FORMULAS = [
  ["Revenue", "billable hours × rate, or fixed fee", "Hourly projects bill by the hour; fixed-fee projects earn their fee once."],
  ["Cost", "hours × (salary ÷ expected hours)", "Each person's own cost per hour, from payroll settings, behind the PIN."],
  ["Margin", "(revenue − cost) ÷ revenue", "Per project, per client, per person, and for the whole period."],
];

function format(value: number, dec: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function ProfitabilityMarketingPage() {
  return (
    <>
      <section className="mk-night mk-hero mk-pad" style={{ paddingTop: "96px", paddingBottom: "112px" }}>
        <div className="mk-wrap">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 24 }}>
            <span className="mk-eyebrow mk-fade-in">Profitability</span>
            <h1 className="mk-h1" style={{ maxWidth: 1000 }}>
              <Words text="Your biggest client might be your least profitable." />
            </h1>
            <Heartbeat />
            <p className="mk-lead mk-fade-in" style={vars({ "--d": "800ms", maxWidth: 660 })}>
              AgencyPulse costs every approved hour at the salary of the person who worked it, and sets it against what
              the project bills. Here&apos;s the sample company, unedited.
            </p>
          </div>
          <div className="mk-g2" style={{ gridTemplateColumns: "minmax(0,8fr) minmax(0,3fr)", gap: 48, marginTop: 64, alignItems: "start" }}>
            <Shot
              src={profitability}
              alt="Profitability page: Rs. 394,234 revenue, Rs. 229,665 salary cost, Rs. 164,569 profit, 41.7% margin, alerts and a per-project table"
              path="/reports/profitability"
              pins={[
                [34, 18],
                [40, 32],
                [60, 33],
                [88, 67],
              ]}
              delay={300}
              priority
            />
            <div>
              <Notes
                items={[
                  ["Revenue, cost, margin", "For any range: this week, this month or your own dates."],
                  ["Plain-language alerts", "Over budget, losing money, burning fast, written as sentences."],
                  ["Client-level loss", "Globex Telecom cost Rs. 59,017 more than it earned."],
                  ["Budget burn vs. time", "A marker shows how much of the timeline has passed."],
                ]}
              />
            </div>
          </div>
        </div>
      </section>

      <Section>
        <Heading eyebrow="How the numbers are worked out" title="No estimates. Approved hours times real salary cost." center />
        <div className="mk-g4 mk-stats" style={{ marginTop: 56, borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          {FIGURES.map((figure, index) => (
            <div
              key={figure.label}
              className="mk-rv"
              style={vars({ "--d": `${index * 120}ms`, padding: "32px 24px", borderLeft: index ? "1px solid var(--border)" : "0" })}
            >
              <div style={{ fontSize: 13, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{figure.label}</div>
              <div
                className="mk-tnum"
                data-to={figure.to}
                data-pre={figure.pre}
                data-suf={figure.suf}
                data-dec={figure.dec}
                style={{ marginTop: 12, fontSize: 44, fontWeight: 600, letterSpacing: -1.6, color: figure.color }}
              >
                {figure.pre}
                {format(figure.to, figure.dec)}
                {figure.suf}
              </div>
            </div>
          ))}
        </div>
        <p className="mk-rv" style={{ margin: "14px 0 0", fontSize: 13, color: "var(--muted)" }}>
          Sample company, 1–10 November.
        </p>
        <div className="mk-g3" style={{ gap: 24, marginTop: 40 }}>
          {FORMULAS.map(([name, formula, text], index) => (
            <div key={name} className="mk-card mk-rv" style={vars({ "--d": `${index * 120}ms`, padding: 28 })}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--primary)" }}>{name}</div>
              <div style={{ marginTop: 14, fontSize: 18, fontWeight: 500, lineHeight: 1.45 }}>{formula}</div>
              <p style={{ margin: "12px 0 0", color: "var(--muted)", fontSize: 15, lineHeight: 1.55 }}>{text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <Split columns="minmax(0,4fr) minmax(0,7fr)">
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Heading eyebrow="Budgets" title="See the overrun three weeks before the work ends." />
            <div>
              <Notes
                items={[
                  ["On track, at risk, over budget", "Budget used against time gone, for every project with a budget."],
                  ["Runs out on…", "At the current pace SEO Audit runs out on 14 Nov, before its 20 Nov due date."],
                  ["Fixed fee, extra hours unbilled", "Brand Refresh used its fee; every hour since is cost only."],
                ]}
              />
            </div>
          </div>
          <Crop src={projectTable} alt="Projects table with hours, revenue, cost, profit, margin and budget bars" sizes="(max-width: 900px) 100vw, 760px" />
        </Split>
      </Section>

      <Section>
        <Split columns="minmax(0,1fr) minmax(0,1fr)" gap={56}>
          <Crop src={attention} alt="What needs attention: four alerts about budgets and margin" />
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Heading
              eyebrow="What needs attention"
              title="Four sentences instead of a spreadsheet."
              lead="Generated from the period's numbers every time you open the page, and ranked by the money at stake."
            />
            <div className="mk-rv">
              <MoreLink href="/demo">See it with your own projects</MoreLink>
            </div>
          </div>
        </Split>
      </Section>

      <CtaBand />
    </>
  );
}
