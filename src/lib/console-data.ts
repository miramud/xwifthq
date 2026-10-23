/* ------------------------------------------------------------------ */
/*  Admin dashboard: shared types, formatters and the chart palette.   */
/*                                                                      */
/*  This module used to generate a whole fake platform — courses,       */
/*  students, instructors, payouts, orders, an activity feed and a      */
/*  system-health board — from a seeded RNG. All of it now comes from    */
/*  the API (`src/lib/api/admin-client.ts`), so only the pure pieces     */
/*  remain here.                                                         */
/* ------------------------------------------------------------------ */

/*  The platform fee is admin-managed, so it is never a constant here: every    */
/*  API payload that needs it carries `feePercent` alongside the money it       */
/*  already applied it to.                                                      */

/* ---------- chart palette (on-brand, distinguishable) ---------- */

export const CHART_COLORS = [
  "#9638CD", // Xwift Purple, primary
  "#e6a532", // Summit Gold — accent
  "#6b4e9e", // Signal Violet — secondary
  "#7646A8", // teal, one step light
  "#0ea5e9", // info blue
  "#22c55e", // success green
  "#b7801b", // gold, one step deep
  "#bc7ee6", // violet, one step light
];

/* ---------- formatters ---------- */

/** Compact NGN, e.g. ₦4.4B, ₦82.5M, ₦350K */
export function formatCompactNaira(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `${sign}₦${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}₦${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}₦${(abs / 1_000).toFixed(0)}K`;
  return `${sign}₦${abs.toLocaleString("en-NG")}`;
}

/** Compact count, e.g. 91.5K, 1.2M */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-NG");
}

/** "3m ago", "2h ago", "5d ago" — for feeds and tables. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "-";
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

/** "12 Mar 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ---------- shared status vocabularies ---------- */

export type CourseStatus = "Published" | "Draft" | "Review";
export type EnrollmentStatus = "Active" | "Completed" | "Refunded" | "Pending" | "Cancelled";
export type InstructorAccountStatus = "Active" | "Pending" | "Suspended";
export type AdminPayoutStatus = "Paid" | "Processing" | "Scheduled" | "On hold";
export type OrderStatus = "Paid" | "Pending" | "Failed" | "Refunded" | "Cancelled";
export type ReviewModStatus = "Published" | "Pending" | "Flagged" | "Removed";
export type TicketStatus = "Open" | "Pending" | "Resolved" | "Closed";
export type TicketPriority = "Urgent" | "High" | "Normal" | "Low";
export type AuditSeverity = "info" | "warning" | "critical";
export type ActivityKind = "enrollment" | "completion" | "review" | "payout" | "course";
export type HealthStatus = "operational" | "degraded" | "down";
