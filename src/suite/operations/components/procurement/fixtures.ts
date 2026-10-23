import type { Comparison, MeOptions, Overview, PoFull, PoLine, PoSummary, PrFull, PrSummary, ReceivableOrder, ReceivingDesk, VendorInvoice } from "@/lib/api/operations-procurement-client";

/* Test data shaped like the API's (`OpsPresenter`), from the Meridian demo. */

const SPR = { id: "p-spr", name: "Student Portal Rebuild", code: "SPR" };

export function prSummary(over: Partial<PrSummary> = {}): PrSummary {
  return {
    id: "pr-1",
    number: "MPT/PR/2026/0001",
    title: "Laptops for the portal developers",
    category: "goods_assets",
    categoryLabel: "Goods: assets",
    status: "approved",
    estimate: 3_800_000_00,
    currency: "NGN",
    neededBy: "2026-10-01",
    requester: "Chinonso Okeke",
    requesterId: "u-chinonso",
    project: SPR,
    costCentreId: null,
    eventId: null,
    createdAt: "2026-09-15T09:00:00+00:00",
    approvalId: "ap-pr-1",
    ...over,
  };
}

/** Three quotations on one line, Konga lowest; a second line Zenith alone quoted. */
export function comparison(over: Partial<Comparison> = {}): Comparison {
  return {
    vendors: [
      { quotationId: "q-konga", vendorId: "v-konga", vendor: "Konga Business", reference: "Q-W2RYW", subtotal: 3_660_000_00, vat: 274_500_00, total: 3_934_500_00, deliveryDays: 5, paymentTerms: "50% advance, balance on delivery", meetsSpec: true, validUntil: "2026-10-19", linesQuoted: 1, rfqId: "rfq-1", enteredBy: "Ifeoma Nwosu", attachments: [{ id: "att-q-konga", kind: "quotation", name: "Konga quote W2RYW.pdf", mime: "application/pdf", size: 182_400, uploadedBy: "Ifeoma Nwosu", uploadedAt: "2026-09-18T11:20:00+00:00" }] },
      { quotationId: "q-zenith", vendorId: "v-zenith", vendor: "Zenith Office Supplies Ltd", reference: "Q-MHND0", subtotal: 3_842_000_00, vat: 288_150_00, total: 4_130_150_00, deliveryDays: 10, paymentTerms: "On delivery", meetsSpec: true, validUntil: "2026-10-19", linesQuoted: 2, rfqId: "rfq-1", enteredBy: "Ifeoma Nwosu", attachments: [] },
      { quotationId: "q-swift", vendorId: "v-swift", vendor: "Swiftlink Networks Ltd", reference: "Q-TDMQD", subtotal: 3_960_000_00, vat: 297_000_00, total: 4_257_000_00, deliveryDays: 14, paymentTerms: "30 days", meetsSpec: false, validUntil: "2026-10-19", linesQuoted: 1, rfqId: "rfq-1", enteredBy: "Ifeoma Nwosu", attachments: [] },
    ],
    lines: [
      {
        prLineId: "l-1",
        lineNo: 1,
        description: "Laptop, 14-inch, 16GB RAM, 512GB SSD",
        kind: "goods",
        quantity: 4,
        unit: "each",
        estimate: 3_800_000_00,
        prices: [
          { quotationId: "q-konga", quotationLineId: "ql-1", vendorId: "v-konga", unitPrice: 915_000_00, quantity: 4, amount: 3_660_000_00, vat: 274_500_00 },
          { quotationId: "q-zenith", quotationLineId: "ql-2", vendorId: "v-zenith", unitPrice: 948_000_00, quantity: 4, amount: 3_792_000_00, vat: 284_400_00 },
          { quotationId: "q-swift", quotationLineId: "ql-3", vendorId: "v-swift", unitPrice: 990_000_00, quantity: 4, amount: 3_960_000_00, vat: 297_000_00 },
        ],
        lowest: 3_660_000_00,
      },
      {
        prLineId: "l-2",
        lineNo: 2,
        description: "Laptop bag",
        kind: "goods",
        quantity: 4,
        unit: "each",
        estimate: 60_000_00,
        prices: [null, { quotationId: "q-zenith", quotationLineId: "ql-4", vendorId: "v-zenith", unitPrice: 12_500_00, quantity: 4, amount: 50_000_00, vat: 3_750_00 }, null],
        lowest: 50_000_00,
      },
    ],
    estimate: 3_860_000_00,
    rule: { needed: 3, have: 3, met: true, singleSource: false, tender: false, message: "Quotation rule met." },
    ...over,
  };
}

