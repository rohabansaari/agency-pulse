import { cn } from "@/lib/cn";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/** CSS custom properties on an element (React's style type doesn't know them). */
export function vars(values: Record<string, string | number>): CSSProperties {
  return values as CSSProperties;
}

/** Headline split into words that rise in one after another. */
export function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(" ").map((word, index) => (
        <span key={index}>
          <span className="mk-word" style={vars({ "--i": index })}>
            {word}
          </span>
          {index < text.split(" ").length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}

/** The brand heartbeat: draws itself, then a spark keeps running along it. */
export function Heartbeat() {
  const d = "M0 40 H250 L268 40 L280 14 L296 58 L312 6 L328 48 L340 40 H470 L482 32 L494 40 H720";
  return (
    <svg className="mk-ecg" width="720" height="64" viewBox="0 0 720 64" aria-hidden="true" style={{ maxWidth: "100%", height: "auto" }}>
      <path className="base" d={d} />
      <path className="spark" d={d} />
    </svg>
  );
}

export function Arrow() {
  return (
    <span className="mk-arrow" aria-hidden="true">
      →
    </span>
  );
}

export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mk-link">
      {children} <Arrow />
    </Link>
  );
}

type Pin = [x: number, y: number];

/** A product screenshot in a browser frame, with optional numbered markers. */
export function Shot({
  src,
  alt,
  path,
  pins = [],
  reveal = "mk-rv mk-rv-s",
  tilt = true,
  pan = false,
  delay = 0,
  priority = false,
  sizes = "(max-width: 900px) 100vw, 1280px",
}: {
  src: StaticImageData;
  alt: string;
  path: string;
  pins?: Pin[];
  reveal?: string;
  tilt?: boolean;
  pan?: boolean;
  delay?: number;
  priority?: boolean;
  sizes?: string;
}) {
  const figure = (
    <figure className={cn("mk-shot", tilt && "mk-tilt")}>
      <div className="mk-shot-bar" aria-hidden="true">
        <span style={{ display: "flex", gap: 6 }}>
          <i />
          <i />
        </span>
        <span className="mk-shot-url">agencypulse.app{path}</span>
        <span style={{ width: 24 }} />
      </div>
      {pan ? (
        <div className="mk-pan-box">
          <Image className="mk-pan" src={src} alt={alt} sizes={sizes} placeholder="blur" unoptimized />
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <Image src={src} alt={alt} sizes={sizes} placeholder="blur" unoptimized priority={priority} />
          {pins.map(([x, y], index) => (
            <span key={index} className="mk-pin" style={vars({ left: `${x}%`, top: `${y}%`, "--pd": index })} aria-hidden="true">
              {index + 1}
            </span>
          ))}
        </div>
      )}
      {tilt ? <span className="mk-glare" aria-hidden="true" /> : null}
    </figure>
  );

  return reveal ? (
    <div className={reveal} style={vars({ "--d": `${delay}ms` })}>
      {figure}
    </div>
  ) : (
    figure
  );
}

/** A cropped part of a screen, without the browser frame. */
export function Crop({
  src,
  alt,
  reveal = "mk-rv mk-rv-s",
  delay = 0,
  style,
  sizes = "(max-width: 900px) 100vw, 720px",
}: {
  src: StaticImageData;
  alt: string;
  reveal?: string;
  delay?: number;
  style?: CSSProperties;
  sizes?: string;
}) {
  return (
    <div className={reveal} style={{ ...vars({ "--d": `${delay}ms` }), ...style }}>
      <figure className="mk-crop">
        <Image src={src} alt={alt} sizes={sizes} placeholder="blur" unoptimized />
      </figure>
    </div>
  );
}

/** Numbered notes that explain a screenshot. */
export function Notes({ items, step = 110 }: { items: [title: string, text: ReactNode][]; step?: number }) {
  return (
    <>
      {items.map(([title, text], index) => (
        <div key={title} className="mk-note mk-rv" style={vars({ "--d": `${index * step}ms` })}>
          <span className="mk-num">{index + 1}</span>
          <div>
            <b>{title}</b>
            <p>{text}</p>
          </div>
        </div>
      ))}
    </>
  );
}

export function Heading({
  eyebrow,
  title,
  lead,
  center = false,
  maxWidth = 760,
  as: Tag = "h2",
}: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  center?: boolean;
  maxWidth?: number;
  as?: "h1" | "h2";
}) {
  return (
    <div
      className="mk-rv"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        maxWidth,
        ...(center ? { textAlign: "center", alignItems: "center", margin: "0 auto" } : {}),
      }}
    >
      <span className="mk-eyebrow">{eyebrow}</span>
      <Tag className="mk-h2">{title}</Tag>
      {lead ? (
        <p className="mk-body" style={{ maxWidth: 620 }}>
          {lead}
        </p>
      ) : null}
    </div>
  );
}

/** Page opening for the lighter pages: eyebrow, headline, lead and actions. */
export function PageIntro({
  eyebrow,
  title,
  lead,
  actions = true,
}: {
  eyebrow: string;
  title: string;
  lead: ReactNode;
  actions?: boolean;
}) {
  return (
    <section className="mk-pad" style={{ paddingTop: "96px", paddingBottom: "64px" }}>
      <div className="mk-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 24 }}>
        <span className="mk-eyebrow mk-fade-in">{eyebrow}</span>
        <h1 className="mk-h1 mk-h1-lg" style={{ maxWidth: 980 }}>
          <Words text={title} />
        </h1>
        <p className="mk-lead mk-fade-in" style={vars({ "--d": "600ms", maxWidth: 640 })}>
          {lead}
        </p>
        {actions ? (
          <div className="mk-fade-in" style={vars({ "--d": "800ms", display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" })}>
            <Link href="/register" className="mk-btn mk-btn-primary">
              Start free trial <Arrow />
            </Link>
            <Link href="/demo" className="mk-btn mk-btn-ghost">
              Book a demo
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function Section({
  children,
  id,
  className,
  style,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section id={id} className={cn("mk-pad", className)} style={{ paddingTop: 128, ...style }}>
      <div className="mk-wrap">{children}</div>
    </section>
  );
}

/** Two columns that stack on phones. */
export function Split({
  children,
  columns = "minmax(0,5fr) minmax(0,7fr)",
  align = "center",
  gap = 72,
}: {
  children: ReactNode;
  columns?: string;
  align?: "center" | "start";
  gap?: number;
}) {
  return (
    <div className="mk-g2" style={{ gridTemplateColumns: columns, alignItems: align, gap }}>
      {children}
    </div>
  );
}

export function CtaBand() {
  return (
    <section className="mk-pad" style={{ paddingTop: "128px", paddingBottom: "128px" }}>
      <div
        className="mk-wrap mk-cta mk-night mk-hero mk-rv mk-rv-s"
        style={{
          borderRadius: 24,
          padding: "80px 64px",
          display: "flex",
          flexWrap: "wrap",
          gap: 40,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
          <span className="mk-eyebrow">Your own numbers</span>
          <h2 className="mk-h2">
            See the margin on your biggest client in one call.
          </h2>
          <p className="mk-lead" style={{ fontSize: 18 }}>
            We set up your teams and projects, load the sample company if you&apos;d rather not share yet, and walk
            you through payroll and profitability.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Link href="/register" className="mk-btn mk-btn-primary">
            Start free trial <Arrow />
          </Link>
          <Link href="/demo" className="mk-btn mk-btn-ghost">
            Book a demo
          </Link>
        </div>
      </div>
    </section>
  );
}
