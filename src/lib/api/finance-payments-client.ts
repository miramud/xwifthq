/* ------------------------------------------------------------------ */
/*  Finance › spend to pay, the paying end: payment vouchers, payment  */
/*  schedules and bank files, project funds (the MD's portfolio) and   */
/*  spend settings. Shapes follow `SpendPresenter`,                    */
/*  `PaymentScheduleController`, `Portfolio` and                       */
/*  `SpendSettingsController` in api-lms. Money is integer minor       */
/*  units (kobo) throughout; rates are basis points (500 = 5%).        */
/* ------------------------------------------------------------------ */

import type { BudgetCheck } from "./finance-budgets-client";
import { ApiError, errorText, financeRequest, financeUpload, unwrap } from "./finance-request";

export { ApiError, errorText };

const enc = encodeURIComponent;

/* ------------------------------ vouchers ------------------------------ */

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

export interface PayeeBank {
  bankName: string | null;
  accountName: string | null;
  last4: string | null;
  /** Where the details came from: the vendor master, HR's salary account… */
  source: string | null;
}

export interface VoucherSummary {
  id: string;
  /** Gap-free: PV/2026/10/0003. A cancelled voucher keeps its number. */
  pvNo: string;
  date: string;
  kind: "payment" | "advance";
  payee: string;
  payeeKind: "staff" | "vendor";
  payeeBank: PayeeBank | null;
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
  preparedById: string;
  scheduleId: string | null;
  cibReference: string | null;
  provisional: boolean;
  approvalId: string | null;
  accrualJournalId: string | null;
  paymentJournalId: string | null;
  confirmedAt: string | null;
  /** What the company budget check said when it was sent (a WARN); null when within budget or never checked. */
  budgetCheck?: BudgetCheck | null;
}

export interface VoucherLine {
  lineNo: number;
  account: { id: string; code: string; name: string } | null;
  projectId: string | null;
  costCentreId: string | null;
  personId: string | null;
  costCategory: string | null;
  description: string;
  gross: number;
  vat: number;
  whtCode: string;
  whtRateBp: number;
  wht: number;
  whtOverrideReason: string | null;
  net: number;
}

export interface SpendDocument {
  id: string;
  itemCode: string | null;
  fileName: string;
  mime: string | null;
  size: number | null;
  sha256: string | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
}

export interface SpendQuery {
  id: string;
  checkpoint: number;
  status: string;
  raisedBy: string | null;
  raisedAt: string | null;
  messages: { id: string; author: string | null; authorId: string; body: string; at: string | null }[];
}

export interface FcuMark {
  code: string;
  label: string;
  result: "ok" | "query" | "na";
  comment: string | null;
}

export interface FcuReviewRecord {
  id: string;
  /** 1 memo vetting, 2 voucher pre-audit, 3 payment confirmation, 4 retirement. */
  checkpoint: number;
  outcome: string;
  reviewer: string | null;
  items: FcuMark[] | null;
  comment: string | null;
  at: string | null;
}

export interface StatusStep {
  from: string | null;
  to: string;
  by: string | null;
  comment: string | null;
  at: string | null;
}

export interface PaymentFailure {
  at: string;
  by: string;
  reason: string;
  cibReference: string | null;
  scheduleId: string | null;
}

export interface VoucherDetail extends VoucherSummary {
  memos: { id: string; reference: string; title: string; amount: number }[];
  lines: VoucherLine[];
  documents: SpendDocument[];
  queries: SpendQuery[];
  reviews: FcuReviewRecord[];
  history: StatusStep[];
  failures: PaymentFailure[];
  confirmationEvidence: string | null;
  statementLineId: string | null;
  amountPaid: number | null;
  initiatedAt: string | null;
}

export interface VoucherLineInput {
  accountId: string;
  projectId?: string | null;
  costCentreId?: string | null;
  personId?: string | null;
  costCategory?: string | null;
  description: string;
  gross: number;
  vat?: number;
  whtCode?: string;
  /** Only when changing the table rate; needs `whtOverrideReason`. */
  whtRateBp?: number | null;
  whtOverrideReason?: string | null;
}

