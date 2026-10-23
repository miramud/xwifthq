/* ------------------------------------------------------------------ */
/*  XwiftHQ Admin & Operations › assets. The register, categories,    */
/*  onboarding kits, asset requests, gate passes, verification and    */
/*  exit clearances (desk), and "My assets" (self-service).           */
/*  Shapes follow `AssetPresenter`, `AssetController`,                */
/*  `AssetRequestController`, `AssetVerificationController`,          */
/*  `ExitClearanceController` and `MyEquipmentController` in api-lms. */
/*  Money is integer kobo; dates `YYYY-MM-DD`, instants ISO 8601.      */
/* ------------------------------------------------------------------ */

import { ApiError, errorText, opsRequest, unwrap } from "./operations-request";
import { opsError, opsFieldErrors } from "./operations-travel-client";

export { ApiError, errorText, opsError, opsFieldErrors };

const enc = encodeURIComponent;

/* ------------------------------- shared ----------------------------- */

export type AssetStatus = "received" | "in_store" | "allocated" | "in_transit" | "under_maintenance" | "lost" | "stolen" | "disposal_pending" | "disposed";
export type AssetCondition = "new" | "good" | "fair" | "poor" | "faulty" | "beyond_repair";
export type AssetClass = "ict" | "office_equipment" | "furniture" | "vehicles" | "buildings";

export interface ProjectRef {
  id: string;
  name: string;
  code: string | null;
}

/** A row of the register (`AssetPresenter::asset`, not full). */
export interface AssetSummary {
  id: string;
  /** Null until the asset is tagged. */
  tagNo: string | null;
  name: string;
  categoryId: string;
  category: string | null;
  categoryCode: string | null;
  make: string | null;
  model: string | null;
  serialNo: string | null;
  status: AssetStatus;
  statusLabel: string;
  condition: AssetCondition;
  location: string | null;
  custodianId: string | null;
  custodian: string | null;
  project: ProjectRef | null;
  cost: number;
  acquiredOn: string | null;
  warrantyUntil: string | null;
}

/**
 * Finance's side of an asset, read-only here. The API sends this one
 * object in snake_case (`FinanceBridge::assetBook`); `normaliseBook` reads
 * either spelling so the screens use one.
 */
export interface AssetBook {
  cost: number;
  accumulated: number;
  nbv: number;
  /** Annual depreciation in basis points: 2500 is 25%. */
  rateBp: number | null;
  status: string | null;
  capitalisedOn: string | null;
  class: string | null;
  gainLoss: number | null;
}

/** One line of an asset's history (`AssetPresenter::movement`). */
export interface AssetMovement {
  id: string;
  assetId: string;
  kind: "tag" | "allocate" | "transfer" | "return" | "status" | "dispose" | "take_out" | "check_in" | string;
  handoverNo: string | null;
  from: string | null;
  to: string | null;
  toUserId: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  project: ProjectRef | null;
  statusFrom: string | null;
  statusTo: string | null;
  condition: string | null;
  accessories: string | null;
  note: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  by: string | null;
  at: string | null;
  /** On self-service handovers. */
  asset: { id: string; tagNo: string | null; name: string; category: string | null } | null;
}

/** A work order on an asset's card, newest first (`AssetPresenter` full). */
export interface AssetWorkOrder {
  id: string;
  number: string | null;
  kind: "preventive" | "corrective" | string;
  title: string;
  status: string;
  /** As stored; `YYYY-MM-DD HH:MM:SS` or ISO. */
  createdAt: string | null;
  /** Labour, vendor and parts, kobo. */
  cost: number;
  prId: string | null;
}

/** An asset's card (`AssetPresenter::asset(..., true)`). */
export interface AssetFull extends AssetSummary {
  specification: Record<string, unknown> | null;
  warrantyProvider: string | null;
  insurancePolicy: string | null;
  insuranceUntil: string | null;
  notes: string | null;
  supplierId: string | null;
  supplier: string | null;
  po: { id: string; number: string | null } | null;
  grn: { id: string; number: string | null } | null;
  book: AssetBook | null;
  history: AssetMovement[];
  pendingHandover: AssetMovement | null;
  /** Its maintenance history (absent from older APIs). */
  workOrders?: AssetWorkOrder[];
}

export interface RegisterMeta {
  byStatus: Partial<Record<AssetStatus, number>>;
  /** Keyed by category id. */
  byCategory: Record<string, { count: number; cost: number }>;
  total: number;
  cost: number;
  warrantyEnding: number;
  faulty: number;
  awaitingTag: number;
  pendingHandovers: number;
  statuses: Record<AssetStatus, string>;
  conditions: Record<AssetCondition, string>;
}

