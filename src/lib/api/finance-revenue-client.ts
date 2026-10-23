/* ------------------------------------------------------------------ */
/*  XwiftHQ Finance › Revenue: contracts and their billing milestones, */
/*  invoices, receipts, aged receivables, the WHT credit-note register  */
/*  and client statements. Shapes follow `ContractController`,          */
/*  `InvoiceController` and `ReceiptController` in api-lms. Money is    */
/*  integer minor units (kobo); rates are basis points (750 = 7.5%).    */
/* ------------------------------------------------------------------ */

import { ApiError, errorText, financeRequest, unwrap } from "./finance-request";

export { ApiError, errorText };

const enc = encodeURIComponent;

/* ------------------------------ currencies ---------------------------- */

/**
 * How a client pays across currencies (Finance PRD §12: "EMMS paid 60% NGN /
 * 40% USD"). Shares are basis points summing to 10,000; the planning rate is
 * the base-currency price of one unit, as a decimal string ("1600").
 */
export interface CurrencyShare {
  currency: string;
  shareBp: number;
  /** Units of base per one unit of `currency`; "1" (or empty) for the base. */
  planningRate?: string;
}

/** A milestone's own weighting of its contract's currencies (rates stay the contract's). */
export interface MilestoneCurrencyShare {
  currency: string;
  shareBp: number;
}

/** One currency's part of the contract value, at the planning rate. */
export interface ContractValuePart {
  currency: string;
  shareBp: number;
  amount: number;
  planningRate: string;
  /** In base at the planning rate. */
  base: number;
}

/* ------------------------------ contracts ----------------------------- */

export type BillingType = "milestone" | "sla" | "t_and_m" | "fixed";
export type ProgressMethod = "milestone_weighted" | "work_completion" | "pm_reported";
export type MilestoneStatus = "planned" | "completed" | "invoiced";

export interface ContractProjectRef {
  id: string;
  name: string;
  code: string | null;
  status: string | null;
}

/** One row of the contract register (`ContractController::index`). */
export interface ContractSummary {
  id: string;
  title: string;
  reference: string | null;
  project: ContractProjectRef | null;
  client: string | null;
  clientId: string;
  /** The contract value, before VAT. */
  value: number;
  currency: string;
  billingType: BillingType;
  status: string;
  retentionBp: number;
  expectedWhtBp: number;
  vatApplicable: boolean;
  vatRateBp: number;
  /** What invoices on the contract earn unless a line says otherwise. */
  revenueAccountId: string | null;
  paymentTermsDays: number;
  /** Issued invoices' subtotals (before VAT). */
  invoiced: number;
  settled: number;
  /** Issued invoices' totals (with VAT). */
  billedTotal: number;
  /** The currency `invoiced`, `settled` and `billedTotal` are in (the base when billing spans currencies). */
  billedCurrency?: string;
  /** Null when the client pays everything in `currency`. */
  currencySplit?: CurrencyShare[] | null;
  /** The value in base at the planning rates; null for a foreign-currency contract without a split. */
  valueBase?: number | null;
  baseCurrency?: string;
  valueParts?: ContractValuePart[];
  milestones: { total: number; completed: number; invoiced: number };
  /** Milestones accepted and waiting to be invoiced. */
  readyToBill: { id: string; name: string; amount: number; dueOn: string | null }[];
}

export interface ContractsMeta {
  billingTypes: Record<BillingType, string>;
  progressMethods: Record<ProgressMethod, string>;
  organisation: string;
  /** The organisation's base currency (what splits and rates are against). */
  baseCurrency?: string;
}

export interface ContractMilestone {
  id: string;
  sequence: number;
  name: string;
  amount: number;
  dueOn: string | null;
  weightBp: number | null;
  /** The Projects milestone or epic whose completion accepts this one. */
  workItemId: string | null;
  status: MilestoneStatus;
  completedAt: string | null;
  /** The milestone's own shares; null inherits the contract's split. */
  currencySplit?: MilestoneCurrencyShare[] | null;
}

