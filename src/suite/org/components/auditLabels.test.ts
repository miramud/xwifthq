import { describe, it, expect } from "vitest";
import { auditActionLabel, auditActionSentence, auditSubject } from "./auditLabels";

describe("auditActionLabel", () => {
  it("spells out the keys the generic rule reads badly", () => {
    expect(auditActionLabel("team.demoted")).toBe("removed admin access from");
    expect(auditActionLabel("hrm.employee.left")).toBe("recorded the departure of");
    expect(auditActionLabel("user.created")).toBe("added a person");
  });

  it("derives the rest: module dropped, past tense first", () => {
    expect(auditActionLabel("hrm.leave.approved")).toBe("approved leave");
    expect(auditActionLabel("projects.member_added")).toBe("added member");
    expect(auditActionLabel("course.status_changed_by_admin")).toBe("changed course status by admin");
    expect(auditActionLabel("core.job_title_created")).toBe("created job title");
    expect(auditActionLabel("seats.granted_offline")).toBe("granted seats offline");
  });

  it("never returns nothing, even for a key with no verb", () => {
    expect(auditActionLabel("modules.purchase_")).toBe("modules purchase");
    expect(auditActionLabel("")).toBe("");
  });

  it("capitalises for a column of its own", () => {
    expect(auditActionSentence("hrm.leave.approved")).toBe("Approved leave");
  });
});

describe("auditSubject", () => {
  it("pulls a short name out of an object, and never returns the object", () => {
    expect(auditSubject({ title: "Fire safety", id: 4 })).toBe("Fire safety");
    expect(auditSubject({ email: "ada@acme.test" })).toBe("ada@acme.test");
    expect(auditSubject({ granted: ["hrm"], changes: [] })).toBeNull();
    expect(auditSubject(["x"])).toBeNull();
    expect(auditSubject(null)).toBeNull();
    expect(auditSubject("Plain note")).toBe("Plain note");
  });
});
