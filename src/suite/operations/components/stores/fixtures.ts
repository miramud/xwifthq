import type { Requisition, StockCount, StockDesk, StockItem } from "@/lib/api/operations-stores-client";

/* Test data shaped like the API's (`StoreController`, `AssetPresenter`), from the Meridian demo. */

export function stockItem(over: Partial<StockItem> = {}): StockItem {
  return {
    id: "i-paper",
    code: "STA-001",
    name: "A4 paper, 80gsm",
    category: "stationery",
    unit: "ream",
    reorderLevel: 20,
    reorderQty: 50,
    critical: false,
    preferredVendorId: null,
    avgCost: 4_500_00,
    active: true,
    byStore: { "s-main": 12, "s-ict": 3 },
    onHand: 15,
    value: 67_500_00,
    onOrder: 0,
    belowReorder: true,
    ...over,
  };
}

export function stockDesk(over: Partial<StockDesk> = {}): StockDesk {
  return {
    stores: [
      { id: "s-main", name: "Main store", location: "Admin block", officerId: "u-ngozi", officer: "Ngozi Eze", active: true },
      { id: "s-ict", name: "ICT store", location: "ICT Centre", officerId: null, officer: null, active: true },
    ],
    items: [
      stockItem(),
      stockItem({ id: "i-toner", code: "TON-002", name: "HP 410A toner, black", category: "toner", unit: "cartridge", reorderLevel: 4, reorderQty: 6, critical: true, avgCost: 95_000_00, byStore: { "s-main": 2 }, onHand: 2, value: 190_000_00, onOrder: 0, belowReorder: true }),
      stockItem({ id: "i-tea", code: "REF-003", name: "Lipton tea, 100 bags", category: "refreshments", unit: "pack", reorderLevel: 5, reorderQty: 10, avgCost: 3_200_00, byStore: { "s-main": 30 }, onHand: 30, value: 96_000_00, onOrder: 0, belowReorder: false }),
    ],
    categories: { stationery: "Stationery", toner: "Toner and ink", refreshments: "Refreshments" },
    ...over,
  };
}

export function requisition(over: Partial<Requisition> = {}): Requisition {
  return {
    id: "rq-1",
    number: "MPT/IRQ/2026/0004",
    status: "approved",
    requester: "Chinonso Okeke",
    requesterId: "u-chinonso",
    storeId: "s-main",
    store: "Main store",
    purpose: "Exam week printing",
    project: null,
    costCentreId: "cc-acad",
    approvalId: "ap-1",
    lines: [
      { id: "rl-1", itemId: "i-paper", code: "STA-001", name: "A4 paper, 80gsm", unit: "ream", quantity: 10, issued: 0, inStore: 12 },
      { id: "rl-2", itemId: "i-toner", code: "TON-002", name: "HP 410A toner, black", unit: "cartridge", quantity: 3, issued: 0, inStore: 2 },
    ],
    createdAt: "2026-10-02T09:00:00+00:00",
    issues: [],
    shortfallPr: null,
    ...over,
  };
}

export function stockCount(over: Partial<StockCount> = {}): StockCount {
  return {
    id: "c-1",
    storeId: "s-main",
    store: "Main store",
    kind: "full",
    status: "counting",
    countedBy: "Ngozi Eze",
    countedById: "u-ngozi",
    approvedBy: null,
    approvedAt: null,
    note: null,
    lines: [
      { id: "cl-1", itemId: "i-paper", code: "STA-001", name: "A4 paper, 80gsm", unit: "ream", systemQty: 12, countedQty: null, variance: null, varianceValue: null },
      { id: "cl-2", itemId: "i-toner", code: "TON-002", name: "HP 410A toner, black", unit: "cartridge", systemQty: 2, countedQty: null, variance: null, varianceValue: null },
    ],
    createdAt: "2026-10-05T08:00:00+00:00",
    ...over,
  };
}
