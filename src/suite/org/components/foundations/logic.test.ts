import { describe, expect, it } from "vitest";
import type { BankAccount, OrgProfile, OrgUnit } from "@/lib/api/org-foundations-client";
import {
  bankStage,
  bankTimeline,
  buildTree,
  changedPatch,
  descendantIds,
  formToPatch,
  formatProblem,
  goesThroughApprovals,
  insertToken,
  TOKENS,
  isRateText,
  mayCheck,
  moveTargets,
  profileToForm,
  ratesByCurrency,
  toggleDay,
  validateProfile,
  visibleRows,
} from "./logic";

const profile = (over: Partial<OrgProfile> = {}): OrgProfile => ({
  legalName: "Meridian Polytechnic Ltd",
  tradingName: null,
  shortCode: "MPT",
  rcNumber: "RC 1234",
  tin: null,
  vatNumber: null,
  addressLine1: "1 Marina",
  addressLine2: null,
  city: "Lagos",
  state: "Lagos",
  postalCode: null,
  country: "NG",
  address: "1 Marina, Lagos",
  displayName: "Meridian Polytechnic Ltd",
  baseCurrency: "NGN",
  fiscalYearStartMonth: 1,
  fiscalYearStartDay: 1,
  timezone: "Africa/Lagos",
  workingDays: [5, 1, 2, 3, 4],
  workStartsAt: "08:00",
  workEndsAt: "17:00",
  documentFooter: null,
  updatedAt: null,
  ...over,
});

describe("profile mapping", () => {
  it("turns blanks into null, upper-cases codes and sorts working days", () => {
    const f = profileToForm(profile());
    expect(f.workingDays).toEqual([1, 2, 3, 4, 5]);
    const patch = formToPatch({ ...f, tradingName: "  ", shortCode: "mpt2", country: "gh", workingDays: [6, 1, 1, 3] });
    expect(patch.tradingName).toBeNull();
    expect(patch.shortCode).toBe("MPT2");
    expect(patch.country).toBe("GH");
    expect(patch.workingDays).toEqual([1, 3, 6]);
  });

  it("sends only what changed, so an untouched base currency is never re-sent", () => {
    const f = profileToForm(profile());
    const patch = changedPatch(f, { ...f, workingDays: toggleDay(f.workingDays, 6) });
    expect(patch).toEqual({ workingDays: [1, 2, 3, 4, 5, 6] });
    expect("baseCurrency" in patch).toBe(false);
  });

  it("always sends the start and end of the day together", () => {
    const f = profileToForm(profile());
    expect(changedPatch(f, { ...f, workEndsAt: "16:30" })).toEqual({ workStartsAt: "08:00", workEndsAt: "16:30" });
  });

  it("toggles a day off and on", () => {
    expect(toggleDay([1, 2, 3], 2)).toEqual([1, 3]);
    expect(toggleDay([1, 3], 2)).toEqual([1, 2, 3]);
  });

  it("catches what the browser can before the API does", () => {
    const f = profileToForm(profile());
    const errors = validateProfile({ ...f, shortCode: "TOO-LONG-CODE", workingDays: [], workEndsAt: "07:00", country: "NGA" });
    expect(Object.keys(errors).sort()).toEqual(["country", "shortCode", "workEndsAt", "workingDays"]);
    expect(validateProfile(f)).toEqual({});
  });
});

describe("exchange rates", () => {
  it("accepts decimal text only", () => {
    expect(isRateText("1545.25")).toBe(true);
    expect(isRateText("0")).toBe(false);
    expect(isRateText("1.123456789")).toBe(false);
    expect(isRateText("1e3")).toBe(false);
  });

  it("groups rates per currency, oldest first", () => {
    const g = ratesByCurrency([
      { id: "2", currency: "USD", baseCurrency: "NGN", rate: "1600", asOf: "2026-10-02", source: null },
      { id: "1", currency: "USD", baseCurrency: "NGN", rate: "1500", asOf: "2026-09-01", source: null },
      { id: "3", currency: "EUR", baseCurrency: "NGN", rate: "1700", asOf: "2026-09-15", source: null },
    ]);
    expect(g.map((x) => x.currency)).toEqual(["EUR", "USD"]);
    expect(g[1].rates.map((r) => r.id)).toEqual(["1", "2"]);
    expect(g[1].latest.rate).toBe("1600");
  });
});

const unit = (id: string, parentId: string | null, over: Partial<OrgUnit> = {}): OrgUnit => ({
  id,
  parentId,
  code: id.toUpperCase(),
  name: id,
  kind: "department",
  description: null,
  status: "active",
  depth: 0,
  sortOrder: 0,
  memberCount: 0,
  defaultCostCentre: null,
  head: null,
  heads: [],
  ...over,
});

