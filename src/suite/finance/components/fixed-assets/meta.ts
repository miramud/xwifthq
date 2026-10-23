import { Ban, CircleCheckBig, CircleDashed, TrendingDown, type LucideIcon } from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import type { AssetClassRow, DepreciationRunRow } from "@/lib/api/finance-assets-client";

/* Fixed assets in the words of the person reading them, and the month grid's arithmetic. Nothing here fetches. */

type Meta = { label: string; hue: Hue; icon: LucideIcon };

export const BOOK_STATUS: Record<string, Meta> = {
  active: { label: "Depreciating", hue: "sky", icon: TrendingDown },
  fully_depreciated: { label: "Fully depreciated", hue: "slate", icon: CircleCheckBig },
  disposed: { label: "Disposed of", hue: "rose", icon: Ban },
};

export const bookStatus = (s: string): Meta => BOOK_STATUS[s] ?? { label: s.replace(/_/g, " "), hue: "slate", icon: CircleDashed };

export const SOURCE_LABEL: Record<string, string> = { manual: "Booked by hand", ops_asset: "Operations register", voucher: "From a voucher" };

/** A stable hue per class key. */
const CLASS_HUE: Record<string, Hue> = { ict: "blue", office_equipment: "sky", furniture: "sun", vehicles: "coral", buildings: "grape", land: "mint" };
export const classHue = (key: string, i = 0): Hue => CLASS_HUE[key] ?? (["mint", "rose", "grape", "sky"] as Hue[])[i % 4];

/** Does a class have the accounts a run (expense and accumulated) and a disposal (cost too) need? */
export function missingAccounts(c: Pick<AssetClassRow, "assetAccount" | "accumulatedAccount" | "expenseAccount">): string[] {
  const out: string[] = [];
  if (!c.assetAccount) out.push("cost");
  if (!c.accumulatedAccount) out.push("accumulated depreciation");
  if (!c.expenseAccount) out.push("depreciation charge");
  return out;
}

export type DepMonthState = "posted" | "open" | "future";

/** Each month of a year, with its posted run if any. Pure, for testing. */
export function depreciationMonths(year: number, runs: DepreciationRunRow[], now: string): { key: string; state: DepMonthState; run: DepreciationRunRow | null }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    const run = runs.find((r) => r.month === key && r.status === "posted") ?? null;
    if (run) return { key, state: "posted" as const, run };
    return { key, state: key > now ? ("future" as const) : ("open" as const), run: null };
  });
}

const addMonths = (key: string, by: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** The month to offer first: the one after the last posted run, else last month; never past this month. */
export function nextMonthToRun(runs: DepreciationRunRow[], now: string): string {
  const posted = runs.filter((r) => r.status === "posted").map((r) => r.month).sort();
  const candidate = posted.length ? addMonths(posted[posted.length - 1], 1) : addMonths(now, -1);
  return candidate > now ? now : candidate;
}
