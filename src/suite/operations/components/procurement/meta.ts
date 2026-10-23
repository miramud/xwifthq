import {
  Ban,
  BadgeCheck,
  CircleCheckBig,
  CircleDashed,
  FilePen,
  Gavel,
  Hourglass,
  PackageCheck,
  PackageOpen,
  ReceiptText,
  Scale,
  Send,
  ShoppingCart,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import type { Comparison, PaymentTermInput, PoFull, PoStatus, PrLineInput, PrStatus, QuoteVendor } from "@/lib/api/operations-procurement-client";

/*
  Every enum procurement speaks, in the words of the person reading it, and
  the arithmetic the screens share: a request's estimate, who is lowest on
  each line of the comparison sheet, whether payment terms add up to the
  order, and whether a GRN has a serial for each item accepted. Nothing here
  fetches; it is all tested directly.
*/

type Meta = { label: string; hue: Hue; icon: LucideIcon };

const humanise = (s: string) => (s ? (s.charAt(0).toUpperCase() + s.slice(1)).replace(/_/g, " ") : "-");

export const PR_STATUS: Record<PrStatus, Meta> = {
  draft: { label: "Draft", hue: "slate", icon: FilePen },
  in_approval: { label: "In approval", hue: "grape", icon: Hourglass },
  approved: { label: "To source", hue: "sky", icon: Scale },
  award_pending: { label: "Award in approval", hue: "sun", icon: Gavel },
  awarded: { label: "Awarded", hue: "blue", icon: BadgeCheck },
  ordered: { label: "Ordered", hue: "mint", icon: ShoppingCart },
  rejected: { label: "Rejected", hue: "rose", icon: XCircle },
  cancelled: { label: "Cancelled", hue: "slate", icon: Ban },
};

export const prStatus = (s: string): Meta => PR_STATUS[s as PrStatus] ?? { label: humanise(s), hue: "slate", icon: CircleDashed };

export const PO_STATUS: Record<PoStatus, Meta> = {
  draft: { label: "Draft", hue: "slate", icon: FilePen },
  in_approval: { label: "In approval", hue: "grape", icon: Hourglass },
  approved: { label: "Approved", hue: "blue", icon: BadgeCheck },
  sent: { label: "Sent to vendor", hue: "sky", icon: Send },
  accepted: { label: "Accepted", hue: "sky", icon: CircleCheckBig },
  partially_received: { label: "Part received", hue: "sun", icon: PackageOpen },
  received: { label: "Received", hue: "mint", icon: PackageCheck },
  invoiced: { label: "Invoiced", hue: "grape", icon: ReceiptText },
  partially_paid: { label: "Part paid", hue: "sky", icon: Wallet },
  paid: { label: "Paid", hue: "mint", icon: CircleCheckBig },
  closed: { label: "Closed", hue: "slate", icon: CircleCheckBig },
  cancelled: { label: "Cancelled", hue: "slate", icon: Ban },
  short_closed: { label: "Short-closed", hue: "slate", icon: Ban },
  rejected: { label: "Rejected", hue: "rose", icon: XCircle },
};

export const poStatus = (s: string): Meta => PO_STATUS[s as PoStatus] ?? { label: humanise(s), hue: "slate", icon: CircleDashed };

export const KIND_LABEL = { lpo: "Purchase order (LPO)", lso: "Service order (LSO)" } as const;

/* ------------------------------ the road ------------------------------ */

export interface Road {
  steps: string[];
  /** How many steps are behind it; the next one is current. */
  done: number;
  /** Stopped on the current step (cancelled, rejected, short-closed). */
  stopped: boolean;
}

/** A staff member's request: raised → approved → sourced → awarded → ordered. */
export function prRoad(status: string): Road {
  const steps = ["Draft", "Approval", "Sourcing", "Award", "Ordered"];
  const at: Record<string, number> = { draft: 0, in_approval: 1, approved: 2, award_pending: 3, awarded: 4, ordered: 5 };
  if (status === "rejected") return { steps, done: 1, stopped: true };
  if (status === "cancelled") return { steps, done: 0, stopped: true };
  return { steps, done: at[status] ?? 0, stopped: false };
}

export const PO_STEPS = ["Draft", "Approval", "Approved", "Sent", "Accepted", "Received", "Invoiced", "Paid"] as const;

/**
 * Where an order is on draft → approval → approved → sent → accepted →
 * received → invoiced → paid. A cancelled or short-closed order stops at the
 * step it had reached (read from its dates and what was received).
 */
export function poRoad(po: Pick<PoFull, "status"> & Partial<Pick<PoFull, "sentAt" | "acceptedAt" | "lines" | "invoices">>): Road {
  const steps = [...PO_STEPS];
  const at: Record<string, number> = {
    draft: 0,
    in_approval: 1,
    approved: 3,
    sent: 4,
    accepted: 5,
    partially_received: 5,
    received: 6,
    invoiced: 7,
    partially_paid: 7,
    paid: 8,
    closed: 8,
  };
  if (po.status === "rejected") return { steps, done: 1, stopped: true };
  if (po.status === "cancelled" || po.status === "short_closed") {
    const received = (po.lines ?? []).some((l) => l.received > 0);
    const reached = (po.invoices ?? []).some((i) => i.status === "matched") ? 7 : received ? 5 : po.acceptedAt ? 5 : po.sentAt ? 4 : 3;
    return { steps, done: reached, stopped: true };
  }
  return { steps, done: at[po.status] ?? 0, stopped: false };
}

/**
 * When each step of an order happened, where the API says: drafted, approved,
 * sent, accepted, the last receipt approved, the first matched invoice. Null
 * where a step has no date (sent for approval, paid) or has not happened.
 */
export function poStepDates(
  po: Pick<PoFull, "createdAt" | "approvedAt" | "sentAt" | "acceptedAt"> & Partial<Pick<PoFull, "grns" | "sccs" | "invoices">>,
): (string | null)[] {
  const latest = (xs: (string | null | undefined)[]) => xs.filter((x): x is string => Boolean(x)).sort().pop() ?? null;
  const received = latest([...(po.grns ?? []).map((g) => g.approvedAt), ...(po.sccs ?? []).map((s) => s.approvedAt)]);
  const invoiced = (po.invoices ?? []).filter((i) => i.status === "matched").map((i) => i.createdAt).filter((x): x is string => Boolean(x)).sort()[0] ?? null;
  return [po.createdAt ?? null, null, po.approvedAt ?? null, po.sentAt ?? null, po.acceptedAt ?? null, received, invoiced, null];
}

/* ------------------------------ quantities ---------------------------- */

const qtyFmt = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 });

