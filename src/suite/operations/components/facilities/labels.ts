import { Building2, Droplets, Flame, Fuel, Globe, Recycle, Zap, type LucideIcon } from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import type { ContractFull, DieselEntry, Lease, LeaseFrequency, SpaceKind } from "@/lib/api/operations-facilities-client";

/*
  Words, colours and arithmetic the facilities screens share: kinds and
  utilities, the rent schedule a lease will run, a contract's months, the
  diesel tank's level over time, and the times of a room booking.
*/

/* ------------------------------- kinds ------------------------------- */

export const KIND_HUE: Record<string, Hue> = { campus: "grape", office: "blue", site: "coral", warehouse: "sun" };
export const kindHue = (k: string | null | undefined): Hue => KIND_HUE[k ?? ""] ?? "slate";

export const SPACE_KINDS: Record<SpaceKind, string> = {
  meeting_room: "Meeting room",
  office: "Office",
  lab: "Lab",
  store: "Store",
  hall: "Hall",
  other: "Other",
};

export const LEASE_FREQUENCIES: Record<LeaseFrequency, { label: string; months: number }> = {
  monthly: { label: "Monthly", months: 1 },
  quarterly: { label: "Quarterly", months: 3 },
  biannual: { label: "Twice a year", months: 6 },
  annual: { label: "Yearly", months: 12 },
};

export const UTILITY_KINDS: Record<string, string> = { electricity: "Electricity", water: "Water", waste: "Waste", internet: "Internet", other: "Other" };

/** Every spend line, diesel included, in the order the charts stack them. */
export const SPEND_KINDS: { key: string; label: string; hue: Hue; icon: LucideIcon }[] = [
  { key: "electricity", label: "Electricity", hue: "sun", icon: Zap },
  { key: "diesel", label: "Diesel", hue: "coral", icon: Fuel },
  { key: "water", label: "Water", hue: "sky", icon: Droplets },
  { key: "internet", label: "Internet", hue: "grape", icon: Globe },
  { key: "waste", label: "Waste", hue: "mint", icon: Recycle },
  { key: "other", label: "Other", hue: "slate", icon: Flame },
];

export function spendKind(key: string) {
  return SPEND_KINDS.find((k) => k.key === key) ?? { key, label: key, hue: "slate" as Hue, icon: Building2 };
}

export const PAID_VIA: Record<string, string> = { card: "Company card", advance: "Cash advance", po: "Purchase order", cash: "Petty cash" };

/* ------------------------------- dates ------------------------------- */

const MS_DAY = 86_400_000;

const utc = (ymd: string) => {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
};

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / MS_DAY);
}

export function addDaysYmd(ymd: string, n: number): string {
  return new Date(utc(ymd) + n * MS_DAY).toISOString().slice(0, 10);
}

/** Add months, clamping the day to the month's end (Carbon's `addMonthsNoOverflow`). */
export function addMonthsYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}

/** `2026-09` plus months. */
export function addMonthsYm(ym: string, n: number): string {
  return addMonthsYmd(`${ym}-01`, n).slice(0, 7);
}

/** Whole months between two dates (Carbon's `diffInMonths`, floor). */
export function monthsBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  let n = (by - ay) * 12 + (bm - am);
  if (bd < ad) n -= 1;
  return Math.max(0, n);
}

