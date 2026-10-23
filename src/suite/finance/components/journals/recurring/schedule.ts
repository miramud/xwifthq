import { CheckCircle2, CircleSlash, Clock, PauseCircle, PlayCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import type { RecurringFrequency, RecurringRunStatus, RecurringStatus } from "@/lib/api/finance-recurring-client";

/*
  A recurring journal's schedule, as the API counts it
  (`RecurringJournals::occurrence`): occurrence n falls in the start month
  plus n steps - or one step later when the day has already passed in the
  start month - on the chosen day, or the month's last day when it has no
  such day. Kept here for the editor's live preview; the API's dates win.
*/

export const STEP: Record<RecurringFrequency, number> = { monthly: 1, quarterly: 3, annual: 12 };

export const FREQUENCY_LABEL: Record<RecurringFrequency, string> = { monthly: "Monthly", quarterly: "Quarterly", annual: "Annually" };

const pad = (n: number) => String(n).padStart(2, "0");
const daysIn = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

/** `YYYY-MM-DD` of the given month (0-based, may overflow) on `day`, clamped to its last day. */
function onDay(year: number, month0: number, day: number): string {
  const y = year + Math.floor(month0 / 12);
  const m = ((month0 % 12) + 12) % 12;
  return `${y}-${pad(m + 1)}-${pad(Math.min(Math.max(1, day), daysIn(y, m)))}`;
}

/** Occurrence `n` (0-based) of a schedule. */
export function occurrence(startDate: string, frequency: RecurringFrequency, day: number, n: number): string {
  const [y, m] = startDate.split("-").map(Number);
  const first = onDay(y, m - 1, day);
  const offset = first < startDate ? 1 : 0;
  return onDay(y, m - 1 + (n + offset) * STEP[frequency], day);
}

/** The dates a schedule makes, up to `count`, stopping at its end date or number of occurrences. */
export function upcoming(
  s: { startDate: string; frequency: RecurringFrequency; dayOfMonth: number; endDate?: string | null; maxOccurrences?: number | null },
  count = 6,
  from = 0,
): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.startDate) || !s.dayOfMonth) return [];
  const out: string[] = [];
  for (let n = from; out.length < count; n++) {
    if (s.maxOccurrences != null && n >= s.maxOccurrences) break;
    const d = occurrence(s.startDate, s.frequency, s.dayOfMonth, n);
    if (s.endDate && d > s.endDate) break;
    out.push(d);
  }
  return out;
}

const ordinal = (n: number) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};

/** "Monthly on the 15th", "Quarterly on the last day". */
export function scheduleLabel(frequency: RecurringFrequency, day: number): string {
  return `${FREQUENCY_LABEL[frequency]} on the ${day >= 31 ? "last day" : ordinal(day)}`;
}

/** The day-of-month choices: 1-28 as they are, 29 and 30 noting the short months, and the last day. */
export function dayOptions(): { value: string; label: string; hint?: string }[] {
  return [
    ...Array.from({ length: 30 }, (_, i) => i + 1).map((d) => ({
      value: String(d),
      label: ordinal(d),
      hint: d >= 29 ? "Last day in shorter months" : undefined,
    })),
    { value: "31", label: "Last day of the month" },
  ];
}

export const RECURRING_STATUS: Record<RecurringStatus, { label: string; hue: Hue; icon: LucideIcon }> = {
  active: { label: "Active", hue: "mint", icon: PlayCircle },
  paused: { label: "Paused", hue: "sun", icon: PauseCircle },
  ended: { label: "Ended", hue: "slate", icon: CircleSlash },
};

export const RUN_STATUS: Record<RecurringRunStatus, { label: string; hue: Hue; icon: LucideIcon }> = {
  created: { label: "Journal made", hue: "mint", icon: CheckCircle2 },
  pending: { label: "Waiting", hue: "sky", icon: Clock },
  skipped: { label: "Skipped, month locked", hue: "sun", icon: Clock },
  failed: { label: "Refused by the ledger", hue: "rose", icon: TriangleAlert },
};
