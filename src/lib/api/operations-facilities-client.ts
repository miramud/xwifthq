/* ------------------------------------------------------------------ */
/*  XwiftHQ Admin & Operations › facilities (PRD §13.1–§13.4). Sites  */
/*  and rooms, room bookings, visitors, leases and rent, service      */
/*  contracts with their monthly confirmations, utility accounts and  */
/*  bills, the diesel log and the spend reports. Shapes follow        */
/*  `FacilityController` and `Facilities` in api-lms. Money is        */
/*  integer kobo; dates `YYYY-MM-DD`, months `YYYY-MM`, instants ISO. */
/* ------------------------------------------------------------------ */

import { opsRequest, unwrap } from "./operations-request";
import { ApiError, errorText, opsError, opsFieldErrors, type MemoRef } from "./operations-travel-client";

export { ApiError, errorText, opsError, opsFieldErrors };

const enc = encodeURIComponent;

/* ------------------------------- types ------------------------------- */

export type Ownership = "owned" | "leased";
export type SpaceKind = "meeting_room" | "office" | "lab" | "store" | "hall" | "other";
export type LeaseFrequency = "monthly" | "quarterly" | "biannual" | "annual";
export type ContractFrequency = "monthly" | "quarterly";
export type ConfirmationStatus = "confirmed" | "disputed";
export type DieselKind = "diesel_in" | "diesel_used";
export type PaidVia = "card" | "advance" | "po" | "cash";

export interface Facility {
  id: string;
  code: string;
  name: string;
  /** campus, office, site, warehouse (`Facility::KINDS`). */
  kind: string;
  address: string | null;
  ownership: Ownership;
  areaSqm: number | null;
  headcount: number | null;
  /** The diesel tank's capacity in litres; null when not set. */
  tankLitres: number | null;
  managerId: string | null;
  manager: string | null;
  costCentreId: string | null;
  active: boolean;
}

/** A site on the list: its room count, diesel in the tank and the active lease's end. */
export interface FacilityRow extends Facility {
  spaces: number;
  /** Litres in the tank by the log. */
  tank: number;
  lease: { endsOn: string; nextDueOn: string | null } | null;
}

export interface SpendMonth {
  month: string;
  /** Kobo by utility kind; `diesel` is always there. */
  byKind: Record<string, number>;
  total: number;
  /** Total over headcount; null when the site has no headcount. */
  perHead: number | null;
}

export interface SpendFacility {
  facilityId: string;
  name: string;
  headcount: number | null;
  months: SpendMonth[];
}

export interface Spend {
  months: string[];
  facilities: SpendFacility[];
}

export interface FacilitiesBoard {
  facilities: FacilityRow[];
  kinds: Record<string, string>;
  spend: Spend;
}

export interface Space {
  id: string;
  name: string;
  kind: SpaceKind;
  capacity: number | null;
  bookable: boolean;
}

export interface LeasePayment {
  dueOn: string;
  amount: number;
  memoId: string | null;
  memo: MemoRef | null;
}

export interface Lease {
  id: string;
  facilityId: string;
  facility: string | null;
  landlordId: string | null;
  landlord: string | null;
  reference: string | null;
  startsOn: string;
  endsOn: string;
  /** Per instalment, kobo. */
  rent: number;
  frequency: LeaseFrequency;
  serviceCharge: number;
  /** Escalation in basis points (500 = 5%). */
  escalationBp: number;
  escalationEveryMonths: number | null;
  noticeDays: number | null;
  nextDueOn: string | null;
  /** The next instalment with escalation applied (rent + service charge). */
  nextAmount: number | null;
  memoLeadDays: number | null;
  status: "active" | "ended";
  /** Negative once it has ended. */
  daysLeft: number;
  documentId: string | null;
  notes: string | null;
  payments: LeasePayment[];
}

export interface UtilityBill {
  month: string;
  amount: number;
  units: number | null;
  reference: string | null;
}

export interface UtilityAccount {
  id: string;
  facilityId: string;
  kind: string;
  kindLabel: string;
  providerId: string | null;
  provider: string | null;
  accountNo: string | null;
  billing: "prepaid" | "postpaid";
  unit: string | null;
  active: boolean;
  bills: UtilityBill[];
}