export interface AssetFilters {
  status?: string;
  categoryId?: string;
  custodianId?: string;
  projectId?: string;
  q?: string;
}

export interface AssetInput {
  categoryId?: string;
  name?: string;
  make?: string | null;
  model?: string | null;
  serialNo?: string | null;
  condition?: AssetCondition;
  location?: string | null;
  projectId?: string | null;
  supplierId?: string | null;
  /** Only on create: the API keeps cost and acquisition date as they were put on the register. */
  cost?: number;
  acquiredOn?: string | null;
  warrantyUntil?: string | null;
  warrantyProvider?: string | null;
  insurancePolicy?: string | null;
  insuranceUntil?: string | null;
  notes?: string | null;
}

export interface MoveInput {
  toUserId?: string | null;
  projectId?: string | null;
  location?: string | null;
  condition?: AssetCondition | null;
  accessories?: string | null;
  note?: string | null;
}

export type StatusChange = "under_maintenance" | "lost" | "stolen" | "back";

export interface AssetCategory {
  id: string;
  code: string;
  name: string;
  kind: "capital" | "controlled";
  assetClass: AssetClass | null;
  active: boolean;
  /** On the desk's list only. */
  assets?: number;
}

export interface CategoryInput {
  code?: string;
  name?: string;
  kind?: "capital" | "controlled";
  assetClass?: AssetClass | null;
  active?: boolean;
}

export interface KitItem {
  categoryId: string;
  quantity: number;
}

export interface AssetKit {
  id: string;
  name: string;
  jobTitleIds: string[];
  items: KitItem[];
}

export interface KitInput {
  name: string;
  jobTitleIds: string[];
  items: KitItem[];
}

/* ------------------------------ requests ----------------------------- */

export type AssetRequestKind = "allocation" | "onboarding" | "replacement" | "return" | "transfer" | "take_out" | "disposal";
export type AssetRequestStatus = "draft" | "in_approval" | "approved" | "fulfilled" | "rejected" | "cancelled" | "converted";
export type DisposalMethod = "sale" | "scrap" | "donation" | "write_off";

export interface GatePass {
  id: string;
  number: string | null;
  holder: string | null;
  purpose: string | null;
  destination: string | null;
  outAt: string | null;
  dueBackOn: string | null;
  returnedAt: string | null;
  overdue: boolean;
  assets: { id: string; tagNo: string | null; name: string }[];
  /** The printable pass only: the pass number as a QR image (data URI). */
  qr?: string;
  /** On my own request's detail: where it stands, and its PDF. */
  status?: "issued" | "out" | "overdue" | "returned";
  pdfPath?: string;
}

export interface AssetRequest {
  id: string;
  number: string | null;
  kind: AssetRequestKind;
  kindLabel: string;
  status: AssetRequestStatus;
  requester: string | null;
  requesterId: string;
  forUser: string | null;
  forUserId: string | null;
  categoryId: string | null;
  category: string | null;
  asset: { id: string; tagNo: string | null; name: string; status: AssetStatus } | null;
  /** Onboarding: what the kit lists. */
  kit: KitItem[] | null;
  reason: string | null;
  neededBy: string | null;
  returnBy: string | null;
  project: ProjectRef | null;
  toLocation: string | null;
  toUser: string | null;
  disposalMethod: DisposalMethod | null;
  proceeds: number | null;
  approvalId: string | null;
  prId: string | null;
  gatePass: GatePass | null;
  createdAt: string | null;
}

/** A handover on my request's detail, with its note as a PDF (`pdfPath` is under `/operations`). */
export interface MyHandover extends AssetMovement {
  pdfPath: string;
}

/** One of my requests in full (`GET me/asset-requests/{id}`). */
export interface MyAssetRequestDetail extends AssetRequest {
  handovers: MyHandover[];
}

/** A request on the desk, with the in-store assets that could meet it and Finance's book of the asset it names. */
export interface AssetRequestFull extends AssetRequest {
  pool: AssetSummary[];
  book: AssetBook | null;
}

export interface AssetRequestInput {
  kind: Exclude<AssetRequestKind, "onboarding">;
  assetId?: string | null;
  categoryId?: string | null;
  forUserId?: string | null;
  reason?: string | null;
  neededBy?: string | null;
  returnBy?: string | null;
  projectId?: string | null;
  toLocation?: string | null;
  toUserId?: string | null;
  disposalMethod?: DisposalMethod | null;
  proceeds?: number | null;
}

