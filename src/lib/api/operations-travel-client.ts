/* ------------------------------------------------------------------ */
/*  Elevate Admin & Operations › travel, events and client payments.  */
/*  Shapes follow `OpsPresenter`, `MyOperationsController`,           */
/*  `TravelDeskController`, `EventController` and                      */
/*  `ClientPaymentController` in api-lms. Money is integer kobo;      */
/*  dates are `YYYY-MM-DD`, instants ISO 8601.                         */
/* ------------------------------------------------------------------ */

import { ApiError, errorText, opsRequest, opsUpload, unwrap } from "./operations-request";

export { ApiError, errorText };

const enc = encodeURIComponent;

/* ------------------------------ shared ------------------------------ */

export interface ProjectRef {
  id: string;
  name: string;
  code: string | null;
}

/** A project's funds when a document was sent (`ProjectFunds::check`). */
export interface FundsSnapshot {
  at: string;
  released: number;
  committed: number;
  actual: number;
  available: number;
  request: number;
  afterRequest: number;
  overridden: boolean;
  overrideReason?: string;
  controlled?: boolean;
}

/** A Finance memo as Operations sees it (`FinanceBridge::memos`). */
export interface MemoRef {
  reference: string | null;
  status: string;
  amount: number;
  paid: number;
  type: string;
}

export interface NamedRef {
  id: string;
  name: string;
}

/** What the staff forms pick from (`GET /me/options`). */
export interface OpsOptions {
  projects: (ProjectRef & { status: string | null })[];
  costCentres: { id: string; code: string; name: string }[];
  vendors: NamedRef[];
  /** With each person's travel grade on record (the default grade when none is set). */
  staff: (NamedRef & { grade?: string | null })[];
  prCategories: Record<string, string>;
  eventTypes: Record<string, string>;
  eventCategories: Record<string, string>;
  travelGrades: Record<string, string>;
  destinationClasses: Record<string, string>;
  travelPolicy: PolicyRate[];
  changeReasons: Record<string, string>;
  financeOn: boolean;
}

/* ------------------------------- travel ----------------------------- */

export type TripStatus = "draft" | "in_approval" | "approved" | "rejected" | "booked" | "completed" | "closed" | "cancelled";
export type TravelMode = "air" | "road" | "rail";
export type FlightClass = "economy" | "premium_economy" | "business";

/** One cell of the policy table: a grade travelling to a class of destination. */
export interface PolicyRate {
  /** Present on the desk's policy table (`GET /travel/policy`), not on `me/options`. */
  id?: string;
  grade: string;
  destinationClass: string;
  dtaDaily: number;
  hotelNightly: number;
  airportTaxi: number;
  flightClass: FlightClass | string;
}

/** One person's travel grade (`GET /travel/grades`); `onRecord` false means the default applies. */
export interface StaffGrade {
  userId: string;
  name: string;
  jobTitle: string | null;
  grade: string;
  onRecord: boolean;
}

export interface StaffGrades {
  grades: Record<string, string>;
  staff: StaffGrade[];
}

export interface TravelPolicyTable {
  grades: Record<string, string>;
  classes: Record<string, string>;
  rates: (PolicyRate & { id: string })[];
}

/** A row of a trip list (`OpsPresenter::trip`, not full). */
export interface TripSummary {
  id: string;
  number: string | null;
  purpose: string;
  destination: string;
  destinationClass: string;
  tripType: "local" | "international";
  departsOn: string;
  returnsOn: string;
  status: TripStatus;
  /** Advance plus the flights estimate. */
  estimate: number;
  /** DTA, hotel and taxi for every traveller: the advance Finance pays. */
  advance: number;
  overPolicy: boolean;
  requester: string | null;
  requesterId: string;
  project: ProjectRef | null;
  eventId: string | null;
  /** How many are travelling. */
  travellers: number;
  approvalId: string | null;
}

export interface TripTraveller {
  id: string;
  userId: string;
  name: string | null;
  grade: string;
  days: number;
  nights: number;
  dta: number;
  hotel: number;
  taxi: number;
  policyTotal: number;
  total: number;
}

