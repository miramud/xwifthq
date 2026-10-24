import {
  Ban,
  BedDouble,
  CalendarCheck2,
  CarFront,
  CircleCheckBig,
  CircleDashed,
  FilePen,
  Hourglass,
  Plane,
  RefreshCw,
  TicketCheck,
  TrainFront,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import { humanise } from "@/suite/lms/components/ui/ws";
import type { ChangeStatus, EventStatus, TripStatus } from "@/lib/api/operations-travel-client";

/* Every travel and event enum in the words of the person reading it. */

export type Meta = { label: string; hue: Hue; icon: LucideIcon };

export const TRIP_STATUS: Record<TripStatus, Meta> = {
  draft: { label: "Draft", hue: "slate", icon: FilePen },
  in_approval: { label: "In approval", hue: "grape", icon: Hourglass },
  approved: { label: "Approved, to book", hue: "sky", icon: CalendarCheck2 },
  booked: { label: "Booked", hue: "blue", icon: TicketCheck },
  completed: { label: "Back, report in", hue: "mint", icon: CircleCheckBig },
  closed: { label: "Closed", hue: "slate", icon: CircleCheckBig },
  rejected: { label: "Rejected", hue: "rose", icon: XCircle },
  cancelled: { label: "Cancelled", hue: "slate", icon: Ban },
};

export const tripStatus = (s: string): Meta => TRIP_STATUS[s as TripStatus] ?? { label: humanise(s), hue: "slate", icon: CircleDashed };

/** The order the desk reads a trip's life in. */
export const TRIP_STATUS_ORDER: TripStatus[] = ["in_approval", "approved", "booked", "completed", "closed", "rejected", "cancelled"];

export const CHANGE_STATUS: Record<ChangeStatus, Meta> = {
  in_approval: { label: "In approval", hue: "grape", icon: Hourglass },
  approved: { label: "Approved, to carry out", hue: "sun", icon: RefreshCw },
  executed: { label: "Done", hue: "mint", icon: CircleCheckBig },
  rejected: { label: "Rejected", hue: "rose", icon: XCircle },
};

export const changeStatus = (s: string): Meta => CHANGE_STATUS[s as ChangeStatus] ?? { label: humanise(s), hue: "slate", icon: CircleDashed };

export const BOOKING_STATUS: Record<string, { label: string; hue: Hue }> = {
  booked: { label: "Booked", hue: "mint" },
  changed: { label: "Changed", hue: "sun" },
  cancelled: { label: "Cancelled", hue: "slate" },
};

export const bookingStatus = (s: string) => BOOKING_STATUS[s] ?? { label: humanise(s), hue: "slate" as Hue };

export const BOOKING_KIND: Record<string, { label: string; icon: LucideIcon; hue: Hue }> = {
  flight: { label: "Flight", icon: Plane, hue: "sky" },
  hotel: { label: "Hotel", icon: BedDouble, hue: "grape" },
  ground: { label: "Ground transport", icon: CarFront, hue: "coral" },
};

export const MODE: Record<string, { label: string; icon: LucideIcon }> = {
  air: { label: "Air", icon: Plane },
  road: { label: "Road", icon: CarFront },
  rail: { label: "Rail", icon: TrainFront },
};

export const FLIGHT_CLASS: Record<string, string> = {
  economy: "Economy",
  premium_economy: "Premium economy",
  business: "Business",
};

export const EVENT_STATUS: Record<EventStatus, Meta> = {
  draft: { label: "Draft", hue: "slate", icon: FilePen },
  in_approval: { label: "In approval", hue: "grape", icon: Hourglass },
  approved: { label: "Approved, running", hue: "blue", icon: CalendarCheck2 },
  closed: { label: "Closed out", hue: "mint", icon: CircleCheckBig },
  rejected: { label: "Rejected", hue: "rose", icon: XCircle },
  cancelled: { label: "Cancelled", hue: "slate", icon: Ban },
};

export const eventStatus = (s: string): Meta => EVENT_STATUS[s as EventStatus] ?? { label: humanise(s), hue: "slate", icon: CircleDashed };

/** A trip's dates as people say them: `13 to 15 Oct 2026`, `30 Sep to 2 Oct 2026`. */
export function dateSpan(from: string | null | undefined, to: string | null | undefined): string {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const parse = (s: string) => s.slice(0, 10).split("-").map(Number);
  if (!from) return "-";
  const [y1, m1, d1] = parse(from);
  if (!to || to === from) return `${d1} ${MONTHS[m1 - 1]} ${y1}`;
  const [y2, m2, d2] = parse(to);
  if (y1 !== y2) return `${d1} ${MONTHS[m1 - 1]} ${y1} to ${d2} ${MONTHS[m2 - 1]} ${y2}`;
  if (m1 !== m2) return `${d1} ${MONTHS[m1 - 1]} to ${d2} ${MONTHS[m2 - 1]} ${y2}`;
  return `${d1} to ${d2} ${MONTHS[m2 - 1]} ${y2}`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The grade on somebody's record (`me/options` staff), or the policy's default, officer, when none is set. */
export function gradeOnRecord(options: { staff: { id: string; grade?: string | null }[] } | null | undefined, userId: string): string {
  return options?.staff.find((p) => p.id === userId)?.grade || "officer";
}
