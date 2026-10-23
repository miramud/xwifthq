import { describe, expect, it } from "vitest";
import type { ResolverInfo, PolicyDefinition } from "@/lib/api/org-foundations-client";
import {
  builderFields,
  cleanContext,
  coerceValue,
  describePath,
  errorAt,
  flagsUsed,
  hasErrorUnder,
  koboToNaira,
  moveItem,
  nairaToKobo,
  newStage,
  normaliseErrors,
  opsFor,
  resolverFor,
  uniqueSlug,
} from "./policy-logic";

/** The builder's logic: money, comparisons, resolver params, and where an error belongs. */

const RESOLVERS: ResolverInfo[] = [
  { kind: "role", label: "Approval role", params: { role: "role" } },
  { kind: "user", label: "A named person", params: { userId: "user" } },
  { kind: "hod_of_unit", label: "Head of a unit", params: { unitId: "unit" } },
  { kind: "line_manager", label: "Line manager", params: {} },
];

const DEF: PolicyDefinition = {
  schema: 1,
  rules: [
    {
      id: "big",
      label: "Over ₦5m",
      when: { any: [{ field: "amount", op: "gt", value: 500000000 }, { not: { field: "flags.urgent", op: "eq", value: true } }] },
      stages: [
        { key: "bursar", name: "Bursar", order: 10, type: "approval", completion: "one", quorum: null, resolver: { kind: "role", role: "BURSAR" }, fallback: null, slaHours: null, parallelGroup: null, distinctPerson: false, canAmend: [] },
      ],
    },
  ],
  bypass: [{ id: "tiny", label: "Petty cash", when: { field: "flags.petty", op: "eq", value: true } }],
  splitting: { enabled: false, windowDays: 30 },
};

describe("money", () => {
  it("turns naira typed by a person into exact kobo", () => {
    expect(nairaToKobo("5,000,000")).toBe(500000000);
    expect(nairaToKobo("₦1,500.50")).toBe(150050);
    expect(nairaToKobo("0.29")).toBe(29); // not 28.999… through a float
    expect(nairaToKobo("12.5")).toBe(1250);
    expect(nairaToKobo(".75")).toBe(75);
    expect(nairaToKobo("")).toBeNull();
    expect(nairaToKobo("abc")).toBeNull();
    expect(nairaToKobo("1.234")).toBeNull();
  });

  it("prints kobo back as naira, dropping .00", () => {
    expect(koboToNaira(500000000)).toBe("5,000,000");
    expect(koboToNaira(150050)).toBe("1,500.50");
    expect(koboToNaira(5)).toBe("0.05");
    expect(koboToNaira(null)).toBe("");
  });
});

describe("comparisons", () => {
  it("offers the operators that fit each field type", () => {
    expect(opsFor("money")).toEqual(expect.arrayContaining(["gt", "between", "lte"]));
    expect(opsFor("money")).not.toContain("contains");
    expect(opsFor("unit")[0]).toBe("within");
    expect(opsFor("list")).toEqual(["contains", "exists"]);
    expect(opsFor("flag")).toEqual(["eq"]);
  });

  it("reshapes the value when the comparison changes", () => {
    expect(coerceValue("money", "between", 100)).toEqual([0, 0]);
    expect(coerceValue("enum", "in", "staff")).toEqual(["staff"]);
    expect(coerceValue("enum", "eq", ["staff"])).toBe("");
    expect(coerceValue("money", "gte", 100)).toBe(100);
    expect(coerceValue("text", "exists", "x")).toBe(true);
  });
});

describe("resolvers and stages", () => {
  it("builds a resolver spec with exactly the params its kind needs", () => {
    expect(resolverFor("user", RESOLVERS)).toEqual({ kind: "user", userId: "" });
    expect(resolverFor("line_manager", RESOLVERS)).toEqual({ kind: "line_manager" });
    // Same kind keeps what was chosen; a different kind starts afresh.
    expect(resolverFor("role", RESOLVERS, { kind: "role", role: "DEAN" })).toEqual({ kind: "role", role: "DEAN" });
    expect(resolverFor("hod_of_unit", RESOLVERS, { kind: "role", role: "DEAN" })).toEqual({ kind: "hod_of_unit", unitId: "" });
  });

  it("adds a stage after the last one, with a key of its own", () => {
    const s = newStage(DEF.rules[0], RESOLVERS);
    expect(s.order).toBe(20);
    expect(s.key).not.toBe("bursar");
    expect(s.resolver).toEqual({ kind: "role", role: "" });
  });

  it("makes unique slugs and moves items", () => {
    expect(uniqueSlug("Rule 1", ["rule-1"])).toBe("rule-1-2");
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    const same = ["a"];
    expect(moveItem(same, 0, -1)).toBe(same);
  });
});

describe("fields and flags", () => {
  it("lists the flags a policy already tests as fields", () => {
    expect(flagsUsed(DEF)).toEqual(["flags.petty", "flags.urgent"]);
    const fields = builderFields([{ key: "amount", label: "Amount", type: "money", options: [] }], DEF);
    expect(fields.map((f) => [f.key, f.type])).toEqual([
      ["amount", "money"],
      ["flags.petty", "flag"],
      ["flags.urgent", "flag"],
    ]);
  });

  it("drops blanks from the simulator context and nests raised flags", () => {
    expect(cleanContext({ amount: 100, unitId: "", tags: [] }, { "flags.urgent": true, "flags.petty": false })).toEqual({
      amount: 100,
      flags: { urgent: true },
    });
  });
});

describe("errors by path", () => {
  const errors = normaliseErrors({
    "definition.rules.0.stages.0.resolver.role": ["No role \"BURSAR\" in this organisation."],
    "rules.0.when.any.0.value": ["Give a list of values."],
  });

  it("reads the validator's dotted paths, with or without definition. in front", () => {
    expect(errorAt(errors, "rules.0.stages.0.resolver.role")).toMatch(/BURSAR/);
    expect(hasErrorUnder(errors, "rules.0")).toBe(true);
    expect(hasErrorUnder(errors, "rules.1")).toBe(false);
    expect(hasErrorUnder(errors, "rules.0.stages.0")).toBe(true);
  });

  it("names the place in words for the summary", () => {
    expect(describePath("rules.0.stages.0.resolver.role", DEF)).toBe("Over ₦5m › Bursar › who approves › role");
    expect(describePath("bypass.0.when", DEF)).toBe("Petty cash › applies when");
    expect(describePath("fallback.kind", DEF)).toBe("If nobody is found › kind");
  });
});
