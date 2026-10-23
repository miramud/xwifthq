import { describe, expect, it } from "vitest";
import { ApiError, errorCode, plain, spendError, spendFieldErrors } from "@/lib/api/finance-spend-client";
import { nextStep, requestStage, requiredAt, retirementSum, slaState, workingDaysWaited } from "./labels";

/** The road a request travels, what happens next, service levels, and the sums. */

describe("requestStage", () => {
  it("walks a payment from raised to paid", () => {
    expect(requestStage({ status: "draft", type: "payment" })).toMatchObject({ done: 0, stopped: false });
    expect(requestStage({ status: "in_approval", type: "payment" }).done).toBe(1);
    expect(requestStage({ status: "fcu_queried", type: "payment" })).toMatchObject({ done: 2, flagged: true });
    expect(requestStage({ status: "fcu_cleared", type: "payment", vouchers: [] }).done).toBe(3);
    expect(requestStage({ status: "fcu_cleared", type: "payment", vouchers: [{ id: "v", pvNo: null, status: "draft", amount: 1, net: 1 }] }).done).toBe(4);
    expect(requestStage({ status: "paid", type: "payment" })).toMatchObject({ done: 5, steps: ["Raised", "Approved", "FCU cleared", "Voucher", "Paid"] });
  });

  it("adds retirement for an advance, and stops where a request was rejected", () => {
    const paid = requestStage({ status: "awaiting_retirement", type: "advance" });
    expect(paid.steps).toHaveLength(6);
    expect(paid.done).toBe(5);
    expect(requestStage({ status: "retired", type: "advance" }).done).toBe(6);
    expect(requestStage({ status: "rejected", type: "payment", reviews: [] })).toMatchObject({ done: 1, stopped: true });
    expect(
      requestStage({ status: "rejected", type: "payment", reviews: [{ id: "r", checkpoint: 1, outcome: "rejected", reviewer: "Ruth", items: [], comment: "x", at: null }] }),
    ).toMatchObject({ done: 2, stopped: true });
  });
});

describe("nextStep", () => {
  it("says whose move it is, from the requester's side", () => {
    expect(nextStep({ status: "awaiting_fcu", type: "payment" })).toMatchObject({ text: "Waiting for the FCU", who: "others" });
    expect(nextStep({ status: "fcu_queried", type: "payment" })).toMatchObject({ text: "Answer the FCU's query", who: "you" });
    expect(nextStep({ status: "awaiting_retirement", type: "advance", retirement: null })).toMatchObject({ text: "Retire your advance", who: "you" });
    expect(nextStep({ status: "awaiting_retirement", type: "advance", retirement: { status: "submitted" } as never }).who).toBe("others");
  });
});

describe("service levels", () => {
  // Tuesday 6 Oct 2026, 15:00.
  const now = new Date(2026, 9, 6, 15, 0);

  it("leaves weekends out of the wait", () => {
    // Since Friday 15:00: Fri 9h + Mon 24h + Tue 15h = 48h, two working days.
    expect(workingDaysWaited(4, now)).toBe(2);
    expect(workingDaysWaited(0.5, now)).toBe(0.5);
  });

  it("calls work in time, due, or overdue - in words", () => {
    expect(slaState(0.2, 1, now)).toMatchObject({ hue: "mint", overdue: false, label: "In time · arrived today" });
    expect(slaState(0.9, 1, now)).toMatchObject({ hue: "sun", overdue: false });
    expect(slaState(4, 1, now)).toMatchObject({ hue: "rose", overdue: true, label: "Overdue · 1 working day late" });
    expect(slaState(4, 2, now).overdue).toBe(false);
    expect(slaState(null, 1, now).label).toBe("Just arrived");
  });
});

describe("checklist and sums", () => {
  it("applies the three-quote rule from its threshold", () => {
    const quotes = { required: true, requiredFrom: 100_000_000 };
    expect(requiredAt(quotes, 50_000_000)).toBe(false);
    expect(requiredAt(quotes, 100_000_000)).toBe(true);
    expect(requiredAt({ required: false, requiredFrom: null }, 1)).toBe(false);
  });

  it("checks that spent plus returned equals the advance", () => {
    expect(retirementSum([150_000_00, 50_000_00], 0, 200_000_00)).toMatchObject({ balanced: true, gap: 0 });
    expect(retirementSum([150_000_00, null], 20_000_00, 200_000_00)).toMatchObject({ balanced: false, gap: 30_000_00, accounted: 170_000_00 });
    expect(retirementSum([250_000_00], 0, 200_000_00).gap).toBe(-50_000_00);
  });
});

describe("API messages", () => {
  it("takes the code off a message and keeps it for logic", () => {
    const e = new ApiError("The given data was invalid.", 422, { duties: ["SOD_VIOLATION: you are the requester on this document, so you cannot also act as its FCU officer."] });
    expect(errorCode(e)).toBe("SOD_VIOLATION");
    expect(spendError(e)).toBe("you are the requester on this document, so you cannot also act as its FCU officer.");
    expect(spendFieldErrors(e).duties).toMatch(/^you are the requester/);
    expect(plain("INSUFFICIENT_PROJECT_FUNDS: the project has ₦1.00 available")).toBe("the project has ₦1.00 available");
    expect(errorCode(new ApiError("Plain words.", 422))).toBeNull();
  });
});
