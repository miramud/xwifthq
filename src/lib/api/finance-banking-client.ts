/* ------------------------------------------------------------------ */
/*  XwiftHQ Finance › Banking: bank accounts, statement imports and    */
/*  their review queue, reconciliation, classification rules and       */
/*  payroll postings. Shapes follow the Laravel controllers in         */
/*  `app/Suite/Finance/Controllers` (BankAccount, Statement,           */
/*  Reconciliation, BankRule, PayrollPosting). Money is integer minor  */
/*  units (kobo) throughout.                                           */
/* ------------------------------------------------------------------ */

import { financeRequest, financeUpload, unwrap } from "./finance-request";

export { ApiError, errorText } from "./finance-request";

/* ---------------------------- bank accounts ---------------------------- */

/** `BankAccount::BANKS` keys. */
export type BankCode = "uba" | "zenith" | "gtbank" | "access" | "firstbank" | "taj" | "other";
export type BankPurpose = "ops" | "project" | "business" | "dom" | "fees" | "grants" | "payroll" | "other";
export type BankAccountType = "current" | "overdraft" | "domiciliary" | "savings";
export type StatementTemplate = "uba_pdf" | "csv" | "xlsx";

export interface BankAccount {
  id: string;
  name: string;
  bankCode: BankCode;
  bankName: string | null;
  /** Masked: `•••• 1234`. The full number never leaves the API. */
  number: string;
  currency: string;
  accountType: BankAccountType;
  purpose: BankPurpose;
  statementTemplate: StatementTemplate;
  columnMapping: Record<string, unknown> | null;
  addressOnRecord: string | null;
  lowBalanceThreshold: number | null;
  status: "active" | "closed";
  glAccount: { id: string; code: string; name: string } | null;
  /** Ledger balance of the linked GL account (posted journals). */
  bookBalance: number;
  /** The running balance on the latest statement line, if any statement is in. */
  bankBalance: number | null;
  bankBalanceDate: string | null;
  /** End date of the last month whose reconciliation is approved. */
  lastReconciled: string | null;
  unreconciledCount: number;
  unreconciledValue: number;
}

export type ReconciliationStatus = "draft" | "balanced" | "approved";

export interface BankAccountDetail extends BankAccount {
  imports: StatementSummary[];
  reconciliations: {
    periodKey: string;
    status: ReconciliationStatus;
    difference: number | null;
    statementClosing: number | null;
    glClosing: number | null;
  }[];
}

export interface BankAccountInput {
  name: string;
  bankCode: BankCode;
  bankName?: string | null;
  accountNumber: string;
  currency?: string;
  accountType?: BankAccountType;
  purpose?: BankPurpose;
  /** An existing postable asset account; leave out and one is made under the cash heading. */
  glAccountId?: string | null;
  statementTemplate?: StatementTemplate;
  columnMapping?: Record<string, unknown> | null;
  addressOnRecord?: string | null;
  lowBalanceThreshold?: number | null;
}

export type BankAccountUpdate = Partial<
  Pick<BankAccountInput, "name" | "bankName" | "accountType" | "purpose" | "statementTemplate" | "columnMapping" | "addressOnRecord" | "lowBalanceThreshold">
> & { status?: "active" | "closed" };

/* ------------------------------ statements ----------------------------- */

export type ImportStatus = "uploaded" | "parsing" | "failed_validation" | "ready_for_review" | "submitted" | "posted";

export interface StatementSummary {
  id: string;
  bankAccountId: string;
  bankAccount: string | null;
  fileName: string;
  status: ImportStatus;
  template: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  accountNo: string | null;
  currency: string | null;
  opening: number | null;
  withdrawals: number | null;
  deposits: number | null;
  closing: number | null;
  available: number | null;
  lineCount: number;
  newLineCount: number;
  /** Every check ran and none failed. */
  verified: boolean;
  uploadedBy: string | null;
  uploadedAt: string | null;
  /** Last change: a stuck import is timed from this. */
  updatedAt?: string | null;
  /** Set once the postings went into the approval engine. */
  approvalId: string | null;
  error: string | null;
}

export type CheckCode = "V1" | "V2" | "V3" | "V4" | "V5" | "V6";
export type CheckStatus = "pass" | "fail" | "warn" | "na";

export interface ValidationCheck {
  code: CheckCode;
  label: string;
  status: CheckStatus;
  message: string;
  /** V4: how many rows the balance chain moved from the printed order. */
  reordered?: number;
  /** V6: statement opening minus the ledger. */
  variance?: number;
}

/** A row as it was read, kept for a failed import so somebody can see why. */
export interface DiagnosticRow {
  listed: number;
  date: string;
  narration: string;
  withdrawal: number;
  deposit: number;
  balance: number;
  location?: string | null;
}

