import { describe, it, expect } from "vitest";
import { can, NO_CAPABILITIES, type Capabilities } from "./capabilities";

/**
 * Reading the capabilities the API computed. Presentation only — the API is
 * the gate — so what is worth pinning is that nothing absent reads as a yes.
 */

const hrManager: Capabilities = {
  isPlatformOwner: false,
  hrmManage: true,
  projectsLead: true,
  projectsEngineeringLead: true,
  lmsAdmin: true,
};

describe("can", () => {
  it("answers what the API said", () => {
    const user = { capabilities: hrManager };

    expect(can(user, "lmsAdmin")).toBe(true);
    expect(can(user, "projectsLead")).toBe(true);
    expect(can(user, "isPlatformOwner")).toBe(false);
  });

  it("treats a session without capabilities as able to do none of them", () => {
    expect(can({}, "lmsAdmin")).toBe(false);
    expect(can({ capabilities: null }, "lmsAdmin")).toBe(false);
    expect(can({ capabilities: {} }, "hrmManage")).toBe(false);
    expect(can(null, "lmsAdmin")).toBe(false);
    expect(can(undefined, "lmsAdmin")).toBe(false);
  });

  /*
    It does not re-derive from role: an admin whose session predates
    capabilities is shown nothing extra here, and `isAdminRole` still
    answers for them from `role` as it always did.
  */
  it("does not infer anything from role", () => {
    const legacyAdmin = { role: "admin", capabilities: undefined };

    expect(can(legacyAdmin, "lmsAdmin")).toBe(false);
  });

  it("only a literal true is a yes", () => {
    const odd = { capabilities: { lmsAdmin: "yes" as unknown as boolean } };

    expect(can(odd, "lmsAdmin")).toBe(false);
  });

  it("offers an all-false set for nobody", () => {
    expect(Object.values(NO_CAPABILITIES).every((v) => v === false)).toBe(true);
    expect(can({ capabilities: NO_CAPABILITIES }, "projectsLead")).toBe(false);
  });
});
