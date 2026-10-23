/* ------------------------------------------------------------------ */
/*  XwiftHQ Admin & Operations › Procurement: the overview, staff's    */
/*  own purchase requests, the sourcing desk (RFQs, quotations, the    */
/*  comparison sheet, the award), purchase orders, receiving (GRNs,    */
/*  SCCs, vendor invoices and the three-way match) and attachments.    */
/*  Shapes follow `OpsPresenter` in api-lms. Money is integer kobo;    */
/*  rates are basis points (750 = 7.5%).                               */
/* ------------------------------------------------------------------ */

import { ApiError, errorText, opsRequest, opsUpload, unwrap } from "./operations-request";
import type { MaintenanceSummary } from "./operations-maintenance-client";

export { ApiError, errorText };

const enc = encodeURIComponent;

/* ------------------------------- shared ------------------------------- */

export interface ProjectRef {
  id: string;
  name: string;
  code: string | null;
}

export interface OpsAttachment {
  id: string;
  kind: string;
  name: string;
  mime: string | null;
  size: number;
  uploadedBy: string | null;
  /** Who added it; only they may remove it from their own request. */
  uploadedById?: string | null;
  uploadedAt: string | null;
}

export type AttachmentOwner = "pr" | "quotation" | "po" | "grn" | "scc" | "vendor_invoice";

