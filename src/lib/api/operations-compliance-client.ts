/* ------------------------------------------------------------------ */
/*  XwiftHQ Admin & Operations › compliance (PRD §17). The register,  */
/*  the shared calendar (Finance's tax deadlines included), each      */
/*  occurrence through to completion with evidence, the fee as a      */
/*  payment memo, certificates and the bid-readiness pack.            */
/*  Shapes follow `ComplianceController`, `Compliance` and `BidPack`  */
/*  in api-lms. Money is integer kobo; dates `YYYY-MM-DD`.            */
/* ------------------------------------------------------------------ */

import { opsRequest, opsUpload, unwrap } from "./operations-request";
import { ApiError, errorText, opsError, opsFieldErrors } from "./operations-travel-client";

export { ApiError, errorText, opsError, opsFieldErrors };

const enc = encodeURIComponent;

/** Where an occurrence is (`Compliance::stage`). */
export type ComplianceStage = "upcoming" | "due_soon" | "in_progress" | "submitted" | "completed" | "overdue" | "cancelled";

/** A certificate's standing today: expiring is within 60 days. */
export type CertificateState = "valid" | "expiring" | "expired" | "missing";

export type DueRuleType = "day_of_month" | "annual_date" | "after_fy_end" | "expiry" | "fixed";

/** How the next due date is worked out. `month` is 1–12. */
export interface DueRule {
  type: DueRuleType;
  day?: number;
  month?: number;
  /** For `after_fy_end`: months after the financial year ends. */
  months?: number;
  /** Monthly remittances fall due in the month after the period. */
  offsetMonths?: number;
}

export interface Obligation {
  id: string;
  /** The starter register's key; null for one added here. */
  key: string | null;
  name: string;
  authority: string | null;
  category: string;
  categoryLabel: string;
  ownerRole: string | null;
  ownerId: string | null;
  owner: string | null;
  frequency: string;
  dueRule: DueRule | null;
  reminderDays: number[];
  evidenceRequired: string | null;
  isCertificate: boolean;
  mandatory: boolean;
  bidPack: boolean;
  needsPayment: boolean;
  typicalFee: number | null;
  counterpartyId: string | null;
  costCentreId: string | null;
  active: boolean;
}

/**
 * One time an obligation falls due. The obligation's own fields (`name`,
 * `category`, `ownerRole`…) are filled on the calendar's list only; a single
 * occurrence (`show`, and the replies to its actions) leaves them null and
 * carries the whole `obligation` instead.
 */
export interface Occurrence {
  id: string;
  obligationId: string;
  name: string | null;
  category: string | null;
  ownerRole: string | null;
  owner: string | null;
  isCertificate: boolean | null;
  needsPayment: boolean | null;
  /** "September 2026", "Q3 2026", "2026". */
  period: string | null;
  dueOn: string | null;
  status: string;
  stage: ComplianceStage;
  reference: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  amount: number | null;
  memoId: string | null;
  evidenceCount: number;
  completedAt: string | null;
  completedBy: string | null;
}

export interface Certificate {
  obligationId: string;
  name: string;
  mandatory: boolean;
  bidPack: boolean;
  /** The latest completed occurrence; null when none is on file. */
  occurrenceId: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  state: CertificateState;
}

export interface ComplianceSummary {
  dueSoon: number;
  overdue: number;
  expired: number;
  expiring: number;
  /** Names of mandatory certificates that have expired. */
  expiredMandatory: string[];
}

export interface ComplianceBoard {
  obligations: Obligation[];
  occurrences: Occurrence[];
  certificates: Certificate[];
  summary: ComplianceSummary;
  /** Every owner role on the register, for the filter chips. */
  owners: string[];
  categories: Record<string, string>;
  frequencies: Record<string, string>;
  from: string;
  to: string;
  financeOn: boolean;
}

export interface Evidence {
  id: string;
  kind: string;
  name: string;
  mime: string | null;
  size: number | null;
  uploadedBy: string | null;
  uploadedById: string | null;
  uploadedAt: string | null;
}

/** Finance's memo for the fee (`FinanceBridge::memos`). */
export interface OccurrenceMemo {
  reference: string | null;
  status: string;
  amount: number;
  paid: number;
  type: string | null;
}

/** A reminder that went out: `t-30` is 30 days before, `overdue` after. */
export interface ReminderSent {
  kind: string;
  sentAt: string | null;
}

export interface OccurrenceDetail extends Occurrence {
  obligation: Obligation;
  evidence: Evidence[];
  notes: string | null;
  /** The obligation's other occurrences, newest first. */
  history: Occurrence[];
  memo: OccurrenceMemo | null;
  reminders: ReminderSent[];
}

