/* ------------------------------------------------------------------ */
/*  Elevate Admin & Operations › maintenance. Work orders through      */
/*  their life, preventive plans and usage readings, insurance claims  */
/*  and the cost report. Shapes follow `MaintenanceController` and     */
/*  `Services/Maintenance/Maintenance.php` in api-lms. Money is        */
/*  integer kobo; dates `YYYY-MM-DD`, instants ISO 8601.               */
/* ------------------------------------------------------------------ */

import { ApiError, errorText, opsRequest, unwrap } from "./operations-request";
import { opsError, opsFieldErrors } from "./operations-travel-client";

export { ApiError, errorText, opsError, opsFieldErrors };

const enc = encodeURIComponent;

/* ------------------------------- enums ------------------------------ */

export type WorkOrderStatus = "open" | "assigned" | "in_progress" | "awaiting_parts" | "completed" | "confirmed" | "cancelled";
export type WorkOrderKind = "preventive" | "corrective";
export type WorkOrderPriority = "critical" | "high" | "normal" | "low";
export type WarrantyOutcome = "not_applicable" | "submitted" | "accepted" | "rejected";
export type UsageUnit = "hours" | "km";
export type ClaimKind = "damage" | "theft" | "accident" | "other";
export type ClaimStatus = "open" | "submitted" | "settled" | "rejected" | "withdrawn";

/** Still being worked (`WorkOrder::OPEN`). */
export const OPEN_STATUSES: WorkOrderStatus[] = ["open", "assigned", "in_progress", "awaiting_parts"];

/** Hours to resolve by priority (`WorkOrder::SLA_HOURS`), unless a ticket set the SLA. */
export const SLA_HOURS: Record<WorkOrderPriority, number> = { critical: 4, high: 24, normal: 72, low: 168 };

/* ---------------------------- work orders ---------------------------- */

/** A row of the board (`MaintenanceController::row`, not full). */
export interface WorkOrder {
  id: string;
  number: string | null;
  kind: WorkOrderKind;
  title: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assetId: string | null;
  asset: { tagNo: string | null; name: string | null } | null;
  facilityId: string | null;
  facility: string | null;
  assignee: string | null;
  assigneeId: string | null;
  vendorId: string | null;
  vendor: string | null;
  /** The SLA: when it should be done by. */
  dueAt: string | null;
  /** Open and past `dueAt`. */
  overdue: boolean;
  /** Labour, vendor and parts, kobo. */
  cost: number;
  createdAt: string | null;
  completedAt: string | null;
}

export interface WorkOrderPart {
  id: string;
  description: string;
  quantity: number;
  unitCost: number;
  source: "store" | "purchase";
  cost: number;
}

/** A work order's page (`row(..., true)`). */
export interface WorkOrderFull extends WorkOrder {
  fault: string | null;
  diagnosis: string | null;
  resolution: string | null;
  labourHours: number;
  labourCost: number;
  vendorCost: number;
  partsCost: number;
  downtimeFrom: string | null;
  downtimeTo: string | null;
  warrantyClaim: WarrantyOutcome | null;
  warrantyNote: string | null;
  /** Why a paid repair is refused for now; null when it may be paid for. */
  warrantyBlock: string | null;
  warrantyUntil: string | null;
  usageAt: number | null;
  parts: WorkOrderPart[];
  ticketId: string | null;
  prId: string | null;
  pr: string | null;
  requestedBy: string | null;
  requestedById: string | null;
  startedAt: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  planId: string | null;
}

export interface MaintenanceSummary {
  /** Open work orders by priority. */
  open: Record<WorkOrderPriority, number>;
  slaBreached: number;
  overduePreventive: number;
  /** Cost of work completed this month, kobo. */
  costThisMonth: number;
  /** Percent of the past year's completed work done inside its SLA; null when none. */
  slaCompliance: number | null;
  /** Six months, oldest first, by when the work was completed. */
  byMonth: { month: string; preventive: number; corrective: number }[];
}

export interface WorkOrderMeta extends MaintenanceSummary {
  priorities: Record<WorkOrderPriority, string>;
}

export interface WorkOrderFilters {
  /** `open` means every open status. */
  status?: string;
  kind?: string;
  assetId?: string;
}

export interface WorkOrderInput {
  assetId?: string | null;
  facilityId?: string | null;
  title: string;
  fault?: string | null;
  priority?: WorkOrderPriority;
  assigneeId?: string | null;
  vendorId?: string | null;
}

