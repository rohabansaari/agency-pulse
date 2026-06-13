/** Display currency — UI always shows PKR; internal values stay decimal strings/numbers. */

export const CURRENCY_CODE = "PKR";
export const CURRENCY_SYMBOL = "Rs.";

const pkrFormatter = new Intl.NumberFormat("en-PK", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Format amount as Pakistani Rupee for display.
 * @example formatPKR(25000) => "Rs. 25,000"
 */
export function formatPKR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") {
    return "—";
  }

  const value = typeof amount === "string" ? Number.parseFloat(amount) : amount;

  if (!Number.isFinite(value)) {
    return "—";
  }

  return `${CURRENCY_SYMBOL} ${pkrFormatter.format(value)}`;
}

/** Compact PKR for tight UI (no symbol prefix variant). */
export function formatPKRCompact(amount: number | string | null | undefined): string {
  const formatted = formatPKR(amount);
  return formatted === "—" ? formatted : formatted.replace(`${CURRENCY_SYMBOL} `, "");
}

export function parseMoney(value: string): number | null {
  const cleaned = value.replace(/[^\d.-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
