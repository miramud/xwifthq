/* ------------------------------------------------------------------ */
/*  Elevate Finance › Spend: payment and advance requests, the memo    */
/*  register and the Finance Control Unit. Shapes follow               */
/*  `App\Suite\Finance\Controllers\SpendPresenter` and the controllers  */
/*  `MySpendController` (self-service, `finance/me/*`),                 */
/*  `PaymentMemoController`, `FcuController`, `VoucherController::show`.*/
/*  Money is integer minor units, like the rest of Finance.            */
/* ------------------------------------------------------------------ */

import { ApiError, errorText, financeRequest, financeUpload, unwrap } from "./finance-request";

export { ApiError, errorText };

/* ------------------------------- enums ------------------------------ */

export type MemoType = "payment" | "advance" | "system" | "approval";

export type MemoStatus =
  | "draft"
  | "in_approval"
  | "awaiting_fcu"
  | "fcu_queried"
  | "fcu_cleared"
  | "partially_paid"
  | "paid"
  | "awaiting_retirement"
  | "retired"
  | "closed"
  | "rejected"
  | "cancelled"
  | "expired";

export type VoucherStatus =
  | "draft"
  | "submitted_to_fcu"
  | "fcu_queried"
  | "fcu_checked"
  | "in_approval"
  | "approved"
  | "scheduled"
  | "payment_initiated"
  | "paid_confirmed"
  | "rejected"
  | "cancelled";

export type RetirementStatus = "draft" | "submitted" | "fcu_queried" | "cleared" | "posted";

/** FCU checkpoints (`FcuReview`): 1 memo vetting, 2 voucher pre-audit, 3 payment confirmation, 4 retirement. */
export type Checkpoint = 1 | 2 | 3 | 4;

export type Mark = "ok" | "query" | "na";

export type ReviewOutcome = "cleared" | "queried" | "rejected";

/* ------------------------------ pieces ------------------------------ */

export interface SpendDocument {
  id: string;
  itemCode: string | null;
  fileName: string;
  mime: string | null;
  size: number;
  sha256: string;
  uploadedBy: string | null;
  uploadedAt: string | null;
}

export interface QueryMessage {
  id: string;
  author: string | null;
  authorId: string | null;
  body: string;
  at: string | null;
}

export interface SpendQuery {
  id: string;
  checkpoint: Checkpoint;
  status: "open" | "answered" | "closed";
  raisedBy: string | null;
  raisedAt: string | null;
  messages: QueryMessage[];
}

export interface ReviewItem {
  code: string;
  label: string;
  result: Mark;
  comment: string | null;
}

export interface SpendReview {
  id: string;
  checkpoint: Checkpoint;
  /** "confirmed" is checkpoint 3's only outcome. */
  outcome: ReviewOutcome | "confirmed";
  reviewer: string | null;
  items: ReviewItem[];
  comment: string | null;
  at: string | null;
}

export interface HistoryEntry {
  from: string | null;
  to: string;
  by: string | null;
  comment: string | null;
  at: string | null;
}

/** One checklist item as it stands on a memo (`Checklists::status`). */
export interface ChecklistState {
  code: string;
  label: string;
  hint: string | null;
  required: boolean;
  attached: number;
}

/** A checklist item as configured (`me/options`). */
export interface ChecklistItemDef {
  code: string;
  label: string;
  hint: string | null;
  required: boolean;
  /** Required only from this amount (minor units), e.g. three quotes from ₦1,000,000. */
  requiredFrom: number | null;
}

/** The funds position recorded when the memo was sent (`ProjectFunds::check`). */
export interface FundsSnapshot {
  at: string;
  released: number;
  committed: number;
  actual: number;
  available: number;
  request: number;
  afterRequest: number;
  overridden: boolean;
  controlled?: boolean;
  overrideCode?: string;
  overrideReason?: string;
}

/** What a project has left (`GET finance/me/funds/{project}`). */
export interface FundsPosition {
  controlled: boolean;
  hasBudget: boolean;
  hasRelease: boolean;
  available: number;
}

export interface Payee {
  kind: "vendor" | "staff";
  id: string;
  name: string | null;
}

/* ------------------------------- memos ------------------------------ */