export interface VoucherInput {
  date?: string;
  narration?: string | null;
  payingBankAccountId?: string | null;
  /** Leave out for an advance: one line to staff advances for the memo's balance. */
  lines?: VoucherLineInput[];
}

export interface WhtRateOption {
  code: string;
  label: string;
  payeeKind: "company" | "individual";
  rateBp: number;
}

/* ------------------------------- memos -------------------------------- */

/** What the voucher screen reads off the cleared memo it pays (`PaymentMemoController::show`). */
export interface VoucherMemo {
  id: string;
  reference: string;
  title: string;
  type: "payment" | "advance" | "system";
  amount: number;
  currency: string | null;
  approvedAmount: number | null;
  paidAmount: number;
  balance: number;
  status: string;
  projectId: string | null;
  project: string | null;
  costCentreId: string | null;
  costCentre: string | null;
  costCategory: string | null;
  payee: { kind: "staff" | "vendor"; id: string; name: string | null; vendorKind?: "company" | "individual" } | null;
  /** Masked, from the master record: what the voucher will pay into. */
  payeeBank?: { bankName: string | null; accountName: string | null; last4: string | null; source: string | null } | null;
  /** Approved less every live voucher on the memo (what a new voucher may draw). */
  remaining?: number;
  requester: string | null;
  neededBy: string | null;
  approvalId: string | null;
  body?: string | null;
  vouchers?: { id: string; pvNo: string; status: VoucherStatus; amount: number; net: number }[];
  clearedAt?: string | null;
}

/* ----------------------------- schedules ------------------------------ */

export type ScheduleStatus = "draft" | "approved" | "downloaded" | "completed" | "cancelled";

export interface PaymentSchedule {
  id: string;
  reference: string;
  bankAccountId: string;
  bankAccount: string | null;
  status: ScheduleStatus;
  total: number;
  count: number;
  createdBy: string | null;
  createdById: string;
  approvedBy: string | null;
  approvedAt: string | null;
  /** SHA-256 of the last bank file produced; null until it is downloaded. */
  fileSha256: string | null;
  generatedAt: string | null;
  createdAt: string | null;
  /** Approving needs the approver's authenticator code (the total reached the step-up amount). */
  stepUp?: boolean;
}

export interface PaymentScheduleDetail extends PaymentSchedule {
  vouchers: VoucherSummary[];
}

/* --------------------------- project funds ---------------------------- */

/** `stale`: progress is over 14 days old, so earned value can't be trusted. */
export type Rag = "green" | "amber" | "red" | "grey" | "stale";

export type RagDimension = "funds" | "budget" | "discipline" | "cost" | "schedule" | "margin" | "collections" | "progress";

export interface RagReason {
  dimension: RagDimension | string;
  status: Rag;
  reason: string;
}

export type ProgressMethod = "milestone_weighted" | "work_completion" | "pm_reported";

/** How percent complete was measured (`ProjectKpis::progress`). */
export interface ProgressReading {
  /** Basis points; null when there is nothing to measure yet. */
  pctBp: number | null;
  method: ProgressMethod | string;
  asOf: string | null;
  stale: boolean;
  detail: string;
}

/**
 * Earned value for one project (`ProjectKpis`). Money in minor units, rates
 * and margins in basis points; CPI and SPI are plain ratios (1 = on plan).
 */
export interface ProjectKpis {
  asOf: string;
  contractValue: number;
  bac: number;
  /** Planned value: the budget's worth of work that should be done by now. */
  pv: number;
  /** Earned value: the budget's worth of work actually done. */
  ev: number;
  /** Actual cost: non-labour spend plus labour (allocated and provisional). */
  ac: number;
  acNonLabour: number;
  acLabour: number;
  acLabourProvisional: number;
  pctBp: number | null;
  progress: ProgressReading;
  cpi: number | null;
  spi: number | null;
  /** Estimate at completion. */
  eac: number | null;
  /** `cpi`: projected from cost efficiency so far; `remaining_at_budget`: early, remaining work at budget. */
  eacMethod: "cpi" | "remaining_at_budget" | null;
  projectedProfit: number | null;
  projectedMarginBp: number | null;
  targetMarginBp: number | null;
  /** Contract value earned so far, less actual cost. */
  progressProfit: number | null;
  recognisedProfit: number | null;
  invoiced: number;
  revenueRecognised: number;
  collected: number;
  receivable: number;
  overdue: number;
  maxDaysOverdue: number;
  /** Collected less spent. */
  cashPosition: number;
  released: number;
  committed: number;
  available: number;
  hasContract: boolean;
  /** Only from `GET projects/{id}/kpis`. */
  dimensions?: RagReason[];
}