export interface TripLeg {
  sequence: number;
  from: string;
  to: string;
  travelOn: string;
  mode: TravelMode;
}

export interface TripBooking {
  id: string;
  kind: "flight" | "hotel" | "ground";
  /** The traveller's user id. */
  travellerId: string | null;
  traveller: string | null;
  agency: string | null;
  reference: string | null;
  details: string | null;
  amount: number;
  status: "booked" | "changed" | "cancelled" | string;
}

export type ChangeStatus = "in_approval" | "approved" | "rejected" | "executed";

export interface TripChange {
  id: string;
  kind: "change" | "cancellation";
  reason: string;
  description: string;
  fee: number;
  status: ChangeStatus;
  bookingId: string | null;
  requestedBy: string | null;
  approvalId: string | null;
  executedAt: string | null;
}

/** A trip in full (`OpsPresenter::trip(..., true)`). */
export interface TripFull extends Omit<TripSummary, "travellers"> {
  flightsEstimate: number;
  justification: string | null;
  lateBookingReason: string | null;
  funds: FundsSnapshot | null;
  costCentreId: string | null;
  report: string | null;
  reportSubmittedAt: string | null;
  advanceMemo: MemoRef | null;
  advanceMemoId: string | null;
  travellers: TripTraveller[];
  legs: TripLeg[];
  bookings: TripBooking[];
  changes: TripChange[];
}

export interface TravellerInput {
  userId: string;
  /** Optional: the API uses the grade on record when it is left out. */
  grade?: string | null;
  /** The whole trip's DTA when it differs from policy; omit for policy. */
  dta?: number | null;
  /** The whole trip's hotel when it differs from policy; omit for policy. */
  hotel?: number | null;
}

export interface TripInput {
  purpose: string;
  projectId?: string | null;
  costCentreId?: string | null;
  destinationClass: string;
  destination: string;
  departsOn: string;
  returnsOn: string;
  flightsEstimate?: number;
  justification?: string | null;
  lateBookingReason?: string | null;
  legs?: { from: string; to: string; travelOn: string; mode?: TravelMode }[];
  travellers: TravellerInput[];
}

export interface ChangeInput {
  kind: "change" | "cancellation";
  reason: string;
  description: string;
  fee?: number;
  bookingId?: string | null;
}

export interface BookingInput {
  kind: "flight" | "hotel" | "ground";
  travellerId?: string | null;
  agencyId?: string | null;
  reference?: string | null;
  details?: string | null;
  amount?: number;
}

/** What changes cost (`TravelRequests::changeReport`). */
export interface ChangeReport {
  total: number;
  byReason: { reason: string; label: string; count: number; fees: number }[];
  byProject: { projectId: string | null; project: string; count: number; fees: number }[];
}

export interface TravelDeskMeta {
  toBook: number;
  changesToExecute: number;
  reportsDue: number;
  changes: ChangeReport;
  spendByProject: { project: ProjectRef | null; total: number; trips: number }[];
}

/* ------------------------------- events ----------------------------- */

export type EventStatus = "draft" | "in_approval" | "approved" | "rejected" | "closed" | "cancelled";
export type LineChannel = "vendor" | "travel" | "advance";

export interface EventSummary {
  id: string;
  number: string | null;
  name: string;
  type: string;
  typeLabel: string;
  status: EventStatus;
  startsOn: string;
  endsOn: string;
  location: string | null;
  project: ProjectRef | null;
  costCentreId: string | null;
  participantsInternal: number;
  participantsExternal: number;
  lead: string | null;
  leadId: string;
  budget: number;
  approvalId: string | null;
  objectives: string | null;
  attendance: number | null;
  outcomes: string | null;
  closedAt: string | null;
  funds: FundsSnapshot | null;
}

export interface EventLine {
  id: string;
  lineNo: number;
  category: string;
  description: string;
  amount: number;
  channel: LineChannel;
}

export interface LinkedDoc {
  id: string;
  number: string | null;
  status: string;
  amount: number;
}

export interface DashboardLine {
  id: string;
  lineNo: number;
  category: string;
  label: string;
  description: string;
  channel: LineChannel;
  budget: number;
  committed: number;
  paid: number;
  available: number;
  vendorRating: number | null;
  requests: LinkedDoc[];
  orders: LinkedDoc[];
  trips: LinkedDoc[];
}

