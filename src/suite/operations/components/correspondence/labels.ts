import type { Hue } from "@/components/workspace/modules";
import type { CsvCell } from "@/components/workspace/csv";
import { CHANNELS, type Letter, type LetterAction } from "@/lib/api/operations-correspondence-client";

/** Every status of both registers, in words, with its colour. */
export const LETTER_STATUS: Record<string, { label: string; hue: Hue }> = {
  received: { label: "Received", hue: "coral" },
  assigned: { label: "With officer", hue: "sky" },
  in_progress: { label: "In progress", hue: "blue" },
  responded: { label: "Responded", hue: "grape" },
  closed: { label: "Closed", hue: "mint" },
  draft: { label: "Draft", hue: "slate" },
  in_approval: { label: "In approval", hue: "sun" },
  approved: { label: "Approved, to dispatch", hue: "sky" },
  rejected: { label: "Rejected", hue: "rose" },
  dispatched: { label: "Dispatched", hue: "blue" },
  delivered: { label: "Delivered", hue: "grape" },
  acknowledged: { label: "Acknowledged", hue: "mint" },
  cancelled: { label: "Cancelled", hue: "slate" },
};

export const letterStatus = (s: string | null | undefined) => LETTER_STATUS[s ?? ""] ?? { label: s ?? "—", hue: "slate" as Hue };

/** Incoming letters still waiting on somebody. */
export const IN_OPEN = ["received", "assigned", "in_progress"];
/** Outgoing letters not yet out of the door. */
export const OUT_OPEN = ["draft", "in_approval", "approved", "rejected"];

export const channelLabel = (c: string | null | undefined) => (c ? (CHANNELS as Record<string, string>)[c] ?? c : "—");

/** "7 Oct 2026" from an ISO date or instant. */
export function dayText(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Whole days from today to an ISO date: negative is late. */
export function daysUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const due = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

/** "Due in 3 days", "Due today", "4 days late". Empty when nothing is due. */
export function dueText(l: Pick<Letter, "dueOn" | "status" | "direction">, now: Date = new Date()): string {
  if (l.direction !== "incoming" || !l.dueOn || !IN_OPEN.includes(l.status)) return "";
  const d = daysUntil(l.dueOn, now);
  if (d === null) return "";
  if (d < 0) return `${-d} day${d === -1 ? "" : "s"} late`;
  if (d === 0) return "Due today";
  return `Due in ${d} day${d === 1 ? "" : "s"}`;
}

/** One line of the trail, in words. */
export function actionText(a: LetterAction): string {
  const words: Record<string, string> = {
    registered: "logged it on receipt",
    drafted: "drafted it",
    updated: "edited the details",
    assigned: `routed it to ${a.to ?? "an officer"}`,
    reassigned: `re-routed it from ${a.from ?? "the officer"} to ${a.to ?? "another officer"}`,
    forwarded: `forwarded it to ${a.to ?? "a colleague"}`,
    acknowledged: "acknowledged it",
    note: "added a minute",
    responded: "marked it responded",
    closed: "closed it",
    reopened: "reopened it",
    cancelled: "cancelled it",
    submitted: "sent it for approval",
    approved: "Approved",
    rejected: "Rejected",
    returned: "Returned for changes",
    dispatched: "dispatched it",
    delivered: "recorded delivery",
    receipt_acknowledged: "recorded the recipient's acknowledgement",
    classified: "changed its confidentiality",
    file_added: "filed a document",
    file_removed: "removed a document",
    reply_drafted: "drafted a reply",
    reply_sent: "sent a reply",
  };
  return words[a.action] ?? a.action.replace(/_/g, " ");
}

/** The register as listed, for a spreadsheet. Exported for testing. */
export function letterRows(rows: Letter[]): CsvCell[][] {
  return [
    ["Reference", "Direction", "Date", "Subject", "From / to", "Their reference", "Channel", "Addressee or unit", "Project", "Action officer", "Due", "Overdue", "Status", "Confidential", "Tracking"],
    ...rows.map((l) => [
      l.reference ?? "Draft",
      l.direction === "incoming" ? "In" : "Out",
      l.date ?? "",
      l.subject,
      [l.party, l.partyOrganisation].filter(Boolean).join(", "),
      l.partyReference ?? "",
      channelLabel(l.channel) === "—" ? "" : channelLabel(l.channel),
      l.addressee ?? l.unit ?? "",
      l.project?.name ?? "",
      l.assignee ?? "",
      l.dueOn ?? "",
      l.overdue ? "Yes" : "No",
      letterStatus(l.status).label,
      l.confidentiality === "confidential" ? "Yes" : "No",
      l.trackingRef ?? "",
    ]),
  ];
}
