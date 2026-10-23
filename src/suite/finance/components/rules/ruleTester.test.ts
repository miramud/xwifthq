import { describe, expect, it } from "vitest";
import { normaliseNarration, testRule } from "./ruleTester";
import { parseBands } from "./FeeBandsEditor";

describe("rule tester", () => {
  it("matches the normalised narration and reads the named groups", () => {
    const r = testRule("^CIB/UTO/(?<purpose>[^/]+)/(?<cp>.+)", "cib/uto/diesel  supply/Adex Ventures Ltd ", { direction: "DR", lineDirection: "DR" });
    expect(r).toMatchObject({ status: "match", purpose: "DIESEL SUPPLY", cp: "ADEX VENTURES LTD" });
  });

  it("says why a line is skipped", () => {
    expect(testRule("REMITA", "REMITA PAYMENT", { direction: "DR", lineDirection: "CR" })).toMatchObject({ status: "no_match", reason: "This rule only looks at money going out." });
    expect(testRule("^SMS", "VAT ON SMS")).toMatchObject({ status: "no_match" });
    expect(testRule("", "x")).toEqual({ status: "empty" });
  });

  it("owns up to patterns the browser cannot preview", () => {
    expect(testRule("(?i)abc", "ABC").status).toBe("unsupported");
  });

  it("normalises like the classifier", () => {
    expect(normaliseNarration("  tnf-  john\tdoe ")).toBe("TNF- JOHN DOE");
  });
});

describe("fee bands", () => {
  it("turns naira rows into kobo bands", () => {
    expect(
      parseBands([
        { upTo: "5,000", fee: "10", vat: "0.75" },
        { upTo: "50000", fee: "26.88", vat: "2.02" },
        { upTo: "", fee: "50", vat: "3.75" },
      ]),
    ).toEqual({
      bands: [
        { upTo: 500_000, fee: 1_000, vat: 75 },
        { upTo: 5_000_000, fee: 2_688, vat: 202 },
        { upTo: null, fee: 5_000, vat: 375 },
      ],
    });
  });

  it("refuses an open band that is not last, and limits that do not rise", () => {
    expect(parseBands([{ upTo: "", fee: "1", vat: "0" }, { upTo: "10", fee: "1", vat: "0" }])).toEqual({ error: "Band 1: only the last band can have no upper limit." });
    expect(parseBands([{ upTo: "10", fee: "1", vat: "0" }, { upTo: "5", fee: "1", vat: "0" }])).toEqual({ error: "Band 2: each limit has to be higher than the one before." });
    expect(parseBands([])).toEqual({ error: "Add at least one band." });
  });
});
