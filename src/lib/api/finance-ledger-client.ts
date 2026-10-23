/* ------------------------------------------------------------------ */
/*  Elevate Finance › the ledger: chart of accounts, periods,          */
/*  journals, month- and year-end, and the financial statements.       */
/*                                                                    */
/*  Shapes are read off the Laravel controllers                        */
/*  (`app/Suite/Finance/Controllers/{Account,Period,Journal,Report,    */
/*  PeriodEnd}Controller.php`) and `Services/Reports/FinancialReports`.*/
/*  Every amount is integer minor units of the organisation's base     */
/*  currency unless a field says otherwise (`txn*`, `currencyBalance`).*/
/* ------------------------------------------------------------------ */

import { financeRequest, unwrap } from "./finance-request";

export { ApiError, errorText } from "./finance-request";

/* ------------------------------ accounts ---------------------------- */

export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "cost_of_revenue"
  | "expense"
  | "other_income"
  | "other_expense";

export type CashFlowClass = "operating" | "investing" | "financing";

/** `Account::requiredDimensions()` - the words, not keys. */
export type DimensionWord = "project" | "cost centre" | "counterparty" | "person";

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: string | null;
  parentId: string | null;
  level: number;
  isPostable: boolean;
  normalBalance: "debit" | "credit";
  requires: DimensionWord[];
  requiresProject: boolean;
  requiresCostCentre: boolean;
  requiresCounterparty: boolean;
  requiresPerson: boolean;
  /** Set on a currency-bound account (a USD bank account); null takes any. */
  currency: string | null;
  isBank: boolean;
  /** The purpose automatic postings use this account for, e.g. `bank_charges`. */
  systemKey: string | null;
  cashFlow: CashFlowClass | null;
  description: string | null;
  active: boolean;
  /** Anything ever posted to it: its code and type are then fixed. */
  used: boolean;
  aliases: { id: string; alias: string }[];
}

export interface CoaTemplate {
  key: string;
  name: string;
  description: string;
}

export interface AccountsPayload {
  accounts: Account[];
  templates: CoaTemplate[];
  systemKeys: string[];
}

/** What `POST /accounts` and `PATCH /accounts/{id}` take (camelCase). */
export interface AccountInput {
  code?: string;
  name?: string;
  type?: AccountType;
  subtype?: string | null;
  parentId?: string | null;
  isHeading?: boolean;
  normalBalance?: "debit" | "credit";
  requiresProject?: boolean;
  requiresCostCentre?: boolean;
  requiresCounterparty?: boolean;
  requiresPerson?: boolean;
  currency?: string | null;
  cashFlow?: CashFlowClass | null;
  description?: string | null;
  active?: boolean;
  systemKey?: string | null;
}

/* ------------------------------ periods ----------------------------- */

export type PeriodStatus = "open" | "soft_closed" | "locked";

export interface Period {
  id: string;
  /** `2026-08` */
  key: string;
  /** `August 2026` */
  label: string;
  startsOn: string;
  endsOn: string;
  status: PeriodStatus;
  /** Journals in the books (posted, and posted-then-reversed). */
  posted: number;
  postedTotal: number;
  drafts: number;
  pending: number;
  changedAt: string | null;
  reopenReason: string | null;
}

/* ------------------------------ journals ---------------------------- */

export type JournalStatus = "draft" | "pending_approval" | "posted" | "reversed" | "rejected";

/** `Journal::TYPES`. Only `manual` and `opening` can be keyed by hand. */
export type JournalType =
  | "manual"
  | "payroll"
  | "bank"
  | "fx_reval"
  | "opening"
  | "closing"
  | "reversal"
  | "labour"
  | "ap"
  | "ar"
  | "depreciation";

export interface JournalSummary {
  id: string;
  /** Null until the journal is numbered (drafts may have none). */
  journalNo: string | null;
  journalDate: string;
  type: JournalType;
  narration: string;
  status: JournalStatus;
  total: number;
  /** What made it: `statement_import`, `payroll_run`, `demo_seed`… */
  sourceType: string | null;
  sourceId: string | null;
  /** Made by a recurring journal template (open at `/suite/finance/journals/recurring/{id}`). */
  recurringJournalId?: string | null;
  createdBy: string | null;
  postedAt: string | null;
  reversesJournalId: string | null;
  reversedByJournalId: string | null;
  /** The approval instance (open at `/suite/approvals/{id}`). */
  approvalId: string | null;
}

export interface JournalLine {
  id: string;
  lineNo: number;
  account: { id: string; code: string | null; name: string | null };
  /** Base currency. */
  debit: number;
  credit: number;
  txnCurrency: string | null;
  txnDebit: number;
  txnCredit: number;
  /** "1520.5" for a converted line; null at par. */
  fxRate: string | null;
  project: { id: string; name: string | null } | null;
  costCentre: { id: string; code: string; name: string } | null;
  counterparty: { id: string; name: string } | null;
  person: { id: string; name: string } | null;
  unitId: string | null;
  narration: string | null;
}

