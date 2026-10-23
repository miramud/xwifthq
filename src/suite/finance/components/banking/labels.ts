import {
  AlertTriangle,
  ArrowLeftRight,
  BadgeCheck,
  CircleSlash,
  Clock,
  FileCheck2,
  FileWarning,
  Hourglass,
  Loader2,
  Send,
  type LucideIcon,
} from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import type {
  BankAccountType,
  BankCode,
  BankPurpose,
  CheckStatus,
  ImportStatus,
  ReconciliationStatus,
  RuleAction,
  StatementSummary,
  StatementTemplate,
} from "@/lib/api/finance-banking-client";

/*
  Every enum the banking API speaks, in the bursary's words, plus the small
  pieces of logic the banking screens share (the import pipeline, the
  reconciliation months). Nothing here fetches; it is all tested directly.
*/

export const BANKS: Record<BankCode, string> = {
  uba: "UBA",
  zenith: "Zenith Bank",
  gtbank: "GTBank",
  access: "Access Bank",
  firstbank: "First Bank",
  taj: "TAJBank",
  other: "Other bank",
};

export const PURPOSES: Record<BankPurpose, string> = {
  ops: "Operations",
  project: "Project",
  business: "Business",
  dom: "Domiciliary",
  fees: "Fees collection",
  grants: "Grants",
  payroll: "Payroll",
  other: "Other",
};

export const ACCOUNT_TYPES: Record<BankAccountType, string> = {
  current: "Current",
  overdraft: "Overdraft",
  domiciliary: "Domiciliary",
  savings: "Savings",
};