/** "in 12 days", "today", "3 days ago". */
export function relDays(n: number): string {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/** Days to expiry, said in the unit a person thinks in. */
export function leftText(days: number): string {
  if (days < 0) return `Ended ${-days} ${-days === 1 ? "day" : "days"} ago`;
  if (days === 0) return "Ends today";
  if (days < 120) return `${days} ${days === 1 ? "day" : "days"} left`;
  const months = Math.round(days / 30.4);
  return months < 24 ? `${months} months left` : `${(days / 365).toFixed(1)} years left`;
}

/* ------------------------------- leases ------------------------------ */

/** The rent for the instalment due on a date, as `Facilities::rentDue` works it out. */
export function rentOn(lease: Pick<Lease, "rent" | "serviceCharge" | "escalationBp" | "escalationEveryMonths" | "startsOn">, on: string): number {
  const every = lease.escalationEveryMonths ?? 0;
  const steps = lease.escalationBp > 0 && every > 0 ? Math.floor(monthsBetween(lease.startsOn, on) / every) : 0;
  let rent = lease.rent;
  for (let i = 0; i < steps; i++) rent *= 1 + lease.escalationBp / 10_000;
  return Math.round(rent) + (lease.serviceCharge ?? 0);
}

export interface Instalment {
  dueOn: string;
  amount: number;
  /** Paid, memo raised, or still to come. */
  state: "raised" | "upcoming";
  memoStatus: string | null;
  /** Higher than the instalment before: an escalation step. */
  stepUp: boolean;
}

/**
 * The rent schedule a lease runs: what has been raised (newest twelve on
 * record) and every instalment still to come to the end of the term.
 */
export function rentSchedule(lease: Lease): Instalment[] {
  const step = LEASE_FREQUENCIES[lease.frequency]?.months ?? 12;
  const raised: Instalment[] = [...lease.payments]
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
    .map((p) => ({ dueOn: p.dueOn, amount: p.amount, state: "raised", memoStatus: p.memo?.status ?? null, stepUp: false }));
  const upcoming: Instalment[] = [];
  let due = lease.nextDueOn;
  for (let guard = 0; due && due <= lease.endsOn && guard < 240; guard++) {
    if (!raised.some((r) => r.dueOn === due)) upcoming.push({ dueOn: due, amount: rentOn(lease, due), state: "upcoming", memoStatus: null, stepUp: false });
    due = addMonthsYmd(due, step);
  }
  const all = [...raised, ...upcoming];
  return all.map((r, i) => ({ ...r, stepUp: i > 0 && r.amount > all[i - 1].amount }));
}

/** Notice markers before a lease or contract ends: T−120, T−90, T−30. */
export const EXPIRY_MARKERS = [120, 90, 30] as const;

/** Where something ending on `endsOn` stands against the markers. */
export function expiryStage(daysLeft: number): { label: string; hue: Hue } {
  if (daysLeft < 0) return { label: "Ended", hue: "slate" };
  if (daysLeft <= 30) return { label: "Ends within 30 days", hue: "rose" };
  if (daysLeft <= 90) return { label: "Within 90 days", hue: "coral" };
  if (daysLeft <= 120) return { label: "Within 120 days", hue: "sun" };
  return { label: "Running", hue: "mint" };
}

/* ----------------------------- timelines ----------------------------- */

export interface Window {
  from: string;
  to: string;
}

/** Percent of the way across a window. */
export function percentAt(ymd: string, w: Window): number {
  const span = utc(w.to) - utc(w.from) || 1;
  return Math.max(0, Math.min(100, ((utc(ymd) - utc(w.from)) / span) * 100));
}

/** The first of each month inside a window, thinned so at most `max` show. */
export function monthTicks(w: Window, max = 8): { date: string; label: string }[] {
  const out: { date: string; label: string }[] = [];
  let d = `${w.from.slice(0, 7)}-01`;
  if (d < w.from) d = addMonthsYmd(d, 1);
  for (; d <= w.to; d = addMonthsYmd(d, 1)) out.push({ date: d, label: shortMonth(d) });
  const every = Math.max(1, Math.ceil(out.length / max));
  return out.filter((_, i) => i % every === 0);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-09-01` → `Sep 26`. */
export function shortMonth(ymd: string): string {
  const [y, m] = ymd.split("-").map(Number);
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

/** `2026-09` → `Sep`; with the year when asked. */
export function monthAbbr(ym: string, withYear = false): string {
  const [y, m] = ym.split("-").map(Number);
  return withYear ? `${MONTHS[m - 1]} ${y}` : MONTHS[m - 1];
}

/* ----------------------------- contracts ----------------------------- */

export type MonthState = "confirmed" | "disputed" | "to_confirm" | "not_started" | "running" | "ended";

export const MONTH_STATE: Record<MonthState, { label: string; hue: Hue }> = {
  confirmed: { label: "Confirmed and paid", hue: "mint" },
  disputed: { label: "Disputed", hue: "rose" },
  to_confirm: { label: "To confirm", hue: "sun" },
  running: { label: "This month", hue: "sky" },
  not_started: { label: "Not started", hue: "slate" },
  ended: { label: "After the contract", hue: "slate" },
};

/** Twelve months ending this one, each with where the contract stands for it. */
export function contractMonths(c: ContractFull, today: string, count = 12): { month: string; state: MonthState }[] {
  const thisMonth = today.slice(0, 7);
  return Array.from({ length: count }, (_, i) => addMonthsYm(thisMonth, i - count + 1)).map((month) => {
    const conf = c.confirmations.find((x) => x.period === month);
    if (conf) return { month, state: conf.status === "disputed" ? "disputed" : "confirmed" };
    if (c.toConfirm.includes(month)) return { month, state: "to_confirm" };
    if (`${month}-31` < c.startsOn) return { month, state: "not_started" };
    if (`${month}-01` > c.endsOn) return { month, state: "ended" };
    if (month === thisMonth) return { month, state: "running" };
    return { month, state: "to_confirm" };
  });
}

/* ------------------------------- diesel ------------------------------ */

/** The tank's level after each entry, oldest first, ending on today's level. */
export function tankLevels(entries: DieselEntry[], tankNow: number): { date: string; level: number }[] {
  const asc = [...entries].sort((a, b) => a.enteredOn.localeCompare(b.enteredOn) || a.id.localeCompare(b.id));
  const delta = asc.reduce((s, e) => s + (e.kind === "diesel_in" ? e.litres : -e.litres), 0);
  let level = tankNow - delta;
  const out: { date: string; level: number }[] = [];
  for (const e of asc) {
    level += e.kind === "diesel_in" ? e.litres : -e.litres;
    const last = out[out.length - 1];
    if (last && last.date === e.enteredOn) last.level = round1(level);
    else out.push({ date: e.enteredOn, level: round1(level) });
  }
  return out;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function litres(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return `${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 1 }).format(n)} L`;
}

/* ------------------------------- times ------------------------------- */

const pad = (n: number) => String(n).padStart(2, "0");

/** A local date and `HH:MM` as an ISO instant with this browser's offset. */
export function localIso(ymd: string, hm: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  const dt = new Date(y, m - 1, d, h, mi || 0, 0);
  const off = -dt.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return `${ymd}T${pad(h)}:${pad(mi || 0)}:00${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

/** The local `YYYY-MM-DD` of an instant. */
export function localYmd(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The local `HH:MM` of an instant. */
export function localHm(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Minutes since midnight of an instant, local. */
export function minuteOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** Minutes since midnight, now. */
export function nowMinute(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** The Monday of the week a day falls in. */
export function mondayOf(ymd: string): string {
  const dow = (new Date(`${ymd}T12:00:00`).getDay() + 6) % 7;
  return addDaysYmd(ymd, -dow);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** `Wed 7 Oct`. */
export function dayLabel(ymd: string): string {
  const dt = new Date(`${ymd}T12:00:00`);
  return `${WEEKDAYS[dt.getDay()]} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

/** `Wed 7 Oct, 10:00 to 11:30` for a span on one day; both ends in full otherwise. */
export function spanText(startsAt: string, endsAt: string): string {
  const a = localYmd(startsAt);
  const b = localYmd(endsAt);
  return a === b ? `${dayLabel(a)}, ${localHm(startsAt)} to ${localHm(endsAt)}` : `${dayLabel(a)} ${localHm(startsAt)} to ${dayLabel(b)} ${localHm(endsAt)}`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