export function prFull(over: Partial<PrFull> = {}): PrFull {
  return {
    ...prSummary(),
    justification: "Two contract developers join the portal team on 1 October.",
    location: "ICT Centre, Main Campus",
    costCategory: "hardware",
    singleSourceReason: null,
    funds: null,
    eventLineId: null,
    lines: [
      { id: "l-1", lineNo: 1, kind: "goods", description: "Laptop, 14-inch, 16GB RAM, 512GB SSD", specification: null, quantity: 4, unit: "each", estUnitPrice: 950_000_00, estimate: 3_800_000_00, suggestedVendorId: null },
      { id: "l-2", lineNo: 2, kind: "goods", description: "Laptop bag", specification: null, quantity: 4, unit: "each", estUnitPrice: 15_000_00, estimate: 60_000_00, suggestedVendorId: null },
    ],
    rfqs: [
      {
        id: "rfq-1",
        number: "MPT/RFQ/2026/0001",
        deadline: "2026-09-19",
        vendors: ["Zenith Office Supplies Ltd", "Konga Business", "Swiftlink Networks Ltd"],
        invited: [
          { vendorId: "v-zenith", vendor: "Zenith Office Supplies Ltd", replied: true, quotationId: "q-zenith", repliedAt: "2026-09-17 10:05:00" },
          { vendorId: "v-konga", vendor: "Konga Business", replied: true, quotationId: "q-konga", repliedAt: "2026-09-18 11:20:00" },
          { vendorId: "v-swift", vendor: "Swiftlink Networks Ltd", replied: true, quotationId: "q-swift", repliedAt: "2026-09-19 08:40:00" },
        ],
        replied: 3,
        awaiting: 0,
        status: "closed",
        message: "Please quote for four developer laptops, delivered to the ICT Centre.",
      },
    ],
    comparison: comparison(),
    awards: [],
    orders: [],
    attachments: [],
    ...over,
  };
}

export function poSummary(over: Partial<PoSummary> = {}): PoSummary {
  return {
    id: "po-1",
    number: "MPT/LPO/2026/0001",
    kind: "lpo",
    status: "invoiced",
    vendorId: "v-konga",
    vendor: "Konga Business",
    project: SPR,
    subtotal: 3_660_000_00,
    vat: 274_500_00,
    total: 3_934_500_00,
    currency: "NGN",
    deliveryDate: "2026-09-30",
    prId: "pr-1",
    prNumber: "MPT/PR/2026/0001",
    createdBy: "Halima Yusuf",
    createdById: "u-halima",
    approvalId: "ap-po-1",
    createdAt: "2026-09-21T10:00:00+00:00",
    approvedAt: "2026-09-21T15:00:00+00:00",
    sentAt: null,
    acceptedAt: null,
    ...over,
  };
}

export function matchedInvoice(over: Partial<VendorInvoice> = {}): VendorInvoice {
  return {
    id: "inv-1",
    poId: "po-1",
    invoiceNo: "KB-INV-90433",
    invoiceDate: "2026-09-30",
    subtotal: 3_660_000_00,
    vat: 274_500_00,
    total: 3_934_500_00,
    status: "matched",
    match: [{ ok: true, lineNo: 1, poLineId: "pol-1", problems: [], quantity: 4, available: 4, unitPrice: 915_000_00, orderPrice: 915_000_00, description: "Laptop, 14-inch, 16GB RAM, 512GB SSD" }],
    advanceDeducted: 1_180_350_00,
    memoId: "memo-2",
    memo: { reference: "MPT/MEMO/GEN/2026/0001", status: "awaiting_fcu", amount: 2_754_150_00, paid: 0, type: "system" },
    resolution: null,
    createdAt: "2026-10-01T10:00:00+00:00",
    vendor: "Konga Business",
    poNumber: "MPT/LPO/2026/0001",
    attachments: [],
    ...over,
  };
}

