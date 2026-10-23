/* ------------------------------------------------------------------ */
/*  Elevate Admin & Operations › the service desk (PRD §19.1) and the */
/*  self-service it answers (§13.4, §13.5): asking for help and       */
/*  following it, booking a room or a pool vehicle, logging a trip    */
/*  for a driver, and confirming a repair is done. Shapes follow      */
/*  `ServiceDeskController` and `MyHelpController` in api-lms.        */
/*  Instants are ISO 8601 with an offset.                              */
/* ------------------------------------------------------------------ */

import { opsRequest, unwrap } from "./operations-request";
import { ApiError, errorText, opsError, opsFieldErrors } from "./operations-travel-client";

export { ApiError, errorText, opsError, opsFieldErrors };

const enc = encodeURIComponent;

/* ------------------------------- types ------------------------------- */

export type TicketStatus = "new" | "assigned" | "in_progress" | "waiting" | "resolved" | "closed" | "cancelled";
export type TicketPriority = "critical" | "high" | "normal" | "low";
/** What the desk may move a ticket to. */
export type DeskStatus = "in_progress" | "waiting" | "resolved" | "cancelled";
export type LinkedType = "work_order" | "requisition" | "purchase_request" | "asset_request" | "vehicle_booking";
export type FieldType = "text" | "textarea" | "date" | "number" | "select";
export type RoutesTo = "ticket" | "work_order" | "requisition" | "asset_request" | "vehicle_booking";

export const OPEN_STATUSES: TicketStatus[] = ["new", "assigned", "in_progress", "waiting"];

/** One question on a catalogue item's form. */
export interface CatalogueField {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
}

export interface Ticket {
  id: string;
  number: string | null;
  title: string;
  priority: TicketPriority;
  status: TicketStatus;
  catalogueId: string | null;
  item: string | null;
  category: string | null;
  requester: string | null;
  requesterId: string;
  assignee: string | null;
  assigneeId: string | null;
  slaDueAt: string | null;
  /** Open and past its SLA. */
  breached: boolean;
  createdAt: string | null;
  resolvedAt: string | null;
  rating: number | null;
  linkedType: LinkedType | null;
  linkedId: string | null;
}

export interface TicketComment {
  id: string;
  body: string;
  /** A note only the desk sees. */
  internal: boolean;
  by: string | null;
  byId: string | null;
  at: string | null;
}

export interface LinkedRecord {
  type: LinkedType;
  id: string;
  reference: string | null;
  status: string | null;
  url: string;
}

/** A record a ticket could be linked to (`GET desk/{id}/linkable`). */
export interface LinkableRecord {
  id: string;
  reference: string | null;
  title: string | null;
  status: string | null;
  date: string | null;
  person: string | null;
  /** Same requester, asset or site, raised since the ticket. */
  related: boolean;
}

export interface TicketFull extends Ticket {
  description: string | null;
  /** The catalogue form's answers by field key. */
  answers: Record<string, string | number | null>;
  fields: CatalogueField[];
  firstResponseAt: string | null;
  closedAt: string | null;
  ratingComment: string | null;
  /** The facility's name. */
  facility: string | null;
  facilityId?: string | null;
  asset: { id: string; tagNo: string | null; name: string | null } | null;
  linked: LinkedRecord | null;
  /** The requester's view leaves out internal notes. */
  comments: TicketComment[];
}

export interface DeskSummary {
  open: number;
  breached: number;
  unassigned: number;
  resolvedThisWeek: number;
  /** Average rating out of 5; null when nobody rated. */
  satisfaction: number | null;
  /** Percent resolved inside the SLA; null when nothing resolved. */
  slaMet: number | null;
  /** Open tickets by catalogue category. */
  byCategory: Record<string, number>;
}

export interface DeskQueue {
  tickets: Ticket[];
  summary: DeskSummary;
  categories: Record<string, string>;
}

export interface CatalogueItem {
  id: string;
  key: string | null;
  name: string;
  category: string;
  description: string | null;
  routesTo: RoutesTo;
  ownerId: string | null;
  owner: string | null;
  slaHours: number;
  defaultPriority: TicketPriority;
  fields: CatalogueField[];
  active: boolean;
}

export interface Catalogue {
  items: CatalogueItem[];
  categories: Record<string, string>;
  routes: Record<string, string>;
}

export interface CatalogueInput {
  name?: string;
  category?: string;
  description?: string | null;
  routesTo?: RoutesTo;
  ownerId?: string | null;
  slaHours?: number;
  defaultPriority?: TicketPriority;
  fields?: CatalogueField[];
  active?: boolean;
}

/* ---------------------------- self-service --------------------------- */

export interface HelpItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  routesTo: RoutesTo;
  slaHours: number;
  fields: CatalogueField[];
}

