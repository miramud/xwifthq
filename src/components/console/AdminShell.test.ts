import { describe, it, expect } from "vitest";
import { ORG_NAV } from "./AdminShell";
import type { AuthUser } from "@/lib/auth-store";

/**
 * Branding, policies and seats are one organisation's own. The platform owner
 * belongs to none, so they are left off the owner's menu rather than offered
 * as pages whose only content is a refusal.
 */

const visible = (user: Partial<AuthUser>) =>
  ORG_NAV.flatMap((g) => g.items)
    .filter((i) => !i.show || i.show(user as AuthUser))
    .map((i) => i.label);

describe("the organisation console menu", () => {
  it("hides Branding, Policies and Seats from the platform owner", () => {
    const labels = visible({ role: "super_admin", organisationId: null });
    expect(labels).not.toContain("Branding");
    expect(labels).not.toContain("Policies");
    expect(labels).not.toContain("Seats");
    expect(labels).toContain("Audit & health");
  });

  it("keeps them for an organisation's admin", () => {
    const labels = visible({ role: "admin", organisationId: "org-1" });
    expect(labels).toEqual(expect.arrayContaining(["Branding", "Policies", "Seats"]));
  });
});