/** `4`, `2.5`, `1,200`: a quantity without trailing zeros. */
export const qty = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "-" : qtyFmt.format(n));

/** What somebody typed as a quantity; null when it isn't one. */
export function parseQty(input: string): number | null {
  const t = input.replace(/[,\s]/g, "");
  if (t === "") return null;
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  return Number(t);
}

/* ------------------------------ estimates ----------------------------- */

/** A line's estimate in kobo: quantity × unit price, rounded as the API does. */
export const lineTotal = (quantity: number, unitPrice: number) => Math.round(quantity * unitPrice);

/** A request's estimate, the sum of its lines. */
export const prEstimate = (lines: Pick<PrLineInput, "quantity" | "estUnitPrice">[]) =>
  lines.reduce((s, l) => s + lineTotal(l.quantity || 0, l.estUnitPrice || 0), 0);

/* -------------------------- the comparison sheet ---------------------- */

export interface SheetView {
  /** prLineId → the quotation ids quoting that line's lowest amount (ties share it). */
  lowestOn: Map<string, Set<string>>;
  /** Vendors cheapest first (by total with VAT). */
  ranked: QuoteVendor[];
  /** The cheapest vendor's total, for "+x% on the lowest". */
  bestTotal: number | null;
  /** The cheapest full award: each line's lowest, per vendor. */
  lowestPicks: { prLineId: string; quotationId: string }[];
  lowestPicksTotal: number;
}