/** A weekly snapshot (`ProjectWatch`), oldest first. */
export interface KpiSnapshot {
  asOf: string;
  status: Rag;
  pv: number;
  ev: number;
  ac: number;
  pctBp: number | null;
  progressProfit: number | null;
  recognisedProfit: number | null;
  projectedProfit: number | null;
  cashPosition: number | null;
  collected: number;
  invoiced: number;
}

export interface ProjectContractSummary {
  id: string;
  title: string | null;
  reference: string | null;
  client: string | null;
  clientId: string | null;
  value: number;
  currency: string;
  billingType: string;
  progressMethod: ProgressMethod | string;
  startsOn: string | null;
  endsOn: string | null;
  milestones?: { id: string; sequence: number; name: string; amount: number; dueOn: string | null; status: string; completedAt: string | null }[];
}

export interface ProjectInvoiceRow {
  id: string;
  invoiceNo: string | null;
  date: string;
  dueOn: string | null;
  subtotal: number;
  total: number;
  settled: number;
  outstanding: number;
  status: string;
  currency: string;
  daysLate: number;
}

export interface ProjectAlertRecord {
  id: string;
  dimension: RagDimension | string;
  severity: Rag;
  message: string;
  raisedAt: string;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}

export interface ProjectLabour {
  allocated: number;
  provisional: number;
  months: { month: string; allocated: number; provisional: number; hours: number }[];
  /** Only for those who may see individual pay. */
  people: { month: string; kind: "allocation" | "provisional"; userId: string; name: string | null; hours: number; hourlyRate: number; amount: number }[] | null;
  seesPeople: boolean;
}

export interface CategoryPosition {
  category: string;
  label: string;
  budget: number;
  budgetToDate: number;
  spent: number;
}

export interface ProjectFunds {
  id: string;
  name: string;
  code: string | null;
  client?: string | null;
  projectStatus: string;
  contractValue: number;
  /** Budget at completion: the approved budget's total. */
  bac: number;
  budgetToDate: number;
  released: number;
  committed: number;
  spent: number;
  /** Released less committed less spent; negative when overdrawn. */
  available: number;
  spentThisMonth: number;
  /** Money out of the bank on this project with no approved request behind it. */
  unplanned: number;
  categories: CategoryPosition[];
  status: Rag;
  reasons: RagReason[];
  hasBudget: boolean;
  /* Earned value (Phase 3). */
  pctBp: number | null;
  cpi: number | null;
  spi: number | null;
  ev: number;
  pv: number;
  eac: number | null;
  progressProfit: number | null;
  projectedProfit: number | null;
  projectedMarginBp: number | null;
  invoiced: number;
  collected: number;
  receivable: number;
  overdue: number;
  /** Labour charged provisionally, until the month's allocation is posted. */
  labourProvisional: number;
  kpis: ProjectKpis;
}

export interface PortfolioTotals {
  contractValue: number;
  bac: number;
  released: number;
  committed: number;
  spent: number;
  available: number;
  spentThisMonth: number;
  unplanned: number;
  invoiced: number;
  collected: number;
  receivable: number;
  overdue: number;
  projectedProfit: number;
  /** Contract value of the projects that have a projection: the base for the portfolio margin. */
  profitContractValue: number;
  red: number;
  amber: number;
  stale: number;
}

export interface Portfolio {
  totals: PortfolioTotals;
  projects: ProjectFunds[];
}

export interface CurvePoint {
  month: string;
  planned: number;
  actual: number;
  cumulativePlanned: number;
  cumulativeActual: number;
}

export interface FundReleaseRecord {
  id: string;
  tranche: number;
  amount: number;
  revoked: number;
  scope: "non_labour" | "all";
  status: "requested" | "approved" | "rejected" | "revoked";
  approvalId: string | null;
  requestedBy: string | null;
  approvedAt: string | null;
  conditions: string | null;
}

