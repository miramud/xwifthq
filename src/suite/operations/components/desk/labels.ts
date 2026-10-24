import { useEffect, useState } from "react";
import { Building2, Car, CircleHelp, IdCard, Laptop, Paperclip, Presentation, Tent, Truck, type LucideIcon } from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import type { LinkedType, Ticket, TicketPriority, TicketStatus } from "@/lib/api/operations-desk-client";

/* Words, colours and clocks the service desk and "Ask for help" share. */

export const TICKET_STATUS: Record<TicketStatus, { label: string; hue: Hue; open: boolean }> = {
  new: { label: "New", hue: "sky", open: true },
  assigned: { label: "Assigned", hue: "blue", open: true },
  in_progress: { label: "In progress", hue: "blue", open: true },
  waiting: { label: "Waiting", hue: "sun", open: true },
  resolved: { label: "Resolved", hue: "mint", open: false },
  closed: { label: "Closed", hue: "slate", open: false },
  cancelled: { label: "Cancelled", hue: "slate", open: false },
};

export const statusMeta = (s: string | null | undefined) => TICKET_STATUS[(s ?? "new") as TicketStatus] ?? { label: s ?? "-", hue: "slate" as Hue, open: false };

export const PRIORITIES: Record<TicketPriority, { label: string; rank: number }> = {
  critical: { label: "Critical", rank: 0 },
  high: { label: "High", rank: 1 },
  normal: { label: "Normal", rank: 2 },
  low: { label: "Low", rank: 3 },
};

export const CATEGORY_LOOK: Record<string, { icon: LucideIcon; hue: Hue }> = {
  facilities: { icon: Building2, hue: "coral" },
  it: { icon: Laptop, hue: "blue" },
  access: { icon: IdCard, hue: "grape" },
  stationery: { icon: Paperclip, hue: "sun" },
  logistics: { icon: Truck, hue: "sky" },
  meetings: { icon: Presentation, hue: "mint" },
  events: { icon: Tent, hue: "rose" },
  transport: { icon: Car, hue: "sky" },
  other: { icon: CircleHelp, hue: "slate" },
};

export const categoryLook = (c: string | null | undefined) => CATEGORY_LOOK[c ?? "other"] ?? CATEGORY_LOOK.other;

export const LINKED_TYPES: Record<LinkedType, string> = {
  work_order: "Work order",
  requisition: "Item requisition",
  purchase_request: "Purchase request",
  asset_request: "Asset request",
  vehicle_booking: "Vehicle booking",
};

export const ROUTES_FALLBACK: Record<string, string> = {
  ticket: "Handled as a ticket",
  work_order: "Becomes a work order",
  requisition: "Becomes an item requisition",
  asset_request: "Becomes an asset request",
  vehicle_booking: "Becomes a vehicle booking",
};

/* -------------------------------- clocks ------------------------------- */

/** The time now, ticking every `ms` (a minute by default), for live countdowns. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** "2h 15m", "3d 4h", "45m". */
export function duration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h${m % 60 ? ` ${m % 60}m` : ""}`;
  const d = Math.floor(h / 24);
  return `${d}d${h % 24 ? ` ${h % 24}h` : ""}`;
}

export type SlaState = "breached" | "soon" | "ok" | "met" | "none";

/** Where a ticket stands against its SLA right now. */
export function sla(t: Pick<Ticket, "slaDueAt" | "status" | "resolvedAt">, now: number): { state: SlaState; text: string; ms: number } {
  if (!t.slaDueAt) return { state: "none", text: "No SLA", ms: Infinity };
  const due = new Date(t.slaDueAt).getTime();
  if (!statusMeta(t.status).open) {
    const at = t.resolvedAt ? new Date(t.resolvedAt).getTime() : null;
    return at === null ? { state: "none", text: statusMeta(t.status).label, ms: Infinity } : at <= due ? { state: "met", text: "Inside the SLA", ms: due - at } : { state: "breached", text: `${duration(at - due)} over the SLA`, ms: due - at };
  }
  const left = due - now;
  if (left < 0) return { state: "breached", text: `Breached ${duration(-left)} ago`, ms: left };
  return { state: left < 2 * 3_600_000 ? "soon" : "ok", text: `${duration(left)} left`, ms: left };
}

/** Priority first, then the SLA soonest to run out: the queue's order. */
export function queueOrder(a: Ticket, b: Ticket): number {
  const p = (PRIORITIES[a.priority]?.rank ?? 9) - (PRIORITIES[b.priority]?.rank ?? 9);
  if (p) return p;
  return (a.slaDueAt ?? "9999").localeCompare(b.slaDueAt ?? "9999");
}

/** "3 Oct, 14:05". */
export function stampText(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "5 minutes ago", "2 days ago". */
export function ago(iso: string | null | undefined, now: number): string {
  if (!iso) return "";
  const ms = now - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  return `${duration(ms)} ago`;
}
