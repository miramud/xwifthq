/*
  Money on screen. The API speaks integer minor units plus a currency code
  (kobo for NGN, cents for USD); people read and type major units. Every
  billing and pricing screen formats and parses through here, so ₦ and $ are
  never divided, rounded or labelled differently from one screen to the next.
*/

export type CurrencyCode = "NGN" | "USD" | (string & {});

/** Minor units per major unit. Both currencies the platform sells in use 100. */
const MINOR_PER_MAJOR = 100;

const LOCALE: Record<string, string> = { NGN: "en-NG", USD: "en-US" };

/**
 * `₦2,500,000` / `$10,500` — whole amounts without decimals, anything with a
 * fractional part to two places. Unknown or missing amounts read "—".
 */
export function formatMoney(minor: number | null | undefined, currency: CurrencyCode = "NGN"): string {
  if (minor === null || minor === undefined || Number.isNaN(minor)) return "—";
  const code = (currency || "NGN").toUpperCase();
  try {
    return new Intl.NumberFormat(LOCALE[code] ?? "en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: minor % MINOR_PER_MAJOR === 0 ? 0 : 2,
      maximumFractionDigits: minor % MINOR_PER_MAJOR === 0 ? 0 : 2,
    }).format(minor / MINOR_PER_MAJOR);
  } catch {
    // An exotic code Intl doesn't know: still readable, never a crash.
    return `${code} ${(minor / MINOR_PER_MAJOR).toLocaleString("en-US")}`;
  }
}

/** Compact form for dense tables and chart axes: `₦2.5M`, `$10.5K`. */
export function formatMoneyCompact(minor: number | null | undefined, currency: CurrencyCode = "NGN"): string {
  if (minor === null || minor === undefined || Number.isNaN(minor)) return "—";
  const code = (currency || "NGN").toUpperCase();
  try {
    return new Intl.NumberFormat(LOCALE[code] ?? "en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      notation: "compact",
      // Currency style defaults to two decimals; without the minimum the
      // one-digit cap still prints "₦5.0M".
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(minor / MINOR_PER_MAJOR);
  } catch {
    return formatMoney(minor, code);
  }
}

/** The currency's symbol alone, for input adornments. */
export function currencySymbol(currency: CurrencyCode): string {
  const code = (currency || "NGN").toUpperCase();
  if (code === "NGN") return "₦";
  if (code === "USD") return "$";
  return code;
}

/** Major units as editable text: 250000000 → "2500000", 1050050 → "10500.50". */
export function majorText(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "";
  const whole = Math.trunc(minor / MINOR_PER_MAJOR);
  const frac = Math.abs(minor % MINOR_PER_MAJOR);
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0")}`;
}

/**
 * Typed major units to minor. Blank → null. Commas, spaces and a leading ₦ or
 * $ are forgiven, because prices get pasted from spreadsheets. Anything that
 * is not a non-negative amount with at most two decimals is "invalid".
 * Integer maths throughout: 19.99 × 100 in floating point is 1998.999….
 */
export function parseMajor(text: string): number | null | "invalid" {
  const cleaned = text.replace(/[₦$,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return "invalid";
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * MINOR_PER_MAJOR + Number(frac.padEnd(2, "0"));
}