export interface Contract {
  id: string;
  service: string;
  serviceLabel: string;
  vendorId: string;
  vendor: string | null;
  facilityId: string | null;
  reference: string | null;
  startsOn: string;
  endsOn: string;
  value: number | null;
  periodAmount: number | null;
  frequency: ContractFrequency;
  status: "active" | "ended" | "terminated";
  daysLeft: number;
  officerId: string | null;
  officer: string | null;
}

export interface Confirmation {
  period: string;
  status: ConfirmationStatus;
  rating: number | null;
  notes: string | null;
  amount: number | null;
  memoId: string | null;
  by: string | null;
}

/** A contract with its confirmations (the contracts list and every reply to a change). */
export interface ContractFull extends Contract {
  facility: string | null;
  scope: string | null;
  sla: string | null;
  renewalNoticeDays: number | null;
  costCentreId: string | null;
  /** Average of the ratings given; null when none. */
  rating: number | null;
  confirmations: Confirmation[];
  /** Months that have run and are not yet confirmed, newest first (the last six). */
  toConfirm: string[];
}

export interface DieselEntry {
  id: string;
  kind: DieselKind;
  enteredOn: string;
  litres: number;
  amount: number;
  /** Running hours at the time, for a generator. */
  reading: number | null;
  /** The generator's tag. */
  generator: string | null;
}

export interface Generator {
  id: string;
  tagNo: string | null;
  name: string | null;
}

export interface FacilityDetail extends Facility {
  spaces: Space[];
  leases: Lease[];
  utilities: UtilityAccount[];
  /** Short contract rows (no confirmations). */
  contracts: Contract[];
  tank: number;
  /** Newest first, the last sixty. */
  diesel: DieselEntry[];
  generators: Generator[];
}

export interface RoomBooking {
  id: string;
  title: string;
  spaceId: string;
  space: string | null;
  startsAt: string;
  endsAt: string;
  bookedBy: string | null;
  attendees: number | null;
}

export interface Visitor {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  purpose: string | null;
  host: string | null;
  hostId: string | null;
  facilityId: string | null;
  expectedAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  badgeNo: string | null;
  email?: string | null;
  /** Site name, when one was chosen. */
  site?: string | null;
  /** The end of the window they are expected in. */
  expectedUntil?: string | null;
  partySize?: number;
  vehiclePlate?: string | null;
  notes?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  /** Registered by the host themselves, ahead of time. */
  preRegistered?: boolean;
  registeredBy?: string | null;
  status?: VisitStatus;
}

/** expected (not arrived yet) · on_site · left · cancelled · missed (the day passed). */
export type VisitStatus = "expected" | "on_site" | "left" | "cancelled" | "missed";

export interface GeneratorMonth {
  month: string;
  litres: number;
  hours: number;
  perHour: number | null;
  /** Over 130% of the generator's other months. */
  flag: boolean;
}

export interface GeneratorReport {
  assetId: string;
  tagNo: string | null;
  name: string | null;
  averagePerHour: number | null;
  months: GeneratorMonth[];
}

export interface FacilityReports {
  spend: Spend;
  generators: GeneratorReport[];
}

/* ------------------------------- inputs ------------------------------ */

export interface FacilityInput {
  code?: string;
  name?: string;
  kind?: string;
  address?: string | null;
  ownership?: Ownership;
  areaSqm?: number | null;
  headcount?: number | null;
  tankLitres?: number | null;
  managerId?: string | null;
  costCentreId?: string | null;
  active?: boolean;
}

export interface SpaceInput {
  name?: string;
  kind?: SpaceKind;
  capacity?: number | null;
  bookable?: boolean;
}

export interface VisitorInput {
  name: string;
  company?: string | null;
  phone?: string | null;
  purpose?: string | null;
  hostId?: string | null;
  facilityId?: string | null;
  expectedAt?: string | null;
  expectedUntil?: string | null;
  email?: string | null;
  partySize?: number;
  vehiclePlate?: string | null;
  notes?: string | null;
}

export interface LeaseInput {
  facilityId?: string;
  landlordId?: string | null;
  reference?: string | null;
  startsOn?: string;
  endsOn?: string;
  rent?: number;
  frequency?: LeaseFrequency;
  serviceCharge?: number;
  escalationBp?: number;
  escalationEveryMonths?: number;
  noticeDays?: number;
  memoLeadDays?: number;
  documentId?: string | null;
  notes?: string | null;
  status?: "active" | "ended";
}

