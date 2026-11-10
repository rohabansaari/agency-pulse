import { MarketingEffects } from "@/components/marketing/MarketingEffects";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MARKETING_NAV } from "@/components/marketing/nav";
import Link from "next/link";
import type { ReactNode } from "react";
import "./marketing.css";

const ROOT_ID = "mk-root";

function Footer() {
  return (
    <footer className="mk-night mk-pad" style={{ paddingTop: "72px", paddingBottom: "40px" }}>
      <div className="mk-wrap mk-g4" style={{ gridTemplateColumns: "minmax(0,1.6fr) repeat(2,minmax(0,1fr))", gap: 40 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 18 }}>
            Agency<span style={{ color: "var(--pulse-on-dark)" }}>Pulse</span>
          </span>
          <p style={{ margin: 0, maxWidth: 340, fontSize: 15, lineHeight: 1.6, color: "var(--night-muted)" }}>
            Time tracking, approvals, payroll and profitability for agencies that bill by the hour and pay by the
            month.
          </p>
        </div>
        <nav aria-label="Product" style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 15 }}>
          <span style={{ color: "#fff", fontWeight: 600 }}>Product</span>
          {MARKETING_NAV.map((item) => (
            <Link key={item.href} href={item.href} style={{ color: "var(--night-muted)", textDecoration: "none" }}>
              {item.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Account" style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 15 }}>
          <span style={{ color: "#fff", fontWeight: 600 }}>Get started</span>
          <Link href="/demo" style={{ color: "var(--night-muted)", textDecoration: "none" }}>
            Book a demo
          </Link>
          <Link href="/login" style={{ color: "var(--night-muted)", textDecoration: "none" }}>
            Sign in
          </Link>
        </nav>
      </div>
      <div
        className="mk-wrap"
        style={{
          marginTop: 56,
          paddingTop: 24,
          borderTop: "1px solid var(--night-border)",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          fontSize: 13,
          color: "var(--night-muted)",
        }}
      >
        <span>© {new Date().getFullYear()} AgencyPulse</span>
        <span>Product screenshots use the built-in sample company.</span>
      </div>
    </footer>
  );
}

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div id={ROOT_ID} className="mk">
      <MarketingHeader />
      <main>{children}</main>
      <Footer />
      <MarketingEffects rootId={ROOT_ID} />
    </div>
  );
}