export interface JournalDetail extends JournalSummary {
  /** The organisation's base currency. */
  currency: string;
  postedBy: string | null;
  autoReverseOn: string | null;
  lines: JournalLine[];
}

/** A line as the entry grid sends it: amounts in the line's currency. */
export interface JournalLineInput {
  accountId: string;
  debit?: number | null;
  credit?: number | null;
  currency?: string | null;
  projectId?: string | null;
  costCentreId?: string | null;
  counterpartyId?: string | null;
  personId?: string | null;
  unitId?: string | null;
  narration?: string | null;
}

export interface JournalInput {
  journalDate: string;
  narration: string;
  type?: "manual" | "opening";
  lines: JournalLineInput[];
}

export interface JournalFilters {
  status?: JournalStatus;
  type?: string;
  from?: string;
  to?: string;
  accountId?: string;
  q?: string;
}

/* ------------------------------ reports ----------------------------- */

export interface ReportFilters {
  from?: string;
  to?: string;
  projectId?: string;
  costCentreId?: string;
  counterpartyId?: string;
  unitId?: string;
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  openingDebit: number;
  openingCredit: number;
  debit: number;
  credit: number;
  closingDebit: number;
  closingCredit: number;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  totals: Omit<TrialBalanceRow, "accountId" | "code" | "name" | "type">;
  balanced: boolean;
  currency: string;
}

export interface LedgerLine {
  journalId: string;
  journalNo: string | null;
  date: string;
  type: JournalType;
  narration: string | null;
  debit: number;
  credit: number;
  txnCurrency: string | null;
  /** Signed, debit-positive, in `txnCurrency`. */
  txnAmount: number;
  /** Running balance, debit-positive, base currency. */
  balance: number;
}

export interface AccountLedger {
  account: { id: string; code: string; name: string; type: AccountType; normalBalance: "debit" | "credit"; currency: string | null };
  /** Debit-positive. */
  opening: number;
  closing: number;
  lines: LedgerLine[];
  currency: string;
}

export interface StatementRow {
  accountId: string;
  code: string;
  name: string;
  /** The parent heading's name. */
  group: string | null;
  amount: number;
}

export interface StatementSection {
  rows: StatementRow[];
  total: number;
}

export interface MonthlyIncome {
  /** `2026-03` */
  month: string;
  /** `Mar 2026` */
  label: string;
  income: number;
  directCosts: number;
  expenses: number;
  surplus: number;
}

export interface IncomeStatement {
  from: string;
  to: string;
  currency: string;
  revenue: StatementSection;
  costOfRevenue: StatementSection;
  grossSurplus: number;
  expenses: StatementSection;
  operatingSurplus: number;
  otherIncome: StatementSection;
  otherExpenses: StatementSection;
  netSurplus: number;
  monthly: MonthlyIncome[];
}

export interface BalanceSheet {
  asAt: string;
  currency: string;
  currentAssets: StatementSection;
  nonCurrentAssets: StatementSection;
  totalAssets: number;
  currentLiabilities: StatementSection;
  nonCurrentLiabilities: StatementSection;
  totalLiabilities: number;
  equity: StatementSection;
  /** Income less expenses not yet closed into accumulated surplus. */
  unclosedSurplus: number;
  totalEquity: number;
  balanced: boolean;
}

export interface CashFlowSection {
  rows: { label: string; amount: number }[];
  inflows: number;
  outflows: number;
  total: number;
}

export interface CashFlow {
  from: string;
  to: string;
  currency: string;
  openingCash: number;
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netChange: number;
  closingCash: number;
}

export interface CashPositionRow {
  accountId: string;
  code: string;
  name: string;
  currency: string | null;
  /** Base currency, debit-positive. */
  balance: number;
  /** In the account's own currency; null for an account that takes any. */
  currencyBalance: number | null;
}

/* ----------------------------- period end --------------------------- */

export type RevaluationRow =
  | { accountId: string; code: string; name: string; currency: string; error: string }
  | {
      accountId: string;
      code: string;
      name: string;
      currency: string;
      currencyBalance: number;
      /** Base value carried in the books today. */
      carried: number;
      /** "1520.5" */
      rate: string;
      restated: number;
      /** Positive is a gain. */
      difference: number;
      error?: undefined;
    };

export interface RunResult {
  id: string;
  journalNo: string | null;
  total: number;
}

/* ------------------------------- client ----------------------------- */

const boolQ = (v: boolean | undefined) => (v === undefined ? undefined : v ? 1 : 0);

