import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Ban,
  CircleCheckBig,
  CircleDashed,
  ClipboardCheck,
  FilePen,
  Hourglass,
  PackageCheck,
  PackageOpen,
  Scale,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import type { CountLine, Requisition, RequisitionLine, StockItem } from "@/lib/api/operations-stores-client";

/*
  Stores in the words of the person reading them, and the arithmetic the
  screens share: where an item sits against its reorder level, what to issue
  by default, a count sheet's variance as it is typed, and which
  requisitions the issue desk takes first. Nothing here fetches.
*/

type Meta = { label: string; hue: Hue; icon: LucideIcon };

const humanise = (s: string) => (s ? (s.charAt(0).toUpperCase() + s.slice(1)).replace(/_/g, " ") : "-");

export const REQUISITION_STATUS: Record<string, Meta> = {
  draft: { label: "Draft", hue: "slate", icon: FilePen },
  in_approval: { label: "In approval", hue: "grape", icon: Hourglass },
  approved: { label: "To issue", hue: "sky", icon: PackageOpen },
  partly_issued: { label: "Part issued", hue: "sun", icon: Scale },
  issued: { label: "Issued", hue: "mint", icon: PackageCheck },
  rejected: { label: "Rejected", hue: "rose", icon: XCircle },
  cancelled: { label: "Cancelled", hue: "slate", icon: Ban },
};

export const requisitionStatus = (s: string): Meta => REQUISITION_STATUS[s] ?? { label: humanise(s), hue: "slate", icon: CircleDashed };

/** Staff read their own requisition a little differently: "to issue" is the store's word. */
export const myRequisitionStatus = (s: string): Meta => (s === "approved" ? { ...REQUISITION_STATUS.approved, label: "Approved" } : requisitionStatus(s));

export const COUNT_STATUS: Record<string, Meta> = {
  counting: { label: "Counting", hue: "sky", icon: ClipboardCheck },
  submitted: { label: "To approve", hue: "sun", icon: Hourglass },
  approved: { label: "Approved", hue: "mint", icon: CircleCheckBig },
  rejected: { label: "Rejected", hue: "rose", icon: XCircle },
};

export const countStatus = (s: string): Meta => COUNT_STATUS[s] ?? { label: humanise(s), hue: "slate", icon: CircleDashed };

export const MOVEMENT: Record<string, Meta> = {
  receipt: { label: "Received", hue: "mint", icon: ArrowDownToLine },
  issue: { label: "Issued", hue: "coral", icon: ArrowUpFromLine },
  transfer_in: { label: "Transfer in", hue: "sky", icon: ArrowLeftRight },
  transfer_out: { label: "Transfer out", hue: "grape", icon: ArrowLeftRight },
  adjustment: { label: "Count adjustment", hue: "sun", icon: Scale },
};

export const movementMeta = (k: string): Meta => MOVEMENT[k] ?? { label: humanise(k), hue: "slate", icon: CircleDashed };

/** Where a reference on the ledger came from. */
export const REF_LABEL: Record<string, string> = { grn: "Goods received", siv: "Store issue", transfer: "Transfer", count: "Stock count", manual: "Received by hand" };

/** A stable hue per category key, so stationery is the same colour everywhere. */
const CATEGORY_HUE: Record<string, Hue> = {
  stationery: "blue",
  toner: "grape",
  refreshments: "sun",
  cleaning: "sky",
  it_accessories: "coral",
  first_aid: "rose",
  branding: "mint",
};
export const categoryHue = (key: string): Hue => CATEGORY_HUE[key] ?? "slate";

/* ------------------------------ levels ------------------------------ */

export type LevelState = "out" | "critical" | "below" | "near" | "healthy" | "untracked";

/**
 * Where an item stands against its reorder level. The gauge scale runs to
 * twice the level, so the reorder tick always sits in the middle.
 */
