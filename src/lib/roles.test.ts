import { describe, it, expect } from "vitest";
import { administersLms, isAdminRole, landingFor, normaliseRole, roleLabel, teaches } from "@/lib/roles";

/**
 * The session's `role` is `user`, or `admin` for an organisation admin (the
 * base Admin role retired in phase 3b); teaching comes from a teaching role.
 * A stale session carrying a retired role is read, not thrown on.
 */
describe("base roles", () => {
  it("folds the retired roles into User", () => {
    expect(normaliseRole("student")).toBe("user");
    expect(normaliseRole("instructor")).toBe("user");
    expect(normaliseRole("admin")).toBe("admin");
    expect(normaliseRole("platform_staff")).toBe("platform_staff");
    expect(normaliseRole("nonsense")).toBeNull();
  });

  it("labels roles in the words the screens use", () => {
    expect(roleLabel("admin")).toBe("Admin");
    expect(roleLabel("user")).toBe("User");
    expect(roleLabel("student")).toBe("User");
    expect(roleLabel("super_admin")).toBe("Platform owner");
  });

  it("treats only admins and the platform owner as administrative", () => {
    expect(isAdminRole({ role: "admin" })).toBe(true);
    expect(isAdminRole({ role: "super_admin" })).toBe(true);
    expect(isAdminRole({ role: "user" })).toBe(false);
    expect(isAdminRole({ role: "platform_staff" })).toBe(false);
  });
});

describe("who runs and who teaches the LMS", () => {
  it("gives a plain user neither the console nor the studio", () => {
    const user = { role: "user" };
    expect(administersLms(user)).toBe(false);
    expect(teaches(user)).toBe(false);
  });

  it("opens the studio to a user holding a teaching role, and not the console", () => {
    const instructor = { role: "user", capabilities: { lmsInstructor: true, lmsAdmin: false } };
    expect(teaches(instructor)).toBe(true);
    expect(administersLms(instructor)).toBe(false);
  });

  it("lets whoever the API says runs the LMS run it (the HR Management Lead as seeded)", () => {
    expect(administersLms({ role: "user", capabilities: { lmsAdmin: true } })).toBe(true);
  });

  it("prefers the server's capability over re-deriving it", () => {
    expect(administersLms({ role: "admin", capabilities: { lmsAdmin: false } })).toBe(false);
    expect(administersLms({ role: "user", capabilities: { lmsAdmin: true } })).toBe(true);
  });

  it("still lets a stale instructor session into the studio", () => {
    expect(teaches({ role: "instructor" })).toBe(true);
  });
});

/** Where each kind of account lands after signing in (26 Sep 2026). */
describe("landingFor", () => {
  const active = (...keys: string[]) =>
    (["lms", "hrm", "projects", "finance", "admin"] as const).map((key) => ({
      key,
      label: key,
      status: keys.includes(key) ? ("active" as const) : ("preview" as const),
    }));

  it("sends the platform owner and platform staff to the Platform console", () => {
    expect(landingFor({ role: "super_admin", organisationId: null })).toBe("/suite/platform");
    expect(landingFor({ role: "platform_staff", organisationId: null })).toBe("/suite/platform");
  });

  it("sends an organisation's admin to the suite home", () => {
    expect(landingFor({ role: "admin", organisationId: "org", modules: active("lms", "hrm") })).toBe("/suite");
  });

  it("sends an organisation's user to My employment", () => {
    expect(landingFor({ role: "user", organisationId: "org", modules: active("lms", "hrm") })).toBe("/suite/hrm/me");
  });

  it("falls back to learning, then the suite, when HRM is not switched on", () => {
    expect(landingFor({ role: "user", organisationId: "org", modules: active("lms") })).toBe("/my-courses");
    expect(landingFor({ role: "user", organisationId: "org", modules: active() })).toBe("/suite");
  });

  it("sends project people to Projects, unless they run HR (X4)", () => {
    const modules = active("lms", "hrm", "projects");

    expect(landingFor({ role: "user", organisationId: "org", modules, onProjectTeam: true })).toBe("/suite/projects");
    expect(landingFor({ role: "user", organisationId: "org", modules, capabilities: { projectsLead: true } })).toBe("/suite/projects");
    expect(
      landingFor({ role: "user", organisationId: "org", modules, capabilities: { projectsEngineeringLead: true, hrmEmployed: true } }),
    ).toBe("/suite/projects");
    // Whoever runs HR without leading delivery keeps HR as home, project team or not.
    expect(
      landingFor({ role: "user", organisationId: "org", modules, capabilities: { hrmManage: true }, onProjectTeam: true }),
    ).toBe("/suite/hrm/me");
    // Projects not switched on: as before.
    expect(landingFor({ role: "user", organisationId: "org", modules: active("lms", "hrm"), onProjectTeam: true })).toBe(
      "/suite/hrm/me",
    );
    // Admins still land on the suite home.
    expect(landingFor({ role: "admin", organisationId: "org", modules, onProjectTeam: true })).toBe("/suite");
  });

  it("keeps a self-serve learner, and a stale student session, in their courses", () => {
    expect(landingFor({ role: "user", organisationId: null })).toBe("/my-courses");
    expect(landingFor({ role: "student", organisationId: "org", modules: active("hrm") })).toBe("/suite/hrm/me");
  });
});