export interface ContractInput {
  facilityId?: string | null;
  vendorId?: string;
  service?: string;
  reference?: string | null;
  scope?: string | null;
  sla?: string | null;
  startsOn?: string;
  endsOn?: string;
  value?: number;
  periodAmount?: number;
  frequency?: ContractFrequency;
  renewalNoticeDays?: number;
  costCentreId?: string | null;
  officerId?: string | null;
  status?: "active" | "ended" | "terminated";
}

export interface ConfirmInput {
  /** `YYYY-MM`. */
  period: string;
  confirmed: boolean;
  rating?: number | null;
  /** Required when disputed: what was not delivered. */
  notes?: string | null;
}

export interface UtilityInput {
  facilityId?: string;
  kind?: string;
  providerId?: string | null;
  accountNo?: string | null;
  billing?: "prepaid" | "postpaid";
  unit?: string | null;
  active?: boolean;
}

export interface BillInput {
  month: string;
  amount: number;
  units?: number | null;
  reference?: string | null;
}

export interface DieselInput {
  kind: DieselKind;
  facilityId: string;
  /** The generator, for diesel used. */
  assetId?: string | null;
  litres: number;
  amount?: number;
  vendorId?: string | null;
  paidVia?: PaidVia | null;
  /** The generator's running hours. */
  reading?: number | null;
  enteredOn?: string;
}

/** What the forms pick from (`GET me/options`): the slice facilities and the desk read. */
export interface OpsPickers {
  staff: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  projects: { id: string; name: string; code: string | null }[];
  costCentres: { id: string; code: string; name: string }[];
}

/* ------------------------------ helpers ------------------------------ */

/** Generators come straight off the table (`tag_no`); one spelling here. */
export function normaliseGenerators(raw: unknown): Generator[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((g: Record<string, unknown>) => ({
    id: String(g.id ?? ""),
    tagNo: (typeof g.tagNo === "string" ? g.tagNo : typeof g.tag_no === "string" ? g.tag_no : null) as string | null,
    name: typeof g.name === "string" ? g.name : null,
  }));
}

const withGenerators = (d: FacilityDetail): FacilityDetail => ({ ...d, generators: normaliseGenerators(d.generators) });

/* ------------------------------- client ------------------------------ */

