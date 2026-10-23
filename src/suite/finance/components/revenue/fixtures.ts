import type {
  AgedReceivables,
  ClientStatement,
  ClientSummary,
  ContractDetail,
  ContractSummary,
  ContractsMeta,
  InvoiceDetail,
  InvoiceSummary,
  InvoicesMeta,
  ReceiptCandidate,
  ClientAdvances,
  ReceiptDetail,
  WhtRegister,
} from "@/lib/api/finance-revenue-client";

/* The Meridian demo's revenue, as the API returned it on 6 Oct 2026, trimmed to what the tests need. */

export const CONTRACTS_META: ContractsMeta = {
  billingTypes: { milestone: "Milestones", sla: "Service (SLA)", t_and_m: "Time and materials", fixed: "Fixed price" },
  progressMethods: { milestone_weighted: "Milestones, weighted", work_completion: "Work completed in Projects", pm_reported: "Reported by the project manager" },
  organisation: "org-1",
};

export const contract = (over: Partial<ContractSummary> = {}): ContractSummary => ({
  id: "ct-sbp",
  title: "Scholarship application and award portal",
  reference: "ESSB/ICT/2026/014",
  project: { id: "proj-sbp", name: "Scholarship Board Portal", code: "SBP", status: "planning" },
  client: "Eastgate State Scholarship Board",
  clientId: "cp-essb",
  value: 95_000_000_00,
  currency: "NGN",
  billingType: "milestone",
  status: "active",
  retentionBp: 0,
  expectedWhtBp: 0,
  vatApplicable: false,
  vatRateBp: 750,
  revenueAccountId: "acc-4400",
  paymentTermsDays: 14,
  invoiced: 12_500_000_00,
  settled: 12_500_000_00,
  billedTotal: 12_500_000_00,
  milestones: { total: 3, completed: 0, invoiced: 1 },
  readyToBill: [],
  ...over,
});

export const contractDetail = (over: Partial<ContractDetail> = {}): ContractDetail => ({
  id: "ct-sbp",
  title: "Scholarship application and award portal",
  reference: "ESSB/ICT/2026/014",
  client: "Eastgate State Scholarship Board",
  clientId: "cp-essb",
  value: 95_000_000_00,
  currency: "NGN",
  billingType: "milestone",
  progressMethod: "milestone_weighted",
  vatApplicable: false,
  vatRateBp: 750,
  expectedWhtBp: 0,
  retentionBp: 0,
  paymentTermsDays: 14,
  revenueAccountId: "acc-4400",
  startsOn: "2026-08-20",
  endsOn: "2027-01-04",
  milestones: [
    { id: "ms-1", sequence: 1, name: "Mobilisation", amount: 12_500_000_00, dueOn: "2026-08-24", weightBp: null, workItemId: null, status: "invoiced", completedAt: "2026-08-24T00:00:00+00:00" },
    { id: "ms-2", sequence: 2, name: "Applications open to students", amount: 47_500_000_00, dueOn: "2026-11-23", weightBp: null, workItemId: "wi-open", status: "planned", completedAt: null },
    { id: "ms-3", sequence: 3, name: "First award cycle and handover", amount: 35_000_000_00, dueOn: "2027-01-04", weightBp: null, workItemId: null, status: "planned", completedAt: null },
  ],
  ...over,
});

export const invoice = (over: Partial<InvoiceSummary> = {}): InvoiceSummary => ({
  id: "inv-3",
  invoiceNo: "INV/2026/0003",
  status: "issued",
  client: "Meridian Library Services Board",
  clientId: "cp-mlsb",
  project: { id: "proj-lsk", name: "Library Self-Service Kiosk", code: "LSK" },
  date: "2026-10-02",
  dueOn: "2026-11-01",
  currency: "NGN",
  subtotal: 7_500_000_00,
  vat: 562_500_00,
  total: 8_062_500_00,
  retention: 403_125_00,
  settled: 0,
  outstanding: 8_062_500_00,
  retentionHeld: 403_125_00,
  daysLate: 0,
  expectedWhtBp: 500,
  open: { trade: 7_659_375_00, retention: 403_125_00, whtTaken: 0 },
  ...over,
});

export const INVOICES_META: InvoicesMeta = { drafts: 0, outstanding: 8_653_750_00, overdue: 591_250_00, invoicedThisYear: 31_000_000_00 };

export const invoiceDetail = (over: Partial<InvoiceDetail> = {}): InvoiceDetail => ({
  ...invoice(),
  lines: [
    {
      id: "line-1",
      description: "Kiosk installation, phase 2",
      accountId: "acc-4400",
      account: "4400 Consultancy and research income",
      projectId: "proj-lsk",
      amount: 7_500_000_00,
      vatRateBp: 750,
      vat: 562_500_00,
    },
  ],
  contract: { id: "ct-lsk", title: "Library self-service kiosks: supply, installation and training" },
  milestoneId: "ms-lsk-2",
  notes: null,
  expectedWht: 375_000_00,
  retentionBp: 500,
  open: { trade: 7_659_375_00, retention: 403_125_00 },
  receipts: [],
  journalId: "jr-9",
  issuedAt: "2026-10-02T09:14:00+01:00",
  issuedBy: "Ngozi Eze",
  voidedAt: null,
  voidedBy: null,
  voidReason: null,
  ...over,
});

