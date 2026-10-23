import type { Hue } from "@/components/workspace/modules";
import type { KpiSnapshot, ProjectKpis } from "@/lib/api/finance-payments-client";

/*
  Earned value in words and colours (Finance PRD §16.10). Pure functions,
  so the thresholds and the S-curve mapping are tested on their own.
*/

export type Band = "green" | "amber" | "red";

/** CPI and SPI: 0.95 and up is on plan, 0.85 to 0.95 slipping, under 0.85 off plan. */
export function indexBand(v: number | null | undefined): Band | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  if (v >= 0.95) return "green";
  if (v >= 0.85) return "amber";
  return "red";
}

export const BAND: Record<Band, { hue: Hue; word: string }> = {
  green: { hue: "mint", word: "on plan" },
  amber: { hue: "sun", word: "slipping" },
  red: { hue: "rose", word: "off plan" },
};

/** `1.318` → `1.32`; null → `–`. */
export function indexText(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v) ? "-" : v.toFixed(2);
}

/** `6200` → `62%`; null → `–`. */
export function pctText(bp: number | null | undefined): string {
  return bp === null || bp === undefined ? "-" : `${Math.round(bp / 100)}%`;
}

/** `4302` → `43.0%`; null → `–`. */
export function marginText(bp: number | null | undefined): string {
  return bp === null || bp === undefined ? "-" : `${(bp / 100).toFixed(1)}%`;
}

/** Margin of a profit on a value, in basis points; null without a value. */
export function marginBp(profit: number | null | undefined, value: number | null | undefined): number | null {
  if (profit === null || profit === undefined || !value) return null;
  return Math.round((profit / value) * 10_000);
}

export const EAC_METHOD: Record<string, string> = {
  cpi: "Projected from cost efficiency so far",
  remaining_at_budget: "Remaining work assumed at budget (early in the project)",
};

export const PROGRESS_METHOD: Record<string, string> = {
  milestone_weighted: "Milestones accepted, weighted by value",
  work_completion: "Work completed on the project board",
  pm_reported: "Reported by the project manager",
};

/** May somebody report percent complete by hand? Only when the project is measured that way, or has no contract to say otherwise. */
export function reportsProgress(k: Pick<ProjectKpis, "progress" | "hasContract">): boolean {
  return k.progress.method === "pm_reported" || !k.hasContract;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-07-27` → `27 Jul`. */
export function shortDay(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return m && d ? `${d} ${MONTHS[m - 1]}` : iso;
}

type Live = Pick<ProjectKpis, "asOf" | "pv" | "ev" | "ac" | "pctBp" | "progressProfit" | "recognisedProfit" | "projectedProfit" | "cashPosition" | "collected" | "invoiced">;

/**
 * The weekly snapshots, oldest first, with today's live figures as the last
 * point (replacing a snapshot taken today). Snapshots are weekly; today is
 * whatever day it is.
 */
export function withToday(history: KpiSnapshot[], live: Live | null | undefined): (KpiSnapshot & { live?: boolean })[] {
  const past = [...history].sort((a, b) => a.asOf.localeCompare(b.asOf));
  if (!live) return past;
  const today: KpiSnapshot & { live: boolean } = {
    asOf: live.asOf,
    status: past[past.length - 1]?.status ?? "grey",
    pv: live.pv,
    ev: live.ev,
    ac: live.ac,
    pctBp: live.pctBp,
    progressProfit: live.progressProfit,
    recognisedProfit: live.recognisedProfit,
    projectedProfit: live.projectedProfit,
    cashPosition: live.cashPosition,
    collected: live.collected,
    invoiced: live.invoiced,
    live: true,
  };
  return [...past.filter((h) => h.asOf.slice(0, 10) < live.asOf.slice(0, 10)), today];
}

/**
 * The S-curve: planned value, earned value and actual cost at each
 * snapshot, today last and marked.
 */
export function sCurve(history: KpiSnapshot[], live: Live | null | undefined) {
  const points = withToday(history, live);
  const todayIndex = live ? points.length - 1 : -1;
  return {
    labels: points.map((p) => shortDay(p.asOf)),
    pv: points.map((p) => p.pv),
    ev: points.map((p) => p.ev),
    ac: points.map((p) => p.ac),
    todayIndex,
  };
}

/** A figure's last `n` weekly values, today included; gaps (null) dropped. */
export function trend(history: KpiSnapshot[], live: Live | null | undefined, key: "progressProfit" | "recognisedProfit" | "cashPosition" | "projectedProfit", n = 12): number[] {
  return withToday(history, live)
    .slice(-n)
    .map((p) => p[key])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}
