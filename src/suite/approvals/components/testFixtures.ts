import type { ApprovalDetail, InboxRow, StageView, TaskView } from "@/lib/api/approvals-client";

/* Test fixtures for the approvals screens. */

export function task(over: Partial<TaskView> = {}): TaskView {
  return {
    id: "t-1",
    assignee: { id: "u-me", name: "Ada Approver" },
    onBehalfOf: null,
    scope: null,
    source: "resolved",
    status: "open",
    action: null,
    comment: null,
    amendments: null,
    dueAt: null,
    actedAt: null,
    holdUntil: null,
    ...over,
  };
}

export function stage(over: Partial<StageView> = {}): StageView {
  return {
    id: "s-1",
    key: "hou",
    name: "Head of unit",
    type: "approval",
    completion: "one",
    quorum: null,
    isControl: false,
    status: "active",
    sequence: 1,
    reasons: [],
    carried: false,
    canAmend: [],
    startedAt: "2026-10-01T09:00:00Z",
    dueAt: null,
    completedAt: null,
    remaining: 1,
    tasks: [task()],
    ...over,
  };
}

export function detail(over: Partial<ApprovalDetail> = {}, viewer: Partial<ApprovalDetail["viewer"]> = {}): ApprovalDetail {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    process: { code: "core.approval_memo", name: "Approval memo" },
    title: "Buy lab chairs",
    ref: "MEMO-2026-0004",
    status: "in_progress",
    revision: 3,
    amount: 450_000_00,
    currency: "NGN",
    flags: [],
    requester: { id: "u-req", name: "Rita Requester" },
    submittedAt: "2026-10-01T09:00:00Z",
    completedAt: null,
    policyVersion: 1,
    documentUrl: null,
    verifyToken: "abc",
    context: {},
    stages: [stage()],
    trace: [],
    notes: {},
    messages: [],
    trail: [{ seq: 1, event: "submitted", actor: "Rita Requester", onBehalfOf: null, at: "2026-10-01T09:00:00Z", note: null, stage: null, stageName: null }],
    trailVerified: true,
    ...over,
    viewer: {
      isRequester: false,
      openTaskIds: ["t-1"],
      canRecall: false,
      canResubmit: false,
      referralsToMe: [],
      watching: false,
      ...viewer,
    },
  };
}

export function row(over: Partial<InboxRow> = {}): InboxRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    process: "core.approval_memo",
    title: "Buy lab chairs",
    ref: "MEMO-2026-0004",
    status: "in_progress",
    amount: 450_000_00,
    currency: "NGN",
    flags: [],
    requester: { id: "u-req", name: "Rita Requester" },
    currentStage: "Head of unit",
    submittedAt: "2026-10-01T09:00:00Z",
    completedAt: null,
    revision: 3,
    task: {
      id: "t-1",
      stage: "Head of unit",
      stageType: "approval",
      scope: null,
      status: "open",
      action: null,
      onBehalfOf: null,
      pool: false,
      escalated: false,
      dueAt: null,
      overdue: false,
      actedAt: null,
      holdUntil: null,
    },
    ...over,
  };
}

export const COUNTS = { to_approve: 3, delegated: 1, returned: 2, mine: 4, overdue: 1, watching: 2, done: 7 };
