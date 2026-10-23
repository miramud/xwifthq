import {
  Ban,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  FileSearch,
  HelpCircle,
  PenLine,
  Send,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import type { StatusStep, VoucherStatus, WhtRateOption } from "@/lib/api/finance-payments-client";

/*
  Words, colours and arithmetic for payment vouchers. The arithmetic mirrors
  `Services/Spend/Vouchers::writeLines` exactly, so the totals a preparer sees
  while coding are the totals the API will store: WHT on the amount before
  VAT, rounded half up to the kobo; net = gross + VAT − WHT; and what a
  voucher draws on its memo is gross + VAT.
*/

export const VOUCHER_STATUS: Record<VoucherStatus, { label: string; hue: Hue; icon: LucideIcon }> = {
  draft: { label: "Draft", hue: "slate", icon: PenLine },
  submitted_to_fcu: { label: "With the FCU", hue: "sky", icon: FileSearch },
  fcu_queried: { label: "Queried by the FCU", hue: "sun", icon: HelpCircle },
  fcu_checked: { label: "FCU checked", hue: "grape", icon: ShieldCheck },
  in_approval: { label: "Awaiting authorisation", hue: "grape", icon: CircleDashed },
  approved: { label: "Approved, to pay", hue: "blue", icon: BadgeCheck },
  scheduled: { label: "On a schedule", hue: "blue", icon: CalendarClock },
  payment_initiated: { label: "Payment sent", hue: "sky", icon: Send },
  paid_confirmed: { label: "Paid and confirmed", hue: "mint", icon: CheckCircle2 },
  rejected: { label: "Rejected", hue: "rose", icon: XCircle },
  cancelled: { label: "Cancelled", hue: "slate", icon: Ban },
};

export const statusLabel = (s: string) => VOUCHER_STATUS[s as VoucherStatus]?.label ?? s.replace(/_/g, " ");

/** The register's tabs, in the order money moves. */
export const VOUCHER_TABS: { key: "all" | VoucherStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "submitted_to_fcu", label: "With the FCU" },
  { key: "fcu_queried", label: "Queried" },
  { key: "in_approval", label: "Awaiting authorisation" },
  { key: "approved", label: "To pay" },
  { key: "scheduled", label: "Scheduled" },
  { key: "payment_initiated", label: "Sent" },
  { key: "paid_confirmed", label: "Confirmed" },
  { key: "cancelled", label: "Cancelled" },
];

export const KIND_LABEL: Record<string, string> = { payment: "Payment", advance: "Advance" };

/* ------------------------------ pipeline ------------------------------ */

export const PIPELINE = ["Drafted", "FCU checked", "Authorised", "Scheduled", "Paid", "Confirmed"] as const;

export type StepState = "done" | "current" | "todo";

/**
 * Where a voucher is on its way from draft to confirmed payment: each of the
 * six stages done, current (somebody has it now) or still to come. `null`
 * for a voucher that stopped (rejected, cancelled) - the page says so instead.
 */
export function pipeline(status: VoucherStatus): StepState[] | null {
  // How many stages are complete; the one after them is where it is now.
  const reached: Partial<Record<VoucherStatus, number>> = {
    draft: 0,
    submitted_to_fcu: 1,
    fcu_queried: 1,
    fcu_checked: 2,
    in_approval: 2,
    approved: 3,
    scheduled: 4,
    payment_initiated: 5,
    paid_confirmed: 6,
  };
  const done = reached[status];
  if (done === undefined) return null;
  return PIPELINE.map((_, i) => (i < done ? "done" : i === done ? "current" : "todo"));
}

/** The signature each stage leaves, found in the status history. */
export const SIGNATURES: { label: string; to: VoucherStatus[] }[] = [
  { label: "Prepared", to: ["draft"] },
  { label: "FCU checked", to: ["fcu_checked"] },
  { label: "Authorised", to: ["approved"] },
  { label: "Paid", to: ["payment_initiated"] },
  { label: "Confirmed", to: ["paid_confirmed"] },
];

export interface Signature {
  label: string;
  by: string | null;
  at: string | null;
  signed: boolean;
}

