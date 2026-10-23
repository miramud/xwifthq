import { describe, it, expect, vi, beforeEach } from "vitest";

const lmsFetch = vi.fn();
const set = vi.fn();

vi.mock("@/lib/api/server", () => ({
  AUTH_COOKIE: "lms_token",
  lmsFetch: (...args: unknown[]) => lmsFetch(...args),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set }),
}));

import { POST } from "./route";

function call(path: string[], body: unknown) {
  return POST(new Request(`http://localhost/api/onboarding/${path.join("/")}`, { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ path }),
  });
}

/**
 * The session for a newly onboarded admin becomes an httpOnly cookie; the
 * token itself must never reach the browser.
 */
describe("onboarding proxy", () => {
  beforeEach(() => {
    lmsFetch.mockReset();
    set.mockReset();
  });

  it("turns the verify session into the auth cookie and strips the token", async () => {
    lmsFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: { data: { status: "paid", email: "ada@acme.test", session: { token: "secret-token", user: { id: "u1" } } } },
    });

    const res = await call(["verify"], { reference: "EL-ONB-1", claimToken: "claim" });
    const json = await res.json();

    expect(lmsFetch).toHaveBeenCalledWith("/onboarding/verify", expect.objectContaining({ method: "POST" }));
    expect(set).toHaveBeenCalledWith("lms_token", "secret-token", expect.objectContaining({ httpOnly: true }));
    expect(json).toEqual({ data: { status: "paid", email: "ada@acme.test", signedIn: true } });
    expect(JSON.stringify(json)).not.toContain("secret-token");
  });

  it("sets no cookie when the API returns no session", async () => {
    lmsFetch.mockResolvedValue({ ok: true, status: 200, body: { data: { status: "pending", session: null } } });

    const json = await (await call(["verify"], { reference: "EL-ONB-1" })).json();

    expect(set).not.toHaveBeenCalled();
    expect(json.data.signedIn).toBe(false);
  });

  it("passes checkout and its errors straight through", async () => {
    lmsFetch.mockResolvedValue({ ok: false, status: 422, body: { message: "Invalid", errors: { email: ["taken"] } } });

    const res = await call(["checkout"], { email: "ada@acme.test" });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ message: "Invalid", errors: { email: ["taken"] } });
    expect(set).not.toHaveBeenCalled();
  });
});
