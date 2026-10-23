import type { CostReport, MaintenancePlan, WorkOrder, WorkOrderFull, WorkOrderMeta } from "@/lib/api/operations-maintenance-client";

/* Test data for the maintenance screens: a generator that won't start, under warranty, and the desk around it. */

export const OPTIONS = {
  staff: [
    { id: "u-tunde", name: "Tunde Bello" },
    { id: "u-ada", name: "Ada Obi" },
  ],
  vendors: [{ id: "v-power", name: "PowerGen Services" }],
};

export function workOrder(over: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: "w1",
    number: "WO-2026-0041",
    kind: "corrective",
    title: "Generator won't start",
    priority: "high",
    status: "open",
    assetId: "a-gen",
    asset: { tagNo: "MPT/GEN/0002", name: "Perkins 60kVA generator" },
    facilityId: null,
    facility: null,
    assignee: null,
    assigneeId: null,
    vendorId: null,
    vendor: null,
    dueAt: "2026-10-07T09:00:00+01:00",
    overdue: false,
    cost: 0,
    createdAt: "2026-10-06T09:00:00+01:00",
    completedAt: null,
    ...over,
  };
}

export function workOrderFull(over: Partial<WorkOrderFull> = {}): WorkOrderFull {
  return {
    ...workOrder(),
    fault: "Cranks but does not fire. Fuel tank half full.",
    diagnosis: null,
    resolution: null,
    labourHours: 0,
    labourCost: 0,
    vendorCost: 0,
    partsCost: 0,
    downtimeFrom: null,
    downtimeTo: null,
    warrantyClaim: null,
    warrantyNote: null,
    warrantyBlock: null,
    warrantyUntil: null,
    usageAt: null,
    parts: [],
    ticketId: null,
    prId: null,
    pr: null,
    requestedBy: "Kemi Desk",
    requestedById: "u-desk",
    startedAt: null,
    confirmedAt: null,
    confirmedBy: null,
    planId: null,
    ...over,
  };
}

export function meta(over: Partial<WorkOrderMeta> = {}): WorkOrderMeta {
  return {
    open: { critical: 1, high: 2, normal: 3, low: 0 },
    slaBreached: 2,
    overduePreventive: 1,
    costThisMonth: 45_000_000,
    slaCompliance: 87.5,
    byMonth: [
      { month: "2026-09", preventive: 12_000_000, corrective: 30_000_000 },
      { month: "2026-10", preventive: 0, corrective: 45_000_000 },
    ],
    priorities: { critical: "Critical", high: "High", normal: "Normal", low: "Low" },
    ...over,
  };
}

export function plan(over: Partial<MaintenancePlan> = {}): MaintenancePlan {
  return {
    id: "p1",
    name: "Generator 250-hour service",
    assetId: "a-gen",
    asset: "MPT/GEN/0002",
    categoryId: null,
    category: null,
    facilityId: null,
    facility: null,
    everyMonths: 3,
    everyUsage: 250,
    usageUnit: "hours",
    leadDays: 7,
    assigneeId: "u-tunde",
    assignee: "Tunde Bello",
    vendorId: null,
    contractId: null,
    checklist: "Change oil and filter",
    active: true,
    targets: [{ id: "t1", assetId: "a-gen", tagNo: "MPT/GEN/0002", name: "Perkins 60kVA generator", lastDoneOn: "2026-08-01", lastDoneUsage: 1000, nextDueOn: "2026-11-01" }],
    ...over,
  };
}

export function report(): CostReport {
  return {
    threshold: 50,
    assets: [
      { assetId: "a-gen", tagNo: "MPT/GEN/0002", name: "Perkins 60kVA generator", category: "Generators", cost: 800_000_000, workOrders: 4, lifetimeCost: 300_000_000, last12Cost: 240_000_000, downtimeHours: 30, pctOfCost: 30, replace: false },
      { assetId: "a-ac", tagNo: "MPT/AC/0007", name: "LG split unit", category: "Air conditioners", cost: 50_000_000, workOrders: 3, lifetimeCost: 40_000_000, last12Cost: 35_000_000, downtimeHours: 12, pctOfCost: 70, replace: true },
    ],
  };
}
