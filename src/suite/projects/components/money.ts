/**
 * Rendering money, in one place.
 *
 * **Minor units in, string out, and nothing here ever does arithmetic.** Every
 * amount that crosses the API is an integer number of cents or kobo, precisely
 * so that a project's cost is an exact sum of thousands of rows. Dividing by a
 * hundred is the last thing that happens to a figure, and it happens here, so
 * no screen invents its own rounding.
 */

const SYMBOL: Record<string, string> = {
  NGN: "₦",
  USD: "$",
};

/**
 * `2000, "USD"` → `$20.00`.
 *
 * Whole amounts keep their decimals rather than dropping them: `$20` and
 * `$20.00` in the same column read as different precisions of the same number,
 * and in a cost report they are the same number.
 */
export function money(minor: number, currency: string): string {
  const symbol = SYMBOL[currency] ?? `${currency} `;
  const negative = minor < 0;
  const major = Math.abs(minor) / 100;

  const formatted = major.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${negative ? "−" : ""}${symbol}${formatted}`;
}

/**
 * The same, rounded to whole units for a headline figure.
 *
 * A forecast of `₦41,382,617.00` is a number nobody reads; `₦41,382,617` is.
 * Only for display of a total, never beside a per-row figure it should tally
 * with — a column of rounded rows that does not add up to its own total is
 * worse than a long number.
 */
export function moneyRounded(minor: number, currency: string): string {
  const symbol = SYMBOL[currency] ?? `${currency} `;
  const negative = minor < 0;

  return `${negative ? "−" : ""}${symbol}${Math.round(Math.abs(minor) / 100).toLocaleString("en-NG")}`;
}

/**
 * `2000, "USD"` → `$20.00/h`.
 *
 * A rate and an amount look identical on a screen and mean different things,
 * so the rate carries its unit.
 */
export function rate(minor: number, currency: string): string {
  return `${money(minor, currency)}/h`;
}

/**
 * Hours, as a person writes them.
 *
 * `1.5` rather than `1.50`, and `2` rather than `2.0`: a timesheet is read at a
 * glance and trailing zeros are noise. Minutes are what the API stores; this
 * only ever renders.
 */
export function hours(value: number): string {
  return `${Number(value.toFixed(2))}h`;
}

/**
 * `90` → `1h 30m`.
 *
 * For a single row, where the exact duration is the point. A total uses
 * `hours()` instead, because `137h 45m` is harder to compare than `137.75h`.
 */
export function duration(minutes: number): string {
  const whole = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (whole === 0) return `${rest}m`;
  if (rest === 0) return `${whole}h`;

  return `${whole}h ${rest}m`;
}

/**
 * The major-unit number for an input field.
 *
 * Paired with `toMinor` so a form round-trips exactly: a rate typed as `20.5`
 * becomes 2050 and comes back as `20.5`, never `20.499999`.
 */
export function toMajor(minor: number): string {
  /*
    Trailing zeros stripped consistently. The first version removed `.00` and
    kept `.50`, so 2000 rendered as `20` and 2050 as `20.50` in the same form -
    two precisions for the same kind of number, which reads as a mistake in
    whichever one somebody notices second.
  */
  return (minor / 100).toFixed(2).replace(/\.?0+$/, "");
}

/**
 * `"20.5"` → `2050`.
 *
 * Rounded, because a browser number input will happily hand back `20.499999`
 * and a third of a cent is not a rate anybody set.
 */
export function toMinor(major: string | number): number {
  const value = typeof major === "number" ? major : Number.parseFloat(major);

  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}
