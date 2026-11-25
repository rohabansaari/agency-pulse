import type { ReactNode } from "react";

/** Contact details shown on the legal pages. Update these before launch. */
export const LEGAL = {
  company: "AgencyPulse",
  email: "privacy@agencypulse.in",
  city: "Lahore, Pakistan",
};

export function LegalDoc({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mk-pad" style={{ paddingTop: 96, paddingBottom: 96 }}>
      <article className="mk-wrap mk-legal">
        <span className="mk-eyebrow">Legal</span>
        <h1 className="mk-h2" style={{ marginTop: 16 }}>
          {title}
        </h1>
        <p className="mk-legal-updated">Last updated {updated}</p>
        <div className="mk-legal-intro">{intro}</div>
        {children}
      </article>
    </section>
  );
}

export function Clause({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </section>
  );
}