export interface EventDashboard {
  lines: DashboardLine[];
  totals: { budget: number; committed: number; paid: number; participants: number };
  /** What still stops the event closing, in words. */
  blockers: string[];
}

export interface EventFull extends EventSummary {
  lines: EventLine[];
  /** Null while a draft. */
  dashboard: EventDashboard | null;
}

export interface EventLineInput {
  category: string;
  description?: string;
  amount: number;
  channel?: LineChannel;
}

export interface EventInput {
  name: string;
  type: string;
  projectId?: string | null;
  costCentreId?: string | null;
  startsOn: string;
  endsOn: string;
  location?: string | null;
  participantsInternal?: number;
  participantsExternal?: number;
  objectives?: string | null;
  lines: EventLineInput[];
}

export type GenerateWhat = "purchase_request" | "travel" | "advance";

export interface GenerateInput {
  what: GenerateWhat;
  amount?: number;
  /** Grade optional: the API uses each person's grade on record. */
  travellers?: { userId: string; grade?: string | null }[];
  destinationClass?: string;
  destination?: string;
  /** Where the trip starts; the organisation's city when left out. */
  origin?: string | null;
  /** How they travel; the API builds the outward leg the day before and the return the day after. */
  mode?: TravelMode | null;
}

export interface GenerateResult {
  kind: GenerateWhat;
  /** The PR's or trip's id; the advance memo's id (null when Finance is off). */
  id: string | null;
}

/* --------------------------- client payments ------------------------ */

export type PackStatus = "draft" | "in_approval" | "approved" | "rejected";

export interface ClientPaymentSummary {
  id: string;
  number: string | null;
  title: string;
  clientId: string;
  client: string | null;
  project: ProjectRef | null;
  amount: number;
  currency: string;
  stage: string;
  stageLabel: string;
  packStatus: PackStatus;
  accountManager: string | null;
  accountManagerId: string | null;
  nextFollowUpOn: string | null;
  followUpOverdue: boolean;
  expectedPaymentOn: string | null;
  submittedAt: string | null;
  paidAt: string | null;
  daysInStage: number;
  daysSinceSubmission: number | null;
  invoiceId: string | null;
  invoiceNo: string | null;
  approvalId: string | null;
}

export interface OpsAttachment {
  id: string;
  kind: string;
  name: string;
  mime: string | null;
  size: number;
  uploadedBy: string | null;
  uploadedAt: string | null;
}

export interface PackItem {
  id: string;
  label: string;
  mandatory: boolean;
  attachment: OpsAttachment | null;
}

export interface StageEntry {
  stage: string;
  label: string;
  contact: string | null;
  notes: string | null;
  nextFollowUpOn: string | null;
  by: string | null;
  enteredAt: string;
}

export interface ClientPaymentFull extends ClientPaymentSummary {
  items: PackItem[];
  history: StageEntry[];
  stages: Record<string, string>;
}

export interface ClientPaymentsMeta {
  totals: { open: number; value: number; overdueFollowUps: number; queried: number };
  byStage: { stage: string; label: string; count: number; value: number }[];
  ageing: { d30: number; d60: number; d90: number; over90: number; notSubmitted: number };
  stages: Record<string, string>;
}

export interface PaymentSources {
  invoices: {
    id: string;
    invoiceNo: string;
    clientId: string;
    client: string;
    projectId: string | null;
    total: number;
    date: string;
    milestoneId: string | null;
  }[];
  clients: NamedRef[];
  staff: NamedRef[];
}

export interface ClientPaymentInput {
  clientId: string;
  title: string;
  amount: number;
  projectId?: string | null;
  invoiceId?: string | null;
  milestoneId?: string | null;
  accountManagerId?: string | null;
  expectedPaymentOn?: string | null;
  nextFollowUpOn?: string | null;
}

export interface StageInput {
  stage: string;
  contact?: string | null;
  notes?: string | null;
  nextFollowUpOn?: string | null;
}

