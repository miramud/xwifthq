/* ------------------------------------------------------------------ */
/*  The document repository and controlled documents (Admin & Ops     */
/*  PRD §18). Core's, not Operations': the desk is `/api/org/         */
/*  repository/*` (admins and holders of `core.repository.*`), staff  */
/*  search and read through `/api/repository/*`. Shapes follow        */
/*  `RepositoryController` and `MyRepositoryController` in api-lms.   */
/* ------------------------------------------------------------------ */

import { ApiError } from "./admin-client";

export { ApiError };

const enc = encodeURIComponent;

type Query = Record<string, string | number | boolean | null | undefined>;

function qs(query?: Query): string {
  if (!query) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function read<T>(res: Response): Promise<T> {
  if (res.status === 204) return {} as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json?.message ?? "Request failed.", res.status, json?.errors);
  return json as T;
}

async function call<T>(base: "org/repository" | "repository", path: string, init: { method?: string; body?: unknown; form?: FormData; query?: Query } = {}): Promise<T> {
  const url = `/api/${base}${path ? `/${path}` : ""}${qs(init.query)}`;
  const res = await fetch(url, {
    method: init.method ?? (init.form || init.body !== undefined ? "POST" : "GET"),
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    cache: "no-store",
  });
  return read<T>(res);
}

const data = <T>(p: Promise<{ data: T }>): Promise<T> => p.then((r) => r.data);

/** The first validation message, or the error's own. */
export function repoError(e: unknown, fallback = "Something went wrong."): string {
  if (e instanceof ApiError) {
    const first = e.errors ? Object.values(e.errors).flat()[0] : undefined;
    return (typeof first === "string" ? first : undefined) ?? e.message ?? fallback;
  }
  return e instanceof Error ? e.message : fallback;
}

/** Field → first message. */
export function repoFieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || !e.errors) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.errors)) {
    const first = Array.isArray(v) ? v[0] : v;
    if (typeof first === "string") out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = first;
  }
  return out;
}

/* ------------------------------- shapes ------------------------------ */

export type Confidentiality = "public_internal" | "confidential" | "restricted";

/** A document in a list (`RepositoryController::present`). */
export interface RepoDocument {
  id: string;
  title: string;
  fileName: string;
  mime: string | null;
  size: number | null;
  category: string;
  categoryLabel: string;
  docType: string | null;
  reference: string | null;
  confidentiality: Confidentiality;
  retentionClass: string;
  legalHold: boolean;
  documentDate: string | null;
  expiresOn: string | null;
  project: { id: string; name: string; code: string | null } | null;
  counterparty: string | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
  /** How many records it is attached to; null where not counted. */
  links: number | null;
  sha256: string | null;
}

/** A record the document is attached to. */
export interface DocumentLink {
  module: string;
  ownerType: string;
  ownerId: string;
  label: string | null;
  at: string | null;
}

export interface AccessLogEntry {
  action: string;
  by: string | null;
  at: string | null;
}

export interface DisposalState {
  status: string;
  reason: string | null;
  approvalId: string | null;
}

export interface RepoDocumentFull extends Omit<RepoDocument, "links"> {
  effectiveOn: string | null;
  tags: string[];
  unitId: string | null;
  projectId: string | null;
  counterpartyId: string | null;
  employeeUserId: string | null;
  allowedUserIds: string[];
  legalHoldReason: string | null;
  hasText: boolean;
  /**
   * The records it is attached to. The API means to send the list, but
   * `present()`'s own `links` (a count, null on a single document) wins the
   * array union, so this can arrive as null: read it with `linksOf`.
   */
  links: DocumentLink[] | number | null;
  retentionEnds?: string | null;
  whyKept?: string | null;
  accessLog?: AccessLogEntry[];
  disposal?: DisposalState | null;
}

/** The links list when the API sent one. */
export const linksOf = (d: Pick<RepoDocumentFull, "links">): DocumentLink[] | null => (Array.isArray(d.links) ? d.links : null);

export interface RetentionClass {
  label: string;
  /** Null: kept for good. */
  years: number | null;
  /** Counted from the document date, its expiry, or nothing. */
  from: "document" | "expiry" | null;
}

