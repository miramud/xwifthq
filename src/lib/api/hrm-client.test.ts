import { afterEach, describe, expect, it, vi } from "vitest";
import { hrm } from "./hrm-client";

function stubFetch(pages: { data: unknown[]; last_page: number }[]) {
  const urls: string[] = [];
  let call = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urls.push(url);
      const page = pages[Math.min(call++, pages.length - 1)];
      return new Response(
        JSON.stringify({ data: page.data, meta: { current_page: call, last_page: page.last_page, total: 0 } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }),
  );
  return urls;
}

afterEach(() => vi.unstubAllGlobals());

describe("hrm client query strings", () => {
  it("sends yes/no filters as 1/0, which Laravel's boolean rule accepts", async () => {
    const urls = stubFetch([{ data: [], last_page: 1 }]);

    await hrm.employees.list({ includeDeparted: true });
    await hrm.employees.list({ includeDeparted: false });

    expect(urls[0]).toContain("includeDeparted=1");
    expect(urls[1]).toContain("includeDeparted=0");
    expect(urls.join(" ")).not.toMatch(/=true|=false/);
  });
});

describe("hrm.employees.listAll", () => {
  it("walks every page of 100 and never asks for more than the API allows", async () => {
    const urls = stubFetch([
      { data: [{ id: "a" }, { id: "b" }], last_page: 2 },
      { data: [{ id: "c" }], last_page: 2 },
    ]);

    const people = await hrm.employees.listAll();

    expect(people.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain("perPage=100");
    expect(urls[0]).toContain("page=1");
    expect(urls[1]).toContain("page=2");
  });
});