export function levelOf(item: Pick<StockItem, "onHand" | "reorderLevel" | "critical" | "belowReorder">): { state: LevelState; pct: number; tickPct: number } {
  const level = item.reorderLevel;
  if (level <= 0) return { state: item.onHand <= 0 ? "out" : "untracked", pct: item.onHand > 0 ? 100 : 0, tickPct: 0 };
  const scale = level * 2;
  const pct = Math.max(0, Math.min(100, (item.onHand / scale) * 100));
  if (item.onHand <= 0) return { state: "out", pct: 0, tickPct: 50 };
  if (item.belowReorder || item.onHand <= level) return { state: item.critical ? "critical" : "below", pct, tickPct: 50 };
  if (item.onHand <= level * 1.25) return { state: "near", pct, tickPct: 50 };
  return { state: "healthy", pct, tickPct: 50 };
}

export const LEVEL_META: Record<LevelState, { label: string; hue: Hue }> = {
  out: { label: "Out of stock", hue: "rose" },
  critical: { label: "Critical, below reorder", hue: "rose" },
  below: { label: "Below reorder", hue: "coral" },
  near: { label: "Near reorder", hue: "sun" },
  healthy: { label: "Healthy", hue: "mint" },
  untracked: { label: "No reorder level", hue: "slate" },
};

/* ---------------------------- requisitions --------------------------- */

/** Still to issue on a line. */
export const remaining = (l: Pick<RequisitionLine, "quantity" | "issued">) => Math.max(0, round2(l.quantity - l.issued));

/** What the desk offers to issue: the rest of the line, or what the store holds if that is less. */
export function defaultIssue(l: Pick<RequisitionLine, "quantity" | "issued" | "inStore">): number {
  return Math.max(0, Math.min(remaining(l), round2(l.inStore ?? 0)));
}

/** Is anything still owed on a requisition? */
export const hasShortfall = (r: Pick<Requisition, "lines">) => r.lines.some((l) => remaining(l) > 0);

const DESK_ORDER: Record<string, number> = { approved: 0, partly_issued: 1, in_approval: 2, issued: 3, rejected: 4, cancelled: 5, draft: 6 };

/** The issue desk's order: approved and part issued first, then oldest first within each. */
export function deskOrder<T extends Pick<Requisition, "status" | "createdAt">>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const s = (DESK_ORDER[a.status] ?? 9) - (DESK_ORDER[b.status] ?? 9);
    if (s !== 0) return s;
    const actionable = a.status === "approved" || a.status === "partly_issued";
    const t = (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
    return actionable ? t : -t;
  });
}

/* ------------------------------- counts ------------------------------ */

/** A count line's variance from what is typed: counted less system, and its value at the unit cost. Null until counted. */
export function lineVariance(systemQty: number, counted: number | null, unitCost: number): { qty: number; value: number } | null {
  if (counted === null) return null;
  const q = round2(counted - systemQty);
  return { qty: q, value: Math.round(q * unitCost) };
}

/** A sheet's totals: lines counted, net and absolute value of the variances, and the lines short and over. */
export function countSummary(
  lines: Pick<CountLine, "id" | "systemQty">[],
  counted: Record<string, number | null>,
  unitCost: (lineId: string) => number,
): { counted: number; total: number; net: number; gross: number; short: number; over: number } {
  let n = 0;
  let net = 0;
  let gross = 0;
  let short = 0;
  let over = 0;
  for (const l of lines) {
    const v = lineVariance(l.systemQty, counted[l.id] ?? null, unitCost(l.id));
    if (!v) continue;
    n++;
    net += v.value;
    gross += Math.abs(v.value);
    if (v.qty < 0) short++;
    else if (v.qty > 0) over++;
  }
  return { counted: n, total: lines.length, net, gross, short, over };
}

/** Unit cost behind an already-valued line, when the item master isn't loaded. */
export function impliedUnitCost(l: Pick<CountLine, "variance" | "varianceValue">): number {
  return l.variance && l.varianceValue != null ? Math.abs(Math.round(l.varianceValue / l.variance)) : 0;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Group items' value by category for the chart, biggest first. */
export function valueByCategory(items: Pick<StockItem, "category" | "value">[], labels: Record<string, string>): { key: string; label: string; value: number }[] {
  const sums = new Map<string, number>();
  for (const i of items) sums.set(i.category, (sums.get(i.category) ?? 0) + i.value);
  return [...sums.entries()].map(([key, value]) => ({ key, label: labels[key] ?? humanise(key), value })).sort((a, b) => b.value - a.value);
}
