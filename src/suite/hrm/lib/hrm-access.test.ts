import { describe, it, expect } from "vitest";
import { isTeamPage, leadsTeam, mayOpenHrmPage, mayOpenTeam } from "./hrm-access";

/**
 * My team (S9) opens by leading a team, not by HR permission keys.
 *
 * The Line Manager role comes with a first direct report, and the API says so
 * (`hrmLeadsTeam`). HR's own pages open by the keys a person's roles give
 * organisation-wide (roles redesign, phase 3a: designations are gone).
 */
const lineManager = { role: "user", capabilities: { hrmLeadsTeam: true } };
const employee = { role: "user", capabilities: { hrmEmployed: true } };
const hrLead = { role: "user", permissions: ["hrm.leave.view", "hrm.employees.view", "hrm.payroll.view"] };
const admin = { role: "admin", permissions: ["hrm.leave.view", "hrm.employees.view"] };
// An HR role holding every leave key still does not lead a team.
const leaveOfficer = { role: "user", permissions: ["hrm.leave.view", "hrm.leave.approve"] };

describe("My team pages (S9)", () => {
  it("recognises the team pages by path", () => {
    expect(isTeamPage("/suite/hrm/team")).toBe(true);
    expect(isTeamPage("/suite/hrm/team/leave/")).toBe(true);
    expect(isTeamPage("/suite/hrm/teams")).toBe(false);
    expect(isTeamPage("/suite/hrm/leave")).toBe(false);
  });

  it("opens to whoever leads a team, nobody else", () => {
    expect(mayOpenHrmPage(lineManager, "/suite/hrm/team/leave")).toBe(true);
    expect(mayOpenHrmPage(employee, "/suite/hrm/team")).toBe(false);
    expect(mayOpenHrmPage(leaveOfficer, "/suite/hrm/team/leave")).toBe(false);
    expect(mayOpenHrmPage(admin, "/suite/hrm/team/reviews")).toBe(false);
    expect(mayOpenTeam(null)).toBe(false);
  });

  it("opens HR's own pages by the keys held, not by leading a team", () => {
    expect(mayOpenHrmPage(lineManager, "/suite/hrm/leave")).toBe(false);
    expect(mayOpenHrmPage(hrLead, "/suite/hrm/leave")).toBe(true);
    expect(mayOpenHrmPage(hrLead, "/suite/hrm/payroll")).toBe(true);
    expect(mayOpenHrmPage(leaveOfficer, "/suite/hrm/people")).toBe(false);
  });

  it("puts My team in the menu only for somebody who leads one", () => {
    expect(leadsTeam(lineManager)).toBe(true);
    expect(leadsTeam(admin)).toBe(false);
    expect(leadsTeam(hrLead)).toBe(false);
  });
});
