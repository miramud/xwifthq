/* ------------------------------------------------------------------ */
/*  Browser-side client for approvals: the inbox every module shares,  */
/*  decisions on tasks, memos, and the cover people set for            */
/*  themselves. Same-origin /api/approvals and /api/memos proxies.     */
/*                                                                      */
/*  Money is whole minor units (kobo). Every decision sends the        */
/*  `revision` the person was looking at; a stale one is a 409.        */
/* ------------------------------------------------------------------ */

import { ApiError } from "./admin-client";

export { ApiError };

export type InboxTab = "to_approve" | "delegated" | "returned" | "mine" | "watching" | "done";
export type InstanceStatus = "in_progress" | "approved" | "rejected" | "returned" | "recalled" | "needs_routing" | "cancelled";
export type StageStatus = "waiting" | "active" | "completed" | "skipped" | "rejected" | "returned" | "cancelled";
export type StageType = "approval" | "review" | "control" | "acknowledge" | "prepare";
export type Completion = "one" | "all" | "quorum" | "all_projects";

export interface InboxCounts {
  to_approve: number;
  delegated: number;
  returned: number;
  mine: number;
  overdue: number;
  watching: number;
  done: number;
}

export interface InboxRow {
  id: string;
  process: string;
  title: string;
  ref: string | null;
  status: InstanceStatus;
  amount: number | null;
  currency: string | null;
  flags: string[];
  requester: { id: string; name: string } | null;
  currentStage: string | null;
  submittedAt: string;
  completedAt: string | null;
  revision: number;
  /** Present on the task tabs (to_approve, delegated, done). */
  task?: {
    id: string;
    stage: string | null;
    stageType: StageType | null;
    scope: string | null;
    status: "open" | "done" | "cancelled" | "on_hold";
    action: string | null;
    onBehalfOf: string | null;
    pool: boolean;
    escalated: boolean;
    dueAt: string | null;
    overdue: boolean;
    actedAt: string | null;
    holdUntil: string | null;
    /** Approving needs the approver's authenticator code. */
    stepUp?: boolean;
  };
}

export interface TaskView {
  id: string;
  assignee: { id: string; name: string } | null;
  onBehalfOf: string | null;
  scope: string | null;
  source: "resolved" | "delegated" | "escalated" | "reassigned" | "pool";
  status: "open" | "done" | "cancelled" | "on_hold";
  action: string | null;
  comment: string | null;
  amendments: Record<string, number> | null;
  dueAt: string | null;
  actedAt: string | null;
  holdUntil: string | null;
  /** Approving needs the approver's authenticator code (the amount reached the step-up amount). */
  stepUp?: boolean;
}

export interface StageView {
  id: string;
  key: string;
  name: string;
  type: StageType;
  completion: Completion;
  quorum: number | null;
  isControl: boolean;
  status: StageStatus;
  sequence: number;
  reasons: string[];
  carried: boolean;
  canAmend: string[];
  startedAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  remaining: number;
  tasks: TaskView[];
}

export interface MessageView {
  id: string;
  kind: "comment" | "refer" | "question" | "answer" | "minute";
  body: string;
  author: string | null;
  authorId: string | null;
  to: string | null;
  toId: string | null;
  at: string | null;
}

export interface TrailEntry {
  seq: number;
  event: string;
  actor: string | null;
  onBehalfOf: string | null;
  at: string;
  note: string | null;
  stage: string | null;
  /** The stage's name as it was routed ("Head of unit"). */
  stageName: string | null;
  /** How the approver proved it was them, on a step-up approval. */
  stepUp?: "authenticator" | "backup_code" | null;
}

export interface ApprovalDetail {
  id: string;
  process: { code: string; name: string };
  title: string;
  ref: string | null;
  status: InstanceStatus;
  revision: number;
  amount: number | null;
  currency: string | null;
  flags: string[];
  requester: { id: string; name: string } | null;
  submittedAt: string;
  completedAt: string | null;
  policyVersion: number | null;
  documentUrl: string | null;
  /** Files the subject was sent with, downloadable by anyone the approval reaches. */
  documents?: { id: string; fileName: string; url: string; uploadedAt: string | null }[];
  verifyToken: string;
  context: Record<string, unknown>;
  stages: StageView[];
  trace: string[];
  notes: Record<string, string[]>;
  messages: MessageView[];
  trail: TrailEntry[];
  trailVerified: boolean;
  viewer: {
    isRequester: boolean;
    openTaskIds: string[];
    canRecall: boolean;
    canResubmit: boolean;
    referralsToMe: string[];
    watching: boolean;
    /** Whether the viewer has an authenticator app set up (for step-up approvals). */
    mfaEnrolled?: boolean;
  };
}

