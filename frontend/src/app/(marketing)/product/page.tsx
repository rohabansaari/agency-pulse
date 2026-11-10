import { Crop, CtaBand, Heading, MoreLink, Notes, PageIntro, Section, Shot, Split, vars } from "@/components/marketing/parts";
import queue from "@/components/marketing/img/crop-queue.webp";
import employees from "@/components/marketing/img/employees.webp";
import leave from "@/components/marketing/img/leave.webp";
import projects from "@/components/marketing/img/projects.webp";
import reports from "@/components/marketing/img/reports.webp";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Product — AgencyPulse",
  description: "Time tracking that stops when the work stops, approvals before payroll, leave, overtime, projects and reports.",
};

const INDEX = [
  ["track", "Tracking"],
  ["approve", "Approvals"],
  ["leave", "Leave & overtime"],
  ["projects", "Projects"],
  ["people", "People & reports"],
] as const;

export default function ProductPage() {
  return (
    <>
      <PageIntro
        eyebrow="Product · Time & approvals"
        title="The working day, from timer to approved hour."
        lead="A desktop agent that only watches while the timer runs, a manager queue for everything else, and reports your clients will believe."
      />

      <section className="mk-pad">
        <nav aria-label="On this page" className="mk-wrap mk-g4" style={{ gridTemplateColumns: "repeat(5,minmax(0,1fr))", borderTop: "1px solid var(--border)" }}>
          {INDEX.map(([id, label], index) => (
            <a
              key={id}
              href={`#${id}`}
              className="mk-rv"
              style={vars({
                "--d": `${index * 90}ms`,
                textDecoration: "none",
                padding: "20px 20px 20px 0",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              })}
            >
              <span style={{ fontSize: 13, color: "var(--primary)", fontWeight: 500 }}>0{index + 1}</span>
              <span style={{ fontWeight: 500 }}>{label}</span>
            </a>
          ))}
        </nav>
      </section>

      <Section id="track" style={{ paddingTop: 96 }}>
        <Split>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Heading eyebrow="01 · Tracking" title="Tracking that stops when the work stops." />
            <div>
              <Notes
                items={[
                  ["Timer on, agent on", "Screenshots every 5 minutes and activity levels, only during a running session."],
                  ["A tray icon that says so", "People can always see when they're being recorded."],
                  ["Auto-pause", "If the desktop agent stops, the timer pauses instead of counting empty time."],
                ]}
              />
            </div>
          </div>
          <Shot
            src={reports}
            alt="Organisation reports: 212 hours in range, 42.1% utilisation and a per-person breakdown"
            path="/reports"
            pins={[
              [66, 17],
              [60, 66],
            ]}
          />
        </Split>
      </Section>

      <Section id="approve">
        <Split columns="minmax(0,5fr) minmax(0,6fr)">
          <Crop
            src={queue}
            alt="Approval queue: manual time from Bilal Ahmed and Jane Smith with reasons"
            reveal="mk-rv mk-rv-l"
            style={{ maxWidth: 460 }}
            sizes="460px"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Heading eyebrow="02 · Approvals" title="Nothing reaches payroll without a yes." />
            <div>
              <Notes
                items={[
                  ["Manual time with a reason", "“Design review at the client office”: written by the person, read by their manager."],
                  ["Reject with a note", "The entry goes back to the person, not into a spreadsheet."],
                  ["Same queue for leave and overtime", "Managers approve all three in one place."],
                ]}
              />
            </div>
          </div>
        </Split>
      </Section>

      <Section id="leave">
        <Heading
          eyebrow="03 · Leave & overtime"
          title="Balances people can see, limits admins can set."
          lead="Medical, casual and annual leave with per-person limits. Overtime is requested, approved, and paid at your rate in the next run."
        />
        <div style={{ marginTop: 48 }}>
          <Shot src={leave} alt="Leave management: limits by category for each employee" path="/admin/leave" pan />
        </div>
      </Section>

      <Section id="projects">
        <Split>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Heading eyebrow="04 · Projects" title="Projects carry the client, the rate and the budget." />
            <div>
              <Notes
                items={[
                  ["Hourly or fixed fee", "Set a rate per hour, or a fixed fee and a budget in hours."],
                  ["Assign people", "Only assigned people can track time to a project."],
                  ["Dates that matter", "Start and due dates drive the budget-burn warnings."],
                ]}
              />
            </div>
            <div className="mk-rv">
              <MoreLink href="/product/profitability">How budgets turn into margin</MoreLink>
            </div>
            <div className="mk-rv">
              <MoreLink href="/product/invoicing">How hours turn into invoices</MoreLink>
            </div>
          </div>
          <Shot
            src={projects}
            alt="Projects: Brand Refresh, Internal Tools, Mobile App MVP, SEO Audit, Social Media Retainer and Website Redesign"
            path="/projects"
          />
        </Split>
      </Section>

      <Section id="people">
        <Heading eyebrow="05 · People & reports" title="One directory, with every person's hours next to their name." center />
        <div style={{ marginTop: 48 }}>
          <Shot src={employees} alt="Employee directory with roles, teams, status, timers and monthly hours" path="/employees" pan />
        </div>
        <div className="mk-g3" style={{ gap: 40, marginTop: 40 }}>
          <Notes
            items={[
              ["Import from CSV", "Bring your team in from a spreadsheet in one go."],
              ["Roles that match the job", "Admin, manager and employee, each with their own screens."],
              ["Export anything", "Reports and timesheets download as CSV for clients and accountants."],
            ]}
          />
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
