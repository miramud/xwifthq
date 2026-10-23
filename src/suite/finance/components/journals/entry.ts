import type { Account, JournalDetail, JournalInput, JournalLineInput } from "@/lib/api/finance-ledger-client";
import { amountInput, parseAmount } from "@/suite/finance/lib/format";
import { requiredDimensions, type Dimension } from "./dimensions";
import type { JournalErrors, LineField } from "./meta";

/*
  The entry grid's arithmetic, apart from the screen: rows as typed, their
  totals per currency, and the journal they become. Amounts stay text while
  somebody types; they are read as minor units only here.
*/

export interface EntryRow {
  key: string;
  accountId: string;
  debit: string;
  credit: string;
  narration: string;
  /** "" = the organisation's base currency. */
  currency: string;
  projectId: string;
  costCentreId: string;
  counterpartyId: string;
  personId: string;
  unitId: string;
  /** Optional details open. */
  more: boolean;
}

let seq = 0;
export const newKey = () => `r${++seq}`;

export const blankRow = (): EntryRow => ({
  key: newKey(),
  accountId: "",
  debit: "",
  credit: "",
  narration: "",
  currency: "",
  projectId: "",
  costCentreId: "",
  counterpartyId: "",
  personId: "",
  unitId: "",
  more: false,
});

/** A saved draft back into rows, amounts in each line's own currency. */
export function rowsFromDetail(j: JournalDetail): EntryRow[] {
  return j.lines.map((l) => {
    const foreign = l.txnCurrency && l.txnCurrency !== j.currency ? l.txnCurrency : "";
    const dr = foreign ? l.txnDebit : l.debit;
    const cr = foreign ? l.txnCredit : l.credit;
    return {
      ...blankRow(),
      accountId: l.account.id,
      debit: amountInput(dr),
      credit: amountInput(cr),
      narration: l.narration ?? "",
      currency: foreign,
      projectId: l.project?.id ?? "",
      costCentreId: l.costCentre?.id ?? "",
      counterpartyId: l.counterparty?.id ?? "",
      personId: l.person?.id ?? "",
      unitId: l.unitId ?? "",
      more: Boolean(l.unitId || foreign),
    };
  });
}

/** The currency a row is in: a currency-bound account decides it. */
export const rowCurrency = (row: EntryRow, account: Account | undefined) => account?.currency ?? row.currency;

/** Is this row untouched? Untouched rows are left out of the journal. */
export const isBlank = (r: EntryRow) => !r.accountId && !r.debit.trim() && !r.credit.trim() && !r.narration.trim();

/** Σ debit and Σ credit per currency ("" = base). Unreadable amounts count as zero. */
export function totals(rows: EntryRow[], accounts: Map<string, Account>): Map<string, { debits: number; credits: number }> {
  const out = new Map<string, { debits: number; credits: number }>();
  for (const r of rows) {
    if (isBlank(r)) continue;
    const c = rowCurrency(r, accounts.get(r.accountId));
    const t = out.get(c) ?? { debits: 0, credits: 0 };
    t.debits += parseAmount(r.debit) ?? 0;
    t.credits += parseAmount(r.credit) ?? 0;
    out.set(c, t);
  }
  return out;
}

export interface Prepared {
  input: JournalInput | null;
  errors: JournalErrors;
  /** The row each sent line came from, to place the API's `lines.N` errors. */
  sent: string[];
}

/** Check what can be checked here, then shape the request. */
export function prepare(
  head: { date: string; narration: string; type: "manual" | "opening" },
  rows: EntryRow[],
  accounts: Map<string, Account>,
): Prepared {
  const errors: JournalErrors = { lines: {} };
  const byKey: Record<string, Partial<Record<LineField, string>>> = {};
  const lines: JournalLineInput[] = [];
  const sent: string[] = [];

  if (!head.date) errors.date = "Choose the date this journal belongs to.";
  if (!head.narration.trim()) errors.narration = "Say what this journal is for.";

  rows.forEach((r) => {
    if (isBlank(r)) return;
    const e: Partial<Record<LineField, string>> = {};
    const account = accounts.get(r.accountId);
    const dr = r.debit.trim() ? parseAmount(r.debit) : 0;
    const cr = r.credit.trim() ? parseAmount(r.credit) : 0;
    if (!r.accountId) e.accountId = "Choose an account.";
    if (dr === null || cr === null) e.debit = "Type an amount, like 1,250.00.";
    else if ((dr > 0) === (cr > 0)) e.debit = dr > 0 ? "A line is a debit or a credit, not both." : "Enter a debit or a credit.";
    for (const d of requiredDimensions(account?.requires ?? [])) {
      if (!r[d]) e[d as LineField] = "Required for this account.";
    }
    if (Object.keys(e).length) byKey[r.key] = e;
    sent.push(r.key);
    lines.push({
      accountId: r.accountId,
      debit: dr || null,
      credit: cr || null,
      currency: rowCurrency(r, account) || null,
      projectId: r.projectId || null,
      costCentreId: r.costCentreId || null,
      counterpartyId: r.counterpartyId || null,
      personId: r.personId || null,
      unitId: r.unitId || null,
      narration: r.narration.trim() || null,
    });
  });

  if (lines.length < 2) errors.grid = "A journal needs at least two lines.";
  sent.forEach((k, i) => {
    if (byKey[k]) errors.lines[i] = byKey[k];
  });

  const ok = !errors.date && !errors.narration && !errors.grid && Object.keys(errors.lines).length === 0;
  return {
    input: ok ? { journalDate: head.date, narration: head.narration.trim(), type: head.type, lines } : null,
    errors,
    sent,
  };
}

/** Errors by row key (from errors by sent index). */
export function errorsByRow(errors: JournalErrors, sent: string[]): Record<string, Partial<Record<LineField, string>>> {
  const out: Record<string, Partial<Record<LineField, string>>> = {};
  for (const [i, e] of Object.entries(errors.lines)) {
    const k = sent[Number(i)];
    if (k) out[k] = e;
  }
  return out;
}

export type { Dimension };