export interface MemoSummary {
  id: string;
  reference: string | null;
  title: string;
  type: MemoType;
  amount: number;
  currency: string | null;
  approvedAmount: number | null;
  paidAmount: number;
  balance: number;
  status: MemoStatus;
  /** The approval engine's own status of the memo. */
  approvalStatus: string;
  projectId: string | null;
  project: string | null;
  costCentreId: string | null;
  costCentre: string | null;
  costCategory: string | null;
  payee: Payee | null;
  requester: string | null;
  requesterId: string;
  neededBy: string | null;
  submittedAt: string | null;
  createdAt: string | null;
  approvalId: string | null;
  overridden: boolean;
  /** Raised after the money had gone, to regularise a bank debit nobody authorised. */
  postFacto?: boolean;
}

export interface MemoVoucherLink {
  id: string;
  pvNo: string | null;
  status: VoucherStatus;
  /** The part of this memo the voucher pays. */
  amount: number;
  net: number;
}

export interface RetirementLine {
  account: { id: string; code: string; name: string } | null;
  projectId: string | null;
  costCentreId: string | null;
  description: string;
  amount: number;
}

export interface Retirement {
  id: string;
  status: RetirementStatus;
  advanced: number;
  spent: number;
  refund: number;
  refundBankAccountId: string | null;
  journalId: string | null;
  lines: RetirementLine[];
  documents: SpendDocument[];
  queries: SpendQuery[];
}

export interface MemoFull extends MemoSummary {
  body: string | null;
  fundsSnapshot: FundsSnapshot | null;
  overrideReason: string | null;
  checklist: ChecklistState[];
  documents: SpendDocument[];
  queries: SpendQuery[];
  reviews: SpendReview[];
  vouchers: MemoVoucherLink[];
  retirement: Retirement | null;
  history: HistoryEntry[];
  clearedAt: string | null;
  /** The bank debit a post-facto memo regularises. */
  statementLineId?: string | null;
  approvedAt?: string | null;
  /** From when Finance may expire it (approved, nothing paid, no voucher); null otherwise. */
  expiresOn?: string | null;
  /** Approved, unpaid, no voucher: it can be expired (from `expiresOn`, or earlier by override). */
  expirable?: boolean;
  pastExpiry?: boolean;
  remindedAt?: string | null;
  expiredAt?: string | null;
  expiryReason?: string | null;
}

export interface MemoInput {
  /** Only when creating; a memo keeps its type. */
  memoType?: "payment" | "advance";
  title?: string;
  body?: string;
  amount?: number;
  currency?: string;
  projectId?: string | null;
  costCentreId?: string | null;
  costCategory?: string | null;
  payeeCounterpartyId?: string | null;
  payeeUserId?: string | null;
  neededBy?: string | null;
}

export interface SpendOptions {
  types: Record<string, string>;
  categories: Record<string, string>;
  checklists: { payment: ChecklistItemDef[]; advance: ChecklistItemDef[]; retirement: ChecklistItemDef[] };
  projects: { id: string; name: string; code: string | null }[];
  /** Postable spending accounts, for retiring an advance. */
  accounts: { id: string; code: string; name: string; requiresProject: boolean; requiresCostCentre: boolean }[];
  bankAccounts: { id: string; name: string; bankName: string | null }[];
}

export interface RetirementLineInput {
  accountId: string;
  projectId?: string | null;
  costCentreId?: string | null;
  description: string;
  amount: number;
}

/* ------------------------------ vouchers ---------------------------- */

export interface VoucherSummary {
  id: string;
  pvNo: string | null;
  date: string;
  kind: string;
  payee: string;
  payeeKind: "vendor" | "staff";
  payeeBank: { bankName: string | null; accountName: string | null; last4: string | null; source: string | null } | null;
  currency: string;
  gross: number;
  vat: number;
  wht: number;
  net: number;
  status: VoucherStatus;
  payingBankAccountId: string | null;
  payingBankAccount: string | null;
  narration: string | null;
  preparedBy: string | null;
  preparedById: string | null;
  scheduleId: string | null;
  cibReference: string | null;
  provisional: boolean;
  approvalId: string | null;
  accrualJournalId: string | null;
  paymentJournalId: string | null;
  confirmedAt: string | null;
  /** Regularises a payment already made: confirmed against that debit on approval, never paid again. */
  postFacto?: boolean;
}

