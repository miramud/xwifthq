/* ------------------------------------------------------------------ */
/*  Admin & Operations › Stores: consumables. The item master and the  */
/*  stores, stock on hand with its ledger, receipts and transfers,     */
/*  reorder suggestions, consumption, issuing requisitions (SIVs) and  */
/*  stock counts; and the staff side: the catalogue, my requisitions   */
/*  and acknowledging what was issued.                                 */
/*                                                                    */
/*  Shapes follow `StoreController`, `MyEquipmentController` and      */
/*  `AssetPresenter` in api-lms. Money is integer kobo; quantities are */
/*  decimals (two places). Laravel decides who may do what.            */
/* ------------------------------------------------------------------ */

import { opsRequest, unwrap } from "./operations-request";
import type { PrSummary } from "./operations-procurement-client";

export { ApiError, errorText } from "./operations-request";

const enc = encodeURIComponent;

/* ------------------------------- master ------------------------------- */

export interface StoreRow {
  id: string;
  name: string;
  location: string | null;
  officerId: string | null;
  officer: string | null;
  active: boolean;
  /** Count variance (kobo) above which Finance is told; null = the default. */
  varianceAlertValue?: number | null;
  varianceAlertDefault?: number;
}

export interface StockItem {
  id: string;
  code: string;
  name: string;
  /** A key of `categories`. */
  category: string;
  unit: string;
  reorderLevel: number;
  reorderQty: number;
  critical: boolean;
  preferredVendorId: string | null;
  /** Weighted-average cost, kobo. */
  avgCost: number;
  active: boolean;
  /** Store id → on hand there. Stores that never held it are missing. */
  byStore: Record<string, number>;
  onHand: number;
  /** On hand at average cost, kobo. */
  value: number;
  /** Ordered on live purchase orders, not yet received (only known for items below reorder). */
  onOrder: number;
  belowReorder: boolean;
}

export interface StockDesk {
  stores: StoreRow[];
  items: StockItem[];
  /** Key → label (`Item::CATEGORIES`). */
  categories: Record<string, string>;
}

export interface ItemInput {
  code?: string;
  name?: string;
  category?: string;
  unit?: string;
  reorderLevel?: number;
  reorderQty?: number;
  critical?: boolean;
  preferredVendorId?: string | null;
  active?: boolean;
}

export interface StoreInput {
  name?: string;
  location?: string | null;
  officerId?: string | null;
  active?: boolean;
  varianceAlertValue?: number | null;
}

/* ------------------------------- ledger ------------------------------- */

export type MovementKind = "receipt" | "issue" | "transfer_in" | "transfer_out" | "adjustment";

export interface ProjectRef {
  id: string;
  name: string;
  code: string | null;
}

export interface StockMovement {
  id: string;
  kind: MovementKind | string;
  item: string | null;
  code: string | null;
  unit: string | null;
  store: string | null;
  /** Signed: in is positive, out negative. */
  quantity: number;
  balanceAfter: number;
  unitCost: number;
  /** `grn`, `siv`, `transfer`, `count`, `manual`. */
  refType: string | null;
  refId: string | null;
  project: ProjectRef | null;
  by: string | null;
  at: string | null;
}

export interface ReceiveInput {
  storeId: string;
  itemId: string;
  quantity: number;
  /** Kobo; moves the item's average cost. Left out: received at the current average. */
  unitCost?: number;
}

export interface TransferInput {
  fromStoreId: string;
  toStoreId: string;
  itemId: string;
  quantity: number;
}

export interface ReorderSuggestion {
  itemId: string;
  code: string;
  name: string;
  unit: string;
  onHand: number;
  onOrder: number;
  reorderLevel: number;
  /** The reorder quantity, or enough to reach the level if that is more. */
  suggested: number;
  critical: boolean;
  avgCost: number;
  vendorId: string | null;
}

export interface ConsumptionItem {
  itemId: string;
  name: string;
  unit: string;
  quantity: number;
  value: number;
}

export interface Consumption {
  /** Most valuable first. */
  byItem: ConsumptionItem[];
  /** Oldest first; months with no issues are missing. */
  byMonth: { month: string; value: number }[];
  /** Drawn at more than twice their monthly average of the six months before. */
  flagged: (ConsumptionItem & { average: number })[];
  from: string;
  to: string;
}

/* ---------------------------- requisitions ---------------------------- */

export type RequisitionStatus = "draft" | "in_approval" | "approved" | "partly_issued" | "issued" | "rejected" | "cancelled";

