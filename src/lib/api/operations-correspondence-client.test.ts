import { afterEach, describe, expect, it, vi } from "vitest";
import { correspondence, myCorrespondence } from "./operations-correspondence-client";

/** The correspondence clients: routes, methods, bodies and the shapes PHP leaves out. */

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
      const body = init.body instanceof FormData ? Object.fromEntries([...init.body.keys()].map((k) => [k, (init.body as FormData).get(k) instanceof File ? "file" : (init.body as FormData).get(k)])) : init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method: init.method ?? "GET", body });
      return new Response(status === 204 ? null : JSON.stringify(reply), { status, headers: { "Content-Type": "application/json" } });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const route = (c: Call) => `${c.method} ${c.url}`;

describe("correspondence (desk)", () => {
  it("lists with its filters, sending overdue as 1 and leaving blanks out", async () => {
    const calls = stubFetch({ data: [{ id: "c1" }], meta: { summary: { open: 3, overdue: 1 }, registry: true } });
    const r = await correspondence.list({ direction: "incoming", status: "open", overdue: true, party: "", unitId: "u1" });
    expect(route(calls[0])).toBe("GET /api/operations/correspondence?direction=incoming&status=open&unitId=u1&overdue=1");
    expect(r.summary.open).toBe(3);
    expect(r.summary.toDispatch).toBe(0);
    expect(r.registry).toBe(true);
    expect(r.letters).toHaveLength(1);
  });

  it("works a letter through: create, route, minute, close, dispatch, deliver, classify, cancel", async () => {
    const calls = stubFetch({ data: { id: "c1" } });
    const l = await correspondence.create({ direction: "incoming", subject: "NBTE visit", channel: "courier" });
    expect(l.files).toEqual([]);
    expect(l.actions).toEqual([]);
    await correspondence.assign("c1", { assignedUnitId: "u1", dueOn: "2026-10-14" });
    await correspondence.note("c1", "Called them");
    await correspondence.close("c1");
    await correspondence.submit("c2");
    await correspondence.dispatch("c2", { channel: "courier", trackingRef: "GIG-1" });
    await correspondence.deliver("c2", { stage: "acknowledged" });
    await correspondence.classify("c1", "confidential");
    await correspondence.cancel("c3", "Logged twice");
    expect(calls.map(route)).toEqual([
      "POST /api/operations/correspondence",
      "POST /api/operations/correspondence/c1/assign",
      "POST /api/operations/correspondence/c1/notes",
      "POST /api/operations/correspondence/c1/close",
      "POST /api/operations/correspondence/c2/submit",
      "POST /api/operations/correspondence/c2/dispatch",
      "POST /api/operations/correspondence/c2/deliver",
      "POST /api/operations/correspondence/c1/classify",
      "POST /api/operations/correspondence/c3/cancel",
    ]);
    expect(calls[3].body).toEqual({ note: null });
    expect(calls[8].body).toEqual({ reason: "Logged twice" });
  });

  it("uploads a file as multipart with its kind, and falls back to the default channels", async () => {
    const calls = stubFetch({ data: { id: "c1", staff: [], units: [], parties: [], projects: [], channels: [] } });
    await correspondence.upload("c1", new File(["x"], "scan.pdf"), "scan");
    expect(calls[0]).toMatchObject({ method: "POST", url: "/api/operations/correspondence/c1/files", body: { file: "file", kind: "scan" } });
    const o = await correspondence.options();
    expect(o.channels.courier).toBe("Courier");
    expect(correspondence.fileUrl("c1", "f1")).toBe("/api/operations/correspondence/c1/files/f1");
  });
});

describe("my correspondence", () => {
  it("acts only through the self-service routes", async () => {
    const calls = stubFetch({ data: { id: "c1", forwarded: true } });
    await myCorrespondence.acknowledge("c1");
    await myCorrespondence.forward("c1", { assigneeId: "u2", note: "Over to you" });
    await myCorrespondence.respond("c1", "Sent by email");
    await myCorrespondence.uploadReply("c1", new File(["x"], "reply.pdf"));
    expect(calls.map(route)).toEqual([
      "POST /api/operations/me/correspondence/c1/acknowledge",
      "POST /api/operations/me/correspondence/c1/forward",
      "POST /api/operations/me/correspondence/c1/respond",
      "POST /api/operations/me/correspondence/c1/files",
    ]);
    expect(calls[1].body).toEqual({ assigneeId: "u2", note: "Over to you" });
    expect(myCorrespondence.fileUrl("c1", "f1")).toBe("/api/operations/me/correspondence/c1/files/f1");
  });
});