export const TEMPLATES: Record<StatementTemplate, { label: string; accept: string; hint: string }> = {
  uba_pdf: { label: "UBA PDF statement", accept: ".pdf,application/pdf", hint: "The PDF statement exactly as UBA sends it - no scans, no edits." },
  csv: { label: "CSV export", accept: ".csv,.txt,text/csv", hint: "A CSV with date, narration, debit, credit and balance columns." },
  xlsx: { label: "Excel export", accept: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", hint: "An Excel sheet with date, narration, debit, credit and balance columns." },
};

export const IMPORT_STATUS: Record<ImportStatus, { label: string; hue: Hue; icon: LucideIcon }> = {
  uploaded: { label: "Uploaded", hue: "slate", icon: Hourglass },
  parsing: { label: "Reading the file", hue: "sky", icon: Loader2 },
  failed_validation: { label: "Failed checks", hue: "rose", icon: FileWarning },
  ready_for_review: { label: "Ready for review", hue: "sun", icon: Clock },
  submitted: { label: "Sent for approval", hue: "grape", icon: Send },
  posted: { label: "Posted", hue: "mint", icon: FileCheck2 },
};

export const importStatus = (s: string) => IMPORT_STATUS[s as ImportStatus] ?? { label: s, hue: "slate" as Hue, icon: Clock };

/** Still on the queue: poll until it settles. */
export const isProcessing = (s: string) => s === "uploaded" || s === "parsing";

/** How long an import may sit uploaded/parsing before it counts as stuck and may be run again. */
export const STUCK_AFTER_MS = 15 * 60 * 1000;

/**
 * May this import be run again? A failed one, or one still on the queue well
 * after its last change. The API has the last word (it refuses an import
 * that already has lines).
 */
export function canRetryImport(i: Pick<StatementSummary, "status" | "uploadedAt"> & { updatedAt?: string | null }, now: number = Date.now()): boolean {
  if (i.status === "failed_validation") return true;
  const since = i.updatedAt ?? i.uploadedAt;
  if (!isProcessing(i.status) || !since) return false;
  return now - new Date(since).getTime() >= STUCK_AFTER_MS;
}

export const CHECK_STATUS: Record<CheckStatus, { label: string; hue: Hue; icon: LucideIcon }> = {
  pass: { label: "Passed", hue: "mint", icon: BadgeCheck },
  fail: { label: "Failed", hue: "rose", icon: AlertTriangle },
  warn: { label: "Check this", hue: "sun", icon: AlertTriangle },
  na: { label: "Not printed", hue: "slate", icon: CircleSlash },
};

export const CATEGORIES: Record<string, { label: string; hue: Hue }> = {
  receipt: { label: "Receipt", hue: "mint" },
  payment: { label: "Payment", hue: "blue" },
  transfer: { label: "Own-account transfer", hue: "sky" },
  reversal: { label: "Reversal", hue: "slate" },
  bank_charge: { label: "Bank charge", hue: "coral" },
  tax: { label: "Tax", hue: "grape" },
  government_payment: { label: "Government payment", hue: "rose" },
};

export const categoryMeta = (c: string | null | undefined) =>
  c ? (CATEGORIES[c] ?? { label: humanise(c), hue: "slate" as Hue }) : { label: "Not classified", hue: "slate" as Hue };

export const SOURCES: Record<string, string> = {
  rule: "Rule",
  memory: "Remembered",
  "rule+memory": "Rule + remembered",
  alias: "Account alias",
  keyword: "Project keyword",
  user: "You",
  pairing: "Pairing",
};

export const sourceLabel = (s: string | null | undefined) => (s ? (SOURCES[s] ?? humanise(s)) : "Not classified");

/** Flags a person should see on a line. `match_client` and `pair_*` are instructions, not news. */
export const FLAGS: Record<string, { label: string; hue: Hue; icon: LucideIcon }> = {
  needs_review: { label: "Needs review", hue: "sun", icon: AlertTriangle },
  needs_dimension: { label: "Needs a project or cost centre", hue: "sun", icon: AlertTriangle },
  reversed: { label: "Reversed pair", hue: "slate", icon: ArrowLeftRight },
  unpaired_reversal: { label: "Reversal with no match", hue: "rose", icon: AlertTriangle },
};

export const RULE_ACTIONS: Record<RuleAction, { label: string; hint: string }> = {
  classify: { label: "Classify", hint: "Set the category and account." },
  pair_transfer: { label: "Pair own-account transfer", hint: "Find the other leg in one of our accounts." },
  pair_reversal: { label: "Pair reversal", hint: "Match the reversal to the payment it undoes." },
  match_client: { label: "Match client", hint: "Look the payer up among clients." },
  split_fee: { label: "Split transfer fee", hint: "Split principal, fee and VAT using the fee table." },
  review: { label: "Send for review", hint: "Always ask a person." },
};

export const RECON_STATUS: Record<ReconciliationStatus | "none", { label: string; hue: Hue }> = {
  approved: { label: "Approved", hue: "mint" },
  balanced: { label: "Balanced, not approved", hue: "sky" },
  draft: { label: "Prepared, not balanced", hue: "sun" },
  none: { label: "Not reconciled", hue: "slate" },
};

export function humanise(s: string): string {
  const t = s.replace(/[_-]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* ------------------------------------------------------------------ */
/*  The import pipeline                                                */
/* ------------------------------------------------------------------ */

export const PIPELINE = ["Uploaded", "Verified", "Reviewed", "Sent for approval", "Posted"] as const;

/**
 * Where an import is on uploaded → verified → reviewed → sent → posted:
 * `done` steps completed, `failed` when verification stopped it.
 * "Reviewed" is done once no line still needs an account.
 */
export function pipelineStage(i: Pick<StatementSummary, "status">, needsAccount = 0): { done: number; failed: boolean } {
  switch (i.status) {
    case "uploaded":
    case "parsing":
      return { done: 1, failed: false };
    case "failed_validation":
      return { done: 1, failed: true };
    case "ready_for_review":
      return { done: needsAccount === 0 ? 3 : 2, failed: false };
    case "submitted":
      return { done: 4, failed: false };
    case "posted":
      return { done: 5, failed: false };
    default:
      return { done: 0, failed: false };
  }
}

/* ------------------------------------------------------------------ */
/*  Months                                                             */
/* ------------------------------------------------------------------ */

/** `YYYY-MM` for a date. */
export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** The `n` months ending with `end` (a `YYYY-MM`), oldest first. */
export function monthsEnding(end: string, n = 12): string[] {
  const [y, m] = end.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - 1 - (n - 1 - i), 1);
    return monthKey(d);
  });
}

/** One month either side of a `YYYY-MM`. */
export function shiftMonth(key: string, by: number): string {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + by, 1));
}

export const isMonthKey = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

/** First and last day of a `YYYY-MM`, as ISO dates. */
export function monthRange(key: string): { from: string; to: string } {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${key}-01`, to: `${key}-${String(last).padStart(2, "0")}` };
}

/** Book minus bank, when both are known. */
export function bookVsBank(book: number, bank: number | null): number | null {
  return bank === null ? null : book - bank;
}
