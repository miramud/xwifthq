import type { EventStatus } from "@/components/workspace/Calendar";
import type { Hue } from "@/components/workspace/modules";
import type { InstanceStatus, MemoStatus, StageStatus, StageType } from "@/lib/api/approvals-client";

/*
  The words the approvals screens use, in one place, so the inbox, the
  decision view, the memo pages and the route preview never disagree about
  what a status or a flag is called.
*/

/** Warnings the routing engine puts on a request, in plain words. */
const FLAG_WORDS: Record<string, string> = {
  SPLIT_SUSPECTED: "Possibly split from a larger purchase",
};

export function flagLabel(flag: string): string {
  if (FLAG_WORDS[flag]) return FLAG_WORDS[flag];
  const t = flag.replace(/_/g, " ").toLowerCase().trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const INSTANCE_STATUS: Record<InstanceStatus, { label: string; hue: Hue }> = {
  in_progress: { label: "In progress", hue: "blue" },
  approved: { label: "Approved", hue: "mint" },
  rejected: { label: "Rejected", hue: "rose" },
  returned: { label: "Returned for changes", hue: "sun" },
  recalled: { label: "Withdrawn", hue: "slate" },
  needs_routing: { label: "Waiting for routing", hue: "coral" },
  cancelled: { label: "Cancelled", hue: "slate" },
};

export function instanceStatus(status: string): { label: string; hue: Hue } {
  return INSTANCE_STATUS[status as InstanceStatus] ?? { label: humanise(status), hue: "slate" };
}

export const MEMO_STATUS: Record<MemoStatus, { label: string; hue: Hue }> = {
  draft: { label: "Draft", hue: "slate" },
  pending: { label: "Waiting for approval", hue: "blue" },
  approved: { label: "Approved", hue: "mint" },
  rejected: { label: "Rejected", hue: "rose" },
  returned: { label: "Returned for changes", hue: "sun" },
  withdrawn: { label: "Withdrawn", hue: "slate" },
};

export const STAGE_STATUS: Record<StageStatus, { label: string; hue: Hue }> = {
  waiting: { label: "Not started", hue: "slate" },
  active: { label: "Waiting", hue: "blue" },
  completed: { label: "Done", hue: "mint" },
  skipped: { label: "Skipped", hue: "slate" },
  rejected: { label: "Rejected", hue: "rose" },
  returned: { label: "Returned", hue: "sun" },
  cancelled: { label: "Cancelled", hue: "slate" },
};

export const STAGE_TYPE: Record<StageType, string> = {
  approval: "Approval",
  review: "Review",
  control: "Control check",
  acknowledge: "Acknowledgement",
  prepare: "Preparation",
};

/** What a task's recorded action reads as in the timeline. */
export function actionLabel(action: string | null | undefined): string {
  switch (action) {
    case "approved":
      return "Approved";
    case "approved_with_amendment":
      return "Approved a lower amount";
    case "recommended":
      return "Recommended";
    case "acknowledged":
      return "Acknowledged";
    case "done":
      return "Prepared";
    case "rejected":
      return "Rejected";
    case "returned":
      return "Returned for changes";
    case "claimed_by_colleague":
      return "Taken by a colleague";
    case null:
    case undefined:
      return "";
    default:
      return humanise(action);
  }
}

/** The approve button's words for a stage type. */
export function approveVerb(type: StageType | null | undefined): string {
  if (type === "review") return "Recommend";
  if (type === "acknowledge") return "Acknowledge";
  if (type === "prepare") return "Mark as prepared";
  return "Approve";
}

/** Trail events, as sentences a person would write. */
const TRAIL_WORDS: Record<string, string> = {
  submitted: "Submitted",
  "approval.submitted": "Submitted",
  approved: "Approved",
  approved_with_amendment: "Approved a lower amount",
  recommended: "Recommended",
  acknowledged: "Acknowledged",
  done: "Prepared",
  task_rejected: "Rejected",
  rejected: "Rejected",
  returned: "Returned for changes",
  "approval.returned": "Returned for changes",
  held: "Put on hold",
  released: "Taken off hold",
  claimed: "Claimed from the pool",
  referred: "Referred for advice",
  asked: "Asked the requester",
  answered: "Answered",
  recalled: "Withdrawn",
  resubmitted: "Resubmitted",
  escalated: "Escalated",
  "approval.escalated": "Escalated",
  reassigned: "Reassigned",
  "approval.reassigned": "Reassigned",
  stage_completed: "Stage completed",
  "approval.stage_completed": "Stage completed",
  "approval.context_changed": "Details changed",
  "approval.needs_routing": "Needs routing",
  completed: "Completed",
  amended: "Amount lowered",
  approvals_carried: "Earlier approvals carried over",
  escalation_failed: "Escalation found nobody",
  needs_routing: "Needs routing",
  overdue: "Went overdue",
  question: "Asked the requester",
  answer: "Requester answered",
  minute: "Referee gave a view",
  reassignment_failed: "Reassignment found nobody",
  route_built: "Route worked out",
  stage_started: "Stage started",
  cancelled: "Cancelled",
};

export function trailLabel(event: string): string {
  return TRAIL_WORDS[event] ?? humanise(event.replace(/^approval\./, ""));
}

export function humanise(s: string | null | undefined): string {
  if (!s) return "";
  const t = s.replace(/[_.-]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* ------------------------------------------------------------------ */
/*  Dates                                                              */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000;

/** Local `YYYY-MM-DD` for an ISO instant. */
export function localYmd(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Where a due date stands: overdue once passed, due within the next day,
 * upcoming otherwise. `null` when there is no due date.
 */
export function dueStatus(dueAt: string | null | undefined, now: Date = new Date()): EventStatus | null {
  if (!dueAt) return null;
  const t = new Date(dueAt).getTime();
  if (Number.isNaN(t)) return null;
  if (t < now.getTime()) return "overdue";
  if (t - now.getTime() <= DAY) return "due";
  return "upcoming";
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** "in 3 days", "2 hours ago": a due date read at a glance. */
export function relativeTo(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - now.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < DAY) return rtf.format(Math.round(diff / 3_600_000), "hour");
  return rtf.format(Math.round(diff / DAY), "day");
}

/* ------------------------------------------------------------------ */
/*  Money                                                              */
/* ------------------------------------------------------------------ */

/**
 * Naira typed by a person → kobo. Accepts "4,500,000" and "1200.50". Returns
 * `null` for blank, `NaN` for something that isn't a non-negative number.
 */
export function nairaToKobo(input: string): number | null {
  const t = input.replace(/[,\s₦]/g, "");
  if (t === "") return null;
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return Number.NaN;
  return Math.round(Number(t) * 100);
}

export function koboToNaira(kobo: number | null | undefined): string {
  if (kobo == null) return "";
  return (kobo / 100).toFixed(kobo % 100 === 0 ? 0 : 2);
}