export interface ChecklistRow {
  label: string;
  mandatory: boolean;
  /** False while the client uses the organisation's default list. */
  own?: boolean;
}

/* ------------------------------- client ----------------------------- */

const listOf = <T>(p: Promise<{ data: T[] }>) => unwrap(p);

export const travel = {
  /** The pickers and the policy every staff form reads. */
  options: () => unwrap(opsRequest<{ data: OpsOptions }>("me/options")),

  /** Staff self-service: trips I raised or travel on. */
  me: {
    list: () => listOf(opsRequest<{ data: TripSummary[] }>("me/trips")),
    get: (id: string) => unwrap(opsRequest<{ data: TripFull }>(`me/trips/${enc(id)}`)),
    create: (input: TripInput) => unwrap(opsRequest<{ data: TripFull }>("me/trips", { method: "POST", body: input })),
    update: (id: string, input: Partial<TripInput>) => unwrap(opsRequest<{ data: TripFull }>(`me/trips/${enc(id)}`, { method: "PATCH", body: input })),
    /** Into approval. The override reason is for sending beyond the project's funds (MD or delegate). */
    submit: (id: string, overrideReason?: string | null) =>
      unwrap(opsRequest<{ data: TripFull }>(`me/trips/${enc(id)}/submit`, { method: "POST", body: overrideReason ? { overrideReason } : {} })),
    requestChange: (id: string, input: ChangeInput) => unwrap(opsRequest<{ data: TripFull }>(`me/trips/${enc(id)}/changes`, { method: "POST", body: input })),
    report: (id: string, report: string) => unwrap(opsRequest<{ data: TripFull }>(`me/trips/${enc(id)}/report`, { method: "POST", body: { report } })),
  },

  /** The travel desk. */
  desk: {
    list: (status?: string) =>
      opsRequest<{ data: TripSummary[]; meta: TravelDeskMeta }>("travel", { query: { status } }).then((r) => ({ trips: r.data, meta: r.meta })),
    get: (id: string) => unwrap(opsRequest<{ data: TripFull }>(`travel/${enc(id)}`)),
    book: (id: string, input: BookingInput) => unwrap(opsRequest<{ data: TripFull }>(`travel/${enc(id)}/bookings`, { method: "POST", body: input })),
    /** The agency has done an approved change; returns the trip. */
    executeChange: (changeId: string) => unwrap(opsRequest<{ data: TripFull }>(`travel-changes/${enc(changeId)}/execute`, { method: "POST" })),
    policy: () => unwrap(opsRequest<{ data: TravelPolicyTable }>("travel/policy")),
    updateRate: (rateId: string, input: Partial<Pick<PolicyRate, "dtaDaily" | "hotelNightly" | "airportTaxi" | "flightClass">>) =>
      unwrap(opsRequest<{ data: { id: string } }>(`travel/policy/${enc(rateId)}`, { method: "PATCH", body: input })),
    /** Everybody's travel grade, and the grades there are. */
    grades: () => unwrap(opsRequest<{ data: StaffGrades }>("travel/grades")),
    /** Put a grade on somebody's record; returns everybody's again. */
    setGrade: (userId: string, grade: string) => unwrap(opsRequest<{ data: StaffGrades }>(`travel/grades/${enc(userId)}`, { method: "PUT", body: { grade } })),
  },
};

export const events = {
  /** Events I lead or created. */
  me: {
    list: () => listOf(opsRequest<{ data: EventSummary[] }>("me/events")),
    get: (id: string) => unwrap(opsRequest<{ data: EventFull }>(`me/events/${enc(id)}`)),
    create: (input: EventInput) => unwrap(opsRequest<{ data: EventFull }>("me/events", { method: "POST", body: input })),
    update: (id: string, input: Partial<EventInput>) => unwrap(opsRequest<{ data: EventFull }>(`me/events/${enc(id)}`, { method: "PATCH", body: input })),
    submit: (id: string, overrideReason?: string | null) =>
      unwrap(opsRequest<{ data: EventFull }>(`me/events/${enc(id)}/submit`, { method: "POST", body: overrideReason ? { overrideReason } : {} })),
    /** A draft PR, a draft trip or an advance, funded from one budget line. */
    generate: (id: string, lineId: string, input: GenerateInput) =>
      unwrap(opsRequest<{ data: GenerateResult }>(`me/events/${enc(id)}/lines/${enc(lineId)}/generate`, { method: "POST", body: input })),
    close: (id: string, attendance: number, outcomes: string) =>
      unwrap(opsRequest<{ data: EventFull }>(`me/events/${enc(id)}/close`, { method: "POST", body: { attendance, outcomes } })),
  },

  /** Every event, for the desk (drafts excluded). */
  desk: {
    list: () =>
      opsRequest<{ data: EventSummary[]; meta: { types: Record<string, string>; categories: Record<string, string> } }>("events").then((r) => ({
        events: r.data,
        meta: r.meta,
      })),
    get: (id: string) => unwrap(opsRequest<{ data: EventFull }>(`events/${enc(id)}`)),
  },
};