export function exceptionInvoice(over: Partial<VendorInvoice> = {}): VendorInvoice {
  return matchedInvoice({
    id: "inv-2",
    invoiceNo: "KB-INV-90501",
    status: "exception",
    memoId: null,
    memo: null,
    advanceDeducted: 0,
    match: [
      {
        ok: false,
        lineNo: 1,
        poLineId: "pol-1",
        problems: ["Invoiced 5 but only 4 accepted and not yet invoiced.", "Price 930,000.00 is not the order's 915,000.00."],
        quantity: 5,
        available: 4,
        unitPrice: 930_000_00,
        orderPrice: 915_000_00,
        description: "Laptop, 14-inch, 16GB RAM, 512GB SSD",
      },
    ],
    ...over,
  });
}

export const TRIGGERS = {
  on_po: "On the order (advance)",
  on_delivery: "On delivery",
  on_completion: "On completion",
  on_milestone: "On a milestone",
  net_days: "Days after the invoice",
} as const;

export function poFull(over: Partial<PoFull> = {}): PoFull {
  return {
    ...poSummary(),
    deliveryAddress: "ICT Centre, Main Campus, Ibadan",
    terms: "Goods to the specification quoted.",
    revision: 0,
    pendingRevision: null,
    sentAt: "2026-09-22T09:00:00+00:00",
    acceptedAt: "2026-09-22T09:00:00+00:00",
    acceptanceNote: "Accepted by email, 22 Sep",
    closingReason: null,
    lines: [{ id: "pol-1", lineNo: 1, kind: "goods", description: "Laptop, 14-inch, 16GB RAM, 512GB SSD", quantity: 4, unit: "each", unitPrice: 915_000_00, vatRateBp: 750, amount: 3_660_000_00, vat: 274_500_00, received: 4, outstanding: 0, invoiced: 4, toInvoice: 0 }],
    paymentTerms: [
      { id: "t-1", sequence: 1, label: "Advance (30%)", trigger: "on_po", pctBp: 3000, amount: 1_180_350_00, days: null, status: "memo_raised", memoId: "memo-1" },
      { id: "t-2", sequence: 2, label: "Balance on delivery", trigger: "on_delivery", pctBp: 7000, amount: 2_754_150_00, days: null, status: "pending", memoId: null },
    ],
    grns: [
      {
        id: "grn-1",
        number: "MPT/GRN/2026/0001",
        poId: "po-1",
        receivedOn: "2026-09-29",
        location: "ICT Centre store",
        deliveryNote: "KB-DN-55120",
        notes: null,
        status: "approved",
        receivedBy: "Tunde Alabi",
        receivedById: "u-tunde",
        approvedBy: "Kemi Adebanjo",
        approvedAt: "2026-09-29T13:00:00+00:00",
        lines: [{ poLineId: "pol-1", received: 4, accepted: 4, rejected: 0, serials: ["5CG4301ZK1", "5CG4301ZK7", "5CG4301ZM2", "5CG4301ZN9"], notes: null }],
        attachments: [],
      },
    ],
    sccs: [],
    invoices: [matchedInvoice()],
    payments: {
      advance: 1_180_350_00,
      advanceDeducted: 1_180_350_00,
      raised: 3_934_500_00,
      paid: 0,
      memos: [
        { kind: "advance", label: "Advance (30%)", memoId: "memo-1", reference: "MPT/MEMO/PEOP/2026/0001", status: "awaiting_fcu", amount: 1_180_350_00, paid: 0, type: "system" },
        { kind: "invoice", label: "Invoice KB-INV-90433", memoId: "memo-2", reference: "MPT/MEMO/GEN/2026/0001", status: "awaiting_fcu", amount: 2_754_150_00, paid: 0, type: "system" },
      ],
    },
    financeOn: true,
    attachments: [],
    triggers: TRIGGERS,
    ...over,
  };
}