export const ledger = {
  accounts: {
    list: (opts: { postableOnly?: boolean; includeInactive?: boolean } = {}): Promise<AccountsPayload> =>
      financeRequest<{ data: Account[]; meta: { templates: CoaTemplate[]; systemKeys: string[] } }>("accounts", {
        query: { postableOnly: boolQ(opts.postableOnly), includeInactive: boolQ(opts.includeInactive) },
      }).then((r) => ({ accounts: r.data, templates: r.meta?.templates ?? [], systemKeys: r.meta?.systemKeys ?? [] })),
    create: (input: AccountInput) => unwrap(financeRequest<{ data: Account }>("accounts", { method: "POST", body: input })),
    update: (id: string, input: AccountInput) =>
      unwrap(financeRequest<{ data: Account }>(`accounts/${id}`, { method: "PATCH", body: input })),
    remove: (id: string) => financeRequest<void>(`accounts/${id}`, { method: "DELETE" }),
    applyTemplate: (template: string) =>
      unwrap(financeRequest<{ data: { created: number } }>("accounts/template", { method: "POST", body: { template } })),
    addAlias: (id: string, alias: string) =>
      unwrap(financeRequest<{ data: Account }>(`accounts/${id}/aliases`, { method: "POST", body: { alias } })),
    removeAlias: (id: string, aliasId: string) => financeRequest<void>(`accounts/${id}/aliases/${aliasId}`, { method: "DELETE" }),
  },

  periods: {
    /** Asking for a year creates its twelve months. */
    list: (year?: number) => unwrap(financeRequest<{ data: Period[] }>("periods", { query: { year } })),
    /** Reopening (to open, or locked → soft-closed) needs a reason. */
    setStatus: (id: string, status: PeriodStatus, reason?: string) =>
      unwrap(
        financeRequest<{ data: { id: string; status: PeriodStatus } }>(`periods/${id}`, {
          method: "PATCH",
          body: { status, reason: reason || undefined },
        }),
      ),
  },

  journals: {
    list: (filters: JournalFilters = {}) =>
      unwrap(financeRequest<{ data: JournalSummary[] }>("journals", { query: { ...filters } })),
    get: (id: string) => unwrap(financeRequest<{ data: JournalDetail }>(`journals/${id}`)),
    create: (input: JournalInput) => unwrap(financeRequest<{ data: JournalDetail }>("journals", { method: "POST", body: input })),
    update: (id: string, input: JournalInput) =>
      unwrap(financeRequest<{ data: JournalDetail }>(`journals/${id}`, { method: "PATCH", body: input })),
    remove: (id: string) => financeRequest<void>(`journals/${id}`, { method: "DELETE" }),
    submit: (id: string) => unwrap(financeRequest<{ data: JournalDetail }>(`journals/${id}/submit`, { method: "POST" })),
    post: (id: string) => unwrap(financeRequest<{ data: JournalDetail }>(`journals/${id}/post`, { method: "POST" })),
    /** Returns the reversing journal. */
    reverse: (id: string, date: string, reason: string) =>
      unwrap(financeRequest<{ data: JournalDetail }>(`journals/${id}/reverse`, { method: "POST", body: { date, reason } })),
  },

  reports: {
    trialBalance: (f: ReportFilters = {}) =>
      unwrap(financeRequest<{ data: TrialBalance }>("reports/trial-balance", { query: { ...f } })),
    ledger: (accountId: string, f: ReportFilters = {}) =>
      unwrap(financeRequest<{ data: AccountLedger }>(`reports/ledger/${accountId}`, { query: { ...f } })),
    incomeStatement: (f: ReportFilters = {}) =>
      unwrap(financeRequest<{ data: IncomeStatement }>("reports/income-statement", { query: { ...f } })),
    balanceSheet: (asAt?: string) =>
      unwrap(financeRequest<{ data: BalanceSheet }>("reports/balance-sheet", { query: { asAt } })),
    /** Not narrowed by dimension: the API ignores those filters here. */
    cashFlow: (f: Pick<ReportFilters, "from" | "to"> = {}) =>
      unwrap(financeRequest<{ data: CashFlow }>("reports/cash-flow", { query: { from: f.from, to: f.to } })),
    cashPosition: (asAt?: string) =>
      unwrap(financeRequest<{ data: CashPositionRow[] }>("reports/cash-position", { query: { asAt } })),
  },

  periodEnd: {
    /** `month` is `YYYY-MM`. */
    revaluationPreview: (month: string) =>
      unwrap(financeRequest<{ data: RevaluationRow[] }>("period-end/revaluation", { query: { month } })),
    /** Null when nothing needed restating. */
    revalue: (month: string) =>
      unwrap(financeRequest<{ data: RunResult | null }>("period-end/revaluation", { method: "POST", body: { month } })),
    /** Null when the year had no income or expense to close. */
    closeYear: (yearEnd: string) =>
      unwrap(financeRequest<{ data: RunResult | null }>("period-end/close-year", { method: "POST", body: { yearEnd } })),
  },
};