/** A project's contract in full (`GET projects/{project}` → `data.contract`). */
export interface ContractDetail {
  id: string;
  title: string;
  reference: string | null;
  client: string | null;
  clientId: string;
  value: number;
  currency: string;
  billingType: BillingType;
  progressMethod: ProgressMethod;
  vatApplicable: boolean;
  vatRateBp: number;
  expectedWhtBp: number;
  retentionBp: number;
  paymentTermsDays: number;
  revenueAccountId: string | null;
  startsOn: string | null;
  endsOn: string | null;
  /** How the client pays across currencies; null: all in `currency`. */
  currencySplit?: CurrencyShare[] | null;
  milestones: ContractMilestone[];
}

/** The slice of the project funds view the contract editor reads. */
export interface ProjectContractView {
  id: string;
  name: string;
  code: string | null;
  projectStatus?: string;
  contract: ContractDetail | null;
}

export interface WorkItemOption {
  id: string;
  title: string;
  type: string;
  dueOn: string | null;
  status: string | null;
  done: boolean;
}

export interface MilestoneInput {
  id?: string | null;
  name: string;
  amount: number;
  dueOn?: string | null;
  weightBp?: number | null;
  workItemId?: string | null;
  /** Leave out to keep what the milestone has; null or [] to inherit the contract's split. */
  currencySplit?: MilestoneCurrencyShare[] | null;
}

export interface ContractInput {
  clientId: string;
  title: string;
  reference?: string | null;
  billingType?: BillingType;
  value: number;
  currency?: string;
  vatApplicable?: boolean;
  vatRateBp?: number;
  expectedWhtBp?: number;
  retentionBp?: number;
  paymentTermsDays?: number;
  revenueAccountId?: string | null;
  progressMethod?: ProgressMethod;
  startsOn?: string | null;
  endsOn?: string | null;
  /** Leave out to keep the split; null or [] for none. */
  currencySplit?: CurrencyShare[] | null;
  milestones?: MilestoneInput[];
}

/* ------------------------------ invoices ------------------------------ */

export type InvoiceStatus = "draft" | "issued" | "part_paid" | "paid" | "void";
/** What the list filters by: a status, or `open` (issued or part paid) and `overdue`. */
export type InvoiceFilter = InvoiceStatus | "open" | "overdue";

export interface InvoiceSummary {
  id: string;
  /** Null until the invoice is issued. */
  invoiceNo: string | null;
  status: InvoiceStatus;
  client: string | null;
  clientId: string;
  project: { id: string; name: string; code: string | null } | null;
  date: string | null;
  dueOn: string | null;
  currency: string;
  subtotal: number;
  vat: number;
  total: number;
  retention: number;
  settled: number;
  outstanding: number;
  /** The part of `outstanding` that is retention: held back, never late. */
  retentionHeld: number;
  /** Days the trade balance is past due while open; 0 otherwise. Retention is never late. */
  daysLate: number;
  /** The WHT the client is expected to deduct, on the subtotal. */
  expectedWhtBp: number;
  /** Null unless the invoice is issued or part paid. */
  open: OpenBalances | null;
  /** Billed in more than one currency: the invoice's own amounts are base equivalents. */
  multiCurrency?: boolean;
  /** One per currency billed (a single-currency invoice has one). */
  tranches?: InvoiceTranche[];
}

export type RateSource = "base" | "table" | "override";

/** The part of an invoice billed in one currency, with its own balance and rate. */
export interface InvoiceTranche {
  id: string;
  currency: string;
  /** The milestone split share it came from, if any. */
  shareBp: number | null;
  subtotal: number;
  vat: number;
  total: number;
  retention: number;
  settled: number;
  outstanding: number;
  retentionHeld: number;
  expectedWht: number;
  /** Units of base per one unit, as text ("1550"); empty while no rate is recorded. */
  rate: string;
  rateScaled: number | null;
  rateAsOf: string | null;
  rateSource: RateSource;
  overrideReason: string | null;
  overriddenBy: string | null;
  /** `total` in base at `rate`; null while no rate is recorded. */
  baseTotal: number | null;
  /** Null unless the invoice is issued or part paid. */
  open: OpenBalances | null;
}

export interface InvoicesMeta {
  drafts: number;
  outstanding: number;
  overdue: number;
  invoicedThisYear: number;
}

export interface InvoiceLine {
  id: string;
  description: string;
  accountId: string;
  /** `4400 Consultancy and research income`. */
  account: string | null;
  projectId: string | null;
  amount: number;
  vatRateBp: number;
  vat: number;
  trancheId?: string | null;
  /** The currency this line bills in. */
  currency?: string;
  shareBp?: number | null;
}