/** Read the comparison: who is lowest per line, and the vendors in rank order. */
export function readSheet(c: Comparison): SheetView {
  const lowestOn = new Map<string, Set<string>>();
  const lowestPicks: { prLineId: string; quotationId: string }[] = [];
  let lowestPicksTotal = 0;
  for (const line of c.lines) {
    const quoted = line.prices.filter((p): p is NonNullable<typeof p> => p !== null);
    if (quoted.length === 0) continue;
    const low = Math.min(...quoted.map((p) => p.amount));
    const winners = quoted.filter((p) => p.amount === low);
    lowestOn.set(line.prLineId, new Set(winners.map((p) => p.quotationId)));
    lowestPicks.push({ prLineId: line.prLineId, quotationId: winners[0].quotationId });
    lowestPicksTotal += winners[0].amount + winners[0].vat;
  }
  const ranked = [...c.vendors].sort((a, b) => a.total - b.total || a.subtotal - b.subtotal);
  return { lowestOn, ranked, bestTotal: ranked[0]?.total ?? null, lowestPicks, lowestPicksTotal };
}

/** "+4%" over the lowest total, or null for the lowest itself. */
export function overLowest(total: number, best: number | null): string | null {
  if (best === null || best <= 0 || total <= best) return null;
  const pct = ((total - best) / best) * 100;
  return `+${pct < 10 ? pct.toFixed(1).replace(/\.0$/, "") : Math.round(pct)}%`;
}

/** What a set of picks costs, VAT included, read off the sheet. */
export function picksTotal(c: Comparison, picks: Record<string, string>): number {
  let total = 0;
  for (const line of c.lines) {
    const q = picks[line.prLineId];
    const p = line.prices.find((x) => x?.quotationId === q);
    if (p) total += p.amount + p.vat;
  }
  return total;
}

/* ---------------------------- payment terms --------------------------- */

export interface TermsCheck {
  sum: number;
  /** total − sum: positive is short, negative is over. */
  gap: number;
  ok: boolean;
  /** Each term's amount, in kobo. */
  amounts: number[];
}

/** One term's amount: a fixed amount, or its share of the total (rounded down, as the API does). */
export const termAmount = (t: Pick<PaymentTermInput, "pctBp" | "amount">, total: number) =>
  t.amount != null ? t.amount : t.pctBp != null ? Math.floor((total * t.pctBp) / 10_000) : 0;

/** Do the terms add up to the order? The API allows ₦1 of rounding. */
export function checkTerms(terms: Pick<PaymentTermInput, "pctBp" | "amount">[], total: number): TermsCheck {
  const amounts = terms.map((t) => termAmount(t, total));
  const sum = amounts.reduce((s, a) => s + a, 0);
  const gap = total - sum;
  return { sum, gap, ok: terms.length > 0 && Math.abs(gap) <= 100, amounts };
}

/** `30%` from basis points; `12.5%`. */
export const pctText = (bp: number | null | undefined) => (bp == null ? "-" : `${qtyFmt.format(bp / 100)}%`);

/** "30" or "12.5" typed → basis points; null when it isn't a share. */
export function parsePct(input: string): number | null {
  const t = input.replace(/[%\s]/g, "");
  if (t === "" || !/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const bp = Math.round(Number(t) * 100);
  return bp > 0 && bp <= 10_000 ? bp : null;
}

/* ------------------------------- receiving ---------------------------- */

/** Serials typed one per line (or comma-separated), blanks dropped. */
export const splitSerials = (text: string) =>
  text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Serials are optional on a goods line; when any are given, there is one for
 * each item accepted (the API's rule). Null when the line is fine.
 */
export function serialProblem(accepted: number, serials: string[]): string | null {
  if (serials.length === 0) return null;
  const want = Math.round(accepted);
  if (serials.length === want) {
    const dupes = serials.filter((s, i) => serials.indexOf(s) !== i);
    return dupes.length ? `${dupes[0]} is entered twice.` : null;
  }
  return want === 0
    ? "Nothing is accepted, so no serials are needed."
    : `${serials.length} ${serials.length === 1 ? "serial" : "serials"} for ${qty(want)} accepted: give one for each item accepted.`;
}

/** Accepted plus rejected cannot be more than what arrived. */
export function receiptProblem(received: number, accepted: number, rejected: number, outstanding: number): string | null {
  if (accepted + rejected > received) return "Accepted and rejected together are more than arrived.";
  if (accepted > outstanding) return `Only ${qty(outstanding)} more can be accepted on this line.`;
  return null;
}

/* ------------------------------- dates ------------------------------- */

/** Today as `YYYY-MM-DD`, local time. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Is a `YYYY-MM-DD` before today? */
export const isPast = (ymd: string | null | undefined) => Boolean(ymd && ymd.slice(0, 10) < today());