export interface WorkOrderPatch {
  diagnosis?: string | null;
  priority?: WorkOrderPriority;
  labourHours?: number | null;
  labourCost?: number | null;
  /** Refused while the warranty blocks a paid repair. */
  vendorCost?: number | null;
}

export interface PartInput {
  source: "store" | "purchase";
  itemId?: string | null;
  storeId?: string | null;
  description?: string | null;
  quantity: number;
  unitCost?: number;
}

/* ------------------------------- plans ------------------------------- */

export interface PlanTarget {
  id: string;
  assetId: string | null;
  tagNo: string | null;
  name: string | null;
  lastDoneOn: string | null;
  lastDoneUsage: number | null;
  nextDueOn: string | null;
}

export interface MaintenancePlan {
  id: string;
  name: string;
  assetId: string | null;
  asset: string | null;
  categoryId: string | null;
  category: string | null;
  facilityId: string | null;
  facility: string | null;
  everyMonths: number | null;
  everyUsage: number | null;
  usageUnit: UsageUnit | null;
  leadDays: number;
  assigneeId: string | null;
  assignee: string | null;
  vendorId: string | null;
  contractId: string | null;
  checklist: string | null;
  active: boolean;
  targets: PlanTarget[];
}

export interface PlanInput {
  name?: string;
  assetId?: string | null;
  categoryId?: string | null;
  facilityId?: string | null;
  everyMonths?: number | null;
  everyUsage?: number | null;
  usageUnit?: UsageUnit | null;
  leadDays?: number;
  assigneeId?: string | null;
  vendorId?: string | null;
  contractId?: string | null;
  checklist?: string | null;
  active?: boolean;
  lastDoneOn?: string | null;
}

export interface UsageReading {
  reading: number;
  unit: UsageUnit;
  readOn: string;
  by: string | null;
}

/* ------------------------------- claims ------------------------------ */

export interface InsuranceClaim {
  id: string;
  kind: ClaimKind;
  incidentOn: string | null;
  incidentReport: string;
  insurer: string | null;
  policyNo: string | null;
  claimNo: string | null;
  amountClaimed: number;
  amountSettled: number | null;
  status: ClaimStatus;
  assetId: string | null;
  /** The asset's tag. */
  asset: string | null;
  workOrderId: string | null;
  reportedBy: string | null;
}

export interface ClaimInput {
  assetId?: string | null;
  workOrderId?: string | null;
  kind?: ClaimKind;
  incidentOn?: string;
  incidentReport?: string;
  insurer?: string | null;
  policyNo?: string | null;
  claimNo?: string | null;
  amountClaimed?: number;
  amountSettled?: number | null;
  status?: ClaimStatus;
}

/* ------------------------------- reports ----------------------------- */

export interface AssetCostRow {
  assetId: string;
  tagNo: string | null;
  name: string | null;
  category: string | null;
  /** What it cost to buy, kobo. */
  cost: number | null;
  workOrders: number;
  lifetimeCost: number;
  last12Cost: number;
  downtimeHours: number;
  /** The past year's maintenance as a percent of the purchase cost. */
  pctOfCost: number | null;
  /** Past the threshold: think about replacing it. */
  replace: boolean;
}

export interface CostReport {
  assets: AssetCostRow[];
  threshold: number;
}

/* ----------------------------- pickers ------------------------------ */

/** A site, for "which facility needs the work" (`GET /facilities`, the slice used here). */
export interface FacilityRef {
  id: string;
  name: string;
}

/** What the maintenance forms pick from (`GET me/options`). */
export interface MaintenanceOptions {
  staff: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
}

/* ------------------------------- client ------------------------------ */

