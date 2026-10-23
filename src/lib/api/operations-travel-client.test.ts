import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, attachmentHref, camelKey, clientPayments, events, isFundsRefusal, opsError, opsFieldErrors, opsMessages, travel } from "./operations-travel-client";

/** The travel, events and client-payments client: routes, methods and bodies, and errors put back on camelCase fields. */

interface Call {
  url: string;
  method: string;
  body: unknown;
}

function stubFetch(reply: unknown = { data: {} }, status = 200) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const raw = init.body;
      calls.push({ url, method: init.method ?? "GET", body: raw instanceof FormData ? raw : raw ? JSON.parse(String(raw)) : undefined });
      return new Response(JSON.stringify(reply), { status, headers: { "Content-Type": "application/json" } });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const route = (c: Call) => `${c.method} ${c.url}`;

describe("travel", () => {
  it("reads, saves, sends and reports on my trips", async () => {
    const calls = stubFetch({ data: { id: "t1" } });
    await travel.options();
    await travel.me.list();
    await travel.me.get("t1");
    await travel.me.create({ purpose: "Sign-off", destinationClass: "local_tier1", destination: "Abuja", departsOn: "2026-10-13", returnsOn: "2026-10-15", travellers: [{ userId: "u1", grade: "senior" }] });
    await travel.me.update("t1", { flightsEstimate: 100 });
    await travel.me.submit("t1");
    await travel.me.submit("t1", "Client deadline");
    await travel.me.requestChange("t1", { kind: "change", reason: "client_driven", description: "A day later", fee: 3_850_000, bookingId: "b1" });
    await travel.me.report("t1", "Signed off.");
    expect(calls.map(route)).toEqual([
      "GET /api/operations/me/options",
      "GET /api/operations/me/trips",
      "GET /api/operations/me/trips/t1",
      "POST /api/operations/me/trips",
      "PATCH /api/operations/me/trips/t1",
      "POST /api/operations/me/trips/t1/submit",
      "POST /api/operations/me/trips/t1/submit",
      "POST /api/operations/me/trips/t1/changes",
      "POST /api/operations/me/trips/t1/report",
    ]);
    expect(calls[5].body).toEqual({});
    expect(calls[6].body).toEqual({ overrideReason: "Client deadline" });
    expect(calls[7].body).toEqual({ kind: "change", reason: "client_driven", description: "A day later", fee: 3_850_000, bookingId: "b1" });
    expect(calls[8].body).toEqual({ report: "Signed off." });
  });

  it("works the desk: the list with its meta, bookings, changes and the policy", async () => {
    const calls = stubFetch({ data: [], meta: { toBook: 2, changesToExecute: 1, reportsDue: 0, changes: { total: 0, byReason: [], byProject: [] }, spendByProject: [] } });
    const r = await travel.desk.list("approved");
    await travel.desk.list();
    await travel.desk.book("t1", { kind: "flight", travellerId: "u1", reference: "PNR K7XQ2M", amount: 17_200_000 });
    await travel.desk.executeChange("c1");
    await travel.desk.policy();
    await travel.desk.updateRate("rate-1", { dtaDaily: 2_600_000, flightClass: "business" });
    expect(r.meta.toBook).toBe(2);
    expect(calls.map(route)).toEqual([
      "GET /api/operations/travel?status=approved",
      "GET /api/operations/travel",
      "POST /api/operations/travel/t1/bookings",
      "POST /api/operations/travel-changes/c1/execute",
      "GET /api/operations/travel/policy",
      "PATCH /api/operations/travel/policy/rate-1",
    ]);
    expect(calls[5].body).toEqual({ dtaDaily: 2_600_000, flightClass: "business" });
  });

  it("reads everybody's travel grade and puts one on somebody's record", async () => {
    const payload = { grades: { officer: "Officer", senior: "Senior staff" }, staff: [{ userId: "u1", name: "Efe", jobTitle: null, grade: "senior", onRecord: true }] };
    const calls = stubFetch({ data: payload });
    const g = await travel.desk.grades();
    const after = await travel.desk.setGrade("u1", "senior");
    expect(calls.map(route)).toEqual(["GET /api/operations/travel/grades", "PUT /api/operations/travel/grades/u1"]);
    expect(calls[1].body).toEqual({ grade: "senior" });
    expect(g).toEqual(payload);
    expect(after.staff[0].onRecord).toBe(true);
  });
});