export interface CommitmentRecord {
  id: string;
  source: string;
  sourceId: string;
  reference: string | null;
  title: string | null;
  amount: number;
  consumed: number;
  outstanding: number;
  category: string | null;
  expiresAt: string | null;
}

export interface ProjectTransaction {
  journalId: string;
  journalNo: string | null;
  date: string;
  source: string | null;
  sourceId: string | null;
  account: string;
  narration: string | null;
  /** Debit less credit: spend is positive. */
  amount: number;
}

export interface ProjectBudgetRecord {
  id: string;
  version: number;
  bac: number;
  contractValue: number;
  targetMarginBp: number | null;
  approvedAt: string | null;
  rebaselineReason: string | null;
  lines: { category: string; month: string; amount: number }[];
}

export interface BudgetDraftRecord {
  id: string;
  version: number;
  status: "draft" | "pending_approval";
  bac: number;
  contractValue: number;
  /** The approval it is waiting in, once sent. */
  approvalId: string | null;
  rebaselineReason: string | null;
}

export interface ProjectFundsDetail extends ProjectFunds {
  budget: ProjectBudgetRecord | null;
  drafts: BudgetDraftRecord[];
  curve: CurvePoint[];
  releases: FundReleaseRecord[];
  commitments: CommitmentRecord[];
  transactions: ProjectTransaction[];
  categories_catalogue: Record<string, string>;
  /** Weekly snapshots, oldest first. */
  history: KpiSnapshot[];
  contract: ProjectContractSummary | null;
  /** Recent invoices on the project's contract. */
  invoices: ProjectInvoiceRow[];
  /** Open alerts. */
  alerts: ProjectAlertRecord[];
}

export interface BudgetInput {
  contractValue: number;
  currency?: string;
  targetMarginBp?: number | null;
  /** Required when an approved budget exists (a rebaseline). */
  reason?: string | null;
  lines: { category: string; month: string; amount: number }[];
}

export interface ReleaseInput {
  amount: number;
  scope: "non_labour" | "all";
  conditions?: string | null;
}

/* ---------------------------- spend settings --------------------------- */

export type ChecklistMemoType = "payment" | "advance" | "system" | "retirement";

export interface ChecklistItem {
  id: string;
  memoType: ChecklistMemoType;
  code: string;
  label: string;
  hint: string | null;
  required: boolean;
  /** Required only from this amount (minor units); null is always. */
  requiredFrom: number | null;
  active: boolean;
}

export interface WhtRateRow {
  id: string;
  code: string;
  label: string;
  payeeKind: "company" | "individual";
  rateBp: number;
  active: boolean;
}

export interface SpendLimits {
  fund_control: boolean;
  advance_retirement_days: number;
  memo_clear_days: number;
  statement_match_days: number;
  commitment_expiry_days: number;
  /** Remind the requester and Finance once when an approved memo has no voucher after this. */
  memo_reminder_days: number;
  /** An approved memo unpaid this long shows as an ageing commitment. */
  commitment_alert_days: number;
  /** Expire memos past `commitment_expiry_days` automatically (off: Finance expires them). */
  commitment_auto_expire: boolean;
}

export interface SpendSettings {
  checklists: ChecklistItem[];
  whtRates: WhtRateRow[];
  settings: SpendLimits;
}

/* ------------------------------- errors ------------------------------- */

/**
 * An API refusal in plain words: the machine code the API leads with
 * (`PV_EXCEEDS_MEMO: …`, `SOD_VIOLATION: …`) is for logs, not people.
 */
export function plainError(e: unknown, fallback = "Something went wrong."): string {
  const text = errorText(e) || fallback;
  return stripCode(text);
}

export function stripCode(text: string): string {
  return text.replace(/^[A-Z][A-Z0-9_]{3,}:\s*/, "");
}

/** Every validation message, code stripped, keyed as the API keyed it (`lines.0.gross`). */
export function fieldMessages(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || !e.errors) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.errors)) {
    const first = Array.isArray(v) ? v[0] : v;
    if (typeof first === "string") out[k] = stripCode(first);
  }
  return out;
}