export const facilities = {
  /** Every site with its rooms, tank and lease; the kinds and six months of spend. */
  list: () =>
    opsRequest<{ data: FacilityRow[]; meta: { kinds: Record<string, string>; spend: Spend } }>("facilities").then(
      (r): FacilitiesBoard => ({ facilities: r.data, kinds: r.meta?.kinds ?? {}, spend: r.meta?.spend ?? { months: [], facilities: [] } }),
    ),
  get: (id: string) => unwrap(opsRequest<{ data: FacilityDetail }>(`facilities/${enc(id)}`)).then(withGenerators),
  create: (input: FacilityInput) => unwrap(opsRequest<{ data: Facility }>("facilities", { method: "POST", body: input })),
  update: (id: string, input: FacilityInput) => unwrap(opsRequest<{ data: Facility }>(`facilities/${enc(id)}`, { method: "PATCH", body: input })),

  addSpace: (facilityId: string, input: SpaceInput) => unwrap(opsRequest<{ data: { id: string } }>(`facilities/${enc(facilityId)}/spaces`, { method: "POST", body: input })),
  updateSpace: (spaceId: string, input: SpaceInput) => unwrap(opsRequest<{ data: { id: string } }>(`facilities/spaces/${enc(spaceId)}`, { method: "PATCH", body: input })),

  /** Every room booking overlapping the window. */
  bookings: (range: { from?: string; to?: string } = {}) => unwrap(opsRequest<{ data: RoomBooking[] }>("facilities/bookings", { query: { ...range } })),

  /** Expected on the day, checked in on it, and anyone still in the building. */
  visitors: (on?: string) => unwrap(opsRequest<{ data: Visitor[] }>("facilities/visitors", { query: { on } })),
  registerVisitor: (input: VisitorInput) => unwrap(opsRequest<{ data: Visitor }>("facilities/visitors", { method: "POST", body: input })),
  checkIn: (id: string, badgeNo?: string | null) =>
    unwrap(opsRequest<{ data: Visitor }>(`facilities/visitors/${enc(id)}/check-in`, { method: "POST", body: badgeNo ? { badgeNo } : {} })),
  /** Reception changes an expected visit (not yet arrived, not cancelled); may move it to another host. */
  updateVisitor: (id: string, patch: Partial<VisitorInput>) =>
    unwrap(opsRequest<{ data: Visitor }>(`facilities/visitors/${enc(id)}`, { method: "PATCH", body: patch })),
  checkOut: (id: string) => unwrap(opsRequest<{ data: Visitor }>(`facilities/visitors/${enc(id)}/check-out`, { method: "POST", body: {} })),
  cancelVisitor: (id: string, reason?: string | null) =>
    unwrap(opsRequest<{ data: Visitor }>(`facilities/visitors/${enc(id)}/cancel`, { method: "POST", body: reason ? { reason } : {} })),
  /** A printable visitor badge (PDF). */
  badgeUrl: (id: string) => `/api/operations/facilities/visitors/${enc(id)}/badge`,

  leases: () => unwrap(opsRequest<{ data: Lease[] }>("facilities/leases")),
  createLease: (input: LeaseInput) => unwrap(opsRequest<{ data: Lease }>("facilities/leases", { method: "POST", body: input })),
  updateLease: (id: string, input: LeaseInput) => unwrap(opsRequest<{ data: Lease }>(`facilities/leases/${enc(id)}`, { method: "PATCH", body: input })),

  contracts: () =>
    opsRequest<{ data: ContractFull[]; meta: { services: Record<string, string> } }>("facilities/contracts").then((r) => ({ contracts: r.data, services: r.meta?.services ?? {} })),
  createContract: (input: ContractInput) => unwrap(opsRequest<{ data: ContractFull }>("facilities/contracts", { method: "POST", body: input })),
  updateContract: (id: string, input: ContractInput) => unwrap(opsRequest<{ data: ContractFull }>(`facilities/contracts/${enc(id)}`, { method: "PATCH", body: input })),
  /** Confirming raises the month's payment memo; a dispute pays nothing and needs notes. */
  confirm: (id: string, input: ConfirmInput) => unwrap(opsRequest<{ data: ContractFull }>(`facilities/contracts/${enc(id)}/confirm`, { method: "POST", body: input })),

  createUtility: (input: UtilityInput) => unwrap(opsRequest<{ data: UtilityAccount }>("facilities/utilities", { method: "POST", body: input })),
  updateUtility: (id: string, input: UtilityInput) => unwrap(opsRequest<{ data: UtilityAccount }>(`facilities/utilities/${enc(id)}`, { method: "PATCH", body: input })),
  /** A month's bill; entering the same month again replaces it. */
  addBill: (utilityId: string, input: BillInput) => unwrap(opsRequest<{ data: UtilityAccount }>(`facilities/utilities/${enc(utilityId)}/bills`, { method: "POST", body: input })),

  /** Diesel into the tank, or used by a generator; replies with the tank after it. */
  diesel: (input: DieselInput) => unwrap(opsRequest<{ data: { id: string; tank: number } }>("facilities/diesel", { method: "POST", body: input })),

  /** Twelve months of spend per site, and each generator's litres per hour. */
  reports: () => unwrap(opsRequest<{ data: FacilityReports }>("facilities/reports")),

  /** Staff, vendors, projects and cost centres for the pickers. */
  options: () => unwrap(opsRequest<{ data: OpsPickers }>("me/options")),
};

/* ------------------------- my visitors (self-service) ------------------------- */

/** A host's own expected visitors: register, follow, cancel. */
export const myVisitors = {
  list: () => unwrap(opsRequest<{ data: { visitors: Visitor[]; sites: { id: string; name: string }[] } }>("me/visitors")),
  register: (input: Omit<VisitorInput, "hostId"> & { expectedAt: string }) => unwrap(opsRequest<{ data: Visitor }>("me/visitors", { method: "POST", body: input })),
  /** Change an expected visit: only before they arrive, never to a day already past. */
  update: (id: string, patch: Partial<Omit<VisitorInput, "hostId">>) => unwrap(opsRequest<{ data: Visitor }>(`me/visitors/${enc(id)}`, { method: "PATCH", body: patch })),
  cancel: (id: string, reason?: string | null) => unwrap(opsRequest<{ data: Visitor }>(`me/visitors/${enc(id)}/cancel`, { method: "POST", body: reason ? { reason } : {} })),
};
