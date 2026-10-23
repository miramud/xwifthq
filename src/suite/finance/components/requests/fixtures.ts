import type { MemoFull, MemoSummary, SpendOptions, VoucherFull } from "@/lib/api/finance-spend-client";

/* Test data shaped like the API's (`SpendPresenter`), from the Meridian demo. */

export function memoSummary(over: Partial<MemoSummary> = {}): MemoSummary {
  return {
    id: "m1",
    reference: "PM-2026-0007",
    title: "Swiftlink: September fibre lease",
    type: "payment",
    amount: 1_150_053_75,
    currency: "NGN",
    approvedAmount: 1_150_053_75,
    paidAmount: 0,
    balance: 1_150_053_75,
    status: "awaiting_fcu",
    approvalStatus: "approved",
    projectId: "p1",
    project: "Campus network upgrade",
    costCentreId: null,
    costCentre: null,
    costCategory: "hardware",
    payee: { kind: "vendor", id: "c1", name: "Swiftlink Networks" },
    requester: "Tunde Bello",
    requesterId: "u-tunde",
    neededBy: "2026-09-10",
    submittedAt: "2026-09-01T09:00:00+01:00",
    createdAt: "2026-09-01T08:00:00+01:00",
    approvalId: "ap-1",
    overridden: false,
    ...over,
  };
}

export function memoFull(over: Partial<MemoFull> = {}): MemoFull {
  return {
    ...memoSummary(),
    body: "Monthly fibre lease for the main campus.",
    fundsSnapshot: {
      at: "2026-09-01T09:00:00+01:00",
      released: 5_000_000_00,
      committed: 1_000_000_00,
      actual: 500_000_00,
      available: 3_500_000_00,
      request: 1_150_053_75,
      afterRequest: 2_349_946_25,
      overridden: false,
    },
    overrideReason: null,
    checklist: [
      { code: "invoice", label: "Vendor invoice or bill", hint: "The invoice the payment settles.", required: true, attached: 1 },
      { code: "contract", label: "Contract or LPO", hint: "Where one exists.", required: false, attached: 0 },
    ],
    documents: [
      { id: "d1", itemCode: "invoice", fileName: "swiftlink-sep.pdf", mime: "application/pdf", size: 120_000, sha256: "abc", uploadedBy: "Tunde Bello", uploadedAt: "2026-09-01T08:30:00+01:00" },
    ],
    queries: [],
    reviews: [],
    vouchers: [],
    retirement: null,
    history: [{ from: "in_approval", to: "awaiting_fcu", by: "Ada Eze", comment: null, at: "2026-09-02T10:00:00+01:00" }],
    clearedAt: null,
    ...over,
  };
}

export const OPTIONS: SpendOptions = {
  types: { payment: "Payment", advance: "Advance or imprest" },
  categories: { hardware: "Hardware", travel: "Travel" },
  checklists: {
    payment: [
      { code: "invoice", label: "Vendor invoice or bill", hint: "The invoice the payment settles.", required: true, requiredFrom: null },
      { code: "three_quotes", label: "Three competing quotations", hint: "Required from ₦1,000,000.", required: true, requiredFrom: 100_000_000 },
    ],
    advance: [{ code: "breakdown", label: "Purpose and budget breakdown", hint: null, required: true, requiredFrom: null }],
    retirement: [{ code: "receipts", label: "Receipts", hint: null, required: true, requiredFrom: null }],
  },
  projects: [{ id: "p1", name: "Campus network upgrade", code: "CNU" }],
  accounts: [{ id: "acc-travel", code: "6200", name: "Travel and accommodation", requiresProject: false, requiresCostCentre: false }],
  bankAccounts: [{ id: "bank-1", name: "Main operating account", bankName: "UBA" }],
};

export function voucherFull(over: Partial<VoucherFull> = {}): VoucherFull {
  return {
    id: "pv1",
    pvNo: "PV-2026-0003",
    date: "2026-09-04",
    kind: "memo",
    payee: "Swiftlink Networks",
    payeeKind: "vendor",
    payeeBank: { bankName: "Zenith Bank", accountName: "Swiftlink Networks Ltd", last4: "4421", source: "counterparty" },
    currency: "NGN",
    gross: 1_150_053_75,
    vat: 0,
    wht: 0,
    net: 1_150_000_00,
    status: "payment_initiated",
    payingBankAccountId: "b1",
    payingBankAccount: "Main operating account",
    narration: "September fibre lease",
    preparedBy: "Amaka Obi",
    preparedById: "u-amaka",
    scheduleId: "s1",
    cibReference: "CIB-778812",
    provisional: false,
    approvalId: "ap-9",
    accrualJournalId: "j1",
    paymentJournalId: null,
    confirmedAt: null,
    memos: [{ id: "m1", reference: "PM-2026-0007", title: "Swiftlink: September fibre lease", amount: 1_150_000_00 }],
    lines: [],
    documents: [],
    queries: [],
    reviews: [],
    history: [],
    failures: [],
    confirmationEvidence: null,
    statementLineId: null,
    amountPaid: null,
    initiatedAt: "2026-09-05T11:00:00+01:00",
    ...over,
  };
}
