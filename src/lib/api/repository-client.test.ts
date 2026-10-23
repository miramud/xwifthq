import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, linksOf, metaForm, myRepository, repoError, repoFieldErrors, repository } from "./repository-client";

/** The repository client: the desk under /api/org, staff under /api/repository; uploads as multipart. */

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
      const body = init.body instanceof FormData ? init.body : init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method: init.method ?? "GET", body });
      return new Response(JSON.stringify(reply), { status, headers: { "Content-Type": "application/json" } });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const route = (c: Call) => `${c.method} ${c.url}`;

describe("repository (desk)", () => {
  it("searches with its filters and reads, edits, holds and disposes of a document", async () => {
    const calls = stubFetch({ data: { id: "d1" }, meta: { total: 4 } });
    const list = await repository.list({ q: "lease", category: "contracts", expiring: 60, confidentiality: "" });
    await repository.get("d1");
    await repository.update("d1", { title: "Office lease 2026", tags: ["lease"] });
    await repository.hold("d1", true, "Matter 14 of 2026");
    await repository.hold("d1", false);
    await repository.dispose("d1", "Retention ended");
    expect(list.meta.total).toBe(4);
    expect(calls.map(route)).toEqual([
      "GET /api/org/repository?q=lease&category=contracts&expiring=60",
      "GET /api/org/repository/d1",
      "PATCH /api/org/repository/d1",
      "POST /api/org/repository/d1/hold",
      "POST /api/org/repository/d1/hold",
      "POST /api/org/repository/d1/dispose",
    ]);
    expect(calls[3].body).toEqual({ on: true, reason: "Matter 14 of 2026" });
    expect(calls[4].body).toEqual({ on: false });
    expect(calls[5].body).toEqual({ reason: "Retention ended" });
    expect(repository.downloadHref("d1")).toBe("/api/org/repository/d1/download");
  });

  it("uploads the file with its metadata, then sets who may see a restricted one", async () => {
    const calls = stubFetch({ data: { id: "d9" } });
    const file = new File(["%PDF"], "board-minutes.pdf", { type: "application/pdf" });
    await repository.upload(file, { title: "Board minutes", category: "corporate", confidentiality: "restricted", tags: ["board", "2026"], projectId: null, allowedUserIds: ["u1", "u2"] });
    expect(calls.map(route)).toEqual(["POST /api/org/repository", "PATCH /api/org/repository/d9"]);
    const form = calls[0].body as FormData;
    expect(form.get("title")).toBe("Board minutes");
    expect(form.getAll("tags[]")).toEqual(["board", "2026"]);
    expect(form.has("projectId")).toBe(false);
    expect(form.has("allowedUserIds[]")).toBe(false);
    expect(form.get("file")).toBeInstanceOf(File);
    expect(calls[1].body).toEqual({ allowedUserIds: ["u1", "u2"] });
  });

  it("keeps controlled documents: versions, review and submission", async () => {
    const calls = stubFetch({ data: [], meta: { kinds: { policy: "Policy" } } });
    const list = await repository.controlled.list();
    await repository.controlled.get("c1");
    await repository.controlled.create({ code: "HR-POL-001", title: "Leave policy", kind: "policy", audience: { everyone: true } });
    await repository.controlled.update("c1", { audience: { unitIds: ["u1"], jobTitleIds: [] } });
    await repository.controlled.draft("c1", { file: new File(["x"], "leave.docx"), bump: "major", changeSummary: "New carry-over rule", reviewerId: "r1" });
    await repository.controlled.submit("v1");
    await repository.controlled.review("v1", false, "Fix clause 4");
    expect(list.kinds.policy).toBe("Policy");
    expect(calls.map(route)).toEqual([
      "GET /api/org/repository/controlled",
      "GET /api/org/repository/controlled/c1",
      "POST /api/org/repository/controlled",
      "PATCH /api/org/repository/controlled/c1",
      "POST /api/org/repository/controlled/c1/versions",
      "POST /api/org/repository/versions/v1/submit",
      "POST /api/org/repository/versions/v1/review",
    ]);
    const form = calls[4].body as FormData;
    expect(form.get("bump")).toBe("major");
    expect(form.get("changeSummary")).toBe("New carry-over rule");
    expect(form.get("reviewerId")).toBe("r1");
    expect(form.has("effectiveOn")).toBe(false);
    expect(calls[6].body).toEqual({ pass: false, note: "Fix clause 4" });
  });

  it("reads the links list only when it is one, and errors by field", () => {
    expect(linksOf({ links: null })).toBeNull();
    expect(linksOf({ links: 3 })).toBeNull();
    expect(linksOf({ links: [{ module: "core", ownerType: "repository", ownerId: "o", label: "Uploaded", at: null }] })).toHaveLength(1);
    const e = new ApiError("Invalid", 422, { change_summary: ["Say what changed."] });
    expect(repoFieldErrors(e).changeSummary).toBe("Say what changed.");
    expect(repoError(e)).toBe("Say what changed.");
    expect(metaForm({ tags: [], title: "" }).has("title")).toBe(false);
  });
});

describe("myRepository (staff)", () => {
  it("searches, lists policies and acknowledges one", async () => {
    const calls = stubFetch({ data: [], meta: { toRead: 2, categories: {} } });
    await myRepository.search({ q: "travel" });
    const p = await myRepository.policies();
    await myRepository.acknowledge("v1");
    expect(p.toRead).toBe(2);
    expect(calls.map(route)).toEqual(["GET /api/repository?q=travel", "GET /api/repository/policies", "POST /api/repository/policies/v1/acknowledge"]);
    expect(myRepository.downloadHref("d1")).toBe("/api/repository/d1/download");
    expect(myRepository.policyFileHref("v1")).toBe("/api/repository/policies/v1/file");
  });
});
