import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import ReferralCapture from "./ReferralCapture";
import { clearReferralCode, storedReferralCode } from "@/lib/referral";

/**
 * An affiliate link (`?ref=CODE`) on any page: the code is remembered only
 * when the API says it is live, and the parameter comes off the address
 * either way so a shared or bookmarked page does not count again.
 */

const fetchMock = vi.fn();

function check(valid: boolean, code: string | null = "ADA20") {
  return new Response(
    JSON.stringify({ data: { valid, code: valid ? code : null, firstName: valid ? "Ada" : null, discountPercent: 10, cookieDays: 60 } }),
    { status: 200 },
  );
}

describe("ReferralCapture", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    clearReferralCode();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearReferralCode();
    window.history.replaceState(null, "", "/");
  });

  it("stores a live code and takes ref off the address", async () => {
    fetchMock.mockResolvedValue(check(true));
    window.history.replaceState(null, "", "/pricing?ref=ada20&currency=NGN#plans");

    render(<ReferralCapture />);

    expect(window.location.pathname).toBe("/pricing");
    expect(window.location.search).toBe("?currency=NGN");
    expect(window.location.hash).toBe("#plans");

    await waitFor(() => expect(storedReferralCode()).toBe("ADA20"));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/public/affiliates/clicks");
    expect(JSON.parse(String(init.body))).toMatchObject({ code: "ADA20", path: "/pricing" });
  });

  it("remembers nothing for a code the API says is not live", async () => {
    fetchMock.mockResolvedValue(check(false));
    window.history.replaceState(null, "", "/?ref=OLDCODE");

    render(<ReferralCapture />);

    expect(window.location.search).toBe("");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // Let the response settle before checking nothing was stored.
    await new Promise((r) => setTimeout(r, 0));
    expect(storedReferralCode()).toBeNull();
  });

  it("ignores something that cannot be a code without asking the API", () => {
    window.history.replaceState(null, "", "/?ref=%3Cscript%3E");

    render(<ReferralCapture />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(storedReferralCode()).toBeNull();
  });
});
