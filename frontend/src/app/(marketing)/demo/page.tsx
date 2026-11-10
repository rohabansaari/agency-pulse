import { DemoForm } from "@/components/marketing/DemoForm";
import { Arrow, Crop, Notes, Split, Words } from "@/components/marketing/parts";
import attention from "@/components/marketing/img/crop-attention.webp";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Book a demo — AgencyPulse",
  description: "Thirty minutes, and you'll know your margin by client.",
};

export default function DemoPage() {
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ?? "";

  return (
    <section className="mk-pad" style={{ paddingTop: "88px", paddingBottom: "128px" }}>
      <div className="mk-wrap">
        <Split columns="minmax(0,6fr) minmax(0,5fr)" align="start" gap={64}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <span className="mk-eyebrow mk-fade-in">Book a demo</span>
            <h1 className="mk-h1 mk-h1-lg">
              <Words text="Thirty minutes, and you'll know your margin by client." />
            </h1>
            <div>
              <Notes
                items={[
                  ["We load your structure", "Teams, projects and rates, or the sample company if you'd rather not share yet."],
                  ["You see three views", "Admin, manager and employee, live."],
                  ["We cost one real project", "Bring last month's hours and a salary band."],
                ]}
              />
            </div>
            <Crop src={attention} alt="Profitability alerts from the sample company" style={{ marginTop: 8 }} />
          </div>

          {contactEmail ? (
            <DemoForm contactEmail={contactEmail} />
          ) : (
            <div className="mk-card mk-rv mk-rv-r" style={{ padding: 36, display: "flex", flexDirection: "column", gap: 16 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Already have a workspace?</h2>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 16, lineHeight: 1.6 }}>
                Sign in and load the sample company from Settings → Sample data to explore every screen with realistic
                numbers.
              </p>
              <Link href="/login" className="mk-btn mk-btn-primary">
                Sign in <Arrow />
              </Link>
            </div>
          )}
        </Split>
      </div>
    </section>
  );
}