export interface InvoiceReceiptLink {
  receiptId: string;
  receiptNo: string | null;
  date: string | null;
  cash: number;
  wht: number;
  retention: number;
  trancheId?: string | null;
  currency?: string;
}

/** What is left on an open invoice: trade (to pay now) and retention (held back). */
export interface OpenBalances {
  trade: number;
  retention: number;
  /** WHT earlier receipts already deducted (the list carries it; the detail may not). */
  whtTaken?: number;
}

export interface InvoiceDetail extends InvoiceSummary {
  lines: InvoiceLine[];
  contract: { id: string; title: string } | null;
  milestoneId: string | null;
  notes: string | null;
  expectedWht: number;
  retentionBp: number;
  receipts: InvoiceReceiptLink[];
  journalId: string | null;
  issuedAt: string | null;
  issuedBy: string | null;
  /** When, by whom (their name) and why it was voided; null unless void. */
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  /** The organisation's base currency. */
  baseCurrency?: string;
  /** May the viewer bill a tranche at a rate other than the recorded one? */
  canOverrideRate?: boolean;
}

export interface InvoiceLineInput {
  description: string;
  accountId?: string | null;
  projectId?: string | null;
  amount: number;
  vatRateBp?: number | null;
  /** The currency the line bills in; the invoice's when left out. */
  currency?: string | null;
  shareBp?: number | null;
}

export interface InvoiceInput {
  clientId?: string | null;
  contractId?: string | null;
  projectId?: string | null;
  milestoneId?: string | null;
  currency?: string;
  invoiceDate?: string | null;
  notes?: string | null;
  retentionBp?: number;
  expectedWhtBp?: number;
  lines: InvoiceLineInput[];
}

/* ------------------------------ receipts ------------------------------ */

export type ReceiptStatus = "posted" | "void";
export type CreditNoteStatus = "expected" | "received";

export interface ReceiptAllocation {
  invoiceId: string;
  invoiceNo: string | null;
  cash: number;
  wht: number;
  retention: number;
  /** Applied later from the client's advance, not when the money came in. */
  fromAdvance: boolean;
  /** The day an advance was applied; null for the receipt's own allocations. */
  appliedOn: string | null;
  /** The journal that applied the advance; null for the receipt's own allocations. */
  journalId: string | null;
  trancheId?: string | null;
  /** The rate the settled tranche was booked at. */
  trancheRate?: string;
  /** Base gain (+) or loss (−): the receipt's rate against the tranche's. */
  realisedFx?: number;
}

export interface ReceiptSummary {
  id: string;
  receiptNo: string | null;
  status: ReceiptStatus;
  client: string | null;
  clientId: string;
  bankAccount: string | null;
  bankAccountId: string;
  date: string;
  currency: string;
  /** Money that came in. */
  cash: number;
  /** WHT the client deducted (no cash; a credit note to collect). */
  wht: number;
  /** Retention released, inside `cash`. */
  retention: number;
  /** Cash not applied to an invoice: held as a client advance. */
  unallocated: number;
  reference: string | null;
  whtCreditNote: CreditNoteStatus | null;
  whtCreditNoteRef: string | null;
  /** When, by whom (their name) and why it was voided; null unless void. */
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  allocations: ReceiptAllocation[];
  /** The receipt date's rate, as text. */
  rate?: string;
  /** Realised FX across its allocations, in base: gain positive. */
  realisedFx?: number;
}

export interface ReceiptDetail extends ReceiptSummary {
  journalId: string | null;
  statementLineId: string | null;
}

/** Money in on a bank statement, not yet in the books. */
export interface ReceiptCandidate {
  id: string;
  bankAccountId: string;
  date: string;
  amount: number;
  narration: string | null;
  counterparty: string | null;
  counterpartyId: string | null;
  reference: string | null;
}

export interface AllocationInput {
  invoiceId: string;
  /** The tranche in the money's currency; picked by currency when left out. */
  trancheId?: string | null;
  cash?: number;
  wht?: number;
  retention?: number;
}

/** Part of a held advance put against one open invoice: cash, and retention released. No WHT. */
export interface AdvanceAllocationInput {
  invoiceId: string;
  trancheId?: string | null;
  cash?: number;
  retention?: number;
}

