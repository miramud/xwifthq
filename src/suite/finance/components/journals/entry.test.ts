import { describe, expect, it } from "vitest";
import { ApiError, type Account } from "@/lib/api/finance-ledger-client";
import { blankRow, errorsByRow, prepare, totals, type EntryRow } from "./entry";
import { journalErrors, plainError } from "./meta";

/** The entry grid's arithmetic: totals per currency, what is sent, and where errors land. */

const acct = (over: Partial<Account>): Account => ({
  id: "a",
  code: "1000",
  name: "A",
  type: "asset",
  subtype: null,
  parentId: null,
  level: 1,
  isPostable: true,
  normalBalance: "debit",
  requires: [],
  requiresProject: false,
  requiresCostCentre: false,
  requiresCounterparty: false,
  requiresPerson: false,
  currency: null,
  isBank: false,
  systemKey: null,
  cashFlow: null,
  description: null,
  active: true,
  used: false,
  aliases: [],
  ...over,
});

const ACCOUNTS = new Map(
  [
    acct({ id: "bank", code: "1110", name: "Main operating account" }),
    acct({ id: "usd", code: "1140", name: "Domiciliary account (USD)", currency: "USD" }),
    acct({ id: "fees", code: "4100", name: "Tuition", type: "revenue", normalBalance: "credit", requires: ["cost centre"], requiresCostCentre: true }),
  ].map((a) => [a.id, a]),
);

const row = (p: Partial<EntryRow>): EntryRow => ({ ...blankRow(), ...p });

describe("journal entry", () => {
  it("totals each currency apart and ignores untouched rows", () => {
    const t = totals(
      [row({ accountId: "bank", debit: "1,000.50" }), row({ accountId: "fees", credit: "1000.5" }), row({ accountId: "usd", debit: "20" }), blankRow()],
      ACCOUNTS,
    );
    expect(t.get("")).toEqual({ debits: 100050, credits: 100050 });
    expect(t.get("USD")).toEqual({ debits: 2000, credits: 0 });
  });

  it("checks one side per line and the dimensions an account demands, before asking the API", () => {
    const rows = [row({ accountId: "bank", debit: "500", credit: "500" }), blankRow(), row({ accountId: "fees", credit: "500" })];
    const p = prepare({ date: "2026-09-30", narration: "Fees", type: "manual" }, rows, ACCOUNTS);
    expect(p.input).toBeNull();
    const byRow = errorsByRow(p.errors, p.sent);
    expect(byRow[rows[0].key].debit).toMatch(/not both/);
    expect(byRow[rows[2].key].costCentreId).toMatch(/Required/);
  });

  it("sends minor units, the bound currency and only the dimensions chosen", () => {
    const rows = [row({ accountId: "usd", debit: "1,250" }), row({ accountId: "fees", credit: "1,875,000.00", costCentreId: "cc-1", narration: " Session 1 " })];
    const p = prepare({ date: "2026-09-30", narration: " Fees received ", type: "manual" }, rows, ACCOUNTS);
    expect(p.input).toEqual({
      journalDate: "2026-09-30",
      narration: "Fees received",
      type: "manual",
      lines: [
        expect.objectContaining({ accountId: "usd", debit: 125000, credit: null, currency: "USD", costCentreId: null }),
        expect.objectContaining({ accountId: "fees", debit: null, credit: 187500000, currency: null, costCentreId: "cc-1", narration: "Session 1" }),
      ],
    });
  });

  it("drops the ledger's codes from its messages", () => {
    expect(plainError("JOURNAL_UNBALANCED: debits ₦10.00, credits ₦9.00 - a difference of ₦1.00.")).toBe("debits ₦10.00, credits ₦9.00 - a difference of ₦1.00.");
    expect(plainError("DIMENSION_REQUIRED: cost centre - 4100 Tuition needs one on every line.")).toBe("Choose a cost centre: 4100 Tuition needs one on every line.");
    expect(plainError("PERIOD_LOCKED: July 2026 is locked. Post the adjustment in the next open month.")).toBe("July 2026 is locked. Post the adjustment in the next open month.");
  });

  it("places a 422's messages on the line and field they are about", () => {
    const e = journalErrors(
      new ApiError("Invalid", 422, {
        "lines.1.cost_centre_id": ["DIMENSION_REQUIRED: cost centre - 4100 Tuition needs one on every line."],
        lines: ["JOURNAL_UNBALANCED: debits ₦1.00, credits ₦2.00 - a difference of ₦1.00."],
        journal_date: ["PERIOD_LOCKED: July 2026 is locked."],
      }),
    );
    expect(e.lines[1].costCentreId).toBe("Choose a cost centre: 4100 Tuition needs one on every line.");
    expect(e.grid).toMatch(/^debits/);
    expect(e.date).toBe("July 2026 is locked.");
  });
});
