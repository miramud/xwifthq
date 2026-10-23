import { Ban, CheckCircle2, CircleDashed, FileCheck2, PenLine, Receipt, Send, type LucideIcon } from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import type { CurrencyCode } from "@/lib/money";
import { amount } from "@/suite/finance/lib/format";
import type {
  AgeBucket,
  BillingType,
  InvoiceFilter,
  InvoiceStatus,
  InvoiceSummary,
  MilestoneStatus,
  OpenBalances,
  ProgressMethod,
  StatementKind,
} from "@/lib/api/finance-revenue-client";

/*
  Words, colours and arithmetic for Finance › Revenue. The arithmetic
  mirrors the API exactly (`Services/Revenue/Invoices::fill`,
  `Receipts::record`), so what somebody sees while keying an invoice or
  spreading a receipt is what the API will store:

  - line VAT = amount × rate, rounded half up to the kobo;
  - retention = total (with VAT) × retention rate, half up;
  - expected WHT = subtotal (before VAT) × WHT rate, rounded down;
  - a receipt's cash covers each invoice's cash and released retention;
    cash + WHT on an invoice may not pass its trade balance, and released
    retention may not pass what is held.
*/

/* ------------------------------ statuses ------------------------------ */

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; hue: Hue; icon: LucideIcon }> = {
  draft: { label: "Draft", hue: "slate", icon: PenLine },
  issued: { label: "Issued", hue: "sky", icon: Send },
  part_paid: { label: "Part paid", hue: "sun", icon: CircleDashed },
  paid: { label: "Paid", hue: "mint", icon: CheckCircle2 },
  void: { label: "Void", hue: "rose", icon: Ban },
};

/** The list's tabs, `?status=` values the API takes. */
export const INVOICE_TABS: { key: InvoiceFilter | "all"; label: string }[] = [
  { key: "draft", label: "Drafts" },
  { key: "open", label: "Open" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "void", label: "Void" },
  { key: "all", label: "All" },
];

export const MILESTONE_STATUS: Record<MilestoneStatus, { label: string; hue: Hue; icon: LucideIcon }> = {
  planned: { label: "Planned", hue: "slate", icon: CircleDashed },
  completed: { label: "Accepted, to bill", hue: "mint", icon: FileCheck2 },
  invoiced: { label: "Invoiced", hue: "blue", icon: Receipt },
};

export const BILLING_TYPES: Record<BillingType, string> = {
  milestone: "Milestones",
  sla: "Service (SLA)",
  t_and_m: "Time and materials",
  fixed: "Fixed price",
};

export const PROGRESS_METHODS: Record<ProgressMethod, string> = {
  milestone_weighted: "Milestones, weighted",
  work_completion: "Work completed in Projects",
  pm_reported: "Reported by the project manager",
};

export const BUCKETS: { key: AgeBucket; label: string; hue: Hue }[] = [
  { key: "current", label: "Not yet due", hue: "mint" },
  { key: "d30", label: "1–30 days", hue: "sky" },
  { key: "d60", label: "31–60 days", hue: "sun" },
  { key: "d90", label: "61–90 days", hue: "coral" },
  { key: "over90", label: "Over 90 days", hue: "rose" },
  { key: "retention", label: "Retention held", hue: "grape" },
];

export const STATEMENT_KIND: Record<StatementKind, { label: string; hue: Hue }> = {
  invoice: { label: "Invoice", hue: "sky" },
  receipt: { label: "Receipt", hue: "mint" },
  wht: { label: "WHT deducted", hue: "grape" },
  void: { label: "Void", hue: "rose" },
};

/** Days late as a person says it, with the hue for its chip. */
export function lateness(daysLate: number): { label: string; hue: Hue } | null {
  if (daysLate <= 0) return null;
  if (daysLate > 90) return { label: `${daysLate} days late`, hue: "rose" };
  if (daysLate > 30) return { label: `${daysLate} days late`, hue: "coral" };
  return { label: daysLate === 1 ? "1 day late" : `${daysLate} days late`, hue: "sun" };
}

