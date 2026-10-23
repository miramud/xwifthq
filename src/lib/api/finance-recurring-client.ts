/* ------------------------------------------------------------------ */
/*  XwiftHQ Finance › recurring journals (FIN-PRD §7.2): templates     */
/*  that make a journal, for approval, on a schedule.                  */
/*                                                                    */
/*  Shapes are read off `Finance/Controllers/                          */
/*  RecurringJournalController.php`. Line amounts are integer minor    */
/*  units in each line's own currency.                                 */
/* ------------------------------------------------------------------ */

import { financeRequest, unwrap } from "./finance-request";
import type { JournalLineInput, JournalStatus } from "./finance-ledger-client";

export { ApiError, errorText } from "./finance-request";

export type RecurringFrequency = "monthly" | "quarterly" | "annual";
export type RecurringStatus = "active" | "paused" | "ended";
/** What became of one occurrence. */
export type RecurringRunStatus = "pending" | "created" | "skipped" | "failed";

export interface RecurringJournalSummary {
  id: string;
  name: string;
  narration: string;
  frequency: RecurringFrequency;
  /** 1-31; a day the month lacks means its last day. */
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  maxOccurrences: number | null;
  autoReverse: boolean;
  status: RecurringStatus;
  nextRunOn: string | null;
  lastRunOn: string | null;
  /** Occurrences scheduled so far. */
  occurrences: number;
  /** Σ debits, in the lines' own currency. */
  amount: number;
  /** Foreign currencies on the lines; empty when all base. */
  currencies: string[];
  lastError: string | null;
  lastErrorAt: string | null;
  createdBy: string | null;
  /** Occurrences skipped (locked month) or refused, waiting to be retried. List only. */
  outstanding?: number;
}

export interface RecurringLine {
  lineNo: number;
  account: { id: string; code: string | null; name: string | null };
  debit: number;
  credit: number;
  currency: string | null;
  project: { id: string; name: string | null } | null;
  costCentre: { id: string; name: string | null } | null;
  counterparty: { id: string; name: string | null } | null;
  person: { id: string; name: string | null } | null;
  unitId: string | null;
  narration: string | null;
}

export interface RecurringRun {
  id: string;
  occurrenceNo: number;
  occurrenceDate: string;
  status: RecurringRunStatus;
  /** Why it was skipped or refused, or why it stayed a draft. */
  reason: string | null;
  attempts: number;
  attemptedAt: string | null;
  journal: { id: string; journalNo: string | null; status: JournalStatus; total: number } | null;
}

export interface RecurringJournalDetail extends RecurringJournalSummary {
  baseCurrency: string;
  updatedBy: string | null;
  /** The next few occurrence dates. */
  upcoming: string[];
  lines: RecurringLine[];
  runs: RecurringRun[];
}

export interface RecurringJournalInput {
  name?: string;
  narration?: string;
  frequency?: RecurringFrequency;
  dayOfMonth?: number;
  startDate?: string;
  endDate?: string | null;
  maxOccurrences?: number | null;
  autoReverse?: boolean;
  lines?: JournalLineInput[];
}

const enc = encodeURIComponent;

export const recurring = {
  list: () => unwrap(financeRequest<{ data: RecurringJournalSummary[] }>("recurring-journals")),
  get: (id: string) => unwrap(financeRequest<{ data: RecurringJournalDetail }>(`recurring-journals/${enc(id)}`)),
  create: (input: RecurringJournalInput) =>
    unwrap(financeRequest<{ data: RecurringJournalDetail }>("recurring-journals", { method: "POST", body: input })),
  update: (id: string, input: RecurringJournalInput) =>
    unwrap(financeRequest<{ data: RecurringJournalDetail }>(`recurring-journals/${enc(id)}`, { method: "PATCH", body: input })),
  /** Only a template that never made a journal. */
  remove: (id: string) => financeRequest<void>(`recurring-journals/${enc(id)}`, { method: "DELETE" }),
  pause: (id: string) => unwrap(financeRequest<{ data: RecurringJournalDetail }>(`recurring-journals/${enc(id)}/pause`, { method: "POST" })),
  resume: (id: string) => unwrap(financeRequest<{ data: RecurringJournalDetail }>(`recurring-journals/${enc(id)}/resume`, { method: "POST" })),
  /** A skipped or refused occurrence again, or (no date) the next one ahead of its day. */
  run: (id: string, occurrenceDate?: string) =>
    unwrap(
      financeRequest<{ data: { run: RecurringRun; template: RecurringJournalDetail } }>(`recurring-journals/${enc(id)}/run`, {
        method: "POST",
        body: occurrenceDate ? { occurrenceDate } : {},
      }),
    ),
  journals: (id: string) => unwrap(financeRequest<{ data: RecurringRun[] }>(`recurring-journals/${enc(id)}/journals`)),
};
