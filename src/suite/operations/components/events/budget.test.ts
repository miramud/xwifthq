import { describe, expect, it } from "vitest";
import { eventBudget, lineBars } from "./budget";

/** The event budget's total and contingency cap, as `Events::fill` checks them, and the dashboard's bars. */

describe("eventBudget", () => {
  it("totals the lines and caps contingency at 10% of the others", () => {
    const s = eventBudget([
      { category: "venue", amount: 70_000_000 },
      { category: "meals", amount: 61_200_000 },
      { category: "printing", amount: 25_500_000 },
      { category: "contingency", amount: 15_000_000 },
    ]);
    expect(s).toEqual({ total: 171_700_000, contingency: 15_000_000, others: 156_700_000, cap: 15_670_000, overCap: false });
  });

  it("allows contingency at exactly the cap and refuses a kobo more", () => {
    expect(eventBudget([{ category: "venue", amount: 100_000 }, { category: "contingency", amount: 10_000 }]).overCap).toBe(false);
    expect(eventBudget([{ category: "venue", amount: 100_000 }, { category: "contingency", amount: 10_001 }]).overCap).toBe(true);
  });

  it("refuses contingency on its own, and treats empty amounts as nothing", () => {
    expect(eventBudget([{ category: "contingency", amount: 5_000 }]).overCap).toBe(true);
    expect(eventBudget([{ category: "venue", amount: null }, { category: "contingency", amount: undefined }])).toMatchObject({ total: 0, overCap: false });
  });

  it("takes another cap when the organisation sets one", () => {
    expect(eventBudget([{ category: "venue", amount: 100_000 }, { category: "contingency", amount: 15_000 }], 1500).overCap).toBe(false);
  });
});

describe("lineBars", () => {
  it("scales committed and paid against the budget", () => {
    expect(lineBars({ budget: 25_500_000, committed: 24_000_000, paid: 12_000_000 })).toEqual({
      budgetPct: 100,
      committedPct: 94.1,
      paidPct: 47.1,
      over: false,
      available: 1_500_000,
    });
  });

  it("rescales to the commitment when a line runs over", () => {
    const b = lineBars({ budget: 100, committed: 125, paid: 0 });
    expect(b).toMatchObject({ budgetPct: 80, committedPct: 100, over: true, available: -25 });
  });

  it("draws nothing for an empty line", () => {
    expect(lineBars({ budget: 0, committed: 0, paid: 0 })).toMatchObject({ budgetPct: 0, committedPct: 0, paidPct: 0, over: false });
  });
});