export const receipt = (over: Partial<ReceiptDetail> = {}): ReceiptDetail => ({
  id: "rct-2",
  receiptNo: "RCT/2026/0002",
  status: "posted",
  client: "Meridian Library Services Board",
  clientId: "cp-mlsb",
  bankAccount: "Main operating account",
  bankAccountId: "bank-1",
  date: "2026-10-05",
  currency: "NGN",
  cash: 10_683_750_00,
  wht: 550_000_00,
  retention: 0,
  unallocated: 0,
  reference: "MLSB transfer 0510",
  whtCreditNote: "expected",
  whtCreditNoteRef: null,
  voidedAt: null,
  voidedBy: null,
  voidReason: null,
  allocations: [{ invoiceId: "inv-2", invoiceNo: "INV/2026/0002", cash: 10_683_750_00, wht: 550_000_00, retention: 0, fromAdvance: false, appliedOn: null, journalId: null }],
  journalId: "jr-12",
  statementLineId: null,
  ...over,
});

export const candidate = (over: Partial<ReceiptCandidate> = {}): ReceiptCandidate => ({
  id: "sl-1",
  bankAccountId: "bank-1",
  date: "2026-10-04",
  amount: 7_284_375_00,
  narration: "NIP FRM MERIDIAN LIBRARY SERVICES BOARD/INV 0003",
  counterparty: "MERIDIAN LIBRARY SERVICES BOARD",
  counterpartyId: "cp-mlsb",
  reference: "26BK0104411",
  ...over,
});

export const WHT_REGISTER: WhtRegister = {
  rows: [
    {
      receiptId: "rct-2",
      receiptNo: "RCT/2026/0002",
      client: "Meridian Library Services Board",
      clientId: "cp-mlsb",
      date: "2026-10-05",
      wht: 550_000_00,
      currency: "NGN",
      creditNote: "expected",
      creditNoteRef: null,
      daysWaiting: 1,
    },
  ],
  expected: 550_000_00,
  received: 0,
};

export const aged = (over: Partial<AgedReceivables> = {}): AgedReceivables => ({
  asOf: "2026-10-06",
  totals: { current: 7_659_375_00, d30: 0, d60: 0, d90: 0, over90: 0, retention: 994_375_00, total: 8_653_750_00 },
  clients: [
    {
      clientId: "cp-mlsb",
      client: "Meridian Library Services Board",
      total: 8_653_750_00,
      invoices: [
        { id: "inv-2", invoiceNo: "INV/2026/0002", dueOn: "2026-09-13", daysLate: 0, outstanding: 591_250_00, retentionHeld: 591_250_00, currency: "NGN", bucket: "retention" },
        { id: "inv-3", invoiceNo: "INV/2026/0003", dueOn: "2026-11-01", daysLate: 0, outstanding: 8_062_500_00, retentionHeld: 403_125_00, currency: "NGN", bucket: "current" },
      ],
      current: 7_659_375_00,
      d30: 0,
      d60: 0,
      d90: 0,
      over90: 0,
      retention: 994_375_00,
    },
  ],
  ...over,
});

export const statement = (over: Partial<ClientStatement> = {}): ClientStatement => ({
  client: "Eastgate State Scholarship Board",
  clientId: "cp-essb",
  from: null,
  to: null,
  opening: 0,
  closing: 0,
  balance: 0,
  aged: { current: 0, d30: 0, d60: 0, d90: 0, over90: 0, retention: 0, total: 0 },
  agedAsOf: "2026-10-06",
  entries: [
    { date: "2026-08-24", kind: "invoice", id: "inv-1", reference: "INV/2026/0001", debit: 12_500_000_00, credit: 0, status: "paid", dueOn: "2026-09-07", balance: 12_500_000_00 },
    { date: "2026-09-03", kind: "receipt", id: "rct-1", reference: "RCT/2026/0001", debit: 0, credit: 12_500_000_00, status: "posted", dueOn: null, balance: 0 },
  ],
  ...over,
});

export const clientSummary = (over: Partial<ClientSummary> = {}): ClientSummary => ({
  clientId: "cp-essb",
  client: "Eastgate State Scholarship Board",
  contracts: 1,
  contractValue: 40_000_000_00,
  currency: "NGN",
  invoices: 2,
  invoiced: 21_500_000_00,
  received: 12_500_000_00,
  wht: 0,
  outstanding: 9_000_000_00,
  retention: 1_075_000_00,
  overdue: 591_250_00,
  lastReceipt: "2026-09-03",
  ...over,
});

export const ADVANCES: ClientAdvances = {
  rows: [
    {
      receiptId: "rct-4",
      receiptNo: "RCT/2026/0004",
      clientId: "cp-mlsb",
      client: "Meridian Library Services Board",
      date: "2026-10-06",
      currency: "NGN",
      held: 1_500_000_00,
      cash: 5_000_000_00,
    },
  ],
  total: 1_500_000_00,
};
