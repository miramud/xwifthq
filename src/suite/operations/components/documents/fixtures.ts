import type { ControlledDetail, DocumentVersion, PolicyToRead, RepoDocument, RepoDocumentFull, RepositoryMeta } from "@/lib/api/repository-client";

/* Test data for the repository screens, as the API sends it. */

export function doc(over: Partial<RepoDocument> = {}): RepoDocument {
  return {
    id: "d-lease",
    title: "Abuja office lease",
    fileName: "abuja-lease-2026.pdf",
    mime: "application/pdf",
    size: 482_000,
    category: "contracts",
    categoryLabel: "Contracts",
    docType: "Lease",
    reference: "CTR/2026/014",
    confidentiality: "confidential",
    retentionClass: "contracts",
    legalHold: false,
    documentDate: "2026-01-15",
    expiresOn: "2026-11-30",
    project: null,
    counterparty: "Eastgate Properties",
    uploadedBy: "Kemi Desk",
    uploadedAt: "2026-01-16T10:00:00Z",
    links: 2,
    sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    ...over,
  };
}

export function docFull(over: Partial<RepoDocumentFull> = {}): RepoDocumentFull {
  return {
    ...doc(),
    effectiveOn: "2026-02-01",
    tags: ["lease", "Abuja"],
    unitId: null,
    projectId: null,
    counterpartyId: "cp-1",
    employeeUserId: null,
    allowedUserIds: [],
    legalHoldReason: null,
    hasText: true,
    links: null,
    retentionEnds: "2033-11-30",
    whyKept: "It is kept until 30 Nov 2033 (Contracts).",
    accessLog: [{ action: "download", by: "Ada Obi", at: "2026-10-01T12:00:00Z" }],
    disposal: null,
    ...over,
  };
}

export function meta(over: Partial<RepositoryMeta> = {}): RepositoryMeta {
  return {
    categories: { corporate: "Corporate & legal", contracts: "Contracts", policies: "Policies, SOPs and templates" },
    levels: { public_internal: "Internal", confidential: "Confidential", restricted: "Restricted" },
    retention: {
      financial: { label: "Financial records", years: 7, from: "document" },
      contracts: { label: "Contracts", years: 7, from: "expiry" },
      corporate: { label: "Corporate records", years: null, from: null },
      general: { label: "General", years: 3, from: "document" },
    },
    byCategory: { contracts: { count: 3, bytes: 1_200_000 }, policies: { count: 1, bytes: 20_000 } },
    total: 4,
    onHold: 1,
    expiringSoon: 1,
    expired: 0,
    restricted: 1,
    ...over,
  };
}

export function version(over: Partial<DocumentVersion> = {}): DocumentVersion {
  return {
    id: "v-2-0",
    version: "2.0",
    status: "approved",
    changeSummary: "Carry-over of annual leave capped at 5 days.",
    documentId: "d-leave-2",
    author: "Kemi Desk",
    authorId: "u-desk",
    reviewer: "Ada Obi",
    reviewerId: "u-ada",
    approver: "Tunde Bello",
    approvalId: null,
    effectiveOn: "2026-09-01",
    nextReviewOn: "2026-10-20",
    approvedAt: "2026-08-28T10:00:00Z",
    assigned: 10,
    acknowledged: 7,
    createdAt: "2026-08-20T10:00:00Z",
    ...over,
  };
}

export function controlled(over: Partial<ControlledDetail> = {}): ControlledDetail {
  const current = version();
  return {
    id: "c-leave",
    code: "HR-POL-004",
    title: "Leave policy",
    kind: "policy",
    kindLabel: "Policy",
    requiresAcknowledgement: true,
    owner: "Kemi Desk",
    ownerUnit: "People",
    current,
    inProgress: null,
    reviewDue: true,
    audience: { everyone: true },
    ownerUnitId: "unit-people",
    ownerId: "u-desk",
    versions: [current, version({ id: "v-1-0", version: "1.0", status: "superseded", documentId: "d-leave-1", changeSummary: "First issue.", assigned: 9, acknowledged: 9 })],
    readReport: [
      { unitId: "unit-eng", unit: "Engineering", assigned: 6, acknowledged: 4, outstanding: ["Bola Ade", "Chidi Eze"] },
      { unitId: "unit-people", unit: "People", assigned: 4, acknowledged: 3, outstanding: ["Efe Omoregie"] },
    ],
    audienceSize: 10,
    ...over,
  };
}

export function policy(over: Partial<PolicyToRead> = {}): PolicyToRead {
  return {
    id: "c-leave",
    code: "HR-POL-004",
    title: "Leave policy",
    kind: "policy",
    kindLabel: "Policy",
    versionId: "v-2-0",
    version: "2.0",
    changeSummary: "Carry-over of annual leave capped at 5 days.",
    documentId: "d-leave-2",
    effectiveOn: "2026-09-01",
    assigned: true,
    acknowledgedAt: null,
    ...over,
  };
}