export interface FulfilInput {
  assetIds?: string[];
  condition?: AssetCondition | null;
  /** Replacement: the condition of the one coming back. */
  conditionOld?: AssetCondition | null;
  /** Replacement: where the old one goes. */
  oldTo?: "store" | "maintenance";
  accessories?: string | null;
  note?: string | null;
  /** Disposal: the date it left. */
  on?: string;
}

/* ---------------------------- verification ---------------------------- */

export type VerificationResult = "pending" | "verified" | "mismatch" | "missing";

export interface VerificationSummary {
  total: number;
  verified: number;
  mismatch: number;
  missing: number;
  pending: number;
  conditionChanged: number;
  /** Seen (verified or found elsewhere) as a share of everything, 0-100. */
  percent: number;
}

export interface VerificationCampaign {
  id: string;
  name: string;
  startsOn: string | null;
  endsOn: string | null;
  status: "open" | "closed";
  closedAt: string | null;
  summary: VerificationSummary;
}

export interface VerificationItem {
  id: string;
  result: VerificationResult;
  asset: AssetSummary | null;
  expectedCustodian: string | null;
  expectedLocation: string | null;
  foundCustodian: string | null;
  foundLocation: string | null;
  condition: AssetCondition | null;
  note: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

export interface VerificationDetail extends VerificationCampaign {
  /** Missing first, then found elsewhere, then not yet seen, then verified. */
  items: VerificationItem[];
}

export interface RecordFoundInput {
  found: boolean;
  /** Leave out to keep the custodian the register expects; null for nobody. */
  foundCustodianId?: string | null;
  foundLocation?: string | null;
  condition?: AssetCondition | null;
  note?: string | null;
}

/* --------------------------- exit clearance --------------------------- */

export type SignoffArea = "admin" | "it" | "finance" | "hod";

export interface ExitSignoff {
  key: SignoffArea;
  label: string;
  by?: string;
  name?: string;
  at?: string;
}

export type ExitItemStatus = "outstanding" | "returned" | "deduct" | "write_off";

export interface ExitClearanceItem {
  id: string;
  assetId: string | null;
  description: string;
  status: ExitItemStatus;
  value: number | null;
  note: string | null;
  decidedBy: string | null;
}

export interface ExitClearance {
  id: string;
  userId: string;
  leaver: string | null;
  leavingOn: string | null;
  status: "open" | "cleared";
  signoffs: ExitSignoff[];
  outstanding: number;
  clearedAt: string | null;
  items: ExitClearanceItem[];
  createdAt: string | null;
}

export interface ExitDecision {
  status: Exclude<ExitItemStatus, "outstanding">;
  value?: number | null;
  note?: string | null;
  condition?: AssetCondition | null;
}

/* ---------------------------- self-service ---------------------------- */

export interface MyAsset extends AssetSummary {
  /** The open verification is waiting for me to confirm this one. */
  toVerify: boolean;
}

export interface MyAssets {
  assets: MyAsset[];
  /** Handover notes waiting for my signature. */
  handovers: AssetMovement[];
  verification: { id: string; name: string; endsOn: string | null; pending: number } | null;
  categories: AssetCategory[];
  conditions: Record<AssetCondition, string>;
}

export type MyRequestKind = "allocation" | "replacement" | "return" | "transfer" | "take_out";

export interface MyAssetRequestInput {
  kind: MyRequestKind;
  assetId?: string | null;
  categoryId?: string | null;
  reason?: string | null;
  neededBy?: string | null;
  returnBy?: string | null;
  projectId?: string | null;
  toLocation?: string | null;
  toUserId?: string | null;
  /** Sends it for approval unless false. */
  submit?: boolean;
}

/** What the pickers need from `GET /me/options`. */
export interface AssetPickerOptions {
  staff: { id: string; name: string }[];
  projects: { id: string; name: string; code: string | null }[];
}

/* ------------------------------ helpers ------------------------------ */

const num = (v: unknown): number | null => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** Finance's book of an asset in one spelling, whichever the API sent. */
export function normaliseBook(raw: unknown): AssetBook | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  return {
    cost: num(b.cost) ?? 0,
    accumulated: num(b.accumulated) ?? 0,
    nbv: num(b.nbv) ?? 0,
    rateBp: num(b.rateBp ?? b.rate_bp),
    status: str(b.status),
    capitalisedOn: str(b.capitalisedOn ?? b.capitalised_on),
    class: str(b.class),
    gainLoss: num(b.gainLoss ?? b.gain_loss),
  };
}

