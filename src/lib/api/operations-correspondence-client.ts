/* ------------------------------------------------------------------ */
/*  Elevate Admin & Operations › the correspondence register (PRD     */
/*  §6.4): letters received (logged, routed to an action officer,     */
/*  tracked to closure) and letters sent (drafted, numbered, approved, */
/*  dispatched, delivered). The desk is `operations/correspondence`;  */
/*  the officer's own list is `operations/me/correspondence`. Shapes  */
/*  follow `CorrespondencePresenter` in api-lms.                      */
/* ------------------------------------------------------------------ */

import { opsRequest, opsUpload, unwrap } from "./operations-request";
import { ApiError, errorText, opsError, opsFieldErrors } from "./operations-travel-client";

export { ApiError, errorText, opsError, opsFieldErrors };

const enc = encodeURIComponent;

/* ------------------------------- types ------------------------------- */

export type Direction = "incoming" | "outgoing";
export type IncomingStatus = "received" | "assigned" | "in_progress" | "responded" | "closed" | "cancelled";
export type OutgoingStatus = "draft" | "in_approval" | "approved" | "rejected" | "dispatched" | "delivered" | "acknowledged" | "cancelled";
export type LetterStatus = IncomingStatus | OutgoingStatus;
export type Channel = "hand" | "post" | "courier" | "email";
export type Confidentiality = "normal" | "confidential";
export type FileKind = "scan" | "copy" | "acknowledgement" | "reply" | "enclosure";

export const CHANNELS: Record<Channel, string> = { hand: "By hand", post: "Post", courier: "Courier", email: "Email" };

export interface Letter {
  id: string;
  direction: Direction;
  /** `{ORG}/IN/2026/0001`; null for an outgoing draft not yet sent for approval. */
  reference: string | null;
  status: LetterStatus;
  subject: string;
  confidentiality: Confidentiality;
  counterpartyId: string | null;
  /** The sender (incoming) or recipient (outgoing): the counterparty's name, or the name typed. */
  party: string | null;
  partyOrganisation: string | null;
  partyReference: string | null;
  channel: Channel | null;
  letterDate: string | null;
  receivedOn: string | null;
  sentOn: string | null;
  /** The register date: received, sent, or drafted. */
  date: string | null;
  addressee: string | null;
  orgUnitId: string | null;
  unit: string | null;
  project: { id: string; name: string; code: string | null } | null;
  projectId: string | null;
  assigneeId: string | null;
  assignee: string | null;
  assignedUnitId: string | null;
  assignedUnit: string | null;
  dueOn: string | null;
  /** Incoming, still awaiting action, and past its due date. */
  overdue: boolean;
  signatoryId: string | null;
  signatory: string | null;
  trackingRef: string | null;
  inReplyToId: string | null;
  createdAt: string | null;
}

export interface RelatedLetter {
  id: string;
  direction: Direction;
  reference: string | null;
  subject: string;
  status: LetterStatus;
  sentOn: string | null;
  receivedOn: string | null;
}

export interface LetterFile {
  id: string;
  kind: string;
  name: string;
  mime: string | null;
  size: number;
  uploadedBy: string | null;
  uploadedById: string | null;
  uploadedAt: string | null;
}

export interface LetterAction {
  id: string;
  action: string;
  by: string | null;
  byId: string | null;
  from: string | null;
  to: string | null;
  note: string | null;
  at: string | null;
}

export interface LetterFull extends Letter {
  summary: string | null;
  registeredBy: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  acknowledgedAt: string | null;
  respondedAt: string | null;
  deliveredAt: string | null;
  receiptAcknowledgedAt: string | null;
  closedAt: string | null;
  closeNote: string | null;
  approvalId: string | null;
  inReplyTo: RelatedLetter | null;
  replies: RelatedLetter[];
  files: LetterFile[];
  actions: LetterAction[];
}

export interface RegisterSummary {
  open: number;
  overdue: number;
  unassigned: number;
  awaitingClosure: number;
  receivedThisMonth: number;
  inApproval: number;
  toDispatch: number;
  sentThisMonth: number;
}

export interface Register {
  letters: Letter[];
  summary: RegisterSummary;
  /** May this person see and mark confidential letters? */
  registry: boolean;
}

export interface RegisterFilters {
  direction?: Direction | "";
  /** A status, `open` (still awaiting action or dispatch) or `all`. */
  status?: string;
  from?: string;
  to?: string;
  unitId?: string;
  party?: string;
  projectId?: string;
  assigneeId?: string;
  overdue?: boolean;
  q?: string;
}

export interface RegisterOptions {
  staff: { id: string; name: string; unitId: string | null }[];
  units: { id: string; name: string; code: string | null }[];
  parties: { id: string; name: string; code: string | null }[];
  projects: { id: string; name: string; code: string | null }[];
  channels: Record<Channel, string>;
}

/** What the register form sends: an incoming letter logged, or an outgoing one drafted. */
export interface LetterInput {
  direction?: Direction;
  subject?: string;
  summary?: string | null;
  counterpartyId?: string | null;
  partyName?: string | null;
  partyOrganisation?: string | null;
  partyReference?: string | null;
  channel?: Channel | null;
  letterDate?: string | null;
  receivedOn?: string | null;
  addressee?: string | null;
  orgUnitId?: string | null;
  projectId?: string | null;
  confidentiality?: Confidentiality;
  assigneeId?: string | null;
  assignedUnitId?: string | null;
  dueOn?: string | null;
  note?: string | null;
  signatoryId?: string | null;
  inReplyToId?: string | null;
  trackingRef?: string | null;
}

