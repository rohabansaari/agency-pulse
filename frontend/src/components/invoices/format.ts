import { formatPKR } from "@/lib/currency";
import type { Invoice } from "@/lib/types";

/** "2026-12-04" -> "04/12/2026" without a timezone round trip. */
export function isoToDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : iso;
}

/** "2026-12-04" -> "4 Dec 2026". */
export function isoToLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function money(value: number | null | undefined): string {
  return formatPKR(value === null || value === undefined ? value : Math.round(value * 100) / 100);
}

export function hours(value: number): string {
  return `${(Math.round(value * 100) / 100).toLocaleString("en-PK")}h`;
}

export type InvoiceTone = "default" | "primary" | "success" | "warning" | "danger";

export function statusLabel(invoice: Pick<Invoice, "status" | "overdue" | "amount_paid">): { label: string; tone: InvoiceTone } {
  if (invoice.status === "sent" && invoice.overdue) return { label: "Overdue", tone: "danger" };
  if (invoice.status === "sent" && invoice.amount_paid > 0) return { label: "Part paid", tone: "warning" };
  if (invoice.status === "sent") return { label: "Sent", tone: "primary" };
  if (invoice.status === "paid") return { label: "Paid", tone: "success" };
  if (invoice.status === "void") return { label: "Void", tone: "default" };
  return { label: "Draft", tone: "default" };
}

/** Days until (positive) or since (negative) an ISO date, from today. */
export function daysFromToday(iso: string): number {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const target = new Date(year, month - 1, day).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86_400_000);
}