const withBook = <T extends { book?: unknown }>(row: T): T & { book: AssetBook | null } => ({ ...row, book: normaliseBook(row.book) });

/* ------------------------------- client ------------------------------ */

export const assets = {
  /* The register. */
  list: (filters: AssetFilters = {}) =>
    opsRequest<{ data: AssetSummary[]; meta: RegisterMeta }>("assets", { query: { ...filters } }).then((r) => ({ assets: r.data, meta: r.meta })),
  get: (id: string) => unwrap(opsRequest<{ data: AssetFull }>(`assets/${enc(id)}`)).then(withBook),
  create: (input: AssetInput) => unwrap(opsRequest<{ data: AssetFull }>("assets", { method: "POST", body: input })).then(withBook),
  update: (id: string, input: AssetInput) => unwrap(opsRequest<{ data: AssetFull }>(`assets/${enc(id)}`, { method: "PATCH", body: input })).then(withBook),
  tag: (id: string, location?: string | null) =>
    unwrap(opsRequest<{ data: AssetFull }>(`assets/${enc(id)}/tag`, { method: "POST", body: location ? { location } : {} })).then(withBook),
  allocate: (id: string, input: MoveInput & { toUserId: string }) =>
    unwrap(opsRequest<{ data: AssetFull }>(`assets/${enc(id)}/allocate`, { method: "POST", body: input })).then(withBook),
  transfer: (id: string, input: MoveInput) => unwrap(opsRequest<{ data: AssetFull }>(`assets/${enc(id)}/transfer`, { method: "POST", body: input })).then(withBook),
  returnToStore: (id: string, input: { condition?: AssetCondition | null; note?: string | null; location?: string | null } = {}) =>
    unwrap(opsRequest<{ data: AssetFull }>(`assets/${enc(id)}/return`, { method: "POST", body: input })).then(withBook),
  /** A handover note (allocation or transfer) as a PDF. */
  movementPdfUrl: (movementId: string) => `/api/operations/assets/movements/${enc(movementId)}/pdf`,
  setStatus: (id: string, status: StatusChange, note?: string | null) =>
    unwrap(opsRequest<{ data: AssetFull }>(`assets/${enc(id)}/status`, { method: "POST", body: note ? { status, note } : { status } })).then(withBook),

  /* Categories and onboarding kits. */
  categories: () => unwrap(opsRequest<{ data: AssetCategory[] }>("assets/categories")),
  createCategory: (input: CategoryInput) => unwrap(opsRequest<{ data: AssetCategory }>("assets/categories", { method: "POST", body: input })),
  updateCategory: (id: string, input: CategoryInput) => unwrap(opsRequest<{ data: AssetCategory }>(`assets/categories/${enc(id)}`, { method: "PATCH", body: input })),
  kits: () => unwrap(opsRequest<{ data: AssetKit[] }>("assets/kits")),
  createKit: (input: KitInput) => unwrap(opsRequest<{ data: AssetKit }>("assets/kits", { method: "POST", body: input })),
  updateKit: (id: string, input: KitInput) => unwrap(opsRequest<{ data: AssetKit }>(`assets/kits/${enc(id)}`, { method: "PATCH", body: input })),
  deleteKit: (id: string) => opsRequest<unknown>(`assets/kits/${enc(id)}`, { method: "DELETE" }).then(() => undefined),

  /* Staff and projects for the pickers. */
  options: () => unwrap(opsRequest<{ data: AssetPickerOptions }>("me/options")),
};

export const assetRequests = {
  list: (filters: { status?: string; kind?: string } = {}) =>
    opsRequest<{ data: AssetRequest[]; meta: { kinds: Record<string, string>; toFulfil: number } }>("asset-requests", { query: { ...filters } }).then((r) => ({
      requests: r.data,
      meta: r.meta,
    })),
  get: (id: string) => unwrap(opsRequest<{ data: AssetRequestFull }>(`asset-requests/${enc(id)}`)).then(withBook),
  create: (input: AssetRequestInput) => unwrap(opsRequest<{ data: AssetRequest }>("asset-requests", { method: "POST", body: input })),
  submit: (id: string) => unwrap(opsRequest<{ data: AssetRequest }>(`asset-requests/${enc(id)}/submit`, { method: "POST", body: {} })),
  fulfil: (id: string, input: FulfilInput) => unwrap(opsRequest<{ data: AssetRequest }>(`asset-requests/${enc(id)}/fulfil`, { method: "POST", body: input })),
  /** Nothing suitable in store: a purchase request instead. */
  convert: (id: string) =>
    unwrap(opsRequest<{ data: AssetRequest & { purchaseRequest: { id: string; number: string | null } } }>(`asset-requests/${enc(id)}/convert`, { method: "POST", body: {} })),
  cancel: (id: string) => unwrap(opsRequest<{ data: AssetRequest }>(`asset-requests/${enc(id)}/cancel`, { method: "POST", body: {} })),
};