export const clientPayments = {
  list: (filters: { stage?: string; client?: string } = {}) =>
    opsRequest<{ data: ClientPaymentSummary[]; meta: ClientPaymentsMeta }>("client-payments", { query: filters }).then((r) => ({ requests: r.data, meta: r.meta })),
  /** Issued invoices not yet in a request, the clients and the staff. */
  sources: () => unwrap(opsRequest<{ data: PaymentSources }>("client-payments/sources")),
  create: (input: ClientPaymentInput) => unwrap(opsRequest<{ data: ClientPaymentFull }>("client-payments", { method: "POST", body: input })),
  get: (id: string) => unwrap(opsRequest<{ data: ClientPaymentFull }>(`client-payments/${enc(id)}`)),
  /** The document for one checklist item; replaces any earlier one. */
  attach: (id: string, itemId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return unwrap(opsUpload<{ data: ClientPaymentFull }>(`client-payments/${enc(id)}/items/${enc(itemId)}`, form));
  },
  submitPack: (id: string) => unwrap(opsRequest<{ data: ClientPaymentFull }>(`client-payments/${enc(id)}/submit`, { method: "POST" })),
  move: (id: string, input: StageInput) => unwrap(opsRequest<{ data: ClientPaymentFull }>(`client-payments/${enc(id)}/stage`, { method: "POST", body: input })),
  checklist: (clientId: string) => listOf(opsRequest<{ data: ChecklistRow[] }>(`clients/${enc(clientId)}/checklist`)),
  saveChecklist: (clientId: string, items: { label: string; mandatory: boolean }[]) =>
    listOf(opsRequest<{ data: ChecklistRow[] }>(`clients/${enc(clientId)}/checklist`, { method: "PUT", body: { items } })),
};

/** A stored file; the proxy streams it. */
export const attachmentHref = (id: string) => `/api/operations/attachments/${enc(id)}`;

/* ------------------------------- errors ----------------------------- */

const CODE = /^[A-Z][A-Z0-9_]{3,}:\s*/;

/** An API refusal in plain words, any machine code taken off. */
export function opsError(e: unknown, fallback = "Something went wrong."): string {
  return (errorText(e) || fallback).replace(CODE, "");
}

/** `cost_centre_id` → `costCentreId`; `travellers.0.user_id` → `travellers.0.userId`. */
export const camelKey = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/**
 * Field → first message. The controllers validate camelCase keys and the
 * services throw snake_case ones; both come back camelCase so a form looks a
 * field up one way.
 */
export function opsFieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || !e.errors) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.errors)) {
    const first = Array.isArray(v) ? v[0] : v;
    if (typeof first === "string") out[camelKey(k)] = first.replace(CODE, "");
  }
  return out;
}

/** Every message under one key (the event's close-out refusal lists each blocker). */
export function opsMessages(e: unknown, key: string): string[] {
  if (!(e instanceof ApiError) || !e.errors) return [];
  const v = e.errors[key];
  return (Array.isArray(v) ? v : v ? [v] : []).filter((x): x is string => typeof x === "string");
}

/** The project funds check refused (`funds`): the MD or a delegate may send it with a reason. */
export function isFundsRefusal(e: unknown): boolean {
  return e instanceof ApiError && Boolean(e.errors && "funds" in e.errors);
}