export interface HelpCatalogue {
  items: HelpItem[];
  categories: Record<string, string>;
  facilities: { id: string; name: string }[];
  myAssets: { id: string; tagNo: string | null; name: string | null }[];
}

export interface RaiseInput {
  catalogueId?: string | null;
  title: string;
  description?: string | null;
  answers?: Record<string, string>;
  priority?: TicketPriority;
  facilityId?: string | null;
  assetId?: string | null;
}

export interface CloseInput {
  rating?: number | null;
  comment?: string | null;
  /** Reopen instead of closing. */
  reopen?: boolean;
}

export interface BookableRoom {
  id: string;
  name: string;
  capacity: number | null;
  facility: string | null;
}

export interface RoomSlot {
  id: string;
  spaceId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  bookedBy: string | null;
  mine: boolean;
}

export interface RoomsWeek {
  rooms: BookableRoom[];
  bookings: RoomSlot[];
}

export interface PoolVehicle {
  id: string;
  registrationNo: string;
  name: string | null;
}

export type VehicleBookingStatus = "requested" | "approved" | "declined" | "cancelled" | "completed";

export interface MyVehicleBooking {
  id: string;
  registrationNo: string | null;
  purpose: string;
  destination: string | null;
  status: VehicleBookingStatus | string;
  startsAt: string;
  endsAt: string;
  driver: string | null;
}

export interface VehiclesBoard {
  pool: PoolVehicle[];
  /** Approved bookings over the next three weeks. */
  busy: { vehicleId: string; startsAt: string; endsAt: string }[];
  mine: MyVehicleBooking[];
  /** Vehicles I am the driver of. */
  driving: (PoolVehicle & { odometer: number | null })[];
}

export interface TripInput {
  tripOn?: string;
  purpose: string;
  projectId?: string | null;
  costCentreId?: string | null;
  origin?: string | null;
  destination?: string | null;
  startOdometer: number;
  endOdometer: number;
}

export interface MyWorkOrder {
  id: string;
  number: string | null;
  title: string;
  status: string;
  /** The asset's tag. */
  asset: string | null;
  resolution: string | null;
  completedAt: string | null;
  /** Completed and waiting for my confirmation. */
  toConfirm: boolean;
}

export interface WorkOrderInput {
  assetId?: string | null;
  facilityId?: string | null;
  title: string;
  fault?: string | null;
  priority?: TicketPriority;
  /** The ticket it comes from; the server links the two. */
  ticketId?: string | null;
}

/* ------------------------------- client ------------------------------ */

/** The service desk: the queue, a ticket, and the catalogue. */
export const desk = {
  queue: (filters: { status?: string; mine?: boolean } = {}) =>
    opsRequest<{ data: Ticket[]; meta: DeskSummary & { categories: Record<string, string> } }>("desk", {
      query: { status: filters.status, mine: filters.mine ? 1 : undefined },
    }).then((r): DeskQueue => {
      const { categories, ...summary } = r.meta;
      return { tickets: r.data, summary: { ...summary, byCategory: asRecord(summary.byCategory) }, categories: categories ?? {} };
    }),
  get: (id: string) => unwrap(opsRequest<{ data: TicketFull }>(`desk/${enc(id)}`)).then(withAnswers),
  /** Null unassigns it. */
  assign: (id: string, assigneeId: string | null) => unwrap(opsRequest<{ data: TicketFull }>(`desk/${enc(id)}/assign`, { method: "POST", body: { assigneeId } })).then(withAnswers),
  comment: (id: string, body: string, internal = false) =>
    unwrap(opsRequest<{ data: TicketFull }>(`desk/${enc(id)}/comments`, { method: "POST", body: { body, internal } })).then(withAnswers),
  status: (id: string, status: DeskStatus) => unwrap(opsRequest<{ data: TicketFull }>(`desk/${enc(id)}/status`, { method: "POST", body: { status } })).then(withAnswers),
  link: (id: string, linkedType: LinkedType, linkedId: string) =>
    unwrap(opsRequest<{ data: TicketFull }>(`desk/${enc(id)}/link`, { method: "POST", body: { linkedType, linkedId } })).then(withAnswers),
  /** Records of one kind this ticket could have become, related ones first. */
  linkable: (id: string, type: LinkedType, q = "") =>
    unwrap(opsRequest<{ data: LinkableRecord[] }>(`desk/${enc(id)}/linkable`, { query: q ? { type, q } : { type } })),
  /** A corrective work order on the maintenance desk (needs a maintenance key). */
  raiseWorkOrder: (input: WorkOrderInput) => unwrap(opsRequest<{ data: { id: string; number?: string | null } }>("maintenance", { method: "POST", body: input })),

  catalogue: () => opsRequest<{ data: CatalogueItem[]; meta: { categories: Record<string, string>; routes: Record<string, string> } }>("desk/catalogue").then(
    (r): Catalogue => ({ items: r.data.map(withFields), categories: r.meta?.categories ?? {}, routes: r.meta?.routes ?? {} }),
  ),
  createItem: (input: CatalogueInput) => unwrap(opsRequest<{ data: CatalogueItem }>("desk/catalogue", { method: "POST", body: input })).then(withFields),
  updateItem: (id: string, input: CatalogueInput) => unwrap(opsRequest<{ data: CatalogueItem }>(`desk/catalogue/${enc(id)}`, { method: "PATCH", body: input })).then(withFields),
};

