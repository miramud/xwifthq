import { CalendarX2, FolderLock, Gauge, PiggyBank, UserX, type LucideIcon } from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import type { LabourExceptionType, LabourMethod, LabourRunKind, LabourRunStatus } from "@/lib/api/finance-labour-client";

/*
  Words, colours and icons for labour costing. An exception is never colour
  alone: each kind has its own icon and a plain name, and the API's sentence
  says what it means for the money.
*/

export const METHOD: Record<LabourMethod, { label: string; short: string; hint: string }> = {
  standard_hours: {
    label: "Standard hours",
    short: "Standard hours",
    hint: "Each person's cost is spread over the standard month. Hours not logged to a project stay in overhead as bench, so idle time shows.",
  },
  proportional: {
    label: "Proportional to hours logged",
    short: "Proportional",
    hint: "Each person's whole cost follows the hours they logged, however few. Nothing is left on the bench unless nothing was logged.",
  },
};

export const EXCEPTION: Record<LabourExceptionType, { label: string; icon: LucideIcon; hue: Hue }> = {
  no_timesheet: { label: "No timesheet", icon: CalendarX2, hue: "sun" },
  over_120: { label: "Over 120% of standard hours", icon: Gauge, hue: "coral" },
  closed_project: { label: "Hours on a closed project", icon: FolderLock, hue: "rose" },
  no_budget: { label: "Project has no budget", icon: PiggyBank, hue: "grape" },
  not_on_payroll: { label: "Not on this payroll", icon: UserX, hue: "sky" },
};

export function exceptionMeta(type: string): { label: string; icon: LucideIcon; hue: Hue } {
  return EXCEPTION[type as LabourExceptionType] ?? { label: "Check this", icon: Gauge, hue: "slate" };
}

export const RUN_KIND: Record<LabourRunKind, { label: string; hue: Hue; hint: string }> = {
  allocation: { label: "Allocation", hue: "blue", hint: "The month's payroll cost, spread over projects" },
  provisional: { label: "Provisional", hue: "grape", hint: "Hours so far this month at the latest rates, until the month's payroll is in" },
};

export const RUN_STATUS: Record<LabourRunStatus, { label: string; hue: Hue }> = {
  posted: { label: "Posted", hue: "mint" },
  reversed: { label: "Reversed", hue: "slate" },
};

/** `24240` minutes → `404`; `870` → `14.5`. */
export function hoursOf(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

const hoursFmt = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 1 });

/** `404 h`, `14.5 h`. */
export function hoursText(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return "—";
  return `${hoursFmt.format(hours)} h`;
}

/** Basis points as a whole percentage: `1912` → `19%`. */
export function bpText(bp: number | null | undefined): string {
  if (bp === null || bp === undefined || Number.isNaN(bp)) return "—";
  return `${Math.round(bp / 100)}%`;
}

/** A `YYYY-MM` the API will take. */
export function isMonthKey(s: string | null | undefined): s is string {
  return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

/** The month before the current one: the one usually waiting to be allocated. */
export function lastMonth(d = new Date()): string {
  const t = d.getFullYear() * 12 + d.getMonth() - 1;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** Today as `YYYY-MM-DD`, local time. */
export function todayIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