export interface ApplyAdvanceInput {
  /** The day it is applied; today when left out. */
  date?: string | null;
  allocations: AdvanceAllocationInput[];
}

/** One receipt with cash still held as the client's advance (`ReceiptController::advances`). */
export interface ClientAdvance {
  receiptId: string;
  receiptNo: string | null;
  clientId: string;
  client: string | null;
  date: string;
  currency: string;
  /** Still held, not yet applied to an invoice. */
  held: number;
  /** What the receipt brought in. */
  cash: number;
}

export interface ClientAdvances {
  rows: ClientAdvance[];
  total: number;
}

export interface ReceiptInput {
  clientId: string;
  bankAccountId: string;
  receivedOn: string;
  cash: number;
  reference?: string | null;
  statementLineId?: string | null;
  allocations: AllocationInput[];
}

export interface WhtRegisterRow {
  receiptId: string;
  receiptNo: string | null;
  client: string | null;
  clientId: string;
  date: string;
  wht: number;
  currency: string;
  creditNote: CreditNoteStatus | null;
  creditNoteRef: string | null;
  daysWaiting: number;
}

export interface WhtRegister {
  rows: WhtRegisterRow[];
  expected: number;
  received: number;
}

/* ---------------------------- receivables ----------------------------- */

export type AgeBucket = "current" | "d30" | "d60" | "d90" | "over90" | "retention";

export type BucketTotals = Record<AgeBucket, number>;

export interface AgedInvoice {
  id: string;
  invoiceNo: string | null;
  dueOn: string | null;
  daysLate: number;
  outstanding: number;
  retentionHeld: number;
  currency: string;
  bucket: AgeBucket;
  /** The tranche this row is (a multi-currency invoice has a row per currency). */
  trancheId?: string;
  /** `outstanding` in base at the booked rate. */
  outstandingBase?: number;
  rate?: string;
  multiCurrency?: boolean;
}

/** The same buckets in one currency, in that currency, and the total in base. */
export interface CurrencyBuckets extends BucketTotals {
  currency: string;
  total: number;
  base: number;
}

/** Buckets are base currency (each tranche at its booked rate); `byCurrency` in each currency. */
export interface AgedClient extends BucketTotals {
  clientId: string;
  client: string | null;
  total: number;
  invoices: AgedInvoice[];
  byCurrency?: CurrencyBuckets[];
}

export interface AgedReceivables {
  asOf: string;
  baseCurrency?: string;
  totals: BucketTotals & { total: number; byCurrency?: CurrencyBuckets[] };
  clients: AgedClient[];
}

export type StatementKind = "invoice" | "receipt" | "wht" | "void";

export interface StatementEntry {
  date: string | null;
  kind: StatementKind;
  /** The invoice (invoice, void) or receipt (receipt, wht) behind the line. */
  id: string;
  reference: string | null;
  debit: number;
  credit: number;
  status: string;
  dueOn: string | null;
  /** Running: what the client owes after this line, in the line's currency. */
  balance: number;
  currency?: string;
  trancheId?: string | null;
}

/** One currency's statement inside a client's. */
export interface StatementSection {
  currency: string;
  opening: number;
  closing: number;
  entries: StatementEntry[];
  aged: BucketTotals & { total: number };
  /** The statement date's rate, as text; null when none is recorded. */
  rate: string | null;
  closingBase: number | null;
  openingBase: number | null;
}

export interface ClientStatement {
  client: string;
  clientId: string;
  /** The range asked for, if any (YYYY-MM-DD). */
  from?: string | null;
  to?: string | null;
  /** What they owed before `from` (0 without one). */
  opening?: number;
  closing?: number;
  /** The closing balance. */
  balance: number;
  entries: StatementEntry[];
  /** What is owed by age at `to` (or today). */
  aged?: BucketTotals & { total: number };
  agedAsOf?: string;
  /** The client's one currency; null when they deal in several (then opening and closing are base). */
  currency?: string | null;
  baseCurrency?: string;
  /** A statement per currency. */
  currencies?: StatementSection[];
}

/** One client with a contract, an issued invoice or a receipt. */
export interface ClientSummary {
  clientId: string;
  client: string;
  contracts: number;
  contractValue: number;
  /** Set when all their contracts share one currency. */
  currency: string | null;
  invoices: number;
  invoiced: number;
  received: number;
  wht: number;
  outstanding: number;
  retention: number;
  overdue: number;
  lastReceipt: string | null;
  /** The currency money columns are in; base when the client deals in several. */
  baseCurrency?: string;
  /** Each currency's own figures, in that currency. */
  byCurrency?: ClientCurrencyFigures[];
}