/** Everybody's own: asking for help, bookings, and repairs to confirm. */
export const help = {
  catalogue: () =>
    unwrap(opsRequest<{ data: HelpCatalogue }>("me/help/catalogue")).then((c) => ({ ...c, items: (c.items ?? []).map(withFields) })),
  mine: () => unwrap(opsRequest<{ data: Ticket[] }>("me/help")),
  raise: (input: RaiseInput) => unwrap(opsRequest<{ data: TicketFull }>("me/help", { method: "POST", body: input })).then(withAnswers),
  get: (id: string) => unwrap(opsRequest<{ data: TicketFull }>(`me/help/${enc(id)}`)).then(withAnswers),
  reply: (id: string, body: string) => unwrap(opsRequest<{ data: TicketFull }>(`me/help/${enc(id)}/comments`, { method: "POST", body: { body } })).then(withAnswers),
  /** Close a resolved request with a rating, or reopen it. */
  close: (id: string, input: CloseInput) => unwrap(opsRequest<{ data: TicketFull }>(`me/help/${enc(id)}/close`, { method: "POST", body: input })).then(withAnswers),

  rooms: (range: { from?: string; to?: string } = {}) => unwrap(opsRequest<{ data: RoomsWeek }>("me/rooms", { query: { ...range } })),
  /** A clash comes back as a 422 on `startsAt` naming the booking in the way. */
  bookRoom: (spaceId: string, input: { title: string; startsAt: string; endsAt: string; attendees?: number | null }) =>
    unwrap(opsRequest<{ data: { id: string } }>(`me/rooms/${enc(spaceId)}/book`, { method: "POST", body: input })),
  cancelRoom: (bookingId: string) => opsRequest<unknown>(`me/room-bookings/${enc(bookingId)}/cancel`, { method: "POST", body: {} }).then(() => undefined),

  vehicles: () => unwrap(opsRequest<{ data: VehiclesBoard }>("me/vehicles")),
  bookVehicle: (vehicleId: string, input: { purpose: string; destination?: string | null; startsAt: string; endsAt: string }) =>
    unwrap(opsRequest<{ data: { id: string; status: string } }>(`me/vehicles/${enc(vehicleId)}/book`, { method: "POST", body: input })),
  cancelVehicle: (bookingId: string) => opsRequest<unknown>(`me/vehicle-bookings/${enc(bookingId)}/cancel`, { method: "POST", body: {} }).then(() => undefined),
  /** A driver logs a trip on the vehicle they drive. */
  logTrip: (vehicleId: string, input: TripInput) => unwrap(opsRequest<{ data: { id: string } }>(`me/vehicles/${enc(vehicleId)}/trips`, { method: "POST", body: input })),

  workOrders: () => unwrap(opsRequest<{ data: MyWorkOrder[] }>("me/work-orders")),
  confirmWork: (id: string) => unwrap(opsRequest<{ data: { id: string; status: string } }>(`me/work-orders/${enc(id)}/confirm`, { method: "POST", body: {} })),
};

/* ------------------------------ helpers ------------------------------ */

/** PHP sends an empty object as `[]`. */
function asRecord<T>(v: Record<string, T> | unknown[] | null | undefined): Record<string, T> {
  return v && !Array.isArray(v) && typeof v === "object" ? v : {};
}

/** Answers and fields are always the right shape here. */
function withAnswers(t: TicketFull): TicketFull {
  return { ...t, answers: asRecord(t.answers), fields: Array.isArray(t.fields) ? t.fields : [], comments: t.comments ?? [] };
}

function withFields<T extends { fields?: CatalogueField[] | null }>(i: T): T & { fields: CatalogueField[] } {
  return { ...i, fields: Array.isArray(i.fields) ? i.fields : [] };
}

/** A field key from its label: "Room number" → `room_number`. */
export function fieldKey(label: string, taken: string[] = []): string {
  const base =
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 36) || "field";
  let key = base;
  for (let n = 2; taken.includes(key); n++) key = `${base}_${n}`;
  return key;
}
