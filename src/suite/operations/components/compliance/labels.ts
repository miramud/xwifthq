import {
  Ban,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  Clock,
  FileQuestion,
  PlayCircle,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  type LucideIcon,
} from "lucide-react";
import type { EventStatus } from "@/components/workspace/Calendar";
import { addDays, dayNumber } from "@/components/workspace/calendar-lanes";
import type { Hue } from "@/components/workspace/modules";
import type { CertificateState, ComplianceStage, DueRule, Occurrence } from "@/lib/api/operations-compliance-client";

/* Words, hues and icons for the compliance screens, and the arithmetic of due dates. */

export interface Meta {
  label: string;
  hue: Hue;
  icon: LucideIcon;
}

export const STAGE: Record<ComplianceStage, Meta> = {
  upcoming: { label: "Upcoming", hue: "sky", icon: CalendarClock },
  due_soon: { label: "Due soon", hue: "sun", icon: Clock },
  in_progress: { label: "In progress", hue: "blue", icon: PlayCircle },
  submitted: { label: "Submitted", hue: "grape", icon: Send },
  completed: { label: "Completed", hue: "mint", icon: CircleCheck },
  overdue: { label: "Overdue", hue: "rose", icon: CircleAlert },
  cancelled: { label: "Cancelled", hue: "slate", icon: Ban },
};

export const stageMeta = (s: string | null | undefined): Meta => STAGE[(s ?? "upcoming") as ComplianceStage] ?? STAGE.upcoming;

/** The calendar's four statuses: what needs attention, in its order. */
export function stageToEvent(stage: ComplianceStage): EventStatus {
  if (stage === "overdue") return "overdue";
  if (stage === "completed") return "done";
  if (stage === "upcoming") return "upcoming";
  return "due";
}

export const CERT_STATE: Record<CertificateState, Meta> = {
  valid: { label: "Valid", hue: "mint", icon: ShieldCheck },
  expiring: { label: "Expiring", hue: "sun", icon: ShieldAlert },
  expired: { label: "Expired", hue: "rose", icon: ShieldX },
  missing: { label: "Not on file", hue: "slate", icon: FileQuestion },
};

/** A category's colour, the same on every compliance screen. */
const CATEGORY_HUE: Record<string, Hue> = {
  corporate: "blue",
  tax: "grape",
  employment: "mint",
  procurement: "sky",
  sector: "coral",
  data_protection: "rose",
  quality: "sun",
  premises: "slate",
  fleet: "sky",
  insurance: "mint",
  contracts: "coral",
};

export const categoryHue = (c: string | null | undefined): Hue => CATEGORY_HUE[c ?? ""] ?? "slate";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }));

/** How the due date is worked out, in a sentence fragment. */
export function dueRuleText(rule: DueRule | null | undefined, frequency?: string): string {
  if (frequency === "on_change") return "Whenever something changes";
  if (!rule) return "Set by hand";
  switch (rule.type) {
    case "day_of_month":
      return `Day ${rule.day ?? 10} of ${rule.offsetMonths ? "the following month" : "each month"}`;
    case "annual_date":
      return `${rule.day ?? 31} ${MONTHS[(rule.month ?? 12) - 1] ?? ""} each year`;
    case "after_fy_end":
      return `${rule.months ?? 6} months after the year end`;
    case "expiry":
      return "When the certificate expires";
    default:
      return "Set by hand";
  }
}

/** `t-30` → "30 days before"; `overdue` → "Overdue notice". */
export function reminderText(kind: string): string {
  if (kind === "overdue") return "Overdue notice";
  const m = /^t-(\d+)$/.exec(kind);
  if (m) return m[1] === "1" ? "1 day before" : `${m[1]} days before`;
  return kind;
}

/** Whole days from `from` to `to` (both `YYYY-MM-DD`); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to.slice(0, 10)) - dayNumber(from.slice(0, 10));
}

/** "Due today", "Due in 12 days", "14 days late", for an open occurrence. */
export function dueText(dueOn: string | null, today: string, stage?: ComplianceStage): string {
  if (!dueOn) return "No due date";
  if (stage === "completed") return "Done";
  const d = daysBetween(today, dueOn);
  if (d === 0) return "Due today";
  if (d < 0) return `${-d} ${d === -1 ? "day" : "days"} late`;
  return `Due in ${d} ${d === 1 ? "day" : "days"}`;
}

/** Each obligation's next open occurrence (overdue ones first in time), from the calendar's list. */
export function nextOpen(occurrences: Occurrence[]): Map<string, Occurrence> {
  const out = new Map<string, Occurrence>();
  for (const o of occurrences) {
    if (o.stage === "completed" || o.stage === "cancelled") continue;
    const cur = out.get(o.obligationId);
    if (!cur || (o.dueOn ?? "9999") < (cur.dueOn ?? "9999")) out.set(o.obligationId, o);
  }
  return out;
}

/** The calendar window around a month: six months back, twelve on. */
export function windowAround(year: number, month: number): { from: string; to: string } {
  const start = new Date(year, month - 6, 1);
  const end = new Date(year, month + 13, 0);
  const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: f(start), to: f(end) };
}

/** Reminder offsets in the order they go out: furthest first. */
export const sortOffsets = (days: number[]): number[] => [...new Set(days.filter((d) => d > 0 && d <= 365))].sort((a, b) => b - a);

export const DEFAULT_REMINDERS = [60, 30, 14, 7, 1];

/* ------------------------- certificate timeline ------------------------- */

export interface Span {
  start: string;
  end: string;
}

/**
 * The window the certificate ribbon draws: from the earliest issue date to
 * the latest expiry, never less than a year back and a year on from today,
 * never more than three years either way.
 */
export function ribbonWindow(certs: { issuedOn: string | null; expiresOn: string | null }[], today: string): Span {
  let start = addDays(today, -365);
  let end = addDays(today, 365);
  for (const c of certs) {
    if (c.issuedOn && c.issuedOn < start) start = c.issuedOn;
    if (c.expiresOn && c.expiresOn > end) end = c.expiresOn;
  }
  const floor = addDays(today, -3 * 365);
  const ceil = addDays(today, 3 * 365);
  return { start: start < floor ? floor : start.slice(0, 8) + "01", end: end > ceil ? ceil : end };
}

/** Where a date sits across the window, 0–100, clamped. */
export function percentAt(date: string, w: Span): number {
  const total = daysBetween(w.start, w.end);
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (daysBetween(w.start, date) / total) * 100));
}

/** First-of-month ticks across the window, every `step` months. */
export function monthTicks(w: Span, step = 3): { date: string; label: string }[] {
  const out: { date: string; label: string }[] = [];
  const [y, m] = w.start.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  // Start on a quarter so the ticks fall on Jan, Apr, Jul, Oct.
  while (d.getMonth() % step !== 0) d.setMonth(d.getMonth() + 1);
  while (true) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    if (key > w.end) break;
    if (key >= w.start) out.push({ date: key, label: `${MONTHS[d.getMonth()].slice(0, 3)} ${String(d.getFullYear()).slice(2)}` });
    d.setMonth(d.getMonth() + step);
  }
  return out;
}
