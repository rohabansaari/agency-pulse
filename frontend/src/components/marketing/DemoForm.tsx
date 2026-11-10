"use client";

import { vars } from "@/components/marketing/parts";
import { useState, type FormEvent } from "react";

/**
 * Demo request. There is no booking backend yet, so the form opens the
 * visitor's email app with the details filled in, addressed to
 * NEXT_PUBLIC_CONTACT_EMAIL.
 */
export function DemoForm({ contactEmail }: { contactEmail: string }) {
  const [sent, setSent] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const get = (key: string) => String(data.get(key) ?? "").trim();
    const body = [
      `Name: ${get("name")}`,
      `Work email: ${get("email")}`,
      `Agency: ${get("agency")}`,
      `Team size: ${get("size")}`,
      `Tracks time with: ${get("tool")}`,
      "",
      get("notes"),
    ].join("\n");
    const subject = `Demo request: ${get("agency") || get("name")}`;
    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <form className="mk-card mk-rv mk-rv-r" onSubmit={onSubmit} style={vars({ padding: 36, display: "flex", flexDirection: "column", gap: 18, "--d": "300ms" })}>
      <div className="mk-g2" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 16 }}>
        <label className="mk-field">
          Name
          <input name="name" type="text" autoComplete="name" required />
        </label>
        <label className="mk-field">
          Work email
          <input name="email" type="email" autoComplete="email" required />
        </label>
      </div>
      <label className="mk-field">
        Agency
        <input name="agency" type="text" autoComplete="organization" required />
      </label>
      <div className="mk-g2" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 16 }}>
        <label className="mk-field">
          Team size
          <select name="size" defaultValue="11–25">
            <option>1–10</option>
            <option>11–25</option>
            <option>26–50</option>
            <option>51–100</option>
            <option>100+</option>
          </select>
        </label>
        <label className="mk-field">
          You track time with
          <select name="tool" defaultValue="Spreadsheets">
            <option>Spreadsheets</option>
            <option>Another time tracker</option>
            <option>Nothing yet</option>
          </select>
        </label>
      </div>
      <label className="mk-field">
        What should we look at first?
        <textarea name="notes" rows={4} placeholder="For example: which retainers are actually profitable" />
      </label>
      <button type="submit" className="mk-btn mk-btn-primary" style={{ border: 0, cursor: "pointer", font: "inherit", fontWeight: 500 }}>
        Book a 30-minute demo
      </button>
      <p role="status" style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
        {sent
          ? `Your email app should have opened with the request. If it didn't, write to ${contactEmail}.`
          : `This opens your email app with the details filled in, addressed to ${contactEmail}.`}
      </p>
    </form>
  );
}