export interface RequisitionLine {
  id: string;
  itemId: string;
  code: string | null;
  name: string | null;
  unit: string | null;
  quantity: number;
  issued: number;
  /** On the desk's detail only: what the store holds now. */
  inStore?: number;
}

export interface IssueLine {
  itemId: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
}

/** A store issue voucher (SIV). */
export interface StoreIssue {
  id: string;
  number: string | null;
  lines: IssueLine[];
  issuedBy: string | null;
  issuedAt: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}

export interface Requisition {
  id: string;
  number: string | null;
  status: RequisitionStatus | string;
  requester: string | null;
  requesterId: string;
  storeId: string;
  store: string | null;
  purpose: string | null;
  project: ProjectRef | null;
  costCentreId: string | null;
  approvalId: string | null;
  lines: RequisitionLine[];
  createdAt: string | null;
  /** On a single requisition and on "mine". */
  issues?: StoreIssue[];
  /** The purchase request drafted for what the store couldn't issue (its number is null while it is a draft). */
  shortfallPr?: { id: string; number: string | null; status: string } | null;
}

/** After issuing: the requisition as it now stands, and the voucher just raised. */
export type IssueResult = Requisition & { issued: StoreIssue };

export interface RequisitionInput {
  storeId: string;
  purpose?: string | null;
  projectId?: string | null;
  costCentreId?: string | null;
  lines: { itemId: string; quantity: number }[];
  /** Defaults to true: sent for approval at once. */
  submit?: boolean;
}

/* ------------------------------- counts ------------------------------- */

export type CountStatus = "counting" | "submitted" | "approved" | "rejected";

export interface CountLine {
  id: string;
  itemId: string;
  code: string | null;
  name: string | null;
  unit: string | null;
  systemQty: number;
  countedQty: number | null;
  variance: number | null;
  /** Variance at average cost, kobo. */
  varianceValue: number | null;
}

export interface StockCount {
  id: string;
  storeId: string;
  store: string | null;
  kind: "full" | "cycle" | string;
  status: CountStatus | string;
  countedBy: string | null;
  countedById: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  note: string | null;
  lines: CountLine[];
  createdAt: string | null;
}

export interface CountInput {
  storeId: string;
  kind?: "full" | "cycle";
  /** A cycle count of chosen items; otherwise every item the store has held. */
  itemIds?: string[];
}

/* ------------------------------- staff -------------------------------- */

export interface Catalogue {
  stores: { id: string; name: string; location: string | null }[];
  items: { id: string; code: string; name: string; category: string; unit: string }[];
  categories: Record<string, string>;
}

/** An asset category as the staff side lists it (`AssetPresenter::category`). */
export interface AssetCategoryOption {
  id: string;
  code: string;
  name: string;
  kind: string | null;
  assetClass: string | null;
  active: boolean;
}

/* -------------------------------- client ------------------------------ */

