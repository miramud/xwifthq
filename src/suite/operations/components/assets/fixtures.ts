import type {
  AssetFull,
  AssetMovement,
  AssetRequestFull,
  AssetSummary,
  ExitClearance,
  MyAssets,
  RegisterMeta,
  VerificationDetail,
} from "@/lib/api/operations-assets-client";

/* Test data for the asset screens: one laptop through its life, and the desks around it. */

export const OPTIONS = {
  staff: [
    { id: "u-ada", name: "Ada Obi" },
    { id: "u-efe", name: "Efe Musa" },
  ],
  projects: [{ id: "p1", name: "Kano rollout", code: "KAN" }],
};

export function assetSummary(over: Partial<AssetSummary> = {}): AssetSummary {
  return {
    id: "a1",
    tagNo: "MPT/LAP/0001",
    name: "Dell Latitude 5440",
    categoryId: "c-lap",
    category: "Laptops",
    categoryCode: "LAP",
    make: "Dell",
    model: "Latitude 5440",
    serialNo: "SN123",
    status: "in_store",
    statusLabel: "In store",
    condition: "new",
    location: "Abuja store",
    custodianId: null,
    custodian: null,
    project: null,
    cost: 95_000_000,
    acquiredOn: "2026-09-01",
    warrantyUntil: "2027-09-01",
    ...over,
  };
}

export function movement(over: Partial<AssetMovement> = {}): AssetMovement {
  return {
    id: "m1",
    assetId: "a1",
    kind: "allocate",
    handoverNo: "MPT/HO/2026/0007",
    from: null,
    to: "Ada Obi",
    toUserId: "u-ada",
    fromLocation: "Abuja store",
    toLocation: "Abuja store",
    project: null,
    statusFrom: "in_store",
    statusTo: "in_transit",
    condition: "new",
    accessories: "Charger, bag",
    note: null,
    acknowledgedBy: null,
    acknowledgedAt: null,
    by: "Kemi Desk",
    at: "2026-10-05T09:00:00+01:00",
    asset: null,
    ...over,
  };
}

export function assetFull(over: Partial<AssetFull> = {}): AssetFull {
  return {
    ...assetSummary(),
    specification: null,
    warrantyProvider: "Dell Nigeria",
    insurancePolicy: null,
    insuranceUntil: null,
    notes: null,
    supplierId: null,
    supplier: null,
    po: null,
    grn: null,
    book: { cost: 95_000_000, accumulated: 23_750_000, nbv: 71_250_000, rateBp: 2500, status: "active", capitalisedOn: "2026-01-01", class: "ICT equipment", gainLoss: null },
    history: [movement({ id: "m0", kind: "tag", handoverNo: null, to: null, toUserId: null, acknowledgedAt: "2026-09-01T10:00:00+01:00", acknowledgedBy: "Kemi Desk" })],
    pendingHandover: null,
    ...over,
  };
}

export function registerMeta(over: Partial<RegisterMeta> = {}): RegisterMeta {
  return {
    byStatus: { in_store: 2, allocated: 3, received: 1, lost: 1 },
    byCategory: { "c-lap": { count: 5, cost: 475_000_000 }, "c-phn": { count: 2, cost: 60_000_000 } },
    total: 7,
    cost: 535_000_000,
    warrantyEnding: 2,
    faulty: 1,
    awaitingTag: 1,
    pendingHandovers: 1,
    statuses: {
      received: "Received, not tagged",
      in_store: "In store",
      allocated: "Allocated",
      in_transit: "In transit",
      under_maintenance: "Under maintenance",
      lost: "Lost",
      stolen: "Stolen",
      disposal_pending: "Disposal pending",
      disposed: "Disposed",
    },
    conditions: { new: "New", good: "Good", fair: "Fair", poor: "Poor", faulty: "Faulty", beyond_repair: "Beyond repair" },
    ...over,
  };
}