/** A draft LSO with one service line, ready to be edited. */
export function draftLso(over: Partial<PoFull> = {}): PoFull {
  return poFull({
    id: "po-2",
    number: null,
    kind: "lso",
    status: "draft",
    vendorId: "v-power",
    vendor: "Mainstream Power Solutions",
    project: null,
    subtotal: 178_000_00,
    vat: 13_350_00,
    total: 191_350_00,
    deliveryDate: "2026-10-03",
    deliveryAddress: "Power house, Main Campus",
    terms: null,
    sentAt: null,
    acceptedAt: null,
    acceptanceNote: null,
    approvalId: null,
    lines: [{ id: "pol-9", lineNo: 1, kind: "service", description: "Full service: oil, filters, coolant, load test", quantity: 1, unit: "job", unitPrice: 178_000_00, vatRateBp: 750, amount: 178_000_00, vat: 13_350_00, received: 0 }],
    paymentTerms: [{ id: "t-9", sequence: 1, label: "On completion", trigger: "on_completion", pctBp: 10000, amount: 191_350_00, days: null, status: "pending", memoId: null }],
    grns: [],
    sccs: [],
    invoices: [],
    payments: { advance: 0, advanceDeducted: 0, raised: 0, paid: 0, memos: [] },
    ...over,
  });
}

/** An order's line as the receiving desk lists it. */
export function receivableLine(over: Partial<PoLine> = {}): PoLine {
  return { id: "pol-3", lineNo: 1, kind: "goods", description: "Laptop, 14-inch, 16GB RAM, 512GB SSD", quantity: 4, unit: "each", unitPrice: 915_000_00, vatRateBp: 750, amount: 3_660_000_00, vat: 274_500_00, received: 0, outstanding: 4, invoiced: 0, toInvoice: 0, ...over };
}

export function receivableOrder(over: Partial<ReceivableOrder> = {}): ReceivableOrder {
  return { ...poSummary({ id: "po-3", number: "MPT/LPO/2026/0003", status: "accepted", deliveryDate: "2026-10-10" }), lines: [receivableLine()], deliveryAddress: "ICT Centre, Main Campus", ...over };
}

export function receivingDesk(over: Partial<ReceivingDesk> = {}): ReceivingDesk {
  return {
    toReceive: [receivableOrder()],
    toInvoice: [],
    grns: [],
    sccs: [],
    exceptions: [],
    recentInvoices: [],
    ...over,
  };
}

export const ME_OPTIONS: MeOptions = {
  projects: [
    { id: "p-spr", name: "Student Portal Rebuild", code: "SPR", status: "active" },
    { id: "p-sbp", name: "Scholarship Board Portal", code: "SBP", status: "planning" },
  ],
  costCentres: [{ id: "cc-ict", code: "CC-ICT", name: "ICT infrastructure" }],
  vendors: [
    { id: "v-konga", name: "Konga Business" },
    { id: "v-zenith", name: "Zenith Office Supplies Ltd" },
    { id: "v-swift", name: "Swiftlink Networks Ltd" },
  ],
  prCategories: { goods_assets: "Goods: assets", services_printing: "Services: branding and printing" },
  financeOn: true,
};

export function overview(over: Partial<Overview> = {}): Overview {
  return {
    procurement: {
      requestsInApproval: 1,
      toSource: 2,
      awardsPending: 0,
      ordersDraft: 1,
      ordersOpen: 2,
      openValue: 4_125_850_00,
      overdueDeliveries: 1,
      invoiceExceptions: 0,
      grnsToApprove: 1,
      orderedByMonth: [
        { month: "2026-08", goods: 0, services: 0 },
        { month: "2026-09", goods: 3_934_500_00, services: 191_350_00 },
      ],
    },
    travel: {
      upcoming: [{ id: "t-1", number: "MPT/TRV/2026/0001", purpose: "Requirements sign-off with the Eastgate board", destination: "Abuja", departsOn: "2026-10-13", returnsOn: "2026-10-15", status: "booked", requester: "Efe Omoregie", travellers: 2, project: null }],
      inApproval: 1,
    },
    events: [],
    clientPayments: {
      totals: { open: 1, value: 8_062_500_00, overdueFollowUps: 0, queried: 0 },
      byStage: [],
      followUps: [],
    },
    financeOn: true,
    ...over,
  };
}
