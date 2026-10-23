import { describe, it, expect } from "vitest";
import { admitsToOrgConsole, mayOpenOrgPage } from "@/lib/org-access";
import { holdsFeature } from "@/lib/permissions";
import { hrmFeaturesFor, mayOpenHrmPage } from "@/suite/hrm/lib/hrm-access";

/**
 * Who sees which console page by permission key (2 Oct 2026):
 *  - S8: the organisation console admits holders of a `core.*` key for one of
 *    its pages, and shows them only those pages; admins see everything.
 *  - S7: HR custom roles open the HR pages their keys answer to.
 */
const auditor = {
  role: "user",
  organisationId: "org",
  permissions: ["core.audit_log.view", "core.recycle_bin.view", "core.users.view"],
};

describe("organisation console by key (S8)", () => {
  it("admits a core.* key holder and opens only their pages", () => {
    expect(admitsToOrgConsole(auditor)).toBe(true);
    expect(mayOpenOrgPage(auditor, "/suite/org/audit")).toBe(true);
    expect(mayOpenOrgPage(auditor, "/suite/org/users/u-1")).toBe(true);
    expect(mayOpenOrgPage(auditor, "/suite/org/billing")).toBe(false);
    expect(mayOpenOrgPage(auditor, "/suite/org")).toBe(false);
  });

  it("opens the organisation foundations pages by their own keys (5 Oct 2026)", () => {
    const finance = { role: "user", organisationId: "org", permissions: ["core.fx_rates.view", "core.counterparties.view", "core.cost_centres.view"] };
    expect(admitsToOrgConsole(finance)).toBe(true);
    expect(mayOpenOrgPage(finance, "/suite/org/profile")).toBe(true);
    expect(mayOpenOrgPage(finance, "/suite/org/structure")).toBe(true);
    expect(mayOpenOrgPage(finance, "/suite/org/counterparties/cp-1")).toBe(true);
    expect(mayOpenOrgPage(finance, "/suite/org/numbering")).toBe(false);
    expect(mayOpenOrgPage(finance, "/suite/org/documents")).toBe(false);
    expect(mayOpenOrgPage({ ...finance, permissions: ["core.documents.view"] }, "/suite/org/documents")).toBe(true);
  });

  it("keeps the admins page with organisation admins", () => {
    expect(mayOpenOrgPage({ ...auditor, permissions: ["core.admins.view"] }, "/suite/org/settings")).toBe(false);
    expect(mayOpenOrgPage({ role: "admin", organisationId: "org" }, "/suite/org/settings")).toBe(true);
  });

  it("turns away a plain member, and an instructor whose only core keys are the media library", () => {
    expect(admitsToOrgConsole({ role: "user", organisationId: "org", permissions: [] })).toBe(false);
    expect(
      admitsToOrgConsole({ role: "user", organisationId: "org", permissions: ["core.media.view", "core.uploads.create"] }),
    ).toBe(false);
    expect(admitsToOrgConsole({ ...auditor, organisationId: null })).toBe(false);
  });
});

describe("HR pages by key (S7)", () => {
  const recruiter = { role: "user", permissions: ["hrm.recruitment.view", "hrm.recruitment.create", "hrm.overview.view"] };

  it("maps each page to the features its API answers to", () => {
    expect(hrmFeaturesFor("/suite/hrm")).toEqual(["overview"]);
    expect(hrmFeaturesFor("/suite/hrm/recruitment/candidates/c-1")).toEqual(["recruitment"]);
    expect(hrmFeaturesFor("/suite/hrm/leavers")).toEqual(["offboarding"]);
    expect(hrmFeaturesFor("/suite/hrm/me/leave")).toBeNull();
  });

  it("opens the recruiter's pages and no others", () => {
    expect(mayOpenHrmPage(recruiter, "/suite/hrm/recruitment")).toBe(true);
    expect(mayOpenHrmPage(recruiter, "/suite/hrm")).toBe(true);
    expect(mayOpenHrmPage(recruiter, "/suite/hrm/payroll")).toBe(false);
    expect(mayOpenHrmPage(recruiter, "/suite/hrm/people")).toBe(false);
  });

  it("opens a page to whoever holds its keys, the HR lead and the admin included", () => {
    expect(mayOpenHrmPage({ role: "user", permissions: ["hrm.payroll.view"] }, "/suite/hrm/payroll")).toBe(true);
    expect(mayOpenHrmPage({ role: "admin", permissions: ["hrm.offboarding.view"] }, "/suite/hrm/leavers")).toBe(true);
    expect(mayOpenHrmPage({ role: "user", capabilities: { hrmEmployed: true } }, "/suite/hrm/leave")).toBe(false);
  });

  it("reads keys by feature, not by prefix of another feature", () => {
    expect(holdsFeature({ role: "user", permissions: ["hrm.leave.view"] }, "hrm", "leave")).toBe(true);
    expect(holdsFeature({ role: "user", permissions: ["hrm.leavers.view"] }, "hrm", "leave")).toBe(false);
  });
});
