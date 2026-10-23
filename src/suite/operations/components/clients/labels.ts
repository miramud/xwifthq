import {
  BadgeCheck,
  Ban,
  CalendarClock,
  CircleCheckBig,
  CircleDashed,
  FileCheck2,
  FilePen,
  Hourglass,
  Inbox,
  Landmark,
  MessageCircleQuestion,
  RotateCcw,
  ScanSearch,
  Send,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import { humanise } from "@/suite/lms/components/ui/ws";
import type { PackItem, PackStatus } from "@/lib/api/operations-travel-client";

/*
  A client payment request's stages in the client's own process, the pack's
  approval, and the rules the screens share with the API
  (`PaymentRequests::move` and `::submitPack`).
*/

type Meta = { label: string; hue: Hue; icon: LucideIcon };

export const STAGE: Record<string, Meta> = {
  prepared: { label: "Prepared", hue: "slate", icon: FilePen },
  submitted: { label: "Submitted", hue: "sky", icon: Send },
  acknowledged: { label: "Acknowledged", hue: "sky", icon: Inbox },
  under_verification: { label: "Under verification", hue: "grape", icon: ScanSearch },
  certified: { label: "Certified", hue: "blue", icon: BadgeCheck },
  with_finance: { label: "With finance / audit", hue: "grape", icon: Landmark },
  approved_for_payment: { label: "Approved for payment", hue: "mint", icon: FileCheck2 },
  payment_scheduled: { label: "Payment scheduled", hue: "mint", icon: CalendarClock },
  paid: { label: "Paid", hue: "mint", icon: Wallet },
  closed: { label: "Closed", hue: "slate", icon: CircleCheckBig },
  queried: { label: "Queried", hue: "rose", icon: MessageCircleQuestion },
  resubmitted: { label: "Resubmitted", hue: "sun", icon: RotateCcw },
};

export const stageMeta = (s: string, label?: string): Meta => STAGE[s] ?? { label: label ?? humanise(s), hue: "slate", icon: CircleDashed };

/** The road a payment normally takes, in order. Queried and resubmitted are detours off it. */
export const MAIN_PATH = ["prepared", "submitted", "acknowledged", "under_verification", "certified", "with_finance", "approved_for_payment", "payment_scheduled", "paid"];

/** Stages after which nothing needs chasing (`PaymentRequest::FINISHED`). */
export const FINISHED = ["paid", "closed"];

/** Every stage but paid and closed needs the next follow-up date. */
export const needsFollowUp = (stage: string) => stage !== "" && !FINISHED.includes(stage);

/** Submitting (or resubmitting) to the client needs the pack approved first. */
export const needsApprovedPack = (stage: string) => stage === "submitted" || stage === "resubmitted";

/** Mandatory checklist items with nothing attached, by label. */
export const missingMandatory = (items: readonly PackItem[]) => items.filter((i) => i.mandatory && !i.attachment).map((i) => i.label);

/** The pack can be sent for approval while a draft or after a rejection. */
export const packSendable = (status: PackStatus) => status === "draft" || status === "rejected";

export const PACK_STATUS: Record<PackStatus, Meta> = {
  draft: { label: "Pack being put together", hue: "slate", icon: FilePen },
  in_approval: { label: "Pack in approval", hue: "grape", icon: Hourglass },
  approved: { label: "Pack approved", hue: "mint", icon: BadgeCheck },
  rejected: { label: "Pack sent back", hue: "rose", icon: XCircle },
};

export const packStatus = (s: string): Meta => PACK_STATUS[s as PackStatus] ?? { label: humanise(s), hue: "slate", icon: Ban };

/** The road position of a stage (a detour sits after the furthest main stage reached). */
export function pathIndex(stage: string): number {
  return MAIN_PATH.indexOf(stage);
}