/** The project's funds when a request was sent (`funds_snapshot`). */
export interface OpsFundsSnapshot {
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

/** A Finance payment memo as Operations sees it. */
export interface OpsMemo {
  reference: string | null;
  status: string;
  amount: number;
  paid: number;
  type: string;
}

/* --------------------------- purchase requests ------------------------ */

export type PrStatus = "draft" | "in_approval" | "approved" | "rejected" | "award_pending" | "awarded" | "ordered" | "cancelled";
export type LineKind = "goods" | "service";

export interface PrSummary {
  id: string;
  number: string | null;
  title: string;
  category: string;
  categoryLabel: string;
  status: PrStatus;
  /** Set when the system drafted it: a restock below reorder level, or a requisition's shortfall. */
  origin?: "reorder" | "shortfall" | null;
  estimate: number;
  currency: string;
  neededBy: string | null;
  requester: string | null;
  requesterId: string;
  project: ProjectRef | null;
  costCentreId: string | null;
  eventId: string | null;
  createdAt: string | null;
  approvalId: string | null;
}

export interface PrLine {
  id: string;
  lineNo: number;
  kind: LineKind;
  description: string;
  specification: string | null;
  quantity: number;
  unit: string;
  estUnitPrice: number;
  estimate: number;
  suggestedVendorId: string | null;
  /** Received into the asset register under this category (one serial per item). */
  assetCategoryId?: string | null;
  /** Received into the stores as this stock item. */
  itemId?: string | null;
}

/** One vendor an RFQ went to, and whether their quotation is in. */
export interface RfqInvite {
  vendorId: string;
  vendor: string | null;
  replied: boolean;
  quotationId: string | null;
  repliedAt: string | null;
}

export interface Rfq {
  id: string;
  number: string;
  deadline: string;
  /** The invited vendors' names, in order (older shape; `invited` carries more). */
  vendors: string[];
  invited: RfqInvite[];
  replied: number;
  awaiting: number;
  /** `open` while waiting; `closed` once everyone replied or the deadline passed. */
  status: "open" | "closed" | string;
  message: string | null;
}

export interface QuoteVendor {
  quotationId: string;
  vendorId: string;
  vendor: string | null;
  reference: string | null;
  subtotal: number;
  vat: number;
  total: number;
  deliveryDays: number | null;
  paymentTerms: string | null;
  meetsSpec: boolean;
  validUntil: string | null;
  linesQuoted: number;
  /** The RFQ it answers, when it answers one. */
  rfqId: string | null;
  /** Who keyed the quotation in. */
  enteredBy: string | null;
  /** The quotation's own files: the vendor's document. */
  attachments: OpsAttachment[];
}

export interface QuotePrice {
  quotationId: string;
  quotationLineId: string;
  vendorId: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  vat: number;
}

export interface ComparisonLine {
  prLineId: string;
  lineNo: number;
  description: string;
  kind: LineKind;
  quantity: number;
  unit: string;
  estimate: number;
  /** One per vendor, in the vendors' order; null where that vendor did not quote the line. */
  prices: (QuotePrice | null)[];
  lowest: number | null;
}

export interface QuotationRule {
  needed: number;
  have: number;
  met: boolean;
  singleSource: boolean;
  tender: boolean;
  message: string;
}

export interface Comparison {
  vendors: QuoteVendor[];
  lines: ComparisonLine[];
  estimate: number;
  rule: QuotationRule;
}

export interface Award {
  id: string;
  status: string;
  total: number;
  reason: string;
  recommendedBy: string | null;
  approvalId: string | null;
  createdAt: string | null;
  lines: { prLineId: string; vendorId: string; vendor: string | null }[];
}

export interface PrFull extends PrSummary {
  justification: string | null;
  location: string | null;
  costCategory: string | null;
  singleSourceReason: string | null;
  funds: OpsFundsSnapshot | null;
  eventLineId: string | null;
  lines: PrLine[];
  rfqs: Rfq[];
  /** Null until the request is approved. */
  comparison: Comparison | null;
  awards: Award[];
  orders: PoSummary[];
  attachments: OpsAttachment[];
}

export interface PrLineInput {
  kind: LineKind;
  description: string;
  specification?: string | null;
  quantity: number;
  unit: string;
  estUnitPrice: number;
  /** Optional: put away in the asset register under this category. */
  assetCategoryId?: string | null;
  /** Optional: put away in the stores as this item. */
  itemId?: string | null;
}

export interface PrInput {
  title: string;
  category: string;
  justification?: string | null;
  neededBy?: string | null;
  location?: string | null;
  projectId?: string | null;
  costCentreId?: string | null;
  singleSourceReason?: string | null;
  lines: PrLineInput[];
}

export interface PrDeskMeta {
  toSource: number;
  awardPending: number;
  inApproval: number;
  categories: Record<string, string>;
}

export type PrDeskFilter = "sourcing" | "approved" | "award_pending" | "in_approval";

export interface RfqInput {
  vendorIds: string[];
  deadline: string;
  message?: string | null;
}

export interface QuotationInput {
  vendorId: string;
  rfqId?: string | null;
  reference?: string | null;
  quotedOn?: string | null;
  validUntil?: string | null;
  deliveryDays?: number | null;
  paymentTerms?: string | null;
  meetsSpec?: boolean;
  notes?: string | null;
  lines: { prLineId: string; unitPrice: number; quantity?: number; vatRateBp?: number }[];
}

export interface AwardInput {
  reason: string;
  picks: { prLineId: string; quotationId: string }[];
}

/* ---------------------------- purchase orders ------------------------- */

export type PoStatus =
  | "draft"
  | "in_approval"
  | "approved"
  | "sent"
  | "accepted"
  | "partially_received"
  | "received"
  | "invoiced"
  | "partially_paid"
  | "paid"
  | "closed"
  | "cancelled"
  | "short_closed"
  | "rejected";

export type TermTrigger = "on_po" | "on_delivery" | "on_completion" | "on_milestone" | "net_days";

export interface PoSummary {
  id: string;
  number: string | null;
  kind: "lpo" | "lso";
  status: PoStatus;
  vendorId: string;
  vendor: string | null;
  project: ProjectRef | null;
  subtotal: number;
  vat: number;
  total: number;
  currency: string;
  deliveryDate: string | null;
  prId: string | null;
  prNumber: string | null;
  createdBy: string | null;
  createdById: string | null;
  approvalId: string | null;
  createdAt: string | null;
  approvedAt?: string | null;
  sentAt?: string | null;
  acceptedAt?: string | null;
}

export interface PoLine {
  id: string;
  lineNo: number;
  kind: LineKind;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRateBp: number;
  amount: number;
  vat: number;
  received: number;
  /** Ordered less received. */
  outstanding?: number;
  /** Claimed by matched invoices. */
  invoiced?: number;
  /** Received less invoiced: what can be invoiced now. */
  toInvoice?: number;
  /** Receiving registers these as assets: one serial per item accepted. */
  assetCategoryId?: string | null;
  /** Receiving puts these into a store as stock. */
  itemId?: string | null;
}

/**
 * An order with its lines, as the receiving desk lists it: enough to record
 * a GRN, an SCC or an invoice without reading the order itself.
 */
export interface ReceivableOrder extends PoSummary {
  lines: PoLine[];
  deliveryAddress?: string | null;
}

export interface PaymentTerm {
  id: string;
  sequence: number;
  label: string;
  trigger: TermTrigger;
  pctBp: number | null;
  amount: number;
  days: number | null;
  status: string;
  memoId: string | null;
}

export interface GrnLine {
  poLineId: string;
  received: number;
  accepted: number;
  rejected: number;
  serials: string[];
  notes: string | null;
}

export interface Grn {
  id: string;
  number: string | null;
  poId: string;
  receivedOn: string | null;
  location: string | null;
  deliveryNote: string | null;
  notes: string | null;
  status: string;
  receivedBy: string | null;
  receivedById: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  lines: GrnLine[];
  attachments: OpsAttachment[];
  poNumber?: string | null;
}

export interface Scc {
  id: string;
  number: string | null;
  poId: string;
  periodFrom: string | null;
  periodTo: string | null;
  rating: number | null;
  comments: string | null;
  status: string;
  raisedBy: string | null;
  raisedById: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  lines: { poLineId: string; confirmed: number }[];
  attachments: OpsAttachment[];
  poNumber?: string | null;
}

export interface MatchLine {
  ok: boolean;
  lineNo: number;
  poLineId: string;
  problems: string[];
  quantity: number;
  /** What approved GRNs/SCCs accepted, less earlier invoices. */
  available: number;
  unitPrice: number;
  orderPrice: number;
  description: string;
}

export interface VendorInvoice {
  id: string;
  poId: string;
  invoiceNo: string;
  invoiceDate: string | null;
  subtotal: number;
  vat: number;
  total: number;
  status: "matched" | "exception" | "rejected" | string;
  match: MatchLine[];
  advanceDeducted: number;
  memoId: string | null;
  memo: OpsMemo | null;
  resolution: string | null;
  createdAt: string | null;
  vendor: string | null;
  poNumber: string | null;
  attachments: OpsAttachment[];
}

export interface PoPaymentRow extends Partial<OpsMemo> {
  kind: "advance" | "invoice";
  label: string;
  memoId: string;
}

export interface PoPayments {
  advance: number;
  advanceDeducted: number;
  raised: number;
  paid: number;
  memos: PoPaymentRow[];
}

/**
 * A dearer revision waiting for approval (`PurchaseOrders::revise`). The
 * order keeps its current figures until it is approved. Snake-case inside:
 * it is the stored JSON, passed through as it is.
 */
export interface PoPendingRevision {
  reason: string;
  /** User id of whoever asked for it. */
  by: string;
  byName?: string | null;
  at: string;
  lines: Record<string, { quantity: number; unit_price: number; amount: number; vat: number }>;
  header: { delivery_address?: string | null; delivery_date?: string | null; terms?: string | null };
  /** Total incl. VAT before and after. */
  from: number;
  to: number;
}

export interface PoReviseInput {
  reason: string;
  /** Only the lines that change. Quantity can't go below what was received. */
  lines?: { id: string; quantity?: number; unitPrice?: number }[];
  deliveryAddress?: string | null;
  deliveryDate?: string | null;
  terms?: string | null;
}

export interface PoFull extends PoSummary {
  deliveryAddress: string | null;
  terms: string | null;
  revision: number;
  /** Set while a dearer revision waits for approval; another can't be raised meanwhile. */
  pendingRevision: PoPendingRevision | null;
  sentAt: string | null;
  acceptedAt: string | null;
  acceptanceNote: string | null;
  closingReason: string | null;
  lines: PoLine[];
  paymentTerms: PaymentTerm[];
  grns: Grn[];
  sccs: Scc[];
  invoices: VendorInvoice[];
  payments: PoPayments;
  financeOn: boolean;
  attachments: OpsAttachment[];
  triggers: Record<TermTrigger, string>;
}

export interface PoMeta {
  drafts: number;
  open: number;
  openValue: number;
  triggers: Record<TermTrigger, string>;
}

export type PoFilter = "draft" | "open";

export interface PaymentTermInput {
  label: string;
  trigger: TermTrigger;
  pctBp?: number | null;
  amount?: number | null;
  days?: number | null;
}

export interface PoUpdateInput {
  deliveryAddress?: string | null;
  deliveryDate?: string | null;
  terms?: string | null;
  paymentTerms?: PaymentTermInput[];
}

/* ------------------------------- receiving ---------------------------- */

export interface ReceivingDesk {
  toReceive: ReceivableOrder[];
  /** Orders with something received and not yet invoiced. */
  toInvoice: ReceivableOrder[];
  grns: Grn[];
  sccs: Scc[];
  exceptions: VendorInvoice[];
  recentInvoices: VendorInvoice[];
  /** Open stores, for the GRN of stock items. */
  stores?: { id: string; name: string; location: string | null }[];
}

export interface GrnInput {
  receivedOn: string;
  location?: string | null;
  /** The store stock lines go into; without one, the organisation's first store. */
  storeId?: string | null;
  deliveryNote?: string | null;
  notes?: string | null;
  lines: { poLineId: string; received: number; accepted: number; rejected?: number; serials?: string[]; notes?: string | null }[];
}

export interface SccInput {
  periodFrom?: string | null;
  periodTo?: string | null;
  rating?: number | null;
  comments?: string | null;
  lines: { poLineId: string; confirmed: number }[];
}

export interface InvoiceInput {
  invoiceNo: string;
  invoiceDate: string;
  lines: { poLineId: string; quantity: number; unitPrice: number }[];
}

/* ------------------------------- overview ----------------------------- */

export interface OverviewTrip {
  id: string;
  number: string | null;
  purpose: string;
  destination: string;
  departsOn: string | null;
  returnsOn: string | null;
  status: string;
  requester: string | null;
  travellers: number;
  project: ProjectRef | null;
}

export interface OverviewEvent {
  id: string;
  number: string | null;
  name: string;
  typeLabel: string;
  status: string;
  startsOn: string | null;
  endsOn: string | null;
  location: string | null;
  project: ProjectRef | null;
  budget: number;
}

export interface OverviewFollowUp {
  id: string;
  number: string | null;
  title: string;
  client: string | null;
  amount: number;
  currency: string;
  stage: string;
  stageLabel: string;
  nextFollowUpOn: string | null;
  followUpOverdue: boolean;
  expectedPaymentOn: string | null;
  accountManager: string | null;
}

export interface Overview {
  procurement: {
    requestsInApproval: number;
    toSource: number;
    awardsPending: number;
    ordersDraft: number;
    ordersOpen: number;
    openValue: number;
    overdueDeliveries: number;
    invoiceExceptions: number;
    /** GRNs and SCCs waiting for approval, together. */
    grnsToApprove: number;
    orderedByMonth: { month: string; goods: number; services: number }[];
  };
  travel: { upcoming: OverviewTrip[]; inApproval: number };
  events: OverviewEvent[];
  clientPayments: {
    totals: { open: number; value: number; overdueFollowUps: number; queried: number };
    byStage: { stage: string; label: string; count: number; value: number }[];
    followUps: OverviewFollowUp[];
  };
  /** The register at a glance; cost in kobo, by status. Absent from older APIs. */
  assets?: OverviewAssets;
  stock?: OverviewStock;
  compliance?: OverviewCompliance;
  vendors?: OverviewVendors;
  travelMoney?: { changeFeesThisQuarter: number };
  /** Work orders: open by priority, SLA, preventive overdue, cost (`Maintenance::summary`). */
  maintenance?: MaintenanceSummary;
  facilities?: OverviewFacilities;
  /** The service desk (`ServiceDesk::summary`). */
  desk?: OverviewDesk;
  financeOn: boolean;
}

export interface OverviewFacilities {
  /** Utility bills and diesel bought, all sites, six months by `YYYY-MM`. */
  spend: { month: string; utilities: number; diesel: number }[];
  /** Leases and service contracts ending in the next 90 days. */
  renewals: number;
  /** Service contracts whose last month is not confirmed yet. */
  serviceToConfirm: number;
  /** Vehicles with a paper expiring in 30 days (or already expired). */
  vehiclePapersExpiring: number;
  visitorsToday: number;
}

export interface OverviewDesk {
  open: number;
  breached: number;
  unassigned: number;
  resolvedThisWeek: number;
  /** Average rating out of 5; null when nobody has rated. */
  satisfaction: number | null;
  /** Percent resolved inside the SLA; null when nothing resolved. */
  slaMet: number | null;
  /** Open tickets by catalogue category. */
  byCategory: Record<string, number>;
}

export interface OverviewAssets {
  byStatus: Record<string, { count: number; cost: number }>;
  total: number;
  /** Cost of everything not disposed of. */
  cost: number;
  /** Lost or stolen. */
  missing: number;
  overduePasses: number;
  requestsToFulfil: number;
  clearancesOpen: number;
  /** The verification campaign under way, if any. */
  verification: { name: string; endsOn: string | null; percent: number; missing: number } | null;
}

export interface OverviewStock {
  /** On hand at average cost. */
  value: number;
  belowReorder: number;
  requisitionsToIssue: number;
  /** Issues out of the stores, by `YYYY-MM`, six months. */
  consumption: { month: string; value: number }[];
}

export interface OverviewCompliance {
  dueSoon: number;
  overdue: number;
  expired: number;
  expiring: number;
  expiredMandatory: string[];
  /** Open items due in the next 30 days (and any already late). */
  next: { id: string; name: string | null; dueOn: string | null; stage: string; owner: string | null }[];
}

export interface OverviewVendors {
  /** Top six by value of approved orders in the past year. */
  ordersByVendor: { name: string; orders: number; value: number }[];
  /** Average service rating under 3 of 5. */
  lowRated: { name: string; rating: number }[];
}

/** What the staff forms pick from (`GET me/options`), the slice procurement reads. */
export interface MeOptions {
  projects: { id: string; name: string; code: string | null; status: string | null }[];
  costCentres: { id: string; code: string; name: string }[];
  vendors: { id: string; name: string }[];
  prCategories: Record<string, string>;
  financeOn: boolean;
}

/* -------------------------------- client ------------------------------ */

type List<T, M = undefined> = { data: T[]; meta: M };

export const procurement = {
  overview: () => unwrap(opsRequest<{ data: Overview }>("overview")),

  /** The caller's own purchase requests (`operations/me/*`). */
  me: {
    options: () => unwrap(opsRequest<{ data: MeOptions }>("me/options")),
    list: () => unwrap(opsRequest<{ data: PrSummary[] }>("me/purchase-requests")),
    get: (id: string) => unwrap(opsRequest<{ data: PrFull }>(`me/purchase-requests/${enc(id)}`)),
    create: (input: PrInput) => unwrap(opsRequest<{ data: PrFull }>("me/purchase-requests", { method: "POST", body: input })),
    update: (id: string, input: Partial<PrInput>) => unwrap(opsRequest<{ data: PrFull }>(`me/purchase-requests/${enc(id)}`, { method: "PATCH", body: input })),
    submit: (id: string, overrideReason?: string | null) =>
      unwrap(opsRequest<{ data: PrFull }>(`me/purchase-requests/${enc(id)}/submit`, { method: "POST", body: overrideReason ? { overrideReason } : {} })),
    cancel: (id: string, reason: string) => unwrap(opsRequest<{ data: PrSummary }>(`me/purchase-requests/${enc(id)}/cancel`, { method: "POST", body: { reason } })),
    /** Add an optional file (a specification, a sample design, an agenda) to your own request. Returns the request. */
    attach: (id: string, file: File, kind?: string | null) => {
      const form = new FormData();
      if (kind) form.set("kind", kind);
      form.set("file", file);
      return unwrap(opsUpload<{ data: PrFull }>(`me/purchase-requests/${enc(id)}/attachments`, form));
    },
    /** A file on your own request, streamed by the proxy. */
    fileHref: (attachmentId: string) => `/api/operations/me/attachments/${enc(attachmentId)}`,
    /** Take back a file you added while the request is a draft or with its approvers. */
    removeFile: (attachmentId: string) => opsRequest<Record<string, never>>(`me/attachments/${enc(attachmentId)}`, { method: "DELETE" }),
  },

  /** The sourcing desk. */
  requests: {
    list: async (status?: PrDeskFilter) => {
      const r = await opsRequest<List<PrSummary, PrDeskMeta>>("purchase-requests", { query: { status } });
      return { requests: r.data, meta: r.meta };
    },
    get: (id: string) => unwrap(opsRequest<{ data: PrFull }>(`purchase-requests/${enc(id)}`)),
    rfq: (id: string, input: RfqInput) => unwrap(opsRequest<{ data: { id: string; number: string } }>(`purchase-requests/${enc(id)}/rfqs`, { method: "POST", body: input })),
    quote: (id: string, input: QuotationInput) => unwrap(opsRequest<{ data: { id: string; total: number } }>(`purchase-requests/${enc(id)}/quotations`, { method: "POST", body: input })),
    award: (id: string, input: AwardInput) => unwrap(opsRequest<{ data: { id: string; status: string } }>(`purchase-requests/${enc(id)}/award`, { method: "POST", body: input })),
    cancel: (id: string, reason: string) => unwrap(opsRequest<{ data: PrSummary }>(`purchase-requests/${enc(id)}/cancel`, { method: "POST", body: { reason } })),
  },

  orders: {
    list: async (status?: PoFilter) => {
      const r = await opsRequest<List<PoSummary, PoMeta>>("purchase-orders", { query: { status } });
      return { orders: r.data, meta: r.meta };
    },
    get: (id: string) => unwrap(opsRequest<{ data: PoFull }>(`purchase-orders/${enc(id)}`)),
    update: (id: string, input: PoUpdateInput) => unwrap(opsRequest<{ data: PoFull }>(`purchase-orders/${enc(id)}`, { method: "PATCH", body: input })),
    submit: (id: string) => unwrap(opsRequest<{ data: PoFull }>(`purchase-orders/${enc(id)}/submit`, { method: "POST", body: {} })),
    send: (id: string) => unwrap(opsRequest<{ data: PoFull }>(`purchase-orders/${enc(id)}/send`, { method: "POST", body: {} })),
    accept: (id: string, note?: string | null) =>
      unwrap(opsRequest<{ data: PoFull }>(`purchase-orders/${enc(id)}/accept`, { method: "POST", body: note ? { note } : {} })),
    cancel: (id: string, reason: string) => unwrap(opsRequest<{ data: PoFull }>(`purchase-orders/${enc(id)}/cancel`, { method: "POST", body: { reason } })),
    shortClose: (id: string, reason: string) => unwrap(opsRequest<{ data: PoFull }>(`purchase-orders/${enc(id)}/short-close`, { method: "POST", body: { reason } })),
    /**
     * Change an approved order (approved, sent, accepted, partly received).
     * Not dearer: applied at once as the next revision. Dearer with approvals
     * on: held as `pendingRevision` until approved.
     */
    revise: (id: string, input: PoReviseInput) => unwrap(opsRequest<{ data: PoFull }>(`purchase-orders/${enc(id)}/revise`, { method: "POST", body: input })),
    /** The branded LPO / LSO, streamed by the proxy. */
    pdfUrl: (id: string) => `/api/operations/purchase-orders/${enc(id)}/pdf`,
  },

  receiving: {
    desk: () => unwrap(opsRequest<{ data: ReceivingDesk }>("receiving")),
    grn: (poId: string, input: GrnInput) => unwrap(opsRequest<{ data: Grn }>(`purchase-orders/${enc(poId)}/grns`, { method: "POST", body: input })),
    approveGrn: (id: string) => unwrap(opsRequest<{ data: Grn }>(`grns/${enc(id)}/approve`, { method: "POST", body: {} })),
    scc: (poId: string, input: SccInput) => unwrap(opsRequest<{ data: Scc }>(`purchase-orders/${enc(poId)}/sccs`, { method: "POST", body: input })),
    approveScc: (id: string) => unwrap(opsRequest<{ data: Scc }>(`sccs/${enc(id)}/approve`, { method: "POST", body: {} })),
    /** The goods received note as a PDF (streamed by the proxy). */
    grnPdfUrl: (id: string) => `/api/operations/grns/${enc(id)}/pdf`,
    /** The service completion certificate as a PDF. */
    sccPdfUrl: (id: string) => `/api/operations/sccs/${enc(id)}/pdf`,
    invoice: (poId: string, input: InvoiceInput) => unwrap(opsRequest<{ data: VendorInvoice }>(`purchase-orders/${enc(poId)}/invoices`, { method: "POST", body: input })),
    rejectInvoice: (id: string, resolution: string) =>
      unwrap(opsRequest<{ data: VendorInvoice }>(`vendor-invoices/${enc(id)}/reject`, { method: "POST", body: { resolution } })),
  },

  attachments: {
    upload: (ownerType: AttachmentOwner, ownerId: string, file: File, kind = "other") => {
      const form = new FormData();
      form.set("ownerType", ownerType);
      form.set("ownerId", ownerId);
      form.set("kind", kind);
      form.set("file", file);
      return unwrap(opsUpload<{ data: { id: string; name: string } }>("attachments", form));
    },
    href: (id: string) => `/api/operations/attachments/${enc(id)}`,
    remove: (id: string) => opsRequest<Record<string, never>>(`attachments/${enc(id)}`, { method: "DELETE" }),
  },
};

/* -------------------------------- errors ------------------------------ */

const CODE = /^[A-Z][A-Z0-9_]{3,}:\s*/;

/** An API refusal in plain words, any machine code taken off. */
export function opsError(e: unknown, fallback = "Something went wrong."): string {
  return (errorText(e) || fallback).replace(CODE, "");
}

/** `delivery_date` → `deliveryDate`; `lines.0.unit_price` → `lines.0.unitPrice`. */
export const camelKey = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/**
 * Field → first message, code stripped. The request validators key by the
 * JSON's camelCase names and the services sometimes by snake_case columns;
 * both come back camelCase so a form looks a field up one way.
 */
export function opsFieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || !e.errors) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.errors)) {
    const first = Array.isArray(v) ? v[0] : v;
    if (typeof first === "string") out[camelKey(k)] = first.replace(CODE, "");
  }
  return out;
}

/** Every raw message (codes kept), for reading a machine code. */
function rawMessages(e: unknown): string[] {
  if (!(e instanceof ApiError)) return [];
  const out = [e.message];
  for (const v of Object.values(e.errors ?? {})) {
    for (const m of Array.isArray(v) ? v : [v]) if (typeof m === "string") out.push(m);
  }
  return out;
}

export type FundsCode = "INSUFFICIENT_PROJECT_FUNDS" | "NO_FUNDS_RELEASED";

/** The project-funds refusal a submit can meet, if this is one. */
export function fundsCode(e: unknown): FundsCode | null {
  for (const m of rawMessages(e)) {
    if (m.startsWith("INSUFFICIENT_PROJECT_FUNDS")) return "INSUFFICIENT_PROJECT_FUNDS";
    if (m.startsWith("NO_FUNDS_RELEASED")) return "NO_FUNDS_RELEASED";
  }
  return null;
}

/** A separation-of-duties refusal in plain words, or null. */
export function dutiesRefusal(e: unknown): string | null {
  const hit = rawMessages(e).find((m) => m.startsWith("SOD_VIOLATION"));
  if (!hit) return null;
  const text = hit.replace(CODE, "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