export interface StatementValidation {
  checks: ValidationCheck[];
  diagnostics?: string[];
  rows?: DiagnosticRow[];
  notes?: string[];
}

export interface ProposedJournal {
  id: string;
  journalNo: string | null;
  date: string;
  narration: string | null;
  status: string;
  total: number;
}

export interface StatementDetail extends StatementSummary {
  validation: StatementValidation | null;
  counts: { matched: number; suggested: number; unmatched: number; ignored: number; needsAccount: number };
  journals: ProposedJournal[];
}

export type LineCategory = "receipt" | "payment" | "transfer" | "reversal" | "bank_charge" | "tax" | "government_payment";
export type MatchStatus = "unmatched" | "suggested" | "matched" | "ignored";
export type LineFilter = MatchStatus | "needs_account" | "needs_review";

export interface Ref {
  id: string;
  code?: string | null;
  name: string | null;
}

export interface StatementLine {
  id: string;
  postingSeq: number | null;
  listedIndex: number;
  txnDate: string;
  valueDate: string;
  chequeNo: string | null;
  narration: string;
  direction: "DR" | "CR";
  amount: number;
  balance: number;
  channel: string | null;
  counterpartyRaw: string | null;
  purposeRaw: string | null;
  category: LineCategory | string | null;
  account: { id: string; code: string; name: string } | null;
  project: { id: string; name: string | null } | null;
  costCentre: { id: string; code: string; name: string } | null;
  counterparty: { id: string; name: string } | null;
  personId: string | null;
  person?: { id: string; name: string | null } | null;
  /** rule, memory, rule+memory, pairing, user (alias / keyword reserved). */
  source: string | null;
  confidence: number | null;
  matchStatus: MatchStatus;
  matchedType: string | null;
  pairedLineId: string | null;
  /** The other leg's statement and account; another import when the transfer crossed accounts. */
  pairedImportId?: string | null;
  pairedBankAccountId?: string | null;
  feeSplit: { principal: number; fee: number; vat: number } | null;
  /** needs_review, pair_transfer, pair_reversal, match_client, reversed, unpaired_reversal, tax_year:YYYY */
  flags: string[];
  journalId: string | null;
}

export interface LineReview {
  accountId?: string | null;
  projectId?: string | null;
  costCentreId?: string | null;
  counterpartyId?: string | null;
  personId?: string | null;
  category?: string | null;
  feeSplit?: "accept" | "clear";
  ignore?: boolean;
  remember?: boolean;
}

/* ------------------------------- analysis ------------------------------ */

export interface Anomaly {
  type: string;
  severity: "info" | "warning";
  message: string;
  lineIds: string[];
}

export interface StatementAnalysis {
  account: { id: string; name: string; bank: string | null; number: string; currency: string; type: string };
  summary: {
    opening: number | null;
    inflows: number;
    outflows: number;
    closing: number | null;
    lines: number;
    from: string | null;
    to: string | null;
    checks: { code: CheckCode; label: string; status: CheckStatus }[];
    posted: number;
    unposted: number;
  };
  inflowsBySource: { label: string; amount: number; count: number; top: { name: string; amount: number }[] }[];
  outflowsByCategory: { label: string; amount: number; count: number }[];
  outflowsByProject: { projectId: string; label: string; amount: number }[];
  bankCharges: {
    total: number;
    byType: { label: string; amount: number }[];
    percentOfTurnover: number;
    monthly: { month: string; amount: number }[];
    audit: { month: string; maintenance: number; vatCharged: number; vatExpected: number; message: string }[];
  };
  topPayees: { name: string; amount: number; count: number }[];
  topPayers: { name: string; amount: number; count: number }[];
  balance: {
    daily: { date: string; balance: number }[];
    min: number | null;
    max: number | null;
    average: number | null;
    daysBelowThreshold: number | null;
    daysOverdrawn: number;
  };
  cashConversion: { receivedFromOthers: number; movedToOwnAccounts: number; spentDirectly: number };
  anomalies: Anomaly[];
}

/* ----------------------------- reconciliation -------------------------- */

export interface ReconItem {
  journalId: string;
  journalNo: string | null;
  date: string;
  narration: string | null;
  amount: number;
}

/** One step in a reconciliation's sign-off history. */
export interface ReconciliationEvent {
  id: string;
  action: "prepared" | "approved" | "reopened";
  by: string | null;
  byId: string | null;
  at: string | null;
  /** Why it was reopened. */
  reason: string | null;
  difference: number | null;
}