export function assetRequest(over: Partial<AssetRequestFull> = {}): AssetRequestFull {
  return {
    id: "r1",
    number: "MPT/AR/2026/0003",
    kind: "allocation",
    kindLabel: "New allocation",
    status: "approved",
    requester: "Ada Obi",
    requesterId: "u-ada",
    forUser: "Ada Obi",
    forUserId: "u-ada",
    categoryId: "c-lap",
    category: "Laptops",
    asset: null,
    kit: null,
    reason: "New starter on the Kano rollout",
    neededBy: "2026-10-10",
    returnBy: null,
    project: null,
    toLocation: null,
    toUser: null,
    disposalMethod: null,
    proceeds: null,
    approvalId: "ap1",
    prId: null,
    gatePass: null,
    createdAt: "2026-10-01T09:00:00+01:00",
    pool: [assetSummary(), assetSummary({ id: "a2", tagNo: "MPT/LAP/0002", condition: "good" })],
    book: null,
    ...over,
  };
}

export function verification(over: Partial<VerificationDetail> = {}): VerificationDetail {
  return {
    id: "v1",
    name: "Q4 verification",
    startsOn: "2026-10-01",
    endsOn: "2026-10-20",
    status: "open",
    closedAt: null,
    summary: { total: 4, verified: 1, mismatch: 1, missing: 0, pending: 2, conditionChanged: 0, percent: 50 },
    items: [
      {
        id: "i1",
        result: "mismatch",
        asset: assetSummary({ id: "a3", tagNo: "MPT/LAP/0003", custodianId: "u-efe", custodian: "Efe Musa" }),
        expectedCustodian: "Efe Musa",
        expectedLocation: "Lagos office",
        foundCustodian: "Ada Obi",
        foundLocation: "Abuja office",
        condition: null,
        note: null,
        verifiedBy: "Kemi Desk",
        verifiedAt: "2026-10-03T10:00:00+01:00",
      },
      {
        id: "i2",
        result: "pending",
        asset: assetSummary({ id: "a4", tagNo: "MPT/LAP/0004", custodianId: "u-ada", custodian: "Ada Obi" }),
        expectedCustodian: "Ada Obi",
        expectedLocation: "Abuja office",
        foundCustodian: null,
        foundLocation: null,
        condition: null,
        note: null,
        verifiedBy: null,
        verifiedAt: null,
      },
    ],
    ...over,
  };
}

export function clearance(over: Partial<ExitClearance> = {}): ExitClearance {
  return {
    id: "x1",
    userId: "u-efe",
    leaver: "Efe Musa",
    leavingOn: "2026-10-31",
    status: "open",
    signoffs: [
      { key: "admin", label: "Admin" },
      { key: "it", label: "IT", by: "u-it", name: "Ife IT", at: "2026-10-04T10:00:00+01:00" },
      { key: "finance", label: "Finance" },
      { key: "hod", label: "Head of unit" },
    ],
    outstanding: 1,
    clearedAt: null,
    items: [{ id: "xi1", assetId: "a5", description: "MPT/PHN/0002 iPhone 13", status: "outstanding", value: 60_000_000, note: null, decidedBy: null }],
    createdAt: "2026-10-02T10:00:00+01:00",
    ...over,
  };
}

export function mine(over: Partial<MyAssets> = {}): MyAssets {
  return {
    assets: [{ ...assetSummary({ status: "allocated", custodianId: "u-ada", custodian: "Ada Obi" }), toVerify: true }],
    handovers: [movement({ id: "m9", asset: { id: "a2", tagNo: "MPT/LAP/0002", name: "HP EliteBook", category: "Laptops" } })],
    verification: { id: "v1", name: "Q4 verification", endsOn: "2026-10-20", pending: 1 },
    categories: [{ id: "c-lap", code: "LAP", name: "Laptops", kind: "capital", assetClass: "ict", active: true }],
    conditions: { new: "New", good: "Good", fair: "Fair", poor: "Poor", faulty: "Faulty", beyond_repair: "Beyond repair" },
    ...over,
  };
}