export interface VoucherLine {
  lineNo: number;
  account: { id: string; code: string; name: string } | null;
  projectId: string | null;
  costCentreId: string | null;
  personId: string | null;
  costCategory: string | null;
  description: string | null;
  gross: number;
  vat: number;
  whtCode: string | null;
  whtRateBp: number | null;
  wht: number;
  whtOverrideReason: string | null;
  net: number;
}

export interface VoucherFull extends VoucherSummary {
  memos: { id: string; reference: string | null; title: string; amount: number }[];
  lines: VoucherLine[];
  documents: SpendDocument[];
  queries: SpendQuery[];
  reviews: SpendReview[];
  history: HistoryEntry[];
  failures: { at: string; by: string; reason: string; cibReference: string | null; scheduleId: string | null }[];
  confirmationEvidence: "statement_line" | "cib_receipt" | null;
  statementLineId: string | null;
  amountPaid: number | null;
  initiatedAt: string | null;
}

/* -------------------------------- FCU ------------------------------- */

export interface FcuMemoRow {
  id: string;
  reference: string | null;
  title: string | null;
  type: MemoType;
  amount: number | null;
  currency: string | null;
  projectId: string | null;
  requester: string | null;
  status: MemoStatus;
  /** Calendar days, one decimal. */
  waitingDays: number | null;
  openQueries: number;
}

export interface FcuVoucherRow {
  id: string;
  pvNo: string | null;
  payee: string;
  net: number;
  currency: string;
  /** `provisional` for a payment confirmed on the bank's receipt, still to meet its statement line. */
  status: VoucherStatus | "provisional";
  provisional: boolean;
  cibReference: string | null;
  waitingDays: number | null;
}

export interface FcuRetirementRow {
  id: string;
  memoId: string;
  person: string | null;
  advanced: number;
  spent: number;
  refund: number;
  waitingDays: number | null;
}

export interface FcuQueues {
  memos: FcuMemoRow[];
  vouchers: FcuVoucherRow[];
  payments: FcuVoucherRow[];
  retirements: FcuRetirementRow[];
  /** Checkpoint → item code → what is checked (`FcuChecklist::ITEMS`). */
  checklists: Record<string, Record<string, string>>;
}

export interface CandidateLine {
  id: string;
  importId: string;
  date: string;
  narration: string | null;
  amount: number;
  /** Principal, fee and VAT when the line was split; null when it never was. */
  feeSplit: { principal?: number; fee?: number; vat?: number } | null;
  /** The line is exactly the voucher's net payable. */
  exact: boolean;
}

/** A bank debit with no voucher behind it, and who (if anyone) is regularising it. */
export interface UnauthorisedPayment {
  type: "UNAUTHORISED_PAYMENT";
  lineId: string;
  importId: string;
  date: string;
  narration: string | null;
  amount: number;
  /** What went to the payee: the debit less any transfer fee split out of it. */
  principal?: number;
  posted: boolean;
  bankAccountId?: string;
  bankAccount?: string | null;
  counterpartyId?: string | null;
  counterparty?: string | null;
  personId?: string | null;
  person?: string | null;
  projectId?: string | null;
  costCentreId?: string | null;
  regularising?: { memoId: string; reference: string | null; status: MemoStatus } | null;
}

export interface PostFactoItem {
  type: "POST_FACTO";
  memoId: string;
  reference: string | null;
  title: string | null;
  amount: number | null;
  status?: MemoStatus;
  lineId?: string | null;
  /** When the money actually left. */
  paidOn?: string | null;
  vouchers?: { id: string; pvNo: string | null; status: VoucherStatus }[];
}

/** An approved memo nobody has paid, holding its funds back. */
export interface AgeingCommitment {
  type: "AGEING_COMMITMENT";
  memoId: string;
  reference: string | null;
  title: string | null;
  amount: number;
  requester: string | null;
  project: string | null;
  status: MemoStatus;
  approvedAt: string | null;
  ageDays: number;
  expiresOn: string | null;
  /** Past its expiry date: Finance may expire it. */
  expirable: boolean;
  reminded: boolean;
}