export interface ClientCurrencyFigures {
  currency: string;
  contractValue: number;
  invoiced: number;
  received: number;
  wht: number;
  outstanding: number;
}

export interface StatementRange {
  from?: string | null;
  to?: string | null;
}

function rangeQuery(range: StatementRange = {}): string {
  const q = new URLSearchParams();
  if (range.from) q.set("from", range.from);
  if (range.to) q.set("to", range.to);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/* ------------------------------- client ------------------------------- */

export const revenue = {
  contracts: {
    list: () =>
      financeRequest<{ data: ContractSummary[]; meta: ContractsMeta }>("contracts").then((r) => ({ contracts: r.data, meta: r.meta })),
    /** The project with its contract (null when it has none yet). */
    forProject: (projectId: string) => unwrap(financeRequest<{ data: ProjectContractView }>(`projects/${enc(projectId)}`)),
    /** Create or replace the project's contract, milestones and all. */
    save: (projectId: string, input: ContractInput) =>
      unwrap(financeRequest<{ data: { id: string; milestones: number } }>(`projects/${enc(projectId)}/contract`, { method: "PUT", body: input })),
    workItems: (projectId: string) => unwrap(financeRequest<{ data: WorkItemOption[] }>(`projects/${enc(projectId)}/contract/work-items`)),
    completeMilestone: (milestoneId: string, on?: string | null) =>
      unwrap(
        financeRequest<{ data: { id: string; status: MilestoneStatus } }>(`contract-milestones/${enc(milestoneId)}/complete`, {
          method: "POST",
          body: on ? { on } : {},
        }),
      ),
    /** A draft invoice for an accepted milestone. */
    invoiceMilestone: (milestoneId: string) =>
      unwrap(financeRequest<{ data: { id: string; status: InvoiceStatus } }>(`contract-milestones/${enc(milestoneId)}/invoice`, { method: "POST" })),
  },

  invoices: {
    list: (filters: { status?: InvoiceFilter | ""; client?: string; project?: string; q?: string } = {}) =>
      financeRequest<{ data: InvoiceSummary[]; meta: InvoicesMeta }>("invoices", { query: filters }).then((r) => ({ invoices: r.data, meta: r.meta })),
    get: (id: string) => unwrap(financeRequest<{ data: InvoiceDetail }>(`invoices/${enc(id)}`)),
    create: (input: InvoiceInput) => unwrap(financeRequest<{ data: { id: string; status: InvoiceStatus } }>("invoices", { method: "POST", body: input })),
    update: (id: string, input: InvoiceInput) => unwrap(financeRequest<{ data: InvoiceDetail }>(`invoices/${enc(id)}`, { method: "PATCH", body: input })),
    remove: (id: string) => financeRequest<unknown>(`invoices/${enc(id)}`, { method: "DELETE" }),
    /** Numbered and posted. Dated today unless a date is given. */
    issue: (id: string, date?: string | null) =>
      unwrap(
        financeRequest<{ data: { id: string; invoiceNo: string; status: InvoiceStatus; dueOn: string | null } }>(`invoices/${enc(id)}/issue`, {
          method: "POST",
          body: date ? { date } : {},
        }),
      ),
    void: (id: string, reason: string) =>
      unwrap(financeRequest<{ data: { id: string; status: InvoiceStatus } }>(`invoices/${enc(id)}/void`, { method: "POST", body: { reason } })),
    /** The branded PDF; the proxy streams it. */
    pdfUrl: (id: string) => `/api/finance/invoices/${enc(id)}/pdf`,
    /**
     * Bill a draft's tranche at `rate` (units of base per one unit) instead of
     * the recorded rate, saying why; `rate: null` puts it back. Needs the
     * override permission; logged.
     */
    overrideRate: (id: string, trancheId: string, rate: string | null, reason?: string | null) =>
      unwrap(
        financeRequest<{ data: InvoiceDetail }>(`invoices/${enc(id)}/tranches/${enc(trancheId)}/rate`, {
          method: "POST",
          body: rate === null ? { rate: null } : { rate, reason: reason ?? null },
        }),
      ),
  },

  clients: {
    /** Every client with contracts, invoices or receipts, most owed first. */
    list: () => unwrap(financeRequest<{ data: ClientSummary[] }>("clients")),
  },

  receipts: {
    list: (filters: { client?: string } = {}) => unwrap(financeRequest<{ data: ReceiptSummary[] }>("receipts", { query: filters })),
    get: (id: string) => unwrap(financeRequest<{ data: ReceiptDetail }>(`receipts/${enc(id)}`)),
    create: (input: ReceiptInput) =>
      unwrap(financeRequest<{ data: { id: string; receiptNo: string } }>("receipts", { method: "POST", body: input })),
    void: (id: string, reason: string) =>
      unwrap(financeRequest<{ data: { id: string; status: ReceiptStatus } }>(`receipts/${enc(id)}/void`, { method: "POST", body: { reason } })),
    creditNote: (id: string, reference: string) =>
      unwrap(
        financeRequest<{ data: { id: string; whtCreditNote: CreditNoteStatus; whtCreditNoteRef: string } }>(`receipts/${enc(id)}/credit-note`, {
          method: "POST",
          body: { reference },
        }),
      ),
    /** The official receipt as a PDF (a voided one prints marked VOID). */
    pdfUrl: (id: string) => `/api/finance/receipts/${enc(id)}/pdf`,
    /** Put some of the advance a receipt holds against the client's open invoices. Returns the receipt. */
    applyAdvance: (id: string, input: ApplyAdvanceInput) =>
      unwrap(financeRequest<{ data: ReceiptDetail }>(`receipts/${enc(id)}/apply`, { method: "POST", body: input })),
    candidates: (bankAccountId?: string) =>
      unwrap(financeRequest<{ data: ReceiptCandidate[] }>("receipts/candidates", { query: { bankAccount: bankAccountId } })),
    whtRegister: () =>
      financeRequest<{ data: WhtRegisterRow[]; meta: { expected: number; received: number } }>("receipts/wht-register").then(
        (r): WhtRegister => ({ rows: r.data, expected: r.meta?.expected ?? 0, received: r.meta?.received ?? 0 }),
      ),
  },

  receivables: {
    aged: (asOf?: string | null) => unwrap(financeRequest<{ data: AgedReceivables }>("receivables/aged", { query: { asOf } })),
    /** Cash held for clients from over-receipts, receipt by receipt. */
    advances: (clientId?: string | null) =>
      financeRequest<{ data: ClientAdvance[]; meta?: { total?: number } }>("receivables/advances", { query: { client: clientId ?? undefined } }).then(
        (r): ClientAdvances => ({ rows: r.data, total: r.meta?.total ?? r.data.reduce((t, a) => t + a.held, 0) }),
      ),
    statement: (clientId: string, range: StatementRange = {}) =>
      unwrap(financeRequest<{ data: ClientStatement }>(`clients/${enc(clientId)}/statement`, { query: { from: range.from ?? undefined, to: range.to ?? undefined } })),
    /** The statement of account as a branded PDF. */
    statementPdfUrl: (clientId: string, range: StatementRange = {}) => `/api/finance/clients/${enc(clientId)}/statement/pdf${rangeQuery(range)}`,
  },

  /** Every project in the organisation, for the contract register. */
  projects: () => unwrap(financeRequest<{ data: { id: string; name: string; code: string | null }[] }>("lookups/projects")),
};

/* ------------------------------- errors ------------------------------- */

const CODE = /^[A-Z][A-Z0-9_]{3,}:\s*/;

/** An API refusal in plain words, any machine code taken off. */
export function revenueError(e: unknown, fallback = "Something went wrong."): string {
  return (errorText(e) || fallback).replace(CODE, "");
}

/** `bank_account_id` → `bankAccountId`; `lines.0.account_id` → `lines.0.accountId`. */
export const camelKey = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/**
 * Field → first message. The request validator keys by the JSON's camelCase
 * names and the services by their snake_case columns; both come back here
 * in camelCase so a form looks a field up one way.
 */
export function revenueFieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || !e.errors) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.errors)) {
    const first = Array.isArray(v) ? v[0] : v;
    if (typeof first === "string") out[camelKey(k)] = first.replace(CODE, "");
  }
  return out;
}
