import { describe, it, expect, vi } from "vitest";
import { coverageLine } from "./LeaveBoard";

/**
 * The Decide dialog's cover line.
 *
 * It counted the requester as one of the team away, so an approved request
 * read "1 of 5 away — Zainab Lawal" about Zainab's own leave. The API now
 * counts colleagues only, and the line says "also away".
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/hrm/leave",
  useSearchParams: () => new URLSearchParams(),
}));

describe("coverageLine", () => {
  it("counts colleagues who are also away", () => {
    expect(coverageLine({ away: 1, team: 4, names: ["Ada"] })).toBe("1 of 4 teammates also away");
    expect(coverageLine({ away: 0, team: 1, names: [] })).toBe("0 of 1 teammate also away");
  });

  it("says when there is nobody to compare with", () => {
    expect(coverageLine({ away: 0, team: 0, names: [] })).toBe("No teammates to compare with");
  });
});