export interface FcuExceptions {
  unauthorisedPayments: UnauthorisedPayment[];
  unmatchedProvisional: { type: "UNMATCHED_PROVISIONAL"; pvId: string; pvNo: string | null; payee: string; amount: number; confirmedAt: string | null }[];
  memosNotCleared: { type: "MEMO_NOT_CLEARED"; memoId: string; reference: string | null; title: string | null; amount: number | null }[];
  unretiredAdvances: { type: "UNRETIRED_ADVANCE"; memoId: string; reference: string | null; person: string | null; amount: number; since: string | null }[];
  postFacto: PostFactoItem[];
  ageingCommitments?: AgeingCommitment[];
}

export interface RegulariseInput {
  /** Why it was paid without authority. */
  explanation: string;
  title?: string | null;
  projectId?: string | null;
  costCentreId?: string | null;
  costCategory?: string | null;
  payeeCounterpartyId?: string | null;
  payeeUserId?: string | null;
  /** Send it for approval straight away when it can go (default). */
  submit?: boolean;
}

export type MarkInput = Record<string, { result: Mark; comment?: string | null }>;

/* ------------------------------ client ------------------------------ */

const upload = <T>(path: string, file: File, itemCode?: string | null) => {
  const form = new FormData();
  form.append("file", file);
  if (itemCode) form.append("itemCode", itemCode);
  return unwrap(financeUpload<{ data: T }>(path, form));
};