export interface RepositoryMeta {
  categories: Record<string, string>;
  levels: Record<string, string>;
  retention: Record<string, RetentionClass>;
  byCategory: Record<string, { count: number; bytes: number }>;
  total: number;
  onHold: number;
  expiringSoon: number;
  expired: number;
  restricted: number;
}

export interface RepositoryFilters {
  q?: string;
  category?: string;
  confidentiality?: string;
  /** Expiring within this many days (already expired included). */
  expiring?: number | string;
  docType?: string;
  projectId?: string;
  counterpartyId?: string;
  unitId?: string;
}

export interface DocumentMetaInput {
  title?: string;
  category?: string;
  docType?: string | null;
  reference?: string | null;
  unitId?: string | null;
  counterpartyId?: string | null;
  projectId?: string | null;
  employeeUserId?: string | null;
  documentDate?: string | null;
  effectiveOn?: string | null;
  expiresOn?: string | null;
  confidentiality?: Confidentiality;
  retentionClass?: string;
  tags?: string[];
  allowedUserIds?: string[];
}

/* -------------------------- controlled documents ------------------------- */

export type VersionStatus = "draft" | "in_review" | "in_approval" | "approved" | "superseded" | "rejected";

export interface DocumentVersion {
  id: string;
  /** "2.1". */
  version: string;
  status: VersionStatus;
  changeSummary: string | null;
  documentId: string | null;
  author: string | null;
  authorId: string | null;
  reviewer: string | null;
  reviewerId: string | null;
  approver: string | null;
  approvalId: string | null;
  effectiveOn: string | null;
  nextReviewOn: string | null;
  approvedAt: string | null;
  /** People asked to read it, and how many have. */
  assigned: number;
  acknowledged: number;
  createdAt: string | null;
}

export interface ControlledRow {
  id: string;
  code: string;
  title: string;
  kind: string;
  kindLabel: string;
  requiresAcknowledgement: boolean;
  owner: string | null;
  ownerUnit: string | null;
  current: DocumentVersion | null;
  inProgress: { id: string; version: string; status: VersionStatus } | null;
  /** The next review is within 30 days, or past. */
  reviewDue: boolean;
}

export interface Audience {
  everyone?: boolean;
  unitIds?: string[];
  jobTitleIds?: string[];
}

export interface ReadReportRow {
  unitId: string | null;
  unit: string;
  assigned: number;
  acknowledged: number;
  /** Names of those yet to read it. */
  outstanding: string[];
}

export interface ControlledDetail extends ControlledRow {
  audience: Audience | null;
  ownerUnitId: string | null;
  ownerId: string | null;
  versions: DocumentVersion[];
  readReport: ReadReportRow[];
  audienceSize: number;
}

export interface ControlledInput {
  code?: string;
  title?: string;
  kind?: string;
  ownerUnitId?: string | null;
  ownerId?: string | null;
  requiresAcknowledgement?: boolean;
  audience?: Audience;
}

export interface DraftVersionInput {
  file: File;
  bump: "major" | "minor";
  changeSummary: string;
  reviewerId?: string | null;
  effectiveOn?: string | null;
  nextReviewOn?: string | null;
}

/* ------------------------------- staff ------------------------------- */

export interface PolicyToRead {
  id: string;
  code: string;
  title: string;
  kind: string;
  kindLabel: string;
  versionId: string;
  version: string;
  changeSummary: string | null;
  documentId: string | null;
  effectiveOn: string | null;
  /** Sent to me to read. */
  assigned: boolean;
  acknowledgedAt: string | null;
}

/* ------------------------------ helpers ------------------------------ */

/** Metadata as multipart fields: arrays as `name[]`, empty values left out. */
export function metaForm(meta: DocumentMetaInput, form = new FormData()): FormData {
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => form.append(`${k}[]`, String(x)));
    else form.append(k, String(v));
  }
  return form;
}

/* ------------------------------- client ------------------------------ */