export const gatePasses = {
  list: (open = false) => unwrap(opsRequest<{ data: GatePass[] }>("gate-passes", { query: open ? { open: 1 } : undefined })),
  get: (id: string) => unwrap(opsRequest<{ data: GatePass & { qr: string } }>(`gate-passes/${enc(id)}`)),
  /** The pass as a verifiable PDF, for security at the gate. */
  pdfUrl: (id: string) => `/api/operations/gate-passes/${enc(id)}/pdf`,
  checkIn: (id: string, condition?: AssetCondition | null) =>
    unwrap(opsRequest<{ data: GatePass }>(`gate-passes/${enc(id)}/check-in`, { method: "POST", body: condition ? { condition } : {} })),
};

export const verifications = {
  list: () => unwrap(opsRequest<{ data: VerificationCampaign[] }>("verifications")),
  get: (id: string, result?: VerificationResult) => unwrap(opsRequest<{ data: VerificationDetail }>(`verifications/${enc(id)}`, { query: { result } })),
  open: (input: { name: string; startsOn: string; endsOn: string }) => unwrap(opsRequest<{ data: VerificationCampaign }>("verifications", { method: "POST", body: input })),
  record: (id: string, itemId: string, input: RecordFoundInput) =>
    unwrap(opsRequest<{ data: { id: string; result: VerificationResult } }>(`verifications/${enc(id)}/items/${enc(itemId)}`, { method: "POST", body: input })),
  /** Anything not yet seen becomes missing. */
  close: (id: string) => unwrap(opsRequest<{ data: VerificationCampaign }>(`verifications/${enc(id)}/close`, { method: "POST", body: {} })),
};

export const exitClearances = {
  list: (status?: "open" | "cleared") => unwrap(opsRequest<{ data: ExitClearance[] }>("exit-clearances", { query: { status } })),
  get: (id: string) => unwrap(opsRequest<{ data: ExitClearance }>(`exit-clearances/${enc(id)}`)),
  open: (input: { userId: string; leavingOn?: string | null }) => unwrap(opsRequest<{ data: ExitClearance }>("exit-clearances", { method: "POST", body: input })),
  decide: (id: string, itemId: string, input: ExitDecision) =>
    unwrap(opsRequest<{ data: ExitClearance }>(`exit-clearances/${enc(id)}/items/${enc(itemId)}`, { method: "POST", body: input })),
  sign: (id: string, area: SignoffArea) => unwrap(opsRequest<{ data: ExitClearance }>(`exit-clearances/${enc(id)}/sign`, { method: "POST", body: { area } })),
};

export const myAssets = {
  get: () => unwrap(opsRequest<{ data: MyAssets }>("me/assets")),
  acknowledge: (movementId: string) => unwrap(opsRequest<{ data: AssetSummary }>(`me/handovers/${enc(movementId)}/acknowledge`, { method: "POST", body: {} })),
  /** Confirm an asset I hold during a verification, by its tag or id. */
  verify: (asset: string, condition?: AssetCondition | null) =>
    unwrap(opsRequest<{ data: { assetId: string; result: VerificationResult } }>("me/assets/verify", { method: "POST", body: condition ? { asset, condition } : { asset } })),
  requests: () =>
    opsRequest<{ data: AssetRequest[]; meta: { kinds: Record<string, string> } }>("me/asset-requests").then((r) => ({ requests: r.data, kinds: r.meta?.kinds ?? {} })),
  request: (input: MyAssetRequestInput) => unwrap(opsRequest<{ data: AssetRequest }>("me/asset-requests", { method: "POST", body: input })),
  cancel: (id: string) => unwrap(opsRequest<{ data: AssetRequest }>(`me/asset-requests/${enc(id)}/cancel`, { method: "POST", body: {} })),
  /** One of my requests in full: approval, gate pass, handovers. */
  show: (id: string) => unwrap(opsRequest<{ data: MyAssetRequestDetail }>(`me/asset-requests/${enc(id)}`)),
  handoverPdfUrl: (movementId: string) => `/api/operations/me/handovers/${enc(movementId)}/pdf`,
  gatePassPdfUrl: (passId: string) => `/api/operations/me/gate-passes/${enc(passId)}/pdf`,
};
