import {
  Ban,
  BadgeCheck,
  CircleCheckBig,
  CircleDashed,
  FilePen,
  Hourglass,
  MessageCircleQuestion,
  ReceiptText,
  ShieldCheck,
  TimerOff,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import type {
  ChecklistItemDef,
  Checkpoint,
  Mark,
  MemoFull,
  MemoStatus,
  MemoSummary,
  RetirementStatus,
  VoucherStatus,
} from "@/lib/api/finance-spend-client";

/*
  Every enum the spend API speaks, in the words of the person reading it,
  plus the small pieces of logic the request, register and FCU screens
  share: where a request is on its road, what happens next, how long a
  document has waited against its service level, and the retirement sum.
  Nothing here fetches; it is all tested directly.
*/

type Meta = { label: string; hue: Hue; icon: LucideIcon };

export const MEMO_STATUS: Record<MemoStatus, Meta> = {
  draft: { label: "Draft", hue: "slate", icon: FilePen },
  in_approval: { label: "In approval", hue: "grape", icon: Hourglass },
  awaiting_fcu: { label: "With the FCU", hue: "sky", icon: ShieldCheck },
  fcu_queried: { label: "Queried by the FCU", hue: "sun", icon: MessageCircleQuestion },
  fcu_cleared: { label: "Cleared for payment", hue: "blue", icon: BadgeCheck },
  partially_paid: { label: "Part paid", hue: "sky", icon: Wallet },
  paid: { label: "Paid", hue: "mint", icon: CircleCheckBig },
  awaiting_retirement: { label: "To be retired", hue: "coral", icon: ReceiptText },
  retired: { label: "Retired", hue: "mint", icon: CircleCheckBig },
  closed: { label: "Closed", hue: "slate", icon: CircleCheckBig },
  rejected: { label: "Rejected", hue: "rose", icon: XCircle },
  cancelled: { label: "Cancelled", hue: "slate", icon: Ban },
  expired: { label: "Expired", hue: "slate", icon: TimerOff },
};

export const memoStatus = (s: string): Meta => MEMO_STATUS[s as MemoStatus] ?? { label: humanise(s), hue: "slate", icon: CircleDashed };

/** Statuses the register's filter offers, in the order a request moves through them. */
export const MEMO_STATUS_ORDER: MemoStatus[] = [
  "draft",
  "in_approval",
  "awaiting_fcu",
  "fcu_queried",
  "fcu_cleared",
  "partially_paid",
  "paid",
  "awaiting_retirement",
  "retired",
  "closed",
  "rejected",
  "cancelled",
  "expired",
];

export const MEMO_TYPES: Record<string, { label: string; hint: string }> = {
  payment: { label: "Payment", hint: "Pay a vendor or a member of staff for goods, services or a claim." },
  advance: { label: "Advance", hint: "Money paid to you up front, which you account for with receipts afterwards." },
  system: { label: "System payment", hint: "Raised by another module, such as payroll." },
  approval: { label: "Approval", hint: "An approval memo." },
};

export const memoType = (t: string) => MEMO_TYPES[t]?.label ?? humanise(t);

export const VOUCHER_STATUS: Record<VoucherStatus, { label: string; hue: Hue }> = {
  draft: { label: "Draft", hue: "slate" },
  submitted_to_fcu: { label: "With the FCU", hue: "sky" },
  fcu_queried: { label: "Queried by the FCU", hue: "sun" },
  fcu_checked: { label: "Checked by the FCU", hue: "blue" },
  in_approval: { label: "In approval", hue: "grape" },
  approved: { label: "Approved", hue: "blue" },
  scheduled: { label: "Scheduled", hue: "sky" },
  payment_initiated: { label: "Payment sent", hue: "coral" },
  paid_confirmed: { label: "Paid", hue: "mint" },
  rejected: { label: "Rejected", hue: "rose" },
  cancelled: { label: "Cancelled", hue: "slate" },
};

export const voucherStatus = (s: string) =>
  s === "provisional" ? { label: "Confirmed on the bank receipt", hue: "sun" as Hue } : (VOUCHER_STATUS[s as VoucherStatus] ?? { label: humanise(s), hue: "slate" as Hue });

export const RETIREMENT_STATUS: Record<RetirementStatus, { label: string; hue: Hue }> = {
  draft: { label: "Draft", hue: "slate" },
  submitted: { label: "With the FCU", hue: "sky" },
  fcu_queried: { label: "Queried by the FCU", hue: "sun" },
  cleared: { label: "Cleared", hue: "blue" },
  posted: { label: "Retired and posted", hue: "mint" },
};

export const retirementStatus = (s: string) => RETIREMENT_STATUS[s as RetirementStatus] ?? { label: humanise(s), hue: "slate" as Hue };

export const QUERY_STATUS: Record<string, { label: string; hue: Hue }> = {
  open: { label: "Waiting for an answer", hue: "sun" },
  answered: { label: "Answered", hue: "sky" },
  closed: { label: "Closed", hue: "slate" },
};

export const CHECKPOINTS: Record<Checkpoint, string> = {
  1: "Memo vetting",
  2: "Voucher pre-audit",
  3: "Payment confirmation",
  4: "Retirement vetting",
};

export const MARKS: Record<Mark, { label: string; short: string; hue: Hue; key: string }> = {
  ok: { label: "OK", short: "OK", hue: "mint", key: "o" },
  query: { label: "Query", short: "Query", hue: "sun", key: "q" },
  na: { label: "Not applicable", short: "N/A", hue: "slate", key: "n" },
};

export const OUTCOMES: Record<string, { label: string; hue: Hue }> = {
  cleared: { label: "Cleared", hue: "mint" },
  queried: { label: "Queried", hue: "sun" },
  rejected: { label: "Rejected", hue: "rose" },
  confirmed: { label: "Payment confirmed", hue: "mint" },
};

/** Who is to be paid, in words. */
export const PAYEE_SOURCE: Record<string, string> = {
  counterparty: "Vendor register",
  vendor: "Vendor register",
  staff: "Staff record",
  employee: "Staff record",
  // The API's names for where the bank details came from.
  vendor_master: "Vendor register",
  hr_pay_profile: "HR salary record",
};

export function humanise(s: string): string {
  const t = s.replace(/[_-]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* ------------------------------------------------------------------ */
/*  The road a request travels                                         */
/* ------------------------------------------------------------------ */

export const PAYMENT_STEPS = ["Raised", "Approved", "FCU cleared", "Voucher", "Paid"] as const;
export const ADVANCE_STEPS = [...PAYMENT_STEPS, "Retired"] as const;

export interface Stage {
  steps: readonly string[];
  /** Steps completed. */
  done: number;
  /** The road stopped at step `done` (rejected, cancelled, expired). */
  stopped: boolean;
  /** Step `done` is waiting on the requester (an FCU query). */
  flagged: boolean;
}

/**
 * Where a request is on raised → approved → FCU cleared → voucher → paid
 * (→ retired, for an advance).
 */
export function requestStage(m: Pick<MemoSummary, "status" | "type"> & Partial<Pick<MemoFull, "vouchers" | "clearedAt" | "reviews">>): Stage {
  const steps = m.type === "advance" ? ADVANCE_STEPS : PAYMENT_STEPS;
  const at = (done: number, extra: Partial<Stage> = {}): Stage => ({ steps, done, stopped: false, flagged: false, ...extra });
  const hasVoucher = (m.vouchers ?? []).some((v) => v.status !== "cancelled" && v.status !== "rejected");

  switch (m.status) {
    case "draft":
      return at(0);
    case "in_approval":
      return at(1);
    case "awaiting_fcu":
      return at(2);
    case "fcu_queried":
      return at(2, { flagged: true });
    case "fcu_cleared":
      return at(hasVoucher ? 4 : 3);
    case "partially_paid":
      return at(4);
    case "paid":
    case "closed":
      return at(steps.length === 5 ? 5 : 6);
    case "awaiting_retirement":
      return at(5);
    case "retired":
      return at(6);
    case "rejected": {
      const byFcu = (m.reviews ?? []).some((r) => r.outcome === "rejected");
      return at(byFcu ? 2 : 1, { stopped: true });
    }
    case "cancelled":
      return at(m.clearedAt ? 3 : 2, { stopped: true });
    case "expired":
      return at(1, { stopped: true });
    default:
      return at(0);
  }
}

export interface NextStep {
  text: string;
  /** Whose move it is. */
  who: "you" | "others" | "done";
  hue: Hue;
}

/** What happens next, from the requester's side of the screen. */
export function nextStep(m: Pick<MemoSummary, "status" | "type"> & Partial<Pick<MemoFull, "retirement" | "queries">>): NextStep {
  const retirement = m.retirement ?? null;
  switch (m.status) {
    case "draft":
      return { text: "Finish it and send it to Finance", who: "you", hue: "slate" };
    case "in_approval":
      return { text: "Waiting for approval", who: "others", hue: "grape" };
    case "awaiting_fcu":
      return { text: "Waiting for the FCU", who: "others", hue: "sky" };
    case "fcu_queried":
      return { text: "Answer the FCU's query", who: "you", hue: "sun" };
    case "fcu_cleared":
      return { text: "Cleared - Finance is preparing the payment", who: "others", hue: "blue" };
    case "partially_paid":
      return { text: "Part paid - the rest is on its way", who: "others", hue: "sky" };
    case "paid":
      return { text: "Paid", who: "done", hue: "mint" };
    case "awaiting_retirement":
      if (retirement?.status === "submitted") return { text: "Your retirement is with the FCU", who: "others", hue: "sky" };
      if (retirement?.status === "fcu_queried") return { text: "Answer the FCU on your retirement", who: "you", hue: "sun" };
      return { text: "Retire your advance", who: "you", hue: "coral" };
    case "retired":
      return { text: "Retired", who: "done", hue: "mint" };
    case "closed":
      return { text: "Closed", who: "done", hue: "slate" };
    case "rejected":
      return { text: "Rejected", who: "done", hue: "rose" };
    case "cancelled":
      return { text: "Cancelled", who: "done", hue: "slate" };
    case "expired":
      return { text: "Expired before it was approved", who: "done", hue: "slate" };
    default:
      return { text: humanise(m.status), who: "others", hue: "slate" };
  }
}

/** A request still on its way (not paid, retired, closed or stopped). */
export const isOpen = (s: MemoStatus) => !["paid", "retired", "closed", "rejected", "cancelled", "expired"].includes(s);

/** Statuses during which the requester can add documents (`MySpendController::upload`). */
export const takesDocuments = (s: MemoStatus) => s === "draft" || s === "fcu_queried";

/* ------------------------------------------------------------------ */
/*  Service levels                                                     */
/* ------------------------------------------------------------------ */

/** FCU service levels in working days (Finance PRD §11.4): memos and vouchers 1, payments 2. */
export const SLA_DAYS = { memos: 1, vouchers: 1, payments: 2, retirements: 2 } as const;

/**
 * Working days (Monday to Friday) between `waitingDays` calendar days ago
 * and `now`, to one decimal: weekends do not count against the FCU.
 */
export function workingDaysWaited(waitingDays: number, now: Date = new Date()): number {
  const end = now.getTime();
  let t = end - waitingDays * 86_400_000;
  let ms = 0;
  while (t < end) {
    const d = new Date(t);
    const nextMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const stop = Math.min(nextMidnight, end);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) ms += stop - t;
    t = stop;
  }
  return Math.round((ms / 86_400_000) * 10) / 10;
}

export interface Sla {
  label: string;
  hue: Hue;
  overdue: boolean;
  /** Working days waited. */
  waited: number;
}

/** How long something has waited, against its service level: in time, due now, or overdue (in words, not just colour). */
export function slaState(waitingDays: number | null | undefined, slaDays: number, now: Date = new Date()): Sla {
  if (waitingDays == null) return { label: "Just arrived", hue: "mint", overdue: false, waited: 0 };
  const waited = workingDaysWaited(waitingDays, now);
  const cal = Math.max(0, Math.round(waitingDays));
  const span = cal === 0 ? "today" : cal === 1 ? "1 day" : `${cal} days`;
  if (waited > slaDays) {
    const over = Math.max(1, Math.round(waited - slaDays));
    return { label: `Overdue · ${over} working ${over === 1 ? "day" : "days"} late`, hue: "rose", overdue: true, waited };
  }
  if (waited > slaDays * 0.6) return { label: `Due now · waiting ${span}`, hue: "sun", overdue: false, waited };
  return { label: cal === 0 ? "In time · arrived today" : `In time · waiting ${span}`, hue: "mint", overdue: false, waited };
}

/* ------------------------------------------------------------------ */
/*  Checklists and sums                                                */
/* ------------------------------------------------------------------ */

/** Is this item required at this amount? The three-quote rule applies from its threshold. */
export function requiredAt(item: Pick<ChecklistItemDef, "required" | "requiredFrom">, amount: number | null): boolean {
  return item.required && (item.requiredFrom == null || (amount ?? 0) >= item.requiredFrom);
}

export interface RetirementSum {
  spent: number;
  refund: number;
  accounted: number;
  advanced: number;
  /** Advanced minus accounted: positive is still to account for, negative is over. */
  gap: number;
  balanced: boolean;
}

/** Spent plus cash returned must equal the advance (`Retirements::save`). */
export function retirementSum(amounts: (number | null)[], refund: number | null, advanced: number): RetirementSum {
  const spent = amounts.reduce<number>((s, a) => s + (a ?? 0), 0);
  const r = refund ?? 0;
  const accounted = spent + r;
  return { spent, refund: r, accounted, advanced, gap: advanced - accounted, balanced: accounted === advanced && advanced > 0 };
}