/** The latest history step into each stage: who signed it and when. */
export function signatures(history: StatusStep[], preparedBy: string | null): Signature[] {
  return SIGNATURES.map((s) => {
    const hit = [...history].reverse().find((h) => s.to.includes(h.to as VoucherStatus));
    if (s.label === "Prepared") return { label: s.label, by: hit?.by ?? preparedBy, at: hit?.at ?? null, signed: true };
    // Authorised by the approval process has no person on the history step.
    return { label: s.label, by: hit?.by ?? (hit ? "The approval process" : null), at: hit?.at ?? null, signed: Boolean(hit) };
  });
}

/* -------------------------------- WHT --------------------------------- */

/** WHT in kobo on a gross (before VAT) at a rate in basis points: half up, like the API. */
export function whtOn(gross: number, rateBp: number): number {
  if (gross <= 0 || rateBp <= 0) return 0;
  return Math.floor((gross * rateBp + 5_000) / 10_000);
}

/** "5%", "2.5%" from basis points. */
export function pct(bp: number | null | undefined): string {
  if (bp === null || bp === undefined) return "—";
  const v = bp / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

/** Percent text ("7.5") to basis points; null when it isn't a rate. */
export function bpFromPct(text: string): number | null {
  const t = text.replace(/[%\s]/g, "");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const bp = Math.round(Number(t) * 100);
  return bp <= 10_000 ? bp : null;
}

/**
 * The rate the table gives a class for this payee. Staff are individuals;
 * a vendor is taken as a company here (the API knows the vendor's kind and
 * has the last word when the voucher is saved).
 */
export function tableRate(rates: WhtRateOption[], code: string, payeeKind: "company" | "individual"): number | null {
  if (code === "none") return 0;
  return rates.find((r) => r.code === code && r.payeeKind === payeeKind)?.rateBp ?? null;
}

export interface LineFigures {
  gross: number;
  vat: number;
  rateBp: number;
  wht: number;
  net: number;
}

export function lineFigures(gross: number, vat: number, rateBp: number): LineFigures {
  const w = whtOn(gross, rateBp);
  return { gross, vat, rateBp, wht: w, net: gross + vat - w };
}

export function sumFigures(lines: LineFigures[]): { gross: number; vat: number; wht: number; net: number; draw: number } {
  const t = lines.reduce((s, l) => ({ gross: s.gross + l.gross, vat: s.vat + l.vat, wht: s.wht + l.wht, net: s.net + l.net }), { gross: 0, vat: 0, wht: 0, net: 0 });
  return { ...t, draw: t.gross + t.vat };
}

/** Voucher statuses that still draw on their memo's balance (the API's `Vouchers::LIVE`). */
export const DRAWS_ON_MEMO: VoucherStatus[] = [
  "draft",
  "submitted_to_fcu",
  "fcu_queried",
  "fcu_checked",
  "in_approval",
  "approved",
  "scheduled",
  "payment_initiated",
  "paid_confirmed",
];

/**
 * What is left on a memo for this voucher: the approved amount less every
 * other live voucher on it. The memo's own `balance` only knows what has been
 * paid, so it overstates the room while other vouchers are in progress.
 */
export function memoRoom(
  memo: { approvedAmount: number | null; amount: number; vouchers?: { id: string; status: VoucherStatus; amount: number }[] },
  exceptVoucherId?: string,
): number {
  const approved = memo.approvedAmount ?? memo.amount;
  const others = (memo.vouchers ?? []).filter((v) => v.id !== exceptVoucherId && DRAWS_ON_MEMO.includes(v.status)).reduce((s, v) => s + v.amount, 0);
  return Math.max(0, approved - others);
}

export const CHECKPOINTS: Record<number, string> = {
  1: "Memo vetting",
  2: "Voucher pre-audit",
  3: "Payment confirmation",
  4: "Retirement",
};

export const MARK: Record<string, { label: string; hue: Hue }> = {
  ok: { label: "Passed", hue: "mint" },
  query: { label: "Queried", hue: "sun" },
  na: { label: "Not applicable", hue: "slate" },
};

export const OUTCOME: Record<string, { label: string; hue: Hue }> = {
  cleared: { label: "Cleared", hue: "mint" },
  confirmed: { label: "Payment confirmed", hue: "mint" },
  queried: { label: "Queried", hue: "sun" },
  rejected: { label: "Rejected", hue: "rose" },
};

export const BANK_SOURCE: Record<string, string> = {
  vendor_master: "From the vendor register",
  hr_pay_profile: "From HR's salary account",
};
