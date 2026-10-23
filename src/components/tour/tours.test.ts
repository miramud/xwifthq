import { describe, it, expect } from "vitest";
import { TOURS, tourForPath } from "./tours";
import { panelTourKey } from "@/components/workspace/kit";

/** The tour list agreed for every dashboard (26 Sep 2026). */
const CONTRACT_KEYS = [
  "suite-home",
  "org-overview",
  "org-users",
  "org-billing",
  "platform-overview",
  "lms-console",
  "teach-studio",
  "hrm",
  "projects",
  "my-learning",
  "my-employment",
];

describe("tour registry", () => {
  it("has exactly one tour per agreed dashboard", () => {
    expect(TOURS.map((t) => t.key).sort()).toEqual([...CONTRACT_KEYS].sort());
  });

  it("keeps every tour between four and eight steps", () => {
    for (const tour of TOURS) {
      expect(tour.steps.length, tour.key).toBeGreaterThanOrEqual(4);
      expect(tour.steps.length, tour.key).toBeLessThanOrEqual(8);
    }
  });

  it("finds each dashboard's tour by its path, and nothing for other pages", () => {
    expect(tourForPath("/suite")?.key).toBe("suite-home");
    expect(tourForPath("/suite/org")?.key).toBe("org-overview");
    expect(tourForPath("/suite/org/users")?.key).toBe("org-users");
    expect(tourForPath("/suite/org/billing")?.key).toBe("org-billing");
    expect(tourForPath("/suite/platform")?.key).toBe("platform-overview");
    expect(tourForPath("/suite/lms")?.key).toBe("lms-console");
    expect(tourForPath("/suite/lms/teach")?.key).toBe("teach-studio");
    expect(tourForPath("/suite/hrm")?.key).toBe("hrm");
    expect(tourForPath("/suite/projects")?.key).toBe("projects");
    expect(tourForPath("/my-courses")?.key).toBe("my-learning");
    expect(tourForPath("/suite/hrm/me")?.key).toBe("my-employment");
    expect(tourForPath("/suite/org/users/123")).toBeUndefined();
    expect(tourForPath("/suite/hrm/me/leave")).toBeUndefined();
  });

  it("names a titled panel's anchor after its title", () => {
    expect(panelTourKey("Needs attention")).toBe("panel-needs-attention");
    expect(panelTourKey("To-do")).toBe("panel-to-do");
    expect(panelTourKey("Your self-service")).toBe("panel-your-self-service");
    expect(panelTourKey(undefined)).toBeUndefined();
  });
});