export interface Reconciliation {
  id: string | null;
  /** True while a prepared reconciliation's figures still stand (or it is approved). */
  prepared: boolean;
  bankAccount: { id: string; name: string; currency: string };
  period: string;
  status: ReconciliationStatus;
  statementClosing: number | null;
  glClosing: number;
  unpresentedPayments: number;
  uncreditedReceipts: number;
  difference: number;
  detail: {
    unpresented: ReconItem[];
    uncredited: ReconItem[];
    /** Signed: deposits positive. */
    notInLedger: { lineId: string; date: string; narration: string; amount: number }[];
    adjustedBank: number | null;
    adjustedBook: number;
    lastStatementDate: string | null;
  } | null;
  preparedBy: string | null;
  preparedById?: string | null;
  approvedBy: string | null;
  approvedById?: string | null;
  approvedAt: string | null;
}

/* --------------------------------- rules -------------------------------- */

export type RuleAction = "classify" | "pair_transfer" | "pair_reversal" | "match_client" | "split_fee" | "review";

export interface BankRule {
  id: string;
  priority: number;
  name: string;
  direction: "DR" | "CR" | null;
  pattern: string;
  amountMin: number | null;
  amountMax: number | null;
  category: string | null;
  /** A system account the rule posts to (bank_charges, cit_payable…), set by the starter rules. */
  systemKey: string | null;
  accountId: string | null;
  costCentreId: string | null;
  projectId: string | null;
  action: RuleAction;
  active: boolean;
  hits: number;
}

export type BankRuleInput = Partial<Omit<BankRule, "id" | "hits" | "systemKey">>;

export interface ProjectKeyword {
  id: string;
  keyword: string;
  projectId: string;
  project?: string | null;
}

/** One band of the transfer-fee table: principal up to `upTo` (null = no limit). */
export interface FeeBand {
  upTo: number | null;
  fee: number;
  vat: number;
}

export interface RulesBook {
  rules: BankRule[];
  keywords: ProjectKeyword[];
  feeBands: FeeBand[] | null;
}

/* -------------------------------- payroll ------------------------------- */

/**
 * A run's journal on its way into the books: sent for a second person's
 * approval (maker-checker), sent back as a draft, or rejected.
 */
export interface PayrollWaiting {
  id: string;
  status: "pending_approval" | "draft" | "rejected" | string;
  /** Null when approvals are off for payroll posting: a second person posts it from the journal. */
  approvalId: string | null;
}

export interface PayrollRunRow {
  id: string;
  reference: string | null;
  period: string;
  periodEnd: string;
  status: "approved" | "paid" | string;
  headcount: number;
  gross: number;
  net: number;
  employerCost: number;
  journal: { id: string; journalNo: string | null } | null;
  waiting: PayrollWaiting | null;
}

export interface PayrollPreview {
  id: string;
  period: string;
  lines: {
    label: string;
    systemKey: string | null;
    account: { id: string; code: string; name: string } | null;
    side: "debit" | "credit";
    amount: number;
  }[];
  /** HRM lines with no account in the chart yet. */
  missing: string[];
  debit: number;
  credit: number;
  journal: { id: string; journalNo: string | null } | null;
  waiting: PayrollWaiting | null;
}

/* ------------------------------ GL accounts ------------------------------ */

/** The slice of `GET finance/accounts` the banking pickers need. */
export interface GlAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  isPostable: boolean;
  isBank: boolean;
  currency: string | null;
  systemKey: string | null;
  active: boolean;
  /** Dimensions a line on this account must carry: "project", "cost centre", "counterparty", "person". */
  requires?: string[];
}

/* -------------------------------- client -------------------------------- */

const enc = encodeURIComponent;

