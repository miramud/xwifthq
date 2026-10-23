import { describe, it, expect } from "vitest";
import { recoveryFor } from "./recovery";

describe("recoveryFor — the way back from a broken page", () => {
  it.each([
    ["/suite/projects/hrm-system", "Back to all projects", "/suite/projects"],
    ["/suite/projects/hrm-system/anything", "Back to all projects", "/suite/projects"],
    ["/suite/projects", "Back to Projects", "/suite/projects"],
    ["/suite/projects/portfolios", "Back to Projects", "/suite/projects"],
    ["/suite/hrm/leave/abc", "Back to HR", "/suite/hrm"],
    ["/suite/lms/teach/courses/x", "Back to the teaching studio", "/suite/lms/teach"],
    ["/suite/lms/compliance", "Back to the learning dashboard", "/suite/lms"],
    ["/suite/org/users", "Back to organisation settings", "/suite/org"],
    ["/suite", "Go to the suite home", "/suite"],
    ["/platform/orgs/1", "Back to the platform console", "/platform"],
    ["/learn/intro-to-sql", "Back to my courses", "/my-courses"],
    ["/courses/nope", "Browse courses", "/courses"],
    ["/", "Go to the home page", "/"],
    ["/pricing/old", "Go to the home page", "/"],
  ])("%s → %s", (path, label, href) => {
    expect(recoveryFor(path).home).toEqual({ label, href });
  });

  it("never sends somebody inside a module to the course catalogue", () => {
    for (const path of ["/suite/projects/x", "/suite/hrm", "/suite/org", "/suite/lms/teach"]) {
      const way = recoveryFor(path);
      expect(way.home.href).not.toBe("/courses");
      expect(way.wider?.href).not.toBe("/courses");
    }
  });

  it("does not mistake a lookalike prefix for a module", () => {
    expect(recoveryFor("/suite/hrmx").home.href).toBe("/suite");
  });

  it("tolerates a missing or query-laden path", () => {
    expect(recoveryFor(null).home.href).toBe("/");
    expect(recoveryFor("/suite/hrm/?tab=leave").home.href).toBe("/suite/hrm");
  });

  it("explains a missing project in project terms", () => {
    expect(recoveryFor("/suite/projects/gone").missing).toMatch(/may not be on its team/);
  });
});