export const maintenance = {
  list: (filters: WorkOrderFilters = {}) =>
    opsRequest<{ data: WorkOrder[]; meta: WorkOrderMeta }>("maintenance", { query: { ...filters } }).then((r) => ({ workOrders: r.data, meta: r.meta })),
  get: (id: string) => unwrap(opsRequest<{ data: WorkOrderFull }>(`maintenance/${enc(id)}`)),
  /** A fault becomes a corrective work order. */
  create: (input: WorkOrderInput) => unwrap(opsRequest<{ data: WorkOrderFull }>("maintenance", { method: "POST", body: input })),
  update: (id: string, patch: WorkOrderPatch) => unwrap(opsRequest<{ data: WorkOrderFull }>(`maintenance/${enc(id)}`, { method: "PATCH", body: patch })),
  assign: (id: string, input: { assigneeId?: string | null; vendorId?: string | null }) =>
    unwrap(opsRequest<{ data: WorkOrderFull }>(`maintenance/${enc(id)}/assign`, { method: "POST", body: input })),
  start: (id: string) => unwrap(opsRequest<{ data: WorkOrderFull }>(`maintenance/${enc(id)}/start`, { method: "POST", body: {} })),
  warranty: (id: string, outcome: WarrantyOutcome, note?: string | null) =>
    unwrap(opsRequest<{ data: WorkOrderFull }>(`maintenance/${enc(id)}/warranty`, { method: "POST", body: note ? { outcome, note } : { outcome } })),
  addPart: (id: string, input: PartInput) => unwrap(opsRequest<{ data: WorkOrderFull }>(`maintenance/${enc(id)}/parts`, { method: "POST", body: input })),
  /** Parts to buy and the vendor's service, as a draft purchase request. */
  purchase: (id: string, serviceEstimate?: number | null) =>
    unwrap(
      opsRequest<{ data: WorkOrderFull & { purchaseRequest: { id: string; number: string | null } } }>(`maintenance/${enc(id)}/purchase`, {
        method: "POST",
        body: serviceEstimate ? { serviceEstimate } : {},
      }),
    ),
  complete: (id: string, resolution: string, usageAt?: number | null) =>
    unwrap(
      opsRequest<{ data: WorkOrderFull }>(`maintenance/${enc(id)}/complete`, {
        method: "POST",
        body: usageAt != null ? { resolution, usageAt } : { resolution },
      }),
    ),
  confirm: (id: string) => unwrap(opsRequest<{ data: WorkOrderFull }>(`maintenance/${enc(id)}/confirm`, { method: "POST", body: {} })),
  cancel: (id: string, reason: string) => unwrap(opsRequest<{ data: WorkOrderFull }>(`maintenance/${enc(id)}/cancel`, { method: "POST", body: { reason } })),

  plans: () => unwrap(opsRequest<{ data: MaintenancePlan[] }>("maintenance/plans")),
  createPlan: (input: PlanInput) => unwrap(opsRequest<{ data: { id: string } }>("maintenance/plans", { method: "POST", body: input })),
  updatePlan: (id: string, input: PlanInput) => unwrap(opsRequest<{ data: { id: string } }>(`maintenance/plans/${enc(id)}`, { method: "PATCH", body: input })),

  readings: (assetId: string) => unwrap(opsRequest<{ data: UsageReading[] }>(`assets/${enc(assetId)}/readings`)),
  /** A running-hours or odometer reading; a plan that reaches its threshold raises its work order. */
  addReading: (assetId: string, input: { reading: number; unit: UsageUnit; readOn?: string | null }) =>
    unwrap(
      opsRequest<{ data: { id: string; reading: number } }>(`assets/${enc(assetId)}/readings`, {
        method: "POST",
        body: input.readOn ? input : { reading: input.reading, unit: input.unit },
      }),
    ),

  claims: () => unwrap(opsRequest<{ data: InsuranceClaim[] }>("maintenance/claims")),
  createClaim: (input: ClaimInput) => unwrap(opsRequest<{ data: InsuranceClaim }>("maintenance/claims", { method: "POST", body: input })),
  updateClaim: (id: string, input: ClaimInput) => unwrap(opsRequest<{ data: InsuranceClaim }>(`maintenance/claims/${enc(id)}`, { method: "PATCH", body: input })),

  /** Cost per asset over the past year; `threshold` is the percent of purchase cost that flags a replacement. */
  reports: (threshold?: number) => unwrap(opsRequest<{ data: CostReport }>("maintenance/reports", { query: { threshold } })),

  /** Sites, for a facility work order or plan. */
  facilities: () => unwrap(opsRequest<{ data: FacilityRef[] }>("facilities")).then((rows) => rows.map((f) => ({ id: f.id, name: f.name }))),
  options: () => unwrap(opsRequest<{ data: MaintenanceOptions }>("me/options")),
  /** Assets and sites for the forms, readable with the maintenance feature alone. */
  pickers: () =>
    unwrap(
      opsRequest<{ data: { assets: { id: string; tagNo: string | null; name: string; category: string | null; status: string }[]; facilities: FacilityRef[] } }>("maintenance/pickers"),
    ),
};
