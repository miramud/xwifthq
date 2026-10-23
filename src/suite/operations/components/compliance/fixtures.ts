import type { BidPackPreview, ComplianceBoard, Obligation, Occurrence, OccurrenceDetail } from "@/lib/api/operations-compliance-client";

/* Test data for the compliance screens, as the API sends it. "Today" in the tests is 6 October 2026. */

export function obligation(over: Partial<Obligation> = {}): Obligation {
  return {
    id: "ob-tcc",
    key: "tcc",
    name: "Tax Clearance Certificate",
    authority: "FIRS",
    category: "tax",
    categoryLabel: "Tax",
    ownerRole: "Finance",
    ownerId: null,
    owner: null,
    frequency: "annual",
    dueRule: { type: "expiry" },
    reminderDays: [60, 30, 14, 7, 1],
    evidenceRequired: "The certificate, with its issue and expiry dates.",
    isCertificate: true,
    mandatory: true,
    bidPack: true,
    needsPayment: false,
    typicalFee: null,
    counterpartyId: null,
    costCentreId: null,
    active: true,
    ...over,
  };
}

export function occurrence(over: Partial<Occurrence> = {}): Occurrence {
  return {
    id: "oc-paye",
    obligationId: "ob-paye",
    name: "PAYE remittance",
    category: "tax",
    ownerRole: "Finance",
    owner: null,
    isCertificate: false,
    needsPayment: false,
    period: "September 2026",
    dueOn: "2026-10-10",
    status: "open",
    stage: "due_soon",
    reference: null,
    issuedOn: null,
    expiresOn: null,
    amount: null,
    memoId: null,
    evidenceCount: 0,
    completedAt: null,
    completedBy: null,
    ...over,
  };
}

export function board(over: Partial<ComplianceBoard> = {}): ComplianceBoard {
  return {
    obligations: [
      obligation({ id: "ob-paye", key: "paye", name: "PAYE remittance", authority: "State Internal Revenue Service", isCertificate: false, bidPack: false, frequency: "monthly", dueRule: { type: "day_of_month", day: 10, offsetMonths: 1 } }),
      obligation({ id: "ob-cac", key: "cac", name: "CAC annual returns", authority: "Corporate Affairs Commission", category: "corporate", categoryLabel: "Corporate", ownerRole: "Company secretary", isCertificate: false, needsPayment: true, dueRule: { type: "annual_date", month: 6, day: 30 } }),
      obligation(),
    ],
    occurrences: [
      occurrence(),
      occurrence({ id: "oc-cac", obligationId: "ob-cac", name: "CAC annual returns", category: "corporate", ownerRole: "Company secretary", period: "2026", dueOn: "2026-06-30", stage: "overdue" }),
      occurrence({ id: "oc-tcc", obligationId: "ob-tcc", name: "Tax Clearance Certificate", isCertificate: true, period: "2027", dueOn: "2026-12-31", stage: "upcoming" }),
    ],
    certificates: [
      { obligationId: "ob-tcc", name: "Tax Clearance Certificate", mandatory: true, bidPack: true, occurrenceId: "oc-tcc-2025", issuedOn: "2026-01-10", expiresOn: "2026-12-31", state: "valid" },
      { obligationId: "ob-pencom", name: "PENCOM compliance certificate", mandatory: true, bidPack: true, occurrenceId: "oc-pen-2025", issuedOn: "2025-08-01", expiresOn: "2026-07-31", state: "expired" },
      { obligationId: "ob-nitda", name: "NITDA registration", mandatory: false, bidPack: true, occurrenceId: null, issuedOn: null, expiresOn: null, state: "missing" },
    ],
    summary: { dueSoon: 1, overdue: 1, expired: 1, expiring: 0, expiredMandatory: ["PENCOM compliance certificate"] },
    owners: ["Company secretary", "Finance"],
    categories: { corporate: "Corporate", tax: "Tax", employment: "Employment" },
    frequencies: { monthly: "Monthly", annual: "Annual", on_change: "On change" },
    from: "2026-04-01",
    to: "2027-10-31",
    financeOn: true,
    ...over,
  };
}

export function detail(over: Partial<OccurrenceDetail> = {}): OccurrenceDetail {
  const ob = obligation({ id: "ob-cac", name: "CAC annual returns", authority: "Corporate Affairs Commission", category: "corporate", categoryLabel: "Corporate", isCertificate: false, needsPayment: true, typicalFee: 1_500_000, evidenceRequired: "The filing acknowledgement or receipt." });
  return {
    ...occurrence({ id: "oc-cac", obligationId: "ob-cac", name: null, category: null, ownerRole: null, isCertificate: null, needsPayment: null, period: "2026", dueOn: "2026-06-30", stage: "overdue" }),
    obligation: ob,
    evidence: [],
    notes: null,
    history: [occurrence({ id: "oc-cac-2025", obligationId: "ob-cac", name: null, period: "2025", dueOn: "2025-06-30", status: "completed", stage: "completed", reference: "CAC/AR/2025", evidenceCount: 1 })],
    memo: null,
    reminders: [
      { kind: "t-30", sentAt: "2026-05-31T08:00:00Z" },
      { kind: "overdue", sentAt: "2026-07-01T08:00:00Z" },
    ],
    ...over,
  };
}

export function bidPack(over: Partial<BidPackPreview> = {}): BidPackPreview {
  return {
    included: [{ obligationId: "ob-tcc", name: "Tax Clearance Certificate", mandatory: true, bidPack: true, occurrenceId: "oc-tcc-2025", issuedOn: "2026-01-10", expiresOn: "2026-12-31", state: "valid", files: [{ id: "att-tcc", name: "TCC 2026.pdf" }] }],
    missing: [
      { obligationId: "ob-pencom", name: "PENCOM compliance certificate", mandatory: true, bidPack: true, occurrenceId: "oc-pen-2025", issuedOn: "2025-08-01", expiresOn: "2026-07-31", state: "expired", reason: "Expired on 31 Jul 2026" },
      { obligationId: "ob-nitda", name: "NITDA registration", mandatory: false, bidPack: true, occurrenceId: null, issuedOn: null, expiresOn: null, state: "missing", reason: "No certificate on file" },
    ],
    ...over,
  };
}
