import { CheckCircle2, Clock, FilePen, RotateCcw, XCircle, type LucideIcon } from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import { ApiError, type JournalStatus } from "@/lib/api/finance-ledger-client";

/* Journal words: statuses, types, where a journal came from, and errors. */

export const JOURNAL_STATUS: Record<JournalStatus, { label: string; hue: Hue; icon: LucideIcon }> = {
  draft: { label: "Draft", hue: "slate", icon: FilePen },
  pending_approval: { label: "Awaiting approval", hue: "sun", icon: Clock },
  posted: { label: "Posted", hue: "mint", icon: CheckCircle2 },
  reversed: { label: "Reversed", hue: "grape", icon: RotateCcw },
  rejected: { label: "Rejected", hue: "rose", icon: XCircle },
};

export const JOURNAL_TYPES: Record<string, string> = {
  manual: "Manual",
  opening: "Opening balances",
  bank: "Bank",
  payroll: "Payroll",
  fx_reval: "FX revaluation",
  closing: "Year-end close",
  reversal: "Reversal",
  labour: "Labour",
  ap: "Payables",
  ar: "Receivables",
  depreciation: "Depreciation",
};

export const journalTypeLabel = (t: string) => JOURNAL_TYPES[t] ?? t.replace(/_/g, " ");

/** `fin_journals.source_type` of a journal a recurring template made. */
export const RECURRING_SOURCE = "fin_recurring_journal";

/** Where a journal came from, and where to see that. */
export function journalSource(sourceType: string | null, sourceId: string | null): { label: string; href?: string } | null {
  if (!sourceType) return null;
  if (sourceType === "statement_import")
    return { label: "Bank statement import", href: sourceId ? `/suite/finance/banking/imports/${sourceId}` : undefined };
  if (sourceType === "hrm_payroll_run") return { label: "Payroll run", href: "/suite/finance/payroll" };
  if (sourceType === RECURRING_SOURCE) return { label: "Recurring journal", href: sourceId ? `/suite/finance/journals/recurring/${sourceId}` : undefined };
  if (sourceType === "demo_seed") return { label: "Demo data" };
  return { label: sourceType.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) };
}

/**
 * The ledger's refusals start with a code (`JOURNAL_UNBALANCED: …`,
 * `DIMENSION_REQUIRED: cost centre - …`). The sentence after it already
 * says what happened; the code is for logs, not for people.
 */
export function plainError(message: string): string {
  const dim = /^DIMENSION_REQUIRED:\s*([^-]+?)\s+-\s+(.*)$/.exec(message);
  if (dim) return `Choose a ${dim[1]}: ${dim[2]}`;
  return message.replace(/^[A-Z][A-Z_]+:\s*/, "");
}

/** Line fields as the grid names them. The API answers in camel or snake case. */
export type LineField = "accountId" | "debit" | "currency" | "projectId" | "costCentreId" | "counterpartyId" | "personId" | "unitId" | "narration";

const LINE_FIELD: Record<string, LineField> = {
  accountId: "accountId",
  account_id: "accountId",
  debit: "debit",
  credit: "debit",
  currency: "currency",
  projectId: "projectId",
  project_id: "projectId",
  costCentreId: "costCentreId",
  cost_centre_id: "costCentreId",
  counterpartyId: "counterpartyId",
  counterparty_id: "counterpartyId",
  personId: "personId",
  person_id: "personId",
  unitId: "unitId",
  org_unit_id: "unitId",
  narration: "narration",
};

export interface JournalErrors {
  /** Per line index, per field. */
  lines: Record<number, Partial<Record<LineField, string>>>;
  /** The whole grid: unbalanced, too few lines. */
  grid?: string;
  date?: string;
  narration?: string;
  /** Anything else, shown as a banner. */
  general?: string;
}

/** Spread a 422 over the entry form: each message next to what it is about. */
export function journalErrors(e: unknown): JournalErrors {
  const out: JournalErrors = { lines: {} };
  if (!(e instanceof ApiError)) {
    out.general = e instanceof Error ? e.message : "The journal wasn't saved. Try again.";
    return out;
  }
  if (!e.errors) {
    out.general = plainError(e.message);
    return out;
  }
  const rest: string[] = [];
  for (const [key, msgs] of Object.entries(e.errors)) {
    const msg = plainError(String((msgs as string[])[0] ?? ""));
    const line = /^lines\.(\d+)\.(\w+)$/.exec(key);
    if (line) {
      const i = Number(line[1]);
      const field = LINE_FIELD[line[2]] ?? "accountId";
      out.lines[i] = { ...out.lines[i], [field]: out.lines[i]?.[field] ?? msg };
    } else if (key === "lines") out.grid = msg;
    else if (key === "journal_date" || key === "journalDate") out.date = msg;
    else if (key === "narration") out.narration = msg;
    else rest.push(msg);
  }
  if (rest.length) out.general = rest.join(" ");
  return out;
}

/** True when any message is present. */
export const hasErrors = (e: JournalErrors) =>
  Boolean(e.grid || e.date || e.narration || e.general || Object.keys(e.lines).length);