describe("unit tree", () => {
  // ops ── fin ── acc
  //     └─ hr
  // orphan (parent missing)
  const units = [unit("hr", "ops", { sortOrder: 2 }), unit("acc", "fin"), unit("fin", "ops", { sortOrder: 1 }), unit("ops", null), unit("orphan", "gone")];

  it("builds the tree from the flat list, ordered, with orphans at the top", () => {
    const tree = buildTree(units);
    expect(tree.map((n) => n.unit.id)).toEqual(["ops", "orphan"]);
    expect(tree[0].children.map((n) => n.unit.id)).toEqual(["fin", "hr"]);
    expect(tree[0].children[0].children[0].unit.id).toBe("acc");
    expect(tree[0].children[0].children[0].level).toBe(2);
  });

  it("hides the children of a collapsed unit", () => {
    const tree = buildTree(units);
    expect(visibleRows(tree, new Set()).map((n) => n.unit.id)).toEqual(["ops", "fin", "acc", "hr", "orphan"]);
    expect(visibleRows(tree, new Set(["fin"])).map((n) => n.unit.id)).toEqual(["ops", "fin", "hr", "orphan"]);
  });

  it("never offers a unit itself or anything beneath it as a new parent", () => {
    const ops = units.find((u) => u.id === "ops")!;
    expect([...descendantIds("ops", units)].sort()).toEqual(["acc", "fin", "hr"]);
    expect(moveTargets(ops, units).map((u) => u.id)).toEqual(["orphan"]);
    const fin = units.find((u) => u.id === "fin")!;
    expect(moveTargets(fin, units).map((u) => u.id).sort()).toEqual(["hr", "ops", "orphan"]);
  });

  it("leaves retired units out of the move picker", () => {
    const list = [...units, unit("old", null, { status: "retired" })];
    expect(moveTargets(list.find((u) => u.id === "acc")!, list).map((u) => u.id)).not.toContain("old");
  });
});

const account = (over: Partial<BankAccount> = {}): BankAccount => ({
  id: "a1",
  bankName: "Zenith",
  bankCode: null,
  accountName: "Acme Ltd",
  number: "•••• 5678",
  currency: "NGN",
  isDefault: false,
  status: "pending_approval",
  requestedBy: { id: "maker", name: "Mary Maker" },
  decidedBy: null,
  decidedAt: null,
  rejectionReason: null,
  requestedAt: "2026-10-01T09:00:00Z",
  ...over,
});

describe("bank accounts, maker-checker", () => {
  it("shows a pending account as entered and waiting for a second person", () => {
    const steps = bankTimeline(account());
    expect(steps.map((s) => s.key)).toEqual(["entered", "waiting"]);
    expect(steps[0].who).toBe("Mary Maker");
  });

  it("names who approved or rejected it", () => {
    expect(bankTimeline(account({ status: "active", decidedBy: { id: "c", name: "Carl Checker" } }))[1]).toMatchObject({ label: "Approved", who: "Carl Checker" });
    expect(bankTimeline(account({ status: "rejected", decidedBy: { id: "c", name: "Carl Checker" } }))[1]).toMatchObject({ label: "Rejected", tone: "refused" });
    expect(bankStage(account({ status: "retired" }))).toBe("retired");
  });

  it("never lets the maker check their own entry", () => {
    expect(mayCheck(account(), "maker")).toBe(false);
    expect(mayCheck(account(), "someone-else")).toBe(true);
    expect(mayCheck(account({ status: "active" }), "someone-else")).toBe(false);
  });

  it("recognises the approval-engine refusal", () => {
    expect(goesThroughApprovals("These bank details are going through approval. Decide them from Approvals.")).toBe(true);
    expect(goesThroughApprovals("You entered these details.")).toBe(false);
  });
});

describe("reference formats", () => {
  it("inserts a token at the caret, replacing a selection", () => {
    expect(insertToken("INV//{NNNN}", "{ORG}", 4)).toEqual({ value: "INV/{ORG}/{NNNN}", caret: 9 });
    expect(insertToken("INV-XX-{NNNN}", "{YYYY}", 4, 6)).toEqual({ value: "INV-{YYYY}-{NNNN}", caret: 10 });
    expect(insertToken("INV-", "{YY}", null)).toEqual({ value: "INV-{YY}", caret: 8 });
  });

  it("swaps the running number rather than adding a second", () => {
    expect(insertToken("INV-{NNNN}", "{NNNNNN}", 0).value).toBe("INV-{NNNNNN}");
  });

  it("needs exactly one running number", () => {
    expect(formatProblem("INV-{YYYY}")).toMatch(/running number/);
    expect(formatProblem("{NN}-{NNN}")).toMatch(/one running number/);
    expect(formatProblem("INV-{NNNN}")).toBeNull();
  });
});

describe("numbering tokens", () => {
  it("offers {CLIENT} for the client or vendor short code, right after {CAT}", () => {
    const tokens = TOKENS.map((t) => t.token);
    expect(tokens).toEqual(["{ORG}", "{SERIES}", "{DEPT}", "{CC}", "{CAT}", "{CLIENT}", "{YYYY}", "{YY}", "{MM}", "{MMYYYY}", "{FY}", "{NNNN}"]);
    expect(TOKENS.find((t) => t.token === "{CLIENT}")?.label).toBe("Client or vendor short code");
  });
});
