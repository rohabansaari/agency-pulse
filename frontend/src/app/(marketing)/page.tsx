import { Arrow, Crop, CtaBand, Heading, Heartbeat, MoreLink, Notes, Section, Shot, Split, vars, Words } from "@/components/marketing/parts";
import attention from "@/components/marketing/img/crop-attention.webp";
import queue from "@/components/marketing/img/crop-queue.webp";
import dashboard from "@/components/marketing/img/dashboard.webp";
import employeeDashboard from "@/components/marketing/img/employee-dashboard.webp";
import managerDashboard from "@/components/marketing/img/manager-dashboard.webp";
import payroll from "@/components/marketing/img/payroll.webp";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AgencyPulse — Time, payroll and profit for agencies",
  description:
    "AgencyPulse tracks time, routes approvals and runs payroll in rupees, then costs every hour so you see margin by client and project.",
};

const TICKER = [
  "Live timers",
  "Screenshots every 5 min",
  "Manual time with a reason",
  "Leave balances",
  "Overtime approvals",
  "Payroll in PKR",
  "EOBI & income tax",
  "Salary advances",
  "Budget burn",
  "Margin by client",
];

function TickerRow({ hidden = false }: { hidden?: boolean }) {
  return (
    <div style={{ display: "flex" }} aria-hidden={hidden || undefined}>
      {TICKER.map((item, index) => (
        <span key={item} className={index % 2 ? "mk-tick-item is-outline" : "mk-tick-item"}>
          {item}
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M1 9h4l2-6 4 12 2-6h4" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ))}
    </div>
  );
}

const CHAPTERS = [
  {
    eyebrow: "01 · Track & approve",
    title: "Time goes in once, and a manager says yes before it counts.",
    text: "The desktop agent records while the timer runs and stops when it does. Forgotten hours go in by hand with a reason, and land in the manager's queue.",
    href: "/product",
    link: "See time and approvals",
    media: (
      <Crop
        src={queue}
        alt="Approval queue with manual time entries from Bilal Ahmed and Jane Smith and Approve and Reject buttons"
        style={{ maxWidth: 440, marginLeft: "auto" }}
        sizes="440px"
      />
    ),
  },
  {
    eyebrow: "02 · Pay",
    title: "Payroll runs from approved hours only.",
    text: "Pick a period, and AgencyPulse snapshots approved time, paid leave and overtime, takes off tax, EOBI and salary advances, and gives you net pay per person.",
    href: "/product/payroll",
    link: "See payroll",
    media: <Shot src={payroll} alt="Payroll runs page showing 215 hours and net payable of Rs. 208,227.96" path="/payroll" />,
  },
  {
    eyebrow: "03 · Profit",
    title: "Find the client that's losing you money while there's still time to fix it.",
    text: "Every approved hour is costed at the salary of the person who did it, then set against what the project bills. Over-budget work shows up in plain words.",
    href: "/product/profitability",
    link: "See profitability",
    media: (
      <Crop
        src={attention}
        alt="Alerts: Brand Refresh is over budget, Globex Telecom is losing money, SEO Audit is burning budget fast, Website Redesign is the most profitable project"
      />
    ),
  },
];

const ROLES = [
  { src: dashboard, alt: "Admin dashboard", role: "Admin", text: "The whole company: people, payroll, reports and margin." },
  {
    src: managerDashboard,
    alt: "Manager dashboard with team utilisation and an approval queue",
    role: "Manager",
    text: "Their team's hours, plus the approvals waiting on them.",
  },
  {
    src: employeeDashboard,
    alt: "Employee dashboard with a timer, recent sessions and assigned projects",
    role: "Employee",
    text: "A timer, their projects, leave balances and advances.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="mk-night mk-hero mk-pad" style={{ paddingTop: "104px", paddingBottom: "0" }}>
        <div className="mk-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 26 }}>
          <Link
            href="/product/profitability"
            className="mk-fade-in"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              gap: 10,
              alignItems: "center",
              fontSize: 14,
              color: "var(--night-text)",
              border: "1px solid var(--night-border)",
              borderRadius: 999,
              padding: "6px 14px 6px 6px",
            }}
          >
            <span
              style={{
                background: "#9d2a8c",
                color: "#fff",
                borderRadius: 999,
                padding: "3px 10px",
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span className="mk-badge-dot" />
              New
            </span>
            Profitability: see which client is costing you money <Arrow />
          </Link>
          <h1 className="mk-h1 mk-h1-xl" style={{ maxWidth: 1040 }}>
            <Words text="Know what every hour cost, and what it earned." />
          </h1>
          <div style={{ width: "100%", display: "flex", justifyContent: "center", margin: "-6px 0 -10px" }}>
            <Heartbeat />
          </div>
          <p className="mk-lead mk-fade-in" style={vars({ "--d": "900ms", maxWidth: 640 })}>
            AgencyPulse tracks time, routes approvals and runs payroll in rupees, then puts a salary cost on every hour
            so you see margin by client and project while the work is still happening.
          </p>
          <div className="mk-fade-in" style={vars({ "--d": "1100ms", display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" })}>
            <Link href="/register" className="mk-btn mk-btn-primary">
              Start free trial <Arrow />
            </Link>
            <Link href="/demo" className="mk-btn mk-btn-ghost">
              Book a demo
            </Link>
          </div>
          <div className="mk-hero-shot mk-hero-overlap" style={{ width: "100%", marginTop: 40 }}>
            <Shot
              src={dashboard}
              alt="The admin dashboard: hours this week, utilisation, team activity and an approval queue"
              path="/dashboard"
              pins={[
                [28.5, 13],
                [59, 47],
                [76, 41],
              ]}
              reveal=""
              tilt={false}
              priority
            />
          </div>
        </div>
      </section>

      <section className="mk-pad mk-after-hero">
        <div className="mk-wrap mk-g3" style={{ gap: 40 }}>
          <Notes
            items={[
              ["Who is working right now", "Live timers and hours in range, per person and per team."],
              ["Utilisation you can act on", "Tracked against expected hours, so idle capacity is obvious by Wednesday, not month-end."],
              ["Approvals in one queue", "Manual time, leave and overtime wait for a manager before they reach payroll."],
            ]}
          />
        </div>
      </section>

      <section className="mk-pad" style={{ paddingTop: 96 }}>
        <div className="mk-wrap mk-g4 mk-stats" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          {[
            ["5 min", "Screenshot interval, only while a timer runs"],
            ["PKR", "Payroll in rupees with tax, EOBI and advances"],
            ["3 roles", "Admin, manager and employee views"],
            ["1 PIN", "Salaries locked behind a payroll vault"],
          ].map(([value, label], index) => (
            <div
              key={value}
              className="mk-rv"
              style={vars({ "--d": `${index * 120}ms`, padding: "32px 28px", borderLeft: index ? "1px solid var(--border)" : "0" })}
            >
              <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.5 }}>{value}</div>
              <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 15, lineHeight: 1.5 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ paddingTop: 96 }} aria-label="What AgencyPulse covers">
        <div className="mk-ticker">
          <div className="mk-ticker-track">
            <TickerRow />
            <TickerRow hidden />
          </div>
        </div>
      </section>

      {CHAPTERS.map((chapter, index) => {
        const text = (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Heading eyebrow={chapter.eyebrow} title={chapter.title} />
            <p className="mk-body mk-rv" style={vars({ "--d": "120ms", maxWidth: 520 })}>
              {chapter.text}
            </p>
            <div className="mk-rv" style={vars({ "--d": "220ms" })}>
              <MoreLink href={chapter.href}>{chapter.link}</MoreLink>
            </div>
          </div>
        );
        return (
          <Section key={chapter.eyebrow} style={{ paddingTop: 112 }}>
            {index % 2 === 0 ? (
              <Split>
                {text}
                {chapter.media}
              </Split>
            ) : (
              <Split columns="minmax(0,7fr) minmax(0,5fr)">
                {chapter.media}
                {text}
              </Split>
            )}
          </Section>
        );
      })}

      <Section>
        <Heading eyebrow="One app, three views" title="Everyone sees the part of the day that's theirs." center />
        <div className="mk-g3" style={{ gap: 28, marginTop: 56 }}>
          {ROLES.map((item, index) => (
            <div key={item.role} className="mk-rv" style={vars({ "--d": `${index * 150}ms`, display: "flex", flexDirection: "column", gap: 18 })}>
              <Shot src={item.src} alt={item.alt} path="/dashboard" reveal="" sizes="(max-width: 900px) 100vw, 420px" />
              <div>
                <div style={{ fontWeight: 600, fontSize: 19 }}>{item.role}</div>
                <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 15, lineHeight: 1.55 }}>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