describe("events", () => {
  it("saves, sends, raises from a line and closes my events; the desk reads all of them", async () => {
    const calls = stubFetch({ data: { kind: "travel", id: "t9" }, meta: { types: {}, categories: {} } });
    await events.me.create({ name: "Training", type: "client_training", startsOn: "2026-10-20", endsOn: "2026-10-21", lines: [{ category: "venue", amount: 1 }] });
    await events.me.submit("e1", null);
    const made = await events.me.generate("e1", "l1", { what: "travel", travellers: [{ userId: "u1", grade: "officer" }], destinationClass: "local_tier2", destination: "Ibadan" });
    await events.me.close("e1", 33, "Board staff ran a cycle.");
    await events.desk.list();
    await events.desk.get("e1");
    expect(made).toEqual({ kind: "travel", id: "t9" });
    expect(calls.map(route)).toEqual([
      "POST /api/operations/me/events",
      "POST /api/operations/me/events/e1/submit",
      "POST /api/operations/me/events/e1/lines/l1/generate",
      "POST /api/operations/me/events/e1/close",
      "GET /api/operations/events",
      "GET /api/operations/events/e1",
    ]);
    expect(calls[3].body).toEqual({ attendance: 33, outcomes: "Board staff ran a cycle." });
  });

  it("raises travel from a line with where from and how, the grade left to the record", async () => {
    const calls = stubFetch({ data: { kind: "travel", id: "t9" } });
    await events.me.generate("e1", "l1", { what: "travel", travellers: [{ userId: "u1" }], destinationClass: "local_tier3", destination: "Ogbomosho", origin: "Lagos", mode: "road" });
    expect(calls[0].body).toEqual({ what: "travel", travellers: [{ userId: "u1" }], destinationClass: "local_tier3", destination: "Ogbomosho", origin: "Lagos", mode: "road" });
  });
});

describe("client payments", () => {
  it("prepares, attaches, sends and moves a request, and keeps each client's checklist", async () => {
    const calls = stubFetch({ data: [] });
    await clientPayments.list({ stage: "open" });
    await clientPayments.sources();
    await clientPayments.create({ clientId: "cl1", title: "Go-live", amount: 100 });
    await clientPayments.attach("cpr1", "i2", new File(["%PDF"], "invoice.pdf"));
    await clientPayments.submitPack("cpr1");
    await clientPayments.move("cpr1", { stage: "acknowledged", contact: "Mrs Bello", nextFollowUpOn: "2026-10-09" });
    await clientPayments.checklist("cl1");
    await clientPayments.saveChecklist("cl1", [{ label: "Cover letter", mandatory: true }]);
    expect(calls.map(route)).toEqual([
      "GET /api/operations/client-payments?stage=open",
      "GET /api/operations/client-payments/sources",
      "POST /api/operations/client-payments",
      "POST /api/operations/client-payments/cpr1/items/i2",
      "POST /api/operations/client-payments/cpr1/submit",
      "POST /api/operations/client-payments/cpr1/stage",
      "GET /api/operations/clients/cl1/checklist",
      "PUT /api/operations/clients/cl1/checklist",
    ]);
    expect((calls[3].body as FormData).get("file")).toBeInstanceOf(File);
    expect(calls[7].body).toEqual({ items: [{ label: "Cover letter", mandatory: true }] });
    expect(attachmentHref("a1")).toBe("/api/operations/attachments/a1");
  });
});

describe("errors", () => {
  it("puts snake_case service keys and camelCase request keys on the same fields", () => {
    const e = new ApiError("Invalid.", 422, {
      project_id: ["Every trip is for a project or a cost centre."],
      "travellers.0.userId": ["Choose a member of staff."],
      next_follow_up_on: ["Set the next follow-up date."],
    });
    expect(opsFieldErrors(e)).toEqual({
      projectId: "Every trip is for a project or a cost centre.",
      "travellers.0.userId": "Choose a member of staff.",
      nextFollowUpOn: "Set the next follow-up date.",
    });
    expect(camelKey("late_booking_reason")).toBe("lateBookingReason");
  });

  it("recognises the funds refusal and takes its machine code off", () => {
    const e = new ApiError("Invalid.", 422, { funds: ["INSUFFICIENT_PROJECT_FUNDS: the project has 10.00 available and this asks for 20.00."] });
    expect(isFundsRefusal(e)).toBe(true);
    expect(opsError(e)).toBe("the project has 10.00 available and this asks for 20.00.");
    expect(isFundsRefusal(new ApiError("No.", 422, { travel: ["x"] }))).toBe(false);
  });

  it("lists every blocker a close-out was refused for", () => {
    const e = new ApiError("Invalid.", 422, { event: ["1 advance(s) not yet retired.", "A trip for the event has no trip report yet."] });
    expect(opsMessages(e, "event")).toHaveLength(2);
    expect(opsMessages(new Error("x"), "event")).toEqual([]);
  });
});
