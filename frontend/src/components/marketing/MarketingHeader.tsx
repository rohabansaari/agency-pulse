"use client";

import { MARKETING_NAV } from "@/components/marketing/nav";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/cn";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Pages that open on the dark brand hero, so the header starts dark too. */
const NIGHT_PAGES = new Set(["/", "/product/profitability"]);

function Logo({ night }: { night: boolean }) {
  return (
    <Link href="/" aria-label="AgencyPulse home" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
      <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M12 54 32 10l20 44" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d="M14 39h9l4-7 5 12 4-8 3 3h11"
          fill="none"
          stroke={night ? "var(--pulse-on-dark)" : "var(--primary)"}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span style={{ fontWeight: 600, fontSize: 18, letterSpacing: -0.3 }}>
        Agency<span style={{ color: night ? "var(--pulse-on-dark)" : "var(--primary)" }}>Pulse</span>
      </span>
    </Link>
  );
}

export function MarketingHeader() {
  const pathname = usePathname();
  const night = NIGHT_PAGES.has(pathname);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);

  // Close the phone menu after navigating (adjusting state while rendering, not in an effect).
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("mk-header mk-pad", night && "is-night", scrolled && "is-scrolled")}>
      <Logo night={night} />
      <nav aria-label="Main" className="mk-nav mk-hide-sm">
        {MARKETING_NAV.map((item) => (
          <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <ThemeToggle className="mk-theme" />
        <Link href="/login" className="mk-btn mk-btn-ghost mk-hide-sm">
          Sign in
        </Link>
        <Link href="/demo" className="mk-btn mk-btn-primary mk-hide-sm">
          Book a demo
        </Link>
        <button
          type="button"
          className="mk-menu mk-btn mk-btn-ghost"
          aria-expanded={open}
          aria-controls="mk-mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
          style={{ padding: 10, minWidth: 44 }}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      {open ? (
        <nav
          id="mk-mobile-menu"
          aria-label="Main"
          className="mk-fade-in"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            padding: "12px 20px 24px",
            background: night ? "var(--night)" : "var(--background)",
            borderBottom: `1px solid ${night ? "var(--night-border)" : "var(--border)"}`,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {MARKETING_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              style={{ padding: "12px 0", fontSize: 18, fontWeight: 500, textDecoration: "none" }}
            >
              {item.label}
            </Link>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <Link href="/login" className="mk-btn mk-btn-ghost" style={{ flex: 1 }}>
              Sign in
            </Link>
            <Link href="/demo" className="mk-btn mk-btn-primary" style={{ flex: 1 }}>
              Book a demo
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