export const spend = {
  /** Everybody's own requests (`finance/me/*`). */
  me: {
    options: () => unwrap(financeRequest<{ data: SpendOptions }>("me/options")),
    list: () => unwrap(financeRequest<{ data: MemoSummary[] }>("me/memos")),
    get: (id: string) => unwrap(financeRequest<{ data: MemoFull }>(`me/memos/${id}`)),
    create: (input: MemoInput) => unwrap(financeRequest<{ data: MemoFull }>("me/memos", { method: "POST", body: input })),
    update: (id: string, input: MemoInput) => unwrap(financeRequest<{ data: MemoFull }>(`me/memos/${id}`, { method: "PATCH", body: input })),
    remove: (id: string) => financeRequest<unknown>(`me/memos/${id}`, { method: "DELETE" }),
    submit: (id: string, overrideReason?: string | null) =>
      unwrap(financeRequest<{ data: MemoFull }>(`me/memos/${id}/submit`, { method: "POST", body: overrideReason ? { overrideReason } : {} })),
    withdraw: (id: string, reason: string) => unwrap(financeRequest<{ data: MemoFull }>(`me/memos/${id}/withdraw`, { method: "POST", body: { reason } })),
    upload: (memoId: string, file: File, itemCode: string | null) => upload<SpendDocument[]>(`me/memos/${memoId}/documents`, file, itemCode),
    deleteDocument: (documentId: string) => financeRequest<unknown>(`me/documents/${documentId}`, { method: "DELETE" }),
    answer: (queryId: string, body: string) =>
      unwrap(financeRequest<{ data: SpendQuery[] }>(`me/queries/${queryId}/messages`, { method: "POST", body: { body } })),
    funds: (projectId: string) => unwrap(financeRequest<{ data: FundsPosition }>(`me/funds/${projectId}`)),
    saveRetirement: (memoId: string, input: { lines: RetirementLineInput[]; refund: number; refundBankAccountId: string | null }) =>
      unwrap(financeRequest<{ data: Retirement }>(`me/memos/${memoId}/retirement`, { method: "POST", body: input })),
    submitRetirement: (retirementId: string) => unwrap(financeRequest<{ data: Retirement }>(`me/retirements/${retirementId}/submit`, { method: "POST" })),
    uploadRetirement: (retirementId: string, file: File) => upload<SpendDocument[]>(`me/retirements/${retirementId}/documents`, file, "receipts"),
  },

  /** Finance's register of every request. */
  memos: {
    list: (filters: { status?: string; type?: string; projectId?: string; q?: string } = {}) =>
      unwrap(financeRequest<{ data: MemoSummary[] }>("memos", { query: filters })),
    get: (id: string) => unwrap(financeRequest<{ data: MemoFull }>(`memos/${id}`)),
    override: (id: string, reason: string) => unwrap(financeRequest<{ data: MemoFull }>(`memos/${id}/override`, { method: "POST", body: { reason } })),
    cancel: (id: string, reason: string) => unwrap(financeRequest<{ data: MemoFull }>(`memos/${id}/cancel`, { method: "POST", body: { reason } })),
    /** Expire an approved memo nobody paid, freeing its funds. Before its date only with `override`, by a finance manager. */
    expire: (id: string, reason: string, override = false) =>
      unwrap(financeRequest<{ data: MemoFull }>(`memos/${id}/expire`, { method: "POST", body: override ? { reason, override } : { reason } })),
  },

  fcu: {
    queues: () => unwrap(financeRequest<{ data: FcuQueues }>("fcu")),
    exceptions: () => unwrap(financeRequest<{ data: FcuExceptions }>("fcu/exceptions")),
    /** Raise the post-facto memo for a bank debit with no voucher. `submitError` says why it stayed a draft. */
    regularise: (lineId: string, input: RegulariseInput) =>
      unwrap(financeRequest<{ data: { memo: MemoFull; submitError: string | null } }>(`fcu/exceptions/${lineId}/regularise`, { method: "POST", body: input })),
    reviewMemo: (id: string, body: { items: MarkInput; outcome: ReviewOutcome; comment?: string | null }) =>
      unwrap(financeRequest<{ data: MemoFull }>(`fcu/memos/${id}`, { method: "POST", body })),
    reviewVoucher: (id: string, body: { items: MarkInput; outcome: Exclude<ReviewOutcome, "rejected">; comment?: string | null }) =>
      unwrap(financeRequest<{ data: VoucherFull }>(`fcu/vouchers/${id}`, { method: "POST", body })),
    /** One retirement with its advance, whatever its status: the memo, `retirement` set to this one. */
    retirement: (id: string) => unwrap(financeRequest<{ data: MemoFull }>(`retirements/${id}`)),
    reviewRetirement: (id: string, body: { items: MarkInput; outcome: Exclude<ReviewOutcome, "rejected">; comment?: string | null }) =>
      unwrap(financeRequest<{ data: Retirement }>(`fcu/retirements/${id}`, { method: "POST", body })),
    candidates: (pvId: string) => unwrap(financeRequest<{ data: CandidateLine[] }>(`fcu/payments/${pvId}/candidates`)),
    confirm: (
      pvId: string,
      body: { evidence: "statement_line" | "cib_receipt"; statementLineId?: string | null; documentId?: string | null; items: MarkInput },
    ) => unwrap(financeRequest<{ data: VoucherFull }>(`fcu/payments/${pvId}/confirm`, { method: "POST", body })),
    match: (pvId: string, statementLineId: string) =>
      unwrap(financeRequest<{ data: VoucherFull }>(`fcu/payments/${pvId}/match`, { method: "POST", body: { statementLineId } })),
    message: (queryId: string, body: { body?: string; close?: boolean }) =>
      unwrap(financeRequest<{ data: SpendQuery[] }>(`fcu/queries/${queryId}/messages`, { method: "POST", body })),
  },

  vouchers: {
    get: (id: string) => unwrap(financeRequest<{ data: VoucherFull }>(`vouchers/${id}`)),
    upload: (id: string, file: File, itemCode: string | null) => upload<SpendDocument[]>(`vouchers/${id}/documents`, file, itemCode),
  },
};

/** Where a document downloads from: the requester's route, which also lets Finance read it. */
export const documentHref = (id: string) => `/api/finance/me/documents/${id}`;

/* ------------------------------ errors ------------------------------ */

const CODE = /^([A-Z][A-Z_]{3,}):\s*/;

/** The machine code a 422 starts with (`SOD_VIOLATION`, `INSUFFICIENT_PROJECT_FUNDS`…), if any. */
export function errorCode(e: unknown): string | null {
  if (!(e instanceof ApiError)) return null;
  const texts = [e.message, ...Object.values(e.errors ?? {}).flat()];
  for (const t of texts) {
    const m = typeof t === "string" ? CODE.exec(t) : null;
    if (m) return m[1];
  }
  return null;
}

/** A message with its code prefix taken off: what a person reads. */
export const plain = (text: string) => text.replace(CODE, "");

/** The API's message, plainly, for showing next to the action that failed. */
export function spendError(e: unknown): string {
  return plain(errorText(e));
}

/** Field → first message, code prefixes off. */
export function spendFieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || !e.errors) return {};
  return Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, plain(v[0] ?? "")]));
}
