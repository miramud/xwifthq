/* ------------------------------------------------------------------ */
/*  Elevate Admin & Operations › fleet. Vehicles and their papers,     */
/*  the trip log, fuel and efficiency, pool bookings, and each         */
/*  vehicle's maintenance and incidents. Shapes follow                 */
/*  `FleetController` and `Services/Fleet/Fleet.php` in api-lms.       */
/*  Money is integer kobo; dates `YYYY-MM-DD`, instants ISO 8601.      */
/* ------------------------------------------------------------------ */

import { ApiError, errorText, opsRequest, unwrap } from "./operations-request";
import { opsError, opsFieldErrors } from "./operations-travel-client";
import type { ClaimKind, ClaimStatus, WorkOrderKind, WorkOrderStatus } from "./operations-maintenance-client";

export { ApiError, errorText, opsError, opsFieldErrors };

const enc = encodeURIComponent;

export type PaperKind = "licence" | "roadworthiness" | "insurance" | "hackney";
export type PaperState = "valid" | "expiring" | "expired" | "missing";
export type FuelType = "petrol" | "diesel" | "electric" | "hybrid";
export type PaidVia = "card" | "advance" | "po" | "cash";
export type BookingStatus = "requested" | "approved" | "declined";

/** Each paper is an obligation in the compliance register; it is renewed there. */
export interface VehiclePaper {
  kind: PaperKind | string;
  label: string;
  obligationId: string;
  /** The open renewal, if one is raised: `/suite/operations/compliance/{occurrenceId}`. */
  occurrenceId: string | null;
  expiresOn: string | null;
  reference: string | null;
  state: PaperState;
}

export interface Vehicle {
  id: string;
  assetId: string;
  tagNo: string | null;
  name: string | null;
  assetStatus: string | null;
  registrationNo: string;
  chassisNo: string | null;
  engineNo: string | null;
  driverId: string | null;
  driver: string | null;
  /** Pool vehicles are booked; others are assigned to a driver. */
  pool: boolean;
  fuelType: FuelType;
  expectedKmPerLitre: number | null;
  odometer: number;
}

export interface VehicleRow extends Vehicle {
  papers: VehiclePaper[];
}

export interface EfficiencyMonth {
  month: string;
  km: number;
  litres: number;
  cost: number;
  kmPerLitre: number | null;
  /** Below 75% of the expected figure. */
  flag: boolean;
}

export interface VehicleEfficiency {
  vehicleId: string;
  registrationNo: string;
  name: string | null;
  /** The vehicle's expected km per litre, or its own average. */
  expected: number | null;
  months: EfficiencyMonth[];
}

export interface PoolBooking {
  id: string;
  vehicleId: string;
  registrationNo: string | null;
  purpose: string;
  destination: string | null;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  requestedBy: string | null;
  driver: string | null;
}

export interface FleetBoard {
  vehicles: VehicleRow[];
  /** Six months per vehicle. */
  efficiency: VehicleEfficiency[];
  /** Requested and approved, this week to three weeks out. */
  bookings: PoolBooking[];
  /** Vehicles on the asset register (category VEH) not set up in the fleet yet. */
  unregistered: { id: string; tagNo: string | null; name: string }[];
  papers: Record<PaperKind, string>;
}

export interface Trip {
  id: string;
  tripOn: string;
  driver: string | null;
  purpose: string;
  project: { id: string; name: string; code: string | null } | null;
  origin: string | null;
  destination: string | null;
  startOdometer: number;
  endOdometer: number;
  km: number;
}

export interface FuelEntry {
  id: string;
  enteredOn: string;
  litres: number;
  amount: number;
  paidVia: PaidVia | null;
  reading: number | null;
}

export interface VehicleFull extends VehicleRow {
  trips: Trip[];
  fuel: FuelEntry[];
  workOrders: { id: string; number: string | null; title: string; kind: WorkOrderKind; status: WorkOrderStatus; cost: number; createdAt: string | null }[];
  incidents: { id: string; kind: ClaimKind; incidentOn: string | null; status: ClaimStatus; amountClaimed: number; amountSettled: number | null }[];
  /** Twelve months. */
  efficiency: VehicleEfficiency | null;
}

export interface VehicleInput {
  assetId?: string;
  registrationNo?: string;
  chassisNo?: string | null;
  engineNo?: string | null;
  driverId?: string | null;
  pool?: boolean;
  fuelType?: FuelType;
  expectedKmPerLitre?: number | null;
  odometer?: number;
  /** Only on create: the papers to track (licence, roadworthiness and insurance by default). */
  papers?: PaperKind[];
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
  driverId?: string | null;
}

export interface FuelInput {
  litres: number;
  amount?: number;
  vendorId?: string | null;
  paidVia?: PaidVia | null;
  reading?: number | null;
  enteredOn?: string;
}

/** What the fleet forms pick from (`GET me/options`). */
export interface FleetOptions {
  staff: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  projects: { id: string; name: string; code: string | null; status: string | null }[];
  costCentres: { id: string; code: string; name: string }[];
}

type RawAsset = { id: string; name: string; tag_no?: string | null; tagNo?: string | null };

export const fleet = {
  /** The API sends `unregistered` as raw rows (`tag_no`); read either spelling. */
  board: () =>
    opsRequest<{ data: Omit<FleetBoard, "papers" | "unregistered"> & { unregistered: RawAsset[] }; meta: { papers: Record<PaperKind, string> } }>("fleet").then((r) => ({
      ...r.data,
      unregistered: (r.data.unregistered ?? []).map((a) => ({ id: a.id, tagNo: a.tagNo ?? a.tag_no ?? null, name: a.name })),
      papers: r.meta.papers,
    })),
  get: (id: string) => unwrap(opsRequest<{ data: VehicleFull }>(`fleet/${enc(id)}`)),
  create: (input: VehicleInput) => unwrap(opsRequest<{ data: Vehicle }>("fleet", { method: "POST", body: input })),
  update: (id: string, input: VehicleInput) => unwrap(opsRequest<{ data: Vehicle }>(`fleet/${enc(id)}`, { method: "PATCH", body: input })),
  /** Track another paper; returns every paper. */
  addPaper: (id: string, kind: PaperKind) => unwrap(opsRequest<{ data: VehiclePaper[] }>(`fleet/${enc(id)}/papers`, { method: "POST", body: { kind } })),
  addTrip: (id: string, input: TripInput) => unwrap(opsRequest<{ data: { id: string; odometer: number } }>(`fleet/${enc(id)}/trips`, { method: "POST", body: input })),
  addFuel: (id: string, input: FuelInput) => unwrap(opsRequest<{ data: { id: string } }>(`fleet/${enc(id)}/fuel`, { method: "POST", body: input })),
  decide: (bookingId: string, approve: boolean, driverId?: string | null) =>
    unwrap(opsRequest<{ data: PoolBooking }>(`fleet/bookings/${enc(bookingId)}/decide`, { method: "POST", body: driverId ? { approve, driverId } : { approve } })),
  options: () => unwrap(opsRequest<{ data: FleetOptions }>("me/options")),
};