export interface BidPackIncluded extends Certificate {
  files: { id: string; name: string }[];
}

export interface BidPackMissing extends Certificate {
  /** "Expired on 3 Sep 2026", "No certificate on file", "No file attached". */
  reason: string;
}

export interface BidPackPreview {
  included: BidPackIncluded[];
  missing: BidPackMissing[];
}

export interface ObligationInput {
  name?: string;
  authority?: string | null;
  category?: string;
  ownerRole?: string | null;
  ownerId?: string | null;
  frequency?: string;
  dueRule?: DueRule | null;
  reminderDays?: number[];
  evidenceRequired?: string | null;
  isCertificate?: boolean;
  mandatory?: boolean;
  bidPack?: boolean;
  needsPayment?: boolean;
  typicalFee?: number | null;
  counterpartyId?: string | null;
  costCentreId?: string | null;
  active?: boolean;
  /** A new obligation's first due date, instead of the rule's. */
  firstDueOn?: string | null;
}

export interface CompleteInput {
  reference?: string | null;
  issuedOn?: string | null;
  /** Required for a certificate. */
  expiresOn?: string | null;
  notes?: string | null;
}

/* ------------------------------ helpers ------------------------------ */

/** The reminder rows come straight from the table (`sent_at`); one spelling here. */
function normaliseReminders(raw: unknown): ReminderSent[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: Record<string, unknown>) => ({
    kind: String(r.kind ?? ""),
    sentAt: (typeof r.sentAt === "string" ? r.sentAt : typeof r.sent_at === "string" ? r.sent_at : null) as string | null,
  }));
}

const withReminders = (d: OccurrenceDetail): OccurrenceDetail => ({ ...d, reminders: normaliseReminders(d.reminders) });

/* ------------------------------- client ------------------------------ */

export const compliance = {
  /** The register, the calendar's occurrences between two dates (overdue ones from before included), certificates and the summary. */
  board: (range: { from?: string; to?: string; ownerRole?: string } = {}) =>
    opsRequest<{
      data: Omit<ComplianceBoard, "categories" | "frequencies" | "from" | "to" | "financeOn">;
      meta: { categories: Record<string, string>; frequencies: Record<string, string>; from: string; to: string; financeOn: boolean };
    }>("compliance", { query: { ...range } }).then((r) => ({ ...r.data, ...r.meta }) as ComplianceBoard),

  create: (input: ObligationInput) => unwrap(opsRequest<{ data: Obligation }>("compliance", { method: "POST", body: input })),
  update: (id: string, input: ObligationInput) => unwrap(opsRequest<{ data: Obligation }>(`compliance/obligations/${enc(id)}`, { method: "PATCH", body: input })),

  occurrence: (id: string) => unwrap(opsRequest<{ data: OccurrenceDetail }>(`compliance/occurrences/${enc(id)}`)).then(withReminders),
  start: (id: string) => unwrap(opsRequest<{ data: Occurrence }>(`compliance/occurrences/${enc(id)}/start`, { method: "POST", body: {} })),
  submit: (id: string, input: { reference?: string | null; note?: string | null } = {}) =>
    unwrap(opsRequest<{ data: Occurrence }>(`compliance/occurrences/${enc(id)}/submit`, { method: "POST", body: input })),
  /** Refused without evidence on file; a certificate needs `expiresOn`. */
  complete: (id: string, input: CompleteInput) => unwrap(opsRequest<{ data: Occurrence }>(`compliance/occurrences/${enc(id)}/complete`, { method: "POST", body: input })),

  uploadEvidence: (id: string, file: File, kind?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (kind) form.append("kind", kind);
    return unwrap(opsUpload<{ data: { id: string; name: string } }>(`compliance/occurrences/${enc(id)}/evidence`, form));
  },
  removeEvidence: (id: string, attachmentId: string) =>
    opsRequest<Record<string, never>>(`compliance/occurrences/${enc(id)}/evidence/${enc(attachmentId)}`, { method: "DELETE" }).then(() => undefined),
  evidenceHref: (attachmentId: string) => `/api/operations/attachments/${enc(attachmentId)}`,

  /** A draft payment memo for the fee, in kobo. Needs Finance. */
  raiseMemo: (id: string, amount: number) => unwrap(opsRequest<{ data: { memoId: string } }>(`compliance/occurrences/${enc(id)}/memo`, { method: "POST", body: { amount } })),

  bidPack: () => unwrap(opsRequest<{ data: BidPackPreview }>("compliance/bid-pack")),
  bidPackHref: "/api/operations/compliance/bid-pack/file",
};
