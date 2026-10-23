import { describe, expect, it } from "vitest";
import type { TripSummary, EventSummary } from "@/lib/api/operations-travel-client";
import type { VehicleRow } from "@/lib/api/operations-fleet-client";
import type { Obligation, Occurrence } from "@/lib/api/operations-compliance-client";
import { tripRows } from "./travel/TravelDeskBoard";
import { eventRows } from "./events/EventsDesk";
import { vehicleRows } from "./fleet/FleetBoard";
import { obligationRows } from "./compliance/ComplianceDesk";

/** The rows each Operations register hands to "Download CSV": money in major units with a currency, dates ISO, labels readable. */

describe("Operations CSV rows", () => {
  it("travel desk: one row per trip, estimate and advance in naira", () => {
    const t = {
      id: "t1", number: "TRV-0001", purpose: "Client workshop", destination: "Abuja", destinationClass: "a", tripType: "local", departsOn: "2026-10-12", returnsOn: "2026-10-14",
      status: "approved", estimate: 45000000, advance: 30000000, overPolicy: true, requester: "Ngozi Eze", requesterId: "u1", project: { id: "p1", name: "Tax reform", code: "TR" }, eventId: null, travellers: 2, approvalId: null,
    } as unknown as TripSummary;
    const rows = tripRows([t]);
    expect(rows[0]).toContain("Estimate");
    expect(rows[1]).toEqual(["TRV-0001", "Abuja", "Local", "Client workshop", "Ngozi Eze", 2, "2026-10-12", "2026-10-14", "Tax reform", expect.any(String), "Yes", "300000.00", "450000.00", "NGN"]);
  });

  it("events: budget in naira, attendance and close date", () => {
    const e = {
      id: "e1", number: "EVT-0003", name: "Staff retreat", type: "retreat", typeLabel: "Retreat", status: "closed", startsOn: "2026-09-01", endsOn: "2026-09-02", location: "Lekki", project: null, costCentreId: "c1",
      participantsInternal: 30, participantsExternal: 2, lead: "Bisi", leadId: "u2", budget: 120000000, approvalId: null, objectives: null, attendance: 31, outcomes: null, closedAt: "2026-09-05T10:00:00Z", funds: null,
    } as unknown as EventSummary;
    const rows = eventRows([e]);
    expect(rows[1]).toEqual(["EVT-0003", "Staff retreat", "Retreat", "2026-09-01", "2026-09-02", "Lekki", "Cost centre", "Bisi", expect.any(String), 30, 2, 31, "1200000.00", "NGN", "2026-09-05"]);
  });

  it("fleet: a column pair per paper, blank where a vehicle lacks it", () => {
    const v = (id: string, papers: VehicleRow["papers"]) =>
      ({ id, assetId: "a", tagNo: "VEH-1", name: "Hilux", assetStatus: "in_use", registrationNo: `LAG-${id}`, chassisNo: null, engineNo: null, driverId: null, driver: "Musa", pool: true, fuelType: "diesel", expectedKmPerLitre: 9, odometer: 12000, papers }) as VehicleRow;
    const rows = vehicleRows([
      v("1", [{ kind: "insurance", label: "Insurance", obligationId: "o1", occurrenceId: null, expiresOn: "2027-01-01", reference: null, state: "valid" }]),
      v("2", []),
    ]);
    expect(rows[0].slice(-2)).toEqual(["Insurance expires", "Insurance state"]);
    expect(rows[1].slice(-2)).toEqual(["2027-01-01", expect.any(String)]);
    expect(rows[2].slice(-2)).toEqual(["", ""]);
    expect(rows[1]).toContain("Diesel");
  });

  it("compliance: the obligation with its next open deadline and fee", () => {
    const o = {
      id: "o1", key: null, name: "PAYE remittance", authority: "LIRS", category: "tax", categoryLabel: "Tax", ownerRole: "Finance", ownerId: null, owner: null, frequency: "monthly", dueRule: null,
      reminderDays: [7, 1], evidenceRequired: "Receipt", isCertificate: false, mandatory: true, bidPack: false, needsPayment: true, typicalFee: 5000000, counterpartyId: null, costCentreId: null, active: true,
    } as Obligation;
    const next = new Map([["o1", { id: "oc1", obligationId: "o1", period: "September 2026", dueOn: "2026-10-10", stage: "upcoming" } as unknown as Occurrence]]);
    const rows = obligationRows([o], next, { monthly: "Monthly" });
    expect(rows[1].slice(0, 8)).toEqual(["PAYE remittance", "LIRS", "Tax", "Finance", "Monthly", expect.any(String), "2026-10-10", "September 2026"]);
    expect(rows[1]).toContain("50000.00");
    expect(rows[1]).toContain("7 1");
  });
});