export const banking = {
  accounts: {
    list: () => unwrap(financeRequest<{ data: BankAccount[] }>("bank-accounts")),
    get: (id: string) => unwrap(financeRequest<{ data: BankAccountDetail }>(`bank-accounts/${enc(id)}`)),
    create: (input: BankAccountInput) => unwrap(financeRequest<{ data: BankAccount }>("bank-accounts", { method: "POST", body: input })),
    update: (id: string, input: BankAccountUpdate) =>
      unwrap(financeRequest<{ data: BankAccount }>(`bank-accounts/${enc(id)}`, { method: "PATCH", body: input })),
    analysis: (id: string, from: string, to: string) =>
      unwrap(financeRequest<{ data: StatementAnalysis }>(`bank-accounts/${enc(id)}/analysis`, { query: { from, to } })),
  },

  statements: {
    /** 202: the file is stored and processed on the queue. Poll `get` while uploaded/parsing. */
    upload: (bankAccountId: string, file: File) => {
      const form = new FormData();
      form.append("file", file);
      return unwrap(financeUpload<{ data: StatementSummary }>(`bank-accounts/${enc(bankAccountId)}/statements`, form));
    },
    list: (filters: { bankAccountId?: string; status?: ImportStatus } = {}) =>
      unwrap(financeRequest<{ data: StatementSummary[] }>("statements", { query: filters })),
    get: (id: string) => unwrap(financeRequest<{ data: StatementDetail }>(`statements/${enc(id)}`)),
    lines: (id: string, filters: { status?: LineFilter; category?: string; q?: string } = {}) =>
      unwrap(financeRequest<{ data: StatementLine[] }>(`statements/${enc(id)}/lines`, { query: filters })),
    review: (lineId: string, input: LineReview) =>
      unwrap(financeRequest<{ data: StatementLine }>(`statement-lines/${enc(lineId)}`, { method: "PATCH", body: input })),
    /**
     * 202: read the stored file again on the queue. Only a failed import, or
     * one stuck uploaded/parsing for 15+ minutes, and only while it has no lines.
     */
    retry: (id: string) => unwrap(financeRequest<{ data: StatementSummary }>(`statements/${enc(id)}/retry`, { method: "POST" })),
    propose: (id: string) =>
      unwrap(financeRequest<{ data: { journals: string[]; unclassified: number } }>(`statements/${enc(id)}/propose`, { method: "POST" })),
    submit: (id: string) => unwrap(financeRequest<{ data: StatementSummary }>(`statements/${enc(id)}/submit`, { method: "POST" })),
    post: (id: string) => unwrap(financeRequest<{ data: StatementSummary }>(`statements/${enc(id)}/post`, { method: "POST" })),
    analysis: (id: string) => unwrap(financeRequest<{ data: StatementAnalysis }>(`statements/${enc(id)}/analysis`)),
  },

  reconciliations: {
    get: (accountId: string, period: string) =>
      unwrap(financeRequest<{ data: Reconciliation }>(`bank-accounts/${enc(accountId)}/reconciliations/${enc(period)}`)),
    prepare: (accountId: string, period: string) =>
      unwrap(financeRequest<{ data: Reconciliation }>(`bank-accounts/${enc(accountId)}/reconciliations/${enc(period)}/prepare`, { method: "POST" })),
    approve: (accountId: string, period: string) =>
      unwrap(financeRequest<{ data: Reconciliation }>(`bank-accounts/${enc(accountId)}/reconciliations/${enc(period)}/approve`, { method: "POST" })),
    /** Approved → prepared, with a reason. A finance manager who did not approve it; the month must be open. */
    reopen: (accountId: string, period: string, reason: string) =>
      unwrap(financeRequest<{ data: Reconciliation }>(`bank-accounts/${enc(accountId)}/reconciliations/${enc(period)}/reopen`, { method: "POST", body: { reason } })),
    /** Prepared, approved, reopened - newest first. */
    history: (accountId: string, period: string) =>
      unwrap(financeRequest<{ data: ReconciliationEvent[] }>(`bank-accounts/${enc(accountId)}/reconciliations/${enc(period)}/history`)),
    /** The report with its sign-off, as a verifiable PDF (opens in a tab). */
    pdfUrl: (accountId: string, period: string) => `/api/finance/bank-accounts/${enc(accountId)}/reconciliations/${enc(period)}/pdf`,
    /** The same report as a CSV download. */
    csvUrl: (accountId: string, period: string) => `/api/finance/bank-accounts/${enc(accountId)}/reconciliations/${enc(period)}/csv`,
  },

  rules: {
    book: () => unwrap(financeRequest<{ data: RulesBook }>("bank-rules")),
    create: (input: BankRuleInput) => unwrap(financeRequest<{ data: BankRule }>("bank-rules", { method: "POST", body: input })),
    update: (id: string, input: BankRuleInput) =>
      unwrap(financeRequest<{ data: BankRule }>(`bank-rules/${enc(id)}`, { method: "PATCH", body: input })),
    remove: (id: string) => financeRequest<unknown>(`bank-rules/${enc(id)}`, { method: "DELETE" }),
    addKeyword: (keyword: string, projectId: string) =>
      unwrap(financeRequest<{ data: ProjectKeyword }>("bank-rules/keywords", { method: "POST", body: { keyword, projectId } })),
    removeKeyword: (id: string) => financeRequest<unknown>(`bank-rules/keywords/${enc(id)}`, { method: "DELETE" }),
    saveFeeBands: (bands: FeeBand[]) =>
      unwrap(financeRequest<{ data: FeeBand[] }>("bank-rules/fee-bands", { method: "PUT", body: { bands } })),
  },

  payroll: {
    list: () => unwrap(financeRequest<{ data: PayrollRunRow[] }>("payroll")),
    preview: (runId: string) => unwrap(financeRequest<{ data: PayrollPreview }>(`payroll/${enc(runId)}`)),
    post: (runId: string) =>
      unwrap(
        financeRequest<{ data: { id: string; journalNo: string | null; total: number; status: string; approvalId: string | null } }>(`payroll/${enc(runId)}/post`, {
          method: "POST",
        }),
      ),
  },

  /** Postable GL accounts, for the classify and rule pickers. */
  glAccounts: () => unwrap(financeRequest<{ data: GlAccount[] }>("accounts", { query: { postableOnly: 1 } })),
};
