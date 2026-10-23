import { formatMoneyCompact, type CurrencyCode } from "@/lib/money";

/*
  Money the way an accountant reads it. Finance's API speaks integer minor
  units (kobo, cents) like the rest of the suite; on screen a ledger amount
  always shows two decimals, and a statement column shows negatives in
  brackets with no currency sign on every row.
*/

const fmt2 = new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `₦1,234,500.00` - two decimals always; "-" when unknown. Negatives as `-₦…`. */
export function amount(minor: number | null | undefined, currency: CurrencyCode = "NGN"): string {
  if (minor === null || minor === undefined || Number.isNaN(minor)) return "-";
  const sign = minor < 0 ? "-" : "";
  return `${sign}${symbol(currency)}${fmt2.format(Math.abs(minor) / 100)}`;
}

/** `1,234,500.00` or `(1,234,500.00)` - statement columns; "–" for zero when `dashZero`. */
export function accounting(minor: number | null | undefined, dashZero = false): string {
  if (minor === null || minor === undefined || Number.isNaN(minor)) return "-";
  if (minor === 0 && dashZero) return "-";
  const text = fmt2.format(Math.abs(minor) / 100);
  return minor < 0 ? `(${text})` : text;
}

/** `₦2.5M` for chart axes and dense cards. */
export function compact(minor: number | null | undefined, currency: CurrencyCode = "NGN"): string {
  return formatMoneyCompact(minor, currency);
}

export function symbol(currency: CurrencyCode | null | undefined): string {
  const code = (currency || "NGN").toUpperCase();
  if (code === "NGN") return "₦";
  if (code === "USD") return "$";
  if (code === "GBP") return "£";
  if (code === "EUR") return "€";
  return `${code} `;
}

/**
 * What somebody typed into an amount box, in minor units: "1,234.5" →
 * 123450. Null for anything that isn't an amount (letters, three decimals,
 * empty). Never a float rounding error: the decimals are read as digits.
 */
export function parseAmount(input: string): number | null {
  const t = input.replace(/[,\s₦$£€]/g, "").trim();
  if (t === "") return null;
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(t);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(whole * 100 + frac)) return null;
  return whole * 100 + frac;
}

/** The text an amount box starts with for a stored minor amount ("" for zero/none). */
export function amountInput(minor: number | null | undefined): string {
  if (!minor) return "";
  return (minor / 100).toFixed(2);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-09-03` → `3 Sep 2026`. */
export function day(iso: string | null | undefined): string {
  if (!iso) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** `2026-09` → `September 2026`; `2026-09` short → `Sep 2026`. */
export function monthLabel(key: string, short = false): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  const long = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${short ? MONTHS[m - 1] : long[m - 1]} ${y}`;
}