/* ------------------------------- client ------------------------------- */

/**
 * A file the proxy hands back as JSON-encoded text (anything not ending in
 * `/pdf` is read as JSON and re-sent as JSON): the bank file arrives as one
 * JSON string. Read either way, so it still works if the proxy learns to
 * stream it.
 */
async function textFile(path: string): Promise<string> {
  const res = await fetch(`/api/finance/${path}`, { cache: "no-store" });
  const type = res.headers.get("Content-Type") ?? "";
  const raw = await res.text();
  if (type.includes("application/json")) {
    let body: unknown = null;
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
    if (!res.ok) {
      const b = body as { message?: string; errors?: Record<string, string[]> } | null;
      throw new ApiError(b?.message ?? "Request failed.", res.status, b?.errors);
    }
    if (typeof body === "string") return body;
    throw new ApiError("The bank file didn't come back as a file.", 502);
  }
  if (!res.ok) throw new ApiError(raw || "Request failed.", res.status);
  return raw;
}

export const spend = {
  vouchers: {
    list: (filters: { status?: string; q?: string; bankAccountId?: string } = {}) =>
      unwrap(financeRequest<{ data: VoucherSummary[] }>("vouchers", { query: filters })),
    get: (id: string) => unwrap(financeRequest<{ data: VoucherDetail }>(`vouchers/${enc(id)}`)),
    create: (memoId: string, input: VoucherInput) =>
      unwrap(financeRequest<{ data: VoucherDetail }>(`memos/${enc(memoId)}/vouchers`, { method: "POST", body: input })),
    update: (id: string, input: VoucherInput) =>
      unwrap(financeRequest<{ data: VoucherDetail }>(`vouchers/${enc(id)}`, { method: "PATCH", body: input })),
    submit: (id: string) => unwrap(financeRequest<{ data: VoucherDetail }>(`vouchers/${enc(id)}/submit`, { method: "POST" })),
    approve: (id: string) => unwrap(financeRequest<{ data: VoucherDetail }>(`vouchers/${enc(id)}/approve`, { method: "POST" })),
    cancel: (id: string, reason: string) =>
      unwrap(financeRequest<{ data: VoucherDetail }>(`vouchers/${enc(id)}/cancel`, { method: "POST", body: { reason } })),
    upload: (id: string, file: File, itemCode?: string) => {
      const form = new FormData();
      form.append("file", file);
      if (itemCode) form.append("itemCode", itemCode);
      return unwrap(financeUpload<{ data: SpendDocument[] }>(`vouchers/${enc(id)}/documents`, form));
    },
    /** The printed voucher (letterhead, lines, approvals, a QR to verify it). */
    pdfUrl: (id: string) => `/api/finance/vouchers/${enc(id)}/pdf`,
    whtRates: () => unwrap(financeRequest<{ data: WhtRateOption[] }>("vouchers/wht-rates")),
  },
  memos: {
    get: (id: string) => unwrap(financeRequest<{ data: VoucherMemo }>(`memos/${enc(id)}`)),
  },
  schedules: {
    list: () => unwrap(financeRequest<{ data: PaymentSchedule[] }>("payment-schedules")),
    get: (id: string) => unwrap(financeRequest<{ data: PaymentScheduleDetail }>(`payment-schedules/${enc(id)}`)),
    create: (bankAccountId: string, voucherIds: string[]) =>
      unwrap(financeRequest<{ data: PaymentSchedule }>("payment-schedules", { method: "POST", body: { bankAccountId, voucherIds } })),
    /** `mfaCode`: the approver's authenticator or backup code, when `stepUp` is true. */
    approve: (id: string, mfaCode?: string) =>
      unwrap(financeRequest<{ data: PaymentSchedule }>(`payment-schedules/${enc(id)}/approve`, { method: "POST", body: mfaCode ? { mfaCode } : undefined })),
    /** Draft, approved or downloaded schedules only, and only while no payment on it has gone out. Its vouchers go back to the queue. */
    cancel: (id: string, reason: string) =>
      unwrap(financeRequest<{ data: PaymentSchedule }>(`payment-schedules/${enc(id)}/cancel`, { method: "POST", body: { reason } })),
    /** The CSV for the bank's bulk upload. Producing it is logged and hashed. */
    bankFile: (id: string) => textFile(`payment-schedules/${enc(id)}/bank-file`),
    initiated: (voucherId: string, cibReference: string) =>
      unwrap(financeRequest<{ data: VoucherDetail }>(`vouchers/${enc(voucherId)}/initiated`, { method: "POST", body: { cibReference } })),
    failed: (voucherId: string, reason: string) =>
      unwrap(financeRequest<{ data: VoucherDetail }>(`vouchers/${enc(voucherId)}/failed`, { method: "POST", body: { reason } })),
  },
  funds: {
    portfolio: () => unwrap(financeRequest<{ data: Portfolio }>("projects")),
    project: (id: string) => unwrap(financeRequest<{ data: ProjectFundsDetail }>(`projects/${enc(id)}`)),
    draftBudget: (projectId: string, input: BudgetInput) =>
      unwrap(
        financeRequest<{ data: { id: string; version: number; status: string; bac: number } }>(`projects/${enc(projectId)}/budgets`, {
          method: "POST",
          body: input,
        }),
      ),
    submitBudget: (budgetId: string) =>
      unwrap(financeRequest<{ data: { id: string; status: string } }>(`project-budgets/${enc(budgetId)}/submit`, { method: "POST" })),
    /** Requested and sent for approval in one go. */
    requestRelease: (projectId: string, input: ReleaseInput) =>
      unwrap(
        financeRequest<{ data: { id: string; tranche: number; status: string } }>(`projects/${enc(projectId)}/releases`, {
          method: "POST",
          body: input,
        }),
      ),
    revokeRelease: (releaseId: string, amount: number, reason: string) =>
      unwrap(
        financeRequest<{ data: { id: string; status: string; revoked: number } }>(`fund-releases/${enc(releaseId)}/revoke`, {
          method: "POST",
          body: { amount, reason },
        }),
      ),
    kpis: (projectId: string, asOf?: string | null) =>
      unwrap(financeRequest<{ data: ProjectKpis }>(`projects/${enc(projectId)}/kpis`, { query: { asOf: asOf ?? undefined } })),
    /** The project manager's percent complete (0–100, decimals allowed). */
    reportProgress: (projectId: string, input: { pct: number; asOf?: string | null }) =>
      unwrap(
        financeRequest<{ data: { id: string; pctBp: number; asOf: string } }>(`projects/${enc(projectId)}/progress`, {
          method: "POST",
          body: input.asOf ? input : { pct: input.pct },
        }),
      ),
    labour: (projectId: string) => unwrap(financeRequest<{ data: ProjectLabour }>(`projects/${enc(projectId)}/labour`)),
    acknowledgeAlert: (alertId: string) =>
      unwrap(financeRequest<{ data: { id: string; acknowledgedAt: string | null } }>(`project-alerts/${enc(alertId)}/acknowledge`, { method: "POST" })),
  },
  settings: {
    get: () => unwrap(financeRequest<{ data: SpendSettings }>("spend-settings")),
    update: (patch: Partial<SpendLimits>) =>
      unwrap(financeRequest<{ data: Partial<SpendLimits> }>("spend-settings", { method: "PATCH", body: patch })),
    addChecklistItem: (input: { memoType: ChecklistMemoType; label: string; hint?: string | null; required?: boolean; requiredFrom?: number | null }) =>
      unwrap(financeRequest<{ data: { id: string } }>("spend-settings/checklist", { method: "POST", body: input })),
    updateChecklistItem: (id: string, patch: Partial<Pick<ChecklistItem, "label" | "hint" | "required" | "requiredFrom" | "active">>) =>
      unwrap(financeRequest<{ data: { id: string } }>(`spend-settings/checklist/${enc(id)}`, { method: "PATCH", body: patch })),
    updateWhtRate: (id: string, patch: { rateBp?: number; label?: string; active?: boolean }) =>
      unwrap(financeRequest<{ data: { id: string } }>(`spend-settings/wht/${enc(id)}`, { method: "PATCH", body: patch })),
  },
};
