import {
  Ban,
  BadgeCheck,
  CircleCheck,
  CircleDot,
  CircleX,
  FileCheck2,
  Hourglass,
  PackageSearch,
  Send,
  ShieldQuestion,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import type { ClaimKind, ClaimStatus, WarrantyOutcome, WorkOrderPriority, WorkOrderStatus } from "@/lib/api/operations-maintenance-client";

/* Every maintenance enum in the words of the person reading it, with its colour and icon. */

export type Meta = { label: string; hue: Hue; icon: LucideIcon };

/** The lanes of the board, in the order work moves through them. */
export const STATUS_FLOW: WorkOrderStatus[] = ["open", "assigned", "in_progress", "awaiting_parts", "completed", "confirmed"];

export const WORK_ORDER_STATUS: Record<WorkOrderStatus, Meta> = {
  open: { label: "Open", hue: "sky", icon: CircleDot },
  assigned: { label: "Assigned", hue: "grape", icon: UserCheck },
  in_progress: { label: "In progress", hue: "blue", icon: Wrench },
  awaiting_parts: { label: "Awaiting parts", hue: "sun", icon: PackageSearch },
  completed: { label: "Completed", hue: "mint", icon: CircleCheck },
  confirmed: { label: "Confirmed", hue: "mint", icon: BadgeCheck },
  cancelled: { label: "Cancelled", hue: "slate", icon: Ban },
};

export function workOrderStatus(s: string): Meta {
  return WORK_ORDER_STATUS[s as WorkOrderStatus] ?? { label: s.replace(/_/g, " "), hue: "slate", icon: CircleDot };
}

export const PRIORITY_LABEL: Record<WorkOrderPriority, string> = { critical: "Critical", high: "High", normal: "Normal", low: "Low" };
export const PRIORITY_ORDER: WorkOrderPriority[] = ["critical", "high", "normal", "low"];
export const PRIORITY_HUE: Record<WorkOrderPriority, Hue> = { critical: "rose", high: "coral", normal: "sun", low: "sky" };

export const KIND_LABEL: Record<string, string> = { preventive: "Preventive", corrective: "Corrective" };

export const WARRANTY: Record<WarrantyOutcome, Meta & { hint: string }> = {
  not_applicable: { label: "Not applicable", hue: "slate", icon: CircleX, hint: "The fault is not covered (misuse, wear, outside the terms). A paid repair may go ahead." },
  submitted: { label: "Claim submitted", hue: "sky", icon: Send, hint: "Waiting on the provider. A paid repair waits too." },
  accepted: { label: "Claim accepted", hue: "mint", icon: FileCheck2, hint: "The provider repairs it under warranty, at no cost." },
  rejected: { label: "Claim rejected", hue: "rose", icon: ShieldQuestion, hint: "The provider refused. A paid repair may go ahead." },
};

export const CLAIM_KIND: Record<ClaimKind, string> = { damage: "Damage", theft: "Theft", accident: "Accident", other: "Other" };

export const CLAIM_STATUS: Record<ClaimStatus, Meta> = {
  open: { label: "Open", hue: "sky", icon: CircleDot },
  submitted: { label: "With the insurer", hue: "grape", icon: Hourglass },
  settled: { label: "Settled", hue: "mint", icon: BadgeCheck },
  rejected: { label: "Rejected", hue: "rose", icon: CircleX },
  withdrawn: { label: "Withdrawn", hue: "slate", icon: Ban },
};

/* ------------------------------- SLA -------------------------------- */

const HOUR = 3_600_000;

/** A span of time as people say it: 45m, 3h 20m, 2 days. */
export function spanText(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) {
    const rest = m % 60;
    return rest && h < 10 ? `${h}h ${rest}m` : `${h}h`;
  }
  return `${Math.round(h / 24)} days`;
}

export interface SlaClock {
  label: string;
  hue: Hue;
  /** Open and past its time. */
  overdue: boolean;
  /** Share of the SLA window used, 0..1 (open work orders only; null when unknown). */
  used: number | null;
  /** The dial's big figure and the word under it: "3h 20m" / "left". */
  figure: string;
  note: string;
}

/**
 * Where a work order stands against its SLA. Open: time left (sun inside
 * the last quarter), or how long overdue (rose). Closed: met or missed.
 */
export function slaClock(
  w: { status: string; dueAt: string | null; createdAt?: string | null; completedAt?: string | null },
  now: number = Date.now(),
): SlaClock {
  if (!w.dueAt) return { label: "No SLA", hue: "slate", overdue: false, used: null, figure: "-", note: "no SLA" };
  const due = Date.parse(w.dueAt);
  if (w.status === "cancelled") return { label: "Cancelled", hue: "slate", overdue: false, used: null, figure: "-", note: "cancelled" };
  if (w.status === "completed" || w.status === "confirmed") {
    const done = w.completedAt ? Date.parse(w.completedAt) : now;
    return done <= due
      ? { label: "SLA met", hue: "mint", overdue: false, used: 1, figure: "Met", note: "SLA" }
      : { label: `SLA missed by ${spanText(done - due)}`, hue: "rose", overdue: false, used: 1, figure: "Missed", note: `by ${spanText(done - due)}` };
  }
  const start = w.createdAt ? Date.parse(w.createdAt) : null;
  const used = start !== null && due > start ? Math.min(1, Math.max(0, (now - start) / (due - start))) : null;
  if (now > due) return { label: `Overdue by ${spanText(now - due)}`, hue: "rose", overdue: true, used: 1, figure: spanText(now - due), note: "overdue" };
  const left = due - now;
  const tight = used !== null ? used >= 0.75 : left <= 4 * HOUR;
  return { label: `${spanText(left)} left`, hue: tight ? "sun" : "mint", overdue: false, used, figure: spanText(left), note: "left" };
}

/** Hours between two instants, one decimal; to now while still running. */
export function hoursBetween(from: string | null, to: string | null, now: number = Date.now()): number | null {
  if (!from) return null;
  const end = to ? Date.parse(to) : now;
  return Math.max(0, Math.round(((end - Date.parse(from)) / HOUR) * 10) / 10);
}

/** `YYYY-MM-DD` of today in local time. */
export function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Whole days from `a` to `b` (`YYYY-MM-DD`). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