export interface RouteApprover {
  id: string;
  name: string | null;
  via: string;
  scope: string | null;
  onBehalfOf: string | null;
  source: string;
}

export interface RoutePreview {
  outcome: "routed" | "auto_approved" | "unresolved";
  reason: string | null;
  flags: string[];
  documentAmount: number | null;
  aggregatedAmount: number | null;
  unresolvedStages: string[];
  trace: string[];
  /** "Head of unit (Bursar) → Rector (Rector)" */
  summary: string;
  stages: {
    key: string;
    name: string;
    order: number;
    type: StageType;
    completion: Completion;
    quorum: number | null;
    isControl: boolean;
    reasons: string[];
    notes: string[];
    approvers: RouteApprover[];
  }[];
  policyVersion?: number | null;
}

export interface ContextFieldDef {
  key: string;
  label: string;
  type: "money" | "number" | "text" | "enum" | "boolean" | "unit" | "cost_centre" | "counterparty" | "user" | "project_list" | "list";
  options: { value: string; label: string }[];
}

export interface ProcessInfo {
  code: string;
  name: string;
  description: string;
  module: string;
  enabled: boolean;
  bulkApprovable: boolean;
  fields: ContextFieldDef[];
  amendable: string[];
}

export interface Delegation {
  id: string;
  delegator: { id: string; name: string } | null;
  delegate: { id: string; name: string } | null;
  startsAt: string;
  endsAt: string;
  processes: string[] | null;
  maxAmount: number | null;
  reason: string | null;
  status: "running" | "scheduled" | "ended" | "revoked";
  mine: boolean;
}

export type MemoStatus = "draft" | "pending" | "approved" | "rejected" | "returned" | "withdrawn";
export type MemoCategory = "general" | "policy" | "hiring" | "contract_award" | "event" | "other";

export const MEMO_CATEGORIES: { value: MemoCategory; label: string }[] = [
  { value: "general", label: "General" },
  { value: "policy", label: "Policy" },
  { value: "hiring", label: "Hiring" },
  { value: "contract_award", label: "Contract award" },
  { value: "event", label: "Event or workshop" },
  { value: "other", label: "Other" },
];

export interface MemoSummary {
  id: string;
  reference: string | null;
  title: string;
  category: MemoCategory;
  amount: number | null;
  currency: string | null;
  status: MemoStatus;
  unit: { id: string; code: string; name: string } | null;
  submittedAt: string | null;
  decidedAt: string | null;
  updatedAt: string | null;
}

export interface Memo extends MemoSummary {
  body: string | null;
  costCentre: { id: string; code: string; name: string } | null;
  payee: { id: string; code: string | null; name: string } | null;
  projectIds: string[];
  attachments: string[];
  requester: { id: string; name: string } | null;
  approvalId: string | null;
  isMine: boolean;
  editable: boolean;
}

export interface MemoInput {
  title?: string;
  body?: string | null;
  category?: MemoCategory;
  amount?: number | null;
  currency?: string | null;
  unitId?: string | null;
  costCentreId?: string | null;
  projectIds?: string[] | null;
  payeeId?: string | null;
}

async function request<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (res.status === 204) return {} as T;

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(json?.message ?? "Request failed.", res.status, json?.errors, json?.code);
  }
  return json as T;
}

const a =(path: string) => `/api/approvals${path}`;
const m = (path: string) => `/api/memos${path}`;

type Detail = { data: ApprovalDetail };
const detail = (p: Promise<Detail>) => p.then((r) => r.data);

