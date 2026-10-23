import { describe, it, expect } from "vitest";
import { isModuleActive, moduleStatus, previewHref, type SessionModule } from "@/lib/module-access";
import { WORKSPACE_MODULES, availability, hrefFor, type WorkspaceModule } from "@/components/workspace/modules";
import type { AuthUser } from "@/lib/auth-store";

/**
 * Modules are switched on per organisation by the platform owner. Anything
 * not switched on is a preview for everybody in that organisation.
 */

const modules = (active: string[]): SessionModule[] =>
  (["lms", "hrm", "projects", "finance", "admin"] as const).map((key) => ({
    key,
    label: key,
    status: active.includes(key) ? "active" : "preview",
  }));

function member(over: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    name: "Ruth",
    email: "ruth@acme.test",
    role: "user",
    organisationId: "org-1",
    avatar: null,
    emailVerified: true,
    mustChangePassword: false,
    ...over,
  };
}

const area = (key: string): WorkspaceModule => WORKSPACE_MODULES.find((m) => m.key === key)!;

describe("moduleStatus", () => {
  it("reads the organisation's modules from the session", () => {
    const u = member({ modules: modules(["lms"]) });
    expect(moduleStatus(u, "lms")).toBe("active");
    expect(moduleStatus(u, "hrm")).toBe("preview");
  });

  it("opens Finance and Admin for an organisation that holds them (every module shipped, 9 Oct 2026)", () => {
    const u = member({ modules: modules(["lms", "hrm", "projects", "finance", "admin"]) });
    expect(moduleStatus(u, "finance")).toBe("active");
    expect(moduleStatus(u, "admin")).toBe("active");
  });

  it("doesn't lock anybody out on a session stored before modules existed", () => {
    expect(isModuleActive(member(), "hrm")).toBe(true);
  });

  it("lets the platform's own people navigate every module", () => {
    const owner = member({ role: "super_admin", organisationId: null, modules: modules([]) });
    expect(moduleStatus(owner, "projects")).toBe("active");
  });

  it("gives a self-serve learner the LMS and nothing else", () => {
    const learner = member({ organisationId: null });
    expect(moduleStatus(learner, "lms")).toBe("active");
    expect(moduleStatus(learner, "hrm")).toBe("preview");
  });

  it("points each module's preview at /suite/preview", () => {
    expect(previewHref("projects")).toBe("/suite/preview/projects");
  });
});

describe("what the menus offer", () => {
  it("shows a switched-off module to everybody in the organisation as a preview", () => {
    const u = member({ modules: modules(["lms"]) });
    expect(availability(area("hrm"), u)).toBe("preview");
    expect(availability(area("projects"), u)).toBe("preview");
    expect(hrefFor(area("hrm"), "preview")).toBe("/suite/preview/hrm");
  });

  it("lists the LMS preview once, not once per LMS area", () => {
    const u = member({ modules: modules(["hrm"]) });
    expect(availability(area("lms"), u)).toBe("preview");
    expect(availability(area("learn"), u)).toBe("hidden");
    expect(availability(area("teach"), u)).toBe("hidden");
  });

  it("hides the LMS console from a plain user but opens their learning", () => {
    const u = member({ modules: modules(["lms"]) });
    expect(availability(area("lms"), u)).toBe("hidden");
    expect(availability(area("learn"), u)).toBe("open");
  });

  it("opens the studio to a teaching role", () => {
    const u = member({ modules: modules(["lms"]), capabilities: { lmsInstructor: true } as AuthUser["capabilities"] });
    expect(availability(area("teach"), u)).toBe("open");
  });

  it("opens the LMS console to an admin when the LMS is on", () => {
    const admin = member({ role: "admin", modules: modules(["lms"]) });
    expect(availability(area("lms"), admin)).toBe("open");
  });
});

describe("released modules (5 Oct 2026)", () => {
  const withRelease = (active: string[], released: Record<string, boolean>): SessionModule[] =>
    modules(active).map((m) => ({ ...m, released: released[m.key] ?? true }));

  it("treats a module as released when the session does not say", () => {
    const u = member({ modules: modules(["finance", "admin"]) });
    expect(moduleStatus(u, "finance")).toBe("active");
    expect(moduleStatus(u, "admin")).toBe("active");
  });

  it("opens a released module the organisation holds", () => {
    const u = member({ modules: withRelease(["finance"], { finance: true, admin: false }) });
    expect(moduleStatus(u, "finance")).toBe("active");
    expect(moduleStatus(u, "admin")).toBe("preview");
  });

  it("keeps an unreleased module a preview even for an organisation that holds it", () => {
    const u = member({ modules: withRelease(["hrm"], { hrm: false }) });
    expect(moduleStatus(u, "hrm")).toBe("preview");
  });
});
