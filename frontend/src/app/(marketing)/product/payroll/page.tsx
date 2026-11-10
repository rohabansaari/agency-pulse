import { CtaBand, Heading, Notes, PageIntro, Section, Shot, Split, vars } from "@/components/marketing/parts";
import advances from "@/components/marketing/img/advances.webp";
import payroll from "@/components/marketing/img/payroll.webp";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payroll — AgencyPulse",
  description: "Payroll in rupees from approved hours, with tax, EOBI, salary advances and a PIN-locked vault.",
};

const STEPS = [
  ["Time is tracked", "Timer sessions from the desktop agent."],
  ["Exceptions approved", "Manual time, leave and overtime."],
  ["Advances repaid", "Approved advances come off the next payday."],
  ["Run created", "A snapshot of approved hours for the period."],
  ["Finalize & lock", "Export for the bank and the accountant."],
];

export default function PayrollMarketingPage() {
  return (
    <>
      <PageIntro
        eyebrow="Payroll"
        title="Payroll in rupees, from hours someone approved."
        lead="Pick a period. AgencyPulse adds approved time, paid leave and overtime, takes off tax, EOBI and advances, and gives you net pay per person."
      />

      <section className="mk-pad">
        <div className="mk-wrap">
          <Shot
            src={payroll}
            alt="Payroll runs: 215:06 hours, gross Rs. 233,227.96, net Rs. 208,227.96, and payroll settings"
            path="/admin/payroll"
            pins={[
              [81, 6],
              [66, 19],
              [74, 49],
              [40, 78],
            ]}
            delay={900}
            priority
          />
          <div className="mk-g4" style={{ gap: 32, marginTop: 40 }}>
            <Notes
              items={[
                ["Vault unlocked", "Salaries sit behind a payroll PIN. Without it, admins see hours, not pay."],
                ["Gross to net", "Gross pay, deductions and net payable for every run in range."],
                ["Draft, finalize, lock", "Recalculate while it's a draft. Finalize when it's right. Lock it for the books."],
                ["Your rules", "Working days, hours per day, tax, EOBI, social security and a custom deduction."],
              ]}
            />
          </div>
        </div>
      </section>

      <Section>
        <Heading eyebrow="A run, start to finish" title="Five steps, and the first four happen during the month." center />
        <ol className="mk-g4 mk-steps" style={{ gridTemplateColumns: "repeat(5,minmax(0,1fr))", listStyle: "none", padding: 0, margin: "56px 0 0" }}>
          {STEPS.map(([title, text], index) => (
            <li
              key={title}
              className="mk-rv"
              style={vars({
                "--d": `${index * 160}ms`,
                "--i": index,
                padding: "28px 24px",
                background: index === STEPS.length - 1 ? "var(--primary-muted)" : "transparent",
              })}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--primary)" }}>Step {index + 1}</div>
              <div style={{ marginTop: 10, fontWeight: 600, fontSize: 18 }}>{title}</div>
              <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 15, lineHeight: 1.55 }}>{text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <Split>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Heading eyebrow="Salary advances" title="Asked for in the app, paid back on payday." />
            <div>
              <Notes
                items={[
                  ["Requested by the employee", "Amount and reason, like “Family wedding expenses”."],
                  ["Approved by an admin", "One click, with a history of every past advance."],
                  ["Deducted automatically", "The next payroll run takes it off net pay."],
                ]}
              />
            </div>
          </div>
          <Shot
            src={advances}
            alt="Advance salary: John Doe's pending Rs. 40,000 request and Rachel's approved Rs. 25,000"
            path="/admin/advances"
          />
        </Split>
      </Section>

      <CtaBand />
    </>
  );
}
