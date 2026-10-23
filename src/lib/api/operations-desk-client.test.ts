import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, desk, fieldKey, help, opsFieldErrors } from "./operations-desk-client";

/** The desk and self-service clients: routes, methods and bodies; PHP's empty arrays made objects. */

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
      calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(status === 204 ? null : JSON.stringify(reply), { status, headers: { "Content-Type": "application/json" } });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const route = (c: Call) => `${c.method} ${c.url}`;

describe("desk", () => {
  it("reads the queue with its filters and splits the summary from the categories", async () => {
    const calls = stubFetch({
      data: [{ id: "t1", title: "AC not cooling" }],
      meta: { open: 4, breached: 1, unassigned: 2, resolvedThisWeek: 3, satisfaction: 4.5, slaMet: 92.3, byCategory: [], categories: { it: "IT" } },
    });
    const q = await desk.queue({ status: "all", mine: true });
    await desk.queue();
    expect(calls.map(route)).toEqual(["GET /api/operations/desk?status=all&mine=1", "GET /api/operations/desk"]);
    expect(q.summary.breached).toBe(1);
    expect(q.categories.it).toBe("IT");
    expect(q.summary).not.toHaveProperty("categories");
    expect(q.summary.byCategory).toEqual({});
  });

  it("works a ticket: assign, reply, note, status, link, and a work order", async () => {
    const calls = stubFetch({ data: { id: "t1", answers: [], fields: null, comments: [] } });
    const t = await desk.get("t1");
    expect(t.answers).toEqual({});
    expect(t.fields).toEqual([]);
    await desk.assign("t1", "u2");
    await desk.assign("t1", null);
    await desk.comment("t1", "On it");
    await desk.comment("t1", "Vendor is slow", true);
    await desk.status("t1", "waiting");
    await desk.link("t1", "work_order", "w1");
    await desk.raiseWorkOrder({ facilityId: "f1", title: "AC not cooling", priority: "high" });
    expect(calls.map(route)).toEqual([
      "GET /api/operations/desk/t1",
      "POST /api/operations/desk/t1/assign",
      "POST /api/operations/desk/t1/assign",
      "POST /api/operations/desk/t1/comments",
      "POST /api/operations/desk/t1/comments",
      "POST /api/operations/desk/t1/status",
      "POST /api/operations/desk/t1/link",
      "POST /api/operations/maintenance",
    ]);
    expect(calls[1].body).toEqual({ assigneeId: "u2" });
    expect(calls[2].body).toEqual({ assigneeId: null });
    expect(calls[3].body).toEqual({ body: "On it", internal: false });
    expect(calls[4].body).toEqual({ body: "Vendor is slow", internal: true });
    expect(calls[6].body).toEqual({ linkedType: "work_order", linkedId: "w1" });
  });

  it("keeps the catalogue", async () => {
    const calls = stubFetch({ data: [{ id: "c1", name: "IT support", fields: null }], meta: { categories: { it: "IT" }, routes: { ticket: "Handled as a ticket" } } });
    const c = await desk.catalogue();
    expect(c.items[0].fields).toEqual([]);
    expect(c.routes.ticket).toBe("Handled as a ticket");
    stubFetch({ data: { id: "c2", fields: [{ key: "room", label: "Room", type: "text" }] } });
    const made = await desk.createItem({ name: "Room set-up", category: "meetings", fields: [{ key: "room", label: "Room", type: "text", required: true }] });
    expect(made.fields).toHaveLength(1);
    const more = stubFetch({ data: { id: "c2" } });
    await desk.updateItem("c2", { active: false });
    expect(route(calls[0])).toBe("GET /api/operations/desk/catalogue");
    expect(route(more[0])).toBe("PATCH /api/operations/desk/catalogue/c2");
  });
});

describe("help", () => {
  it("asks, follows, replies to and closes my requests", async () => {
    const calls = stubFetch({ data: { items: [{ id: "i1", fields: null }], categories: {}, facilities: [], myAssets: [] } });
    const cat = await help.catalogue();
    expect(cat.items[0].fields).toEqual([]);
    const more = stubFetch({ data: { id: "t1", answers: { room: "B2" } } });
    await help.mine();
    const t = await help.raise({ catalogueId: "i1", title: "Lights out", answers: { room: "B2" }, facilityId: "f1" });
    expect(t.answers).toEqual({ room: "B2" });
    await help.get("t1");
    await help.reply("t1", "Still dark");
    await help.close("t1", { rating: 5, comment: "Quick" });
    await help.close("t1", { reopen: true, comment: "It went off again" });
    expect(route(calls[0])).toBe("GET /api/operations/me/help/catalogue");
    expect(more.map(route)).toEqual([
      "GET /api/operations/me/help",
      "POST /api/operations/me/help",
      "GET /api/operations/me/help/t1",
      "POST /api/operations/me/help/t1/comments",
      "POST /api/operations/me/help/t1/close",
      "POST /api/operations/me/help/t1/close",
    ]);
    expect(more[3].body).toEqual({ body: "Still dark" });
    expect(more[5].body).toEqual({ reopen: true, comment: "It went off again" });
  });

  it("books and cancels rooms and vehicles, logs a trip, and confirms a repair", async () => {
    const calls = stubFetch({ data: { id: "b1", status: "requested" } });
    await help.rooms({ from: "2026-10-05", to: "2026-10-11" });
    await help.bookRoom("s1", { title: "Sprint review", startsAt: "2026-10-07T10:00:00+01:00", endsAt: "2026-10-07T11:00:00+01:00", attendees: 8 });
    await help.vehicles();
    await help.bookVehicle("v1", { purpose: "Client visit", destination: "Ikeja", startsAt: "2026-10-08T09:00:00+01:00", endsAt: "2026-10-08T13:00:00+01:00" });
    await help.logTrip("v2", { purpose: "Bank run", projectId: "p1", startOdometer: 1000, endOdometer: 1042 });
    await help.workOrders();
    await help.confirmWork("w1");
    stubFetch(null, 204);
    await expect(help.cancelRoom("b1")).resolves.toBeUndefined();
    await expect(help.cancelVehicle("b2")).resolves.toBeUndefined();
    expect(calls.map(route)).toEqual([
      "GET /api/operations/me/rooms?from=2026-10-05&to=2026-10-11",
      "POST /api/operations/me/rooms/s1/book",
      "GET /api/operations/me/vehicles",
      "POST /api/operations/me/vehicles/v1/book",
      "POST /api/operations/me/vehicles/v2/trips",
      "GET /api/operations/me/work-orders",
      "POST /api/operations/me/work-orders/w1/confirm",
    ]);
    expect(calls[1].body).toMatchObject({ title: "Sprint review", attendees: 8 });
  });

  it("names the room booking in the way", async () => {
    stubFetch({ message: "Board room is booked then.", errors: { startsAt: ["Board room is booked then: Budget, 10:00–11:00."] } }, 422);
    const err = await help.bookRoom("s1", { title: "x", startsAt: "a", endsAt: "b" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(opsFieldErrors(err).startsAt).toBe("Board room is booked then: Budget, 10:00–11:00.");
  });
});

describe("fieldKey", () => {
  it("makes a key from a label and keeps it unique", () => {
    expect(fieldKey("Room number")).toBe("room_number");
    expect(fieldKey("Room number", ["room_number"])).toBe("room_number_2");
    expect(fieldKey("¿?")).toBe("field");
  });
});