export const approvals = {
  counts: () => request<{ data: InboxCounts }>(a("/counts")).then((r) => r.data),

  inbox: (tab: InboxTab, filters: { process?: string; q?: string; sla?: "overdue" } = {}) => {
    const qs = new URLSearchParams({ tab });
    if (filters.process) qs.set("process", filters.process);
    if (filters.q) qs.set("q", filters.q);
    if (filters.sla) qs.set("sla", filters.sla);
    return request<{ data: InboxRow[]; counts: InboxCounts }>(a(`?${qs}`));
  },

  get: (id: string) => detail(request<Detail>(a(`/${id}`))),

  processes: () => request<{ data: ProcessInfo[] }>(a("/processes")).then((r) => r.data),

  /** "Your request will go to…" - the route before submitting. */
  simulate: (process: string, context: Record<string, unknown>, requesterId?: string) =>
    request<{ data: RoutePreview }>(a("/simulate"), { method: "POST", body: { process, context, requesterId } }).then((r) => r.data),

  /** `mfaCode`: the approver's authenticator or backup code, on a step-up task. */
  approve: (taskId: string, revision: number, comment?: string, amendments?: Record<string, number>, mfaCode?: string) =>
    detail(request<Detail>(a(`/tasks/${taskId}/approve`), { method: "POST", body: { revision, comment, amendments, mfaCode } })),
  reject: (taskId: string, revision: number, reason: string) =>
    detail(request<Detail>(a(`/tasks/${taskId}/reject`), { method: "POST", body: { revision, reason } })),
  returnForChanges: (taskId: string, revision: number, reason: string) =>
    detail(request<Detail>(a(`/tasks/${taskId}/return`), { method: "POST", body: { revision, reason } })),
  hold: (taskId: string, revision: number, reason: string, until: string) =>
    detail(request<Detail>(a(`/tasks/${taskId}/hold`), { method: "POST", body: { revision, reason, until } })),
  release: (taskId: string) => detail(request<Detail>(a(`/tasks/${taskId}/release`), { method: "POST" })),
  claim: (taskId: string) => detail(request<Detail>(a(`/tasks/${taskId}/claim`), { method: "POST" })),
  refer: (taskId: string, userId: string, note: string) =>
    detail(request<Detail>(a(`/tasks/${taskId}/refer`), { method: "POST", body: { userId, note } })),
  ask: (taskId: string, question: string) =>
    detail(request<Detail>(a(`/tasks/${taskId}/ask`), { method: "POST", body: { question } })),

  recall: (id: string, reason?: string) => detail(request<Detail>(a(`/${id}/recall`), { method: "POST", body: { reason } })),
  /** The requester's answer, or (with `messageId`) a referee's view. */
  reply: (id: string, body: string, messageId?: string) =>
    detail(request<Detail>(a(`/${id}/reply`), { method: "POST", body: { body, messageId } })),
  watch: (id: string) => detail(request<Detail>(a(`/${id}/watch`), { method: "POST" })),
  unwatch: (id: string) => detail(request<Detail>(a(`/${id}/watch`), { method: "DELETE" })),
  verifyTrail: (id: string) =>
    request<{ data: { verified: boolean; brokenAt: number | null; entries: number } }>(a(`/${id}/verify`)).then((r) => r.data),

  /** Same-origin URL that downloads the approval record as a PDF. */
  pdfUrl: (id: string) => a(`/${id}/pdf`),

  delegations: {
    list: () => request<{ data: Delegation[] }>(a("/delegations")).then((r) => r.data),
    create: (input: { delegateId: string; startsAt: string; endsAt: string; processes?: string[] | null; maxAmount?: number | null; reason?: string | null }) =>
      request<{ data: Delegation }>(a("/delegations"), { method: "POST", body: input }).then((r) => r.data),
    revoke: (id: string) => request<{ data: Delegation }>(a(`/delegations/${id}/revoke`), { method: "POST" }).then((r) => r.data),
  },
};

export const memos = {
  list: (filters: { status?: MemoStatus; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (filters.status) qs.set("status", filters.status);
    if (filters.q) qs.set("q", filters.q);
    const s = qs.toString();
    return request<{ data: MemoSummary[] }>(m(s ? `?${s}` : "")).then((r) => r.data);
  },
  get: (id: string) => request<{ data: Memo }>(m(`/${id}`)).then((r) => r.data),
  create: (input: MemoInput & { title: string }) => request<{ data: Memo }>(m(""), { method: "POST", body: input }).then((r) => r.data),
  update: (id: string, input: MemoInput) => request<{ data: Memo }>(m(`/${id}`), { method: "PATCH", body: input }).then((r) => r.data),
  submit: (id: string) => request<{ data: Memo }>(m(`/${id}/submit`), { method: "POST" }).then((r) => r.data),
  recall: (id: string, reason?: string) => request<{ data: Memo }>(m(`/${id}/recall`), { method: "POST", body: { reason } }).then((r) => r.data),
  remove: (id: string) => request<unknown>(m(`/${id}`), { method: "DELETE" }),
  pdfUrl: (id: string) => m(`/${id}/pdf`),
};

/** "₦4,500,000" from kobo. */
export function formatMoney(minor: number | null | undefined, currency: string | null | undefined = "NGN"): string {
  if (minor === null || minor === undefined) return "-";
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: currency || "NGN", maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);
  } catch {
    return `${currency ?? ""} ${(minor / 100).toLocaleString("en-NG")}`;
  }
}