export const stores = {
  desk: () => unwrap(opsRequest<{ data: StockDesk }>("stores")),
  createStore: (input: StoreInput) => unwrap(opsRequest<{ data: { id: string } }>("stores", { method: "POST", body: input })),
  updateStore: (id: string, patch: StoreInput) => unwrap(opsRequest<{ data: { id: string } }>(`stores/${enc(id)}`, { method: "PATCH", body: patch })),
  createItem: (input: ItemInput) => unwrap(opsRequest<{ data: { id: string } }>("stores/items", { method: "POST", body: input })),
  updateItem: (id: string, patch: ItemInput) => unwrap(opsRequest<{ data: { id: string } }>(`stores/items/${enc(id)}`, { method: "PATCH", body: patch })),
  /** The stock ledger, newest first (300 at most). */
  movements: (f: { itemId?: string | null; storeId?: string | null } = {}) =>
    unwrap(opsRequest<{ data: StockMovement[] }>("stores/movements", { query: { itemId: f.itemId ?? undefined, storeId: f.storeId ?? undefined } })),
  /** Opening balances, or stock that arrived without an order. */
  receive: (input: ReceiveInput) => unwrap(opsRequest<{ data: { id: string; balanceAfter: number } }>("stores/receipts", { method: "POST", body: input })),
  transfer: (input: TransferInput) => unwrap(opsRequest<{ data: { ok: boolean } }>("stores/transfers", { method: "POST", body: input })),
  reorder: () => unwrap(opsRequest<{ data: ReorderSuggestion[] }>("stores/reorder")),
  /** Drafts a purchase request for the chosen items; returns it. */
  draftReorder: (lines: { itemId: string; quantity: number }[], costCentreId?: string | null) =>
    unwrap(opsRequest<{ data: PrSummary }>("stores/reorder", { method: "POST", body: costCentreId ? { lines, costCentreId } : { lines } })),
  consumption: (f: { from?: string | null; to?: string | null } = {}) =>
    unwrap(opsRequest<{ data: Consumption }>("stores/consumption", { query: { from: f.from ?? undefined, to: f.to ?? undefined } })),

  requisitions: {
    /** Without a status: everything but drafts. */
    list: (status?: string | null) => unwrap(opsRequest<{ data: Requisition[] }>("requisitions", { query: { status: status ?? undefined } })),
    get: (id: string) => unwrap(opsRequest<{ data: Requisition }>(`requisitions/${enc(id)}`)),
    /** The store issue voucher as a PDF (streamed by the proxy). */
    issuePdfUrl: (issueId: string) => `/api/operations/issues/${enc(issueId)}/pdf`,
    /** `lines` maps requisition line id → quantity to issue now. */
    issue: (id: string, lines: Record<string, number>) => unwrap(opsRequest<{ data: IssueResult }>(`requisitions/${enc(id)}/issue`, { method: "POST", body: { lines } })),
    /** What the store could not issue becomes a draft purchase request. */
    shortfall: (id: string) => unwrap(opsRequest<{ data: PrSummary }>(`requisitions/${enc(id)}/shortfall`, { method: "POST", body: {} })),
    /** Approved or partly issued only: an approved one is cancelled, a partly issued one closes as issued. */
    close: (id: string, reason: string) => unwrap(opsRequest<{ data: Requisition }>(`requisitions/${enc(id)}/close`, { method: "POST", body: { reason } })),
  },

  counts: {
    list: () => unwrap(opsRequest<{ data: StockCount[] }>("stock-counts")),
    get: (id: string) => unwrap(opsRequest<{ data: StockCount }>(`stock-counts/${enc(id)}`)),
    start: (input: CountInput) => unwrap(opsRequest<{ data: StockCount }>("stock-counts", { method: "POST", body: input })),
    /** `lines` maps count line id → counted quantity (null clears it). */
    record: (id: string, lines: Record<string, number | null>, submit = false) =>
      unwrap(opsRequest<{ data: StockCount }>(`stock-counts/${enc(id)}/lines`, { method: "POST", body: submit ? { lines, submit: true } : { lines } })),
    /** Somebody other than the counter approves (stock is adjusted) or rejects. */
    decide: (id: string, approve: boolean, note?: string | null) =>
      unwrap(opsRequest<{ data: StockCount }>(`stock-counts/${enc(id)}/approve`, { method: "POST", body: note ? { approve, note } : { approve } })),
  },

  /** The caller's own side (`operations/me/*`). */
  me: {
    catalogue: () => unwrap(opsRequest<{ data: Catalogue }>("me/stores")),
    requisitions: () => unwrap(opsRequest<{ data: Requisition[] }>("me/requisitions")),
    /** One of mine, with its issue vouchers. */
    requisition: (id: string) => unwrap(opsRequest<{ data: Requisition }>(`me/requisitions/${enc(id)}`)),
    /** A voucher on my own requisition as a PDF. */
    issuePdfUrl: (issueId: string) => `/api/operations/me/issues/${enc(issueId)}/pdf`,
    createRequisition: (input: RequisitionInput) => unwrap(opsRequest<{ data: Requisition }>("me/requisitions", { method: "POST", body: input })),
    /** Draft, in approval or approved: cancelled. Partly issued: closed as issued (nothing more comes). */
    cancelRequisition: (id: string, reason?: string | null) =>
      unwrap(opsRequest<{ data: Requisition }>(`me/requisitions/${enc(id)}/cancel`, { method: "POST", body: reason ? { reason } : {} })),
    /** "I received these." */
    acknowledge: (issueId: string) => unwrap(opsRequest<{ data: StoreIssue }>(`me/issues/${enc(issueId)}/acknowledge`, { method: "POST", body: {} })),
    /** Active asset categories, from the staff equipment payload (the desk's list may be closed to staff). */
    assetCategories: () => unwrap(opsRequest<{ data: { categories?: AssetCategoryOption[] } }>("me/assets")).then((d) => d.categories ?? []),
  },
};
