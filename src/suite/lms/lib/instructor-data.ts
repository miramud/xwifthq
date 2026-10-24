/* ------------------------------------------------------------------ */
/*  Instructor studio: shared constants, formatters and types.         */
/*                                                                      */
/*  This module used to fabricate the instructor's whole world (their */
/*  profile, courses, learners, earnings, transactions, Q&A threads,    */
/*  traffic sources and to-do list) from a seeded RNG. Every one of     */
/*  those now comes from the API (`src/lib/api/instructor-client.ts`).   */
/* ------------------------------------------------------------------ */

/*  The revenue split is NOT a constant: an admin sets the platform fee from    */
/*  /admin/settings. Read it with `usePlatformFee()` from `@/lib/auth-store`,    */
/*  or use the `net` / `feePercent` figures the API already computed.            */

/* ---------- formatters ---------- */

export function formatCompactNaira(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `${sign}₦${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}₦${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}₦${(abs / 1_000).toFixed(0)}K`;
  return `${sign}₦${abs.toLocaleString("en-NG")}`;
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-NG");
}

/* ---------- shared status vocabularies ---------- */

export type CourseState = "Published" | "Draft" | "In Review" | "Scheduled";
export type NotifKind = "review" | "message" | "sale" | "payout" | "system" | "milestone";