/* ------------------------------ helpers ------------------------------ */

/** PHP sends empty lists as `[]` and may leave a list out; the screens never have to check. */
function full(l: LetterFull): LetterFull {
  return { ...l, replies: l.replies ?? [], files: l.files ?? [], actions: l.actions ?? [] };
}

const post = (path: string, body: unknown = {}) => unwrap(opsRequest<{ data: LetterFull }>(path, { method: "POST", body })).then(full);

const EMPTY_SUMMARY: RegisterSummary = { open: 0, overdue: 0, unassigned: 0, awaitingClosure: 0, receivedThisMonth: 0, inApproval: 0, toDispatch: 0, sentThisMonth: 0 };

/* ------------------------------- desk -------------------------------- */

export const correspondence = {
  list: async (filters: RegisterFilters = {}): Promise<Register> => {
    const { overdue, ...rest } = filters;
    const r = await opsRequest<{ data: Letter[]; meta?: { summary?: RegisterSummary; registry?: boolean } }>("correspondence", {
      query: { ...rest, overdue: overdue ? 1 : undefined },
    });
    return { letters: r.data ?? [], summary: { ...EMPTY_SUMMARY, ...(r.meta?.summary ?? {}) }, registry: Boolean(r.meta?.registry) };
  },
  options: () =>
    unwrap(opsRequest<{ data: RegisterOptions }>("correspondence/options")).then((o) => ({
      staff: o.staff ?? [],
      units: o.units ?? [],
      parties: o.parties ?? [],
      projects: o.projects ?? [],
      channels: (Array.isArray(o.channels) ? CHANNELS : (o.channels ?? CHANNELS)) as Record<Channel, string>,
    })),
  get: (id: string) => unwrap(opsRequest<{ data: LetterFull }>(`correspondence/${enc(id)}`)).then(full),
  create: (input: LetterInput) => post("correspondence", input),
  update: (id: string, input: LetterInput) => unwrap(opsRequest<{ data: LetterFull }>(`correspondence/${enc(id)}`, { method: "PATCH", body: input })).then(full),
  /** Route to a person, or to a unit (its head acts on it). */
  assign: (id: string, input: { assigneeId?: string | null; assignedUnitId?: string | null; dueOn?: string | null; note?: string | null }) =>
    post(`correspondence/${enc(id)}/assign`, input),
  note: (id: string, body: string) => post(`correspondence/${enc(id)}/notes`, { body }),
  close: (id: string, note?: string | null) => post(`correspondence/${enc(id)}/close`, { note: note ?? null }),
  reopen: (id: string, note?: string | null) => post(`correspondence/${enc(id)}/reopen`, { note: note ?? null }),
  cancel: (id: string, reason: string) => post(`correspondence/${enc(id)}/cancel`, { reason }),
  submit: (id: string) => post(`correspondence/${enc(id)}/submit`),
  dispatch: (id: string, input: { channel: Channel; sentOn?: string | null; trackingRef?: string | null }) => post(`correspondence/${enc(id)}/dispatch`, input),
  deliver: (id: string, input: { stage: "delivered" | "acknowledged"; on?: string | null; note?: string | null }) => post(`correspondence/${enc(id)}/deliver`, input),
  classify: (id: string, confidentiality: Confidentiality) => post(`correspondence/${enc(id)}/classify`, { confidentiality }),
  upload: (id: string, file: File, kind: FileKind) => {
    const form = new FormData();
    form.set("file", file);
    form.set("kind", kind);
    return unwrap(opsUpload<{ data: LetterFull }>(`correspondence/${enc(id)}/files`, form)).then(full);
  },
  removeFile: (id: string, fileId: string) => opsRequest<unknown>(`correspondence/${enc(id)}/files/${enc(fileId)}`, { method: "DELETE" }).then(() => undefined),
  fileUrl: (id: string, fileId: string) => `/api/operations/correspondence/${enc(id)}/files/${enc(fileId)}`,
};

/* ---------------------------- self-service ---------------------------- */

export const myCorrespondence = {
  list: () => unwrap(opsRequest<{ data: Letter[] }>("me/correspondence")).then((r) => r ?? []),
  colleagues: () => unwrap(opsRequest<{ data: { staff: { id: string; name: string }[] } }>("me/correspondence/options")).then((o) => o.staff ?? []),
  get: (id: string) => unwrap(opsRequest<{ data: LetterFull }>(`me/correspondence/${enc(id)}`)).then(full),
  acknowledge: (id: string) => post(`me/correspondence/${enc(id)}/acknowledge`),
  note: (id: string, body: string) => post(`me/correspondence/${enc(id)}/notes`, { body }),
  /** Hand it to a colleague with a minute; it leaves my list. */
  forward: (id: string, input: { assigneeId: string; note: string; dueOn?: string | null }) =>
    unwrap(opsRequest<{ data: { id: string; forwarded: boolean } }>(`me/correspondence/${enc(id)}/forward`, { method: "POST", body: input })),
  respond: (id: string, note?: string | null) => post(`me/correspondence/${enc(id)}/respond`, { note: note ?? null }),
  uploadReply: (id: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    return unwrap(opsUpload<{ data: LetterFull }>(`me/correspondence/${enc(id)}/files`, form)).then(full);
  },
  fileUrl: (id: string, fileId: string) => `/api/operations/me/correspondence/${enc(id)}/files/${enc(fileId)}`,
};