/** The document desk. */
export const repository = {
  list: (filters: RepositoryFilters = {}) =>
    call<{ data: RepoDocument[]; meta: RepositoryMeta }>("org/repository", "", { query: { ...filters } }).then((r) => ({ documents: r.data, meta: r.meta })),
  get: (id: string) => data(call<{ data: RepoDocumentFull }>("org/repository", enc(id))),
  /**
   * File a document with its metadata. The upload does not keep the people
   * allowed to see a restricted document, so they follow in a second step.
   */
  upload: async (file: File, meta: DocumentMetaInput): Promise<RepoDocumentFull> => {
    const { allowedUserIds, ...rest } = meta;
    const form = metaForm(rest);
    form.append("file", file);
    const doc = await data(call<{ data: RepoDocumentFull }>("org/repository", "", { form }));
    if (allowedUserIds && allowedUserIds.length > 0) return repository.update(doc.id, { allowedUserIds });
    return doc;
  },
  update: (id: string, meta: DocumentMetaInput) => data(call<{ data: RepoDocumentFull }>("org/repository", enc(id), { method: "PATCH", body: meta })),
  downloadHref: (id: string) => `/api/org/repository/${enc(id)}/download`,
  /** Admins only; a reason is needed to place one. */
  hold: (id: string, on: boolean, reason?: string | null) =>
    data(call<{ data: RepoDocumentFull }>("org/repository", `${enc(id)}/hold`, { body: reason ? { on, reason } : { on } })),
  /** Asks for it to be disposed of; the document controller approves. */
  dispose: (id: string, reason: string) => data(call<{ data: { status: string; approvalId: string | null } }>("org/repository", `${enc(id)}/dispose`, { body: { reason } })),

  controlled: {
    list: () => call<{ data: ControlledRow[]; meta: { kinds: Record<string, string> } }>("org/repository", "controlled").then((r) => ({ documents: r.data, kinds: r.meta?.kinds ?? {} })),
    get: (id: string) => data(call<{ data: ControlledDetail }>("org/repository", `controlled/${enc(id)}`)),
    create: (input: ControlledInput) => data(call<{ data: ControlledRow }>("org/repository", "controlled", { body: input })),
    update: (id: string, input: ControlledInput) => data(call<{ data: ControlledRow }>("org/repository", `controlled/${enc(id)}`, { method: "PATCH", body: input })),
    draft: (id: string, input: DraftVersionInput) => {
      const form = new FormData();
      form.append("file", input.file);
      form.append("bump", input.bump);
      form.append("changeSummary", input.changeSummary);
      if (input.reviewerId) form.append("reviewerId", input.reviewerId);
      if (input.effectiveOn) form.append("effectiveOn", input.effectiveOn);
      if (input.nextReviewOn) form.append("nextReviewOn", input.nextReviewOn);
      return data(call<{ data: DocumentVersion }>("org/repository", `controlled/${enc(id)}/versions`, { form }));
    },
    submit: (versionId: string) => data(call<{ data: DocumentVersion }>("org/repository", `versions/${enc(versionId)}/submit`, { body: {} })),
    /** The named reviewer passes it on to approval, or returns it to draft. */
    review: (versionId: string, pass: boolean, note?: string | null) =>
      data(call<{ data: DocumentVersion }>("org/repository", `versions/${enc(versionId)}/review`, { body: note ? { pass, note } : { pass } })),
  },
};

/** The repository as every member of staff sees it. */
export const myRepository = {
  search: (filters: { q?: string; category?: string; projectId?: string } = {}) =>
    call<{ data: RepoDocument[]; meta: { categories: Record<string, string> } }>("repository", "", { query: { ...filters } }).then((r) => ({
      documents: r.data,
      categories: r.meta?.categories ?? {},
    })),
  downloadHref: (id: string) => `/api/repository/${enc(id)}/download`,
  policies: () => call<{ data: PolicyToRead[]; meta: { toRead: number } }>("repository", "policies").then((r) => ({ policies: r.data, toRead: r.meta?.toRead ?? 0 })),
  policyFileHref: (versionId: string) => `/api/repository/policies/${enc(versionId)}/file`,
  acknowledge: (versionId: string) => data(call<{ data: { versionId: string; acknowledgedAt: string | null } }>("repository", `policies/${enc(versionId)}/acknowledge`, { body: {} })),
};