/** Everything still owed on the invoice is retention: held back by agreement, not late. */
export const onlyRetention = (i: { outstanding: number; retentionHeld: number }) => i.outstanding > 0 && i.outstanding === i.retentionHeld;

/* ------------------------------- rates -------------------------------- */

/** Basis points as a percent, `750` → "7.5%". */
export function pct(bp: number | null | undefined): string {
  if (bp === null || bp === undefined) return "—";
  const v = bp / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

/** The text a rate box starts with: `750` → "7.5", 0 → "0". */
export const pctInput = (bp: number | null | undefined) => (bp === null || bp === undefined ? "" : pct(bp).replace("%", ""));

/** Percent text ("7.5") to basis points, at most `max`; null when it isn't a rate. */
export function bpFromPct(text: string, max = 5_000): number | null {
  const t = text.replace(/[%\s]/g, "");
  if (t === "") return 0;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const bp = Math.round(Number(t) * 100);
  return bp <= max ? bp : null;
}

/* ------------------------------ invoices ------------------------------ */

/** amount × rate ÷ 10,000, half up, like `IntMath::mulDiv` for the positive amounts invoices carry. */
export function mulBp(amount: number, bp: number): number {
  if (amount <= 0 || bp <= 0) return 0;
  return Math.floor((amount * bp + 5_000) / 10_000);
}

export interface InvoiceTotals {
  subtotal: number;
  vat: number;
  total: number;
  retention: number;
  expectedWht: number;
  /** What the client pays when the invoice falls due: total less retention and WHT. */
  payNow: number;
}

export function invoiceTotals(lines: { amount: number; vatRateBp: number }[], retentionBp: number, whtBp: number): InvoiceTotals {
  const subtotal = lines.reduce((s, l) => s + Math.max(0, l.amount), 0);
  const vat = lines.reduce((s, l) => s + mulBp(l.amount, l.vatRateBp), 0);
  const total = subtotal + vat;
  const retention = mulBp(total, retentionBp);
  const expectedWht = whtBp > 0 ? Math.floor((subtotal * whtBp) / 10_000) : 0;
  return { subtotal, vat, total, retention, expectedWht, payNow: total - retention - expectedWht };
}

/* ------------------------------ receipts ------------------------------ */

export interface AllocationRow {
  invoiceId: string;
  cash: number;
  wht: number;
  retention: number;
}

/** What an open invoice offers a receipt: its balances, as the list returns them. */
export interface OpenInvoice {
  invoice: Pick<InvoiceSummary, "id" | "invoiceNo" | "dueOn" | "daysLate" | "currency" | "subtotal" | "expectedWhtBp">;
  open: OpenBalances;
}

/** WHT the client is still expected to deduct: expected WHT on the subtotal (rounded down) less what earlier receipts took. */
export function whtLeft(o: OpenInvoice): number {
  const expected = o.invoice.expectedWhtBp > 0 ? Math.floor((o.invoice.subtotal * o.invoice.expectedWhtBp) / 10_000) : 0;
  return Math.max(0, expected - (o.open.whtTaken ?? 0));
}

/**
 * "Pay in full less WHT": the trade balance, with the WHT still expected
 * taken off as a deduction rather than cash. Retention stays held.
 */
export function payInFullLessWht(o: OpenInvoice): AllocationRow {
  const wht = Math.min(whtLeft(o), o.open.trade);
  return { invoiceId: o.invoice.id, cash: o.open.trade - wht, wht, retention: 0 };
}

export interface AllocationProblem {
  invoiceId: string;
  field: "cash" | "retention";
  message: string;
}

export interface AllocationSummary {
  /** Cash applied to invoices: their cash plus released retention. */
  applied: number;
  wht: number;
  retention: number;
  /** Cash left over: kept as a client advance. Negative when over-applied. */
  unallocated: number;
  /** Everything settled on invoices, cash and WHT. */
  settles: number;
  over: boolean;
  problems: AllocationProblem[];
}

export function allocationSummary(
  received: number,
  rows: AllocationRow[],
  open: Record<string, OpenBalances>,
  label: (id: string) => string,
  currency: CurrencyCode = "NGN",
): AllocationSummary {
  const problems: AllocationProblem[] = [];
  let applied = 0;
  let wht = 0;
  let retention = 0;
  for (const r of rows) {
    applied += r.cash + r.retention;
    wht += r.wht;
    retention += r.retention;
    const o = open[r.invoiceId];
    if (!o) continue;
    if (r.cash + r.wht > o.trade)
      problems.push({ invoiceId: r.invoiceId, field: "cash", message: `${label(r.invoiceId)} has ${amount(o.trade, currency)} left to pay (before retention).` });
    if (r.retention > o.retention)
      problems.push({ invoiceId: r.invoiceId, field: "retention", message: `${label(r.invoiceId)} has ${amount(o.retention, currency)} of retention held.` });
  }
  const unallocated = received - applied;
  return { applied, wht, retention, unallocated, settles: applied + wht, over: unallocated < 0, problems };
}

/* ------------------------------ contracts ----------------------------- */

export interface RailSegment {
  key: "invoiced" | "completed" | "planned";
  amount: number;
  label: string;
}

/**
 * A contract's value as a rail: invoiced, accepted-and-waiting and planned
 * milestones in that order, and whatever is not scheduled yet left as the
 * hatched remainder. `over` is how far the milestones pass the value.
 */
export function rail(value: number, milestones: { amount: number; status: MilestoneStatus }[]): { segments: RailSegment[]; scheduled: number; unscheduled: number; over: number } {
  const sum = (s: MilestoneStatus) => milestones.filter((m) => m.status === s).reduce((t, m) => t + Math.max(0, m.amount), 0);
  const segments: RailSegment[] = [
    { key: "invoiced", amount: sum("invoiced"), label: "Invoiced" },
    { key: "completed", amount: sum("completed"), label: "Accepted, to bill" },
    { key: "planned", amount: sum("planned"), label: "Planned" },
  ];
  const scheduled = segments.reduce((t, s) => t + s.amount, 0);
  return { segments, scheduled, unscheduled: Math.max(0, value - scheduled), over: Math.max(0, scheduled - value) };
}

/** Share of `part` in `whole`, 0–100, for bar widths. */
export const share = (part: number, whole: number) => (whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0);

export const today = () => new Date().toISOString().slice(0, 10);

/* ------------------------------ currencies ---------------------------- */

/*
  Currency splits and tranches, mirroring `Services/Revenue/CurrencySplits`:
  rates are units of base per one unit of the currency, carried as decimal
  text and worked as integers ×1e8 (BigInt, so ₦10bn at 1,550 cannot lose a
  kobo); each share is taken in the contract currency, the last share takes
  the remainder, then each part is turned into its own currency at the
  planning rates.
*/

const SCALE = BigInt(100_000_000);

/** "1550.25" → 155025000000 (×1e8); null when it isn't a rate above zero. */
export function rateScaled(text: string | null | undefined): bigint | null {
  const t = (text ?? "").replace(/[,\s]/g, "");
  if (!/^\d{1,10}(\.\d{1,8})?$/.test(t)) return null;
  const [whole, fraction = ""] = t.split(".");
  const v = BigInt(whole) * SCALE + BigInt((fraction + "00000000").slice(0, 8));
  return v > BigInt(0) ? v : null;
}

/** round(a × b ÷ c), half away from zero, like `IntMath::mulDiv`. */
export function mulDiv(a: number | bigint, b: bigint, c: bigint): number {
  const p = BigInt(a) * b;
  const neg = p < BigInt(0) !== c < BigInt(0);
  const ap = p < BigInt(0) ? -p : p;
  const ac = c < BigInt(0) ? -c : c;
  let q = ap / ac;
  if ((ap % ac) * BigInt(2) >= ac) q += BigInt(1);
  return Number(neg ? -q : q);
}

/** An amount in a currency, in base at `rate` (text); null without a rate. */
export function toBase(minor: number, rate: string | null | undefined): number | null {
  const r = rateScaled(rate);
  return r === null ? null : mulDiv(minor, r, SCALE);
}

export interface SplitRow {
  currency: string;
  shareBp: number;
  /** Ignored (1) for the base currency. */
  planningRate?: string;
}

export interface SplitPart {
  currency: string;
  shareBp: number;
  /** In its own currency's minor units; null when its planning rate is missing. */
  amount: number | null;
  /** In base at the planning rate. */
  base: number | null;
}

/** The planning rate of a split row ("1" for the base). */
const planning = (r: SplitRow, base: string): bigint | null => (r.currency === base ? SCALE : rateScaled(r.planningRate));

/**
 * Split an amount stated in the contract currency into the split's
 * currencies, exactly as the API will when it drafts the milestone invoice.
 */
export function apportion(amountMinor: number, contractCurrency: string, split: SplitRow[], base: string): SplitPart[] {
  const own = split.find((r) => r.currency === contractCurrency);
  const contractRate = contractCurrency === base ? SCALE : own ? planning(own, base) : null;
  let left = amountMinor;
  return split.map((r, i) => {
    const part = i === split.length - 1 ? left : mulDiv(amountMinor, BigInt(r.shareBp), BigInt(10_000));
    left -= part;
    const rate = planning(r, base);
    if (rate === null || contractRate === null) return { currency: r.currency, shareBp: r.shareBp, amount: null, base: null };
    const inOwn = r.currency === contractCurrency ? part : mulDiv(part, contractRate, rate);
    return { currency: r.currency, shareBp: r.shareBp, amount: inOwn, base: mulDiv(inOwn, rate, SCALE) };
  });
}

/** What is wrong with a split, in words; null when it will save. */
export function splitProblem(split: SplitRow[], contractCurrency: string, base: string): string | null {
  if (split.length === 0) return null;
  if (split.length < 2) return "Add a second currency, or switch the split off and set the contract currency.";
  const seen = new Set<string>();
  for (const r of split) {
    if (!r.currency) return "Choose a currency for each row.";
    if (seen.has(r.currency)) return `${r.currency} is in the split twice.`;
    seen.add(r.currency);
    if (r.shareBp <= 0) return "Each currency needs a share above zero.";
    if (planning(r, base) === null) return `Give the ${r.currency} rate the contract was priced at.`;
  }
  const total = split.reduce((s, r) => s + r.shareBp, 0);
  if (total !== 10_000) return `The shares add up to ${pct(total)}; they must make 100%.`;
  if (contractCurrency !== base && !seen.has(contractCurrency))
    return `The contract is priced in ${contractCurrency}; put ${contractCurrency} in the split (with its rate) or price it in ${base}.`;
  return null;
}

/** "table" → "Recorded rate", "override" → "Overridden", "base" → "Base currency". */
export const RATE_SOURCE: Record<"base" | "table" | "override", { label: string; hue: Hue }> = {
  base: { label: "Base currency", hue: "sky" },
  table: { label: "Recorded rate", hue: "mint" },
  override: { label: "Overridden", hue: "sun" },
};

/** Group invoice lines by currency in order of first appearance: the tranches the API will make. */
export function tranchesOf<L extends { currency?: string | null; amount: number; vatRateBp: number }>(
  lines: L[],
  fallback: string,
): { currency: string; lines: L[] }[] {
  const out: { currency: string; lines: L[] }[] = [];
  for (const l of lines) {
    const c = (l.currency || fallback).toUpperCase();
    let g = out.find((x) => x.currency === c);
    if (!g) out.push((g = { currency: c, lines: [] }));
    g.lines.push(l);
  }
  return out;
}
