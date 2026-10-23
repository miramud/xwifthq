import { describe, expect, it } from "vitest";
import { daysFrom, depreciatedPercent, expectedGainLoss, rateText } from "./labels";
import { barsFor } from "./parts";
import { groupStatuses } from "./AssetRegister";
import { roadIndex } from "./AssetDetail";
import { inTab, requestSubject } from "./AssetRequestsDesk";
import { passState } from "./GatePasses";
import { assetRequest } from "./fixtures";
import type { GatePass } from "@/lib/api/operations-assets-client";

/** The arithmetic and wording the asset screens lean on. */

describe("asset arithmetic", () => {
  it("counts days to a date, negative once it has passed", () => {
    expect(daysFrom("2026-10-06", "2026-10-10")).toBe(4);
    expect(daysFrom("2026-10-06", "2026-10-06")).toBe(0);
    expect(daysFrom("2026-10-06", "2026-09-30")).toBe(-6);
    expect(daysFrom("2026-10-06", null)).toBeNull();
  });

  it("reads how far Finance has depreciated an asset", () => {
    expect(depreciatedPercent({ cost: 100, accumulated: 25 })).toBe(25);
    expect(depreciatedPercent({ cost: 100, accumulated: 140 })).toBe(100);
    expect(depreciatedPercent({ cost: 0, accumulated: 0 })).toBe(0);
    expect(depreciatedPercent(null)).toBe(0);
  });

  it("works out a disposal's gain or loss against net book value", () => {
    expect(expectedGainLoss(71_250_000, 80_000_000)).toBe(8_750_000);
    expect(expectedGainLoss(71_250_000, 5_000_000)).toBe(-66_250_000);
    expect(expectedGainLoss(71_250_000, null)).toBe(-71_250_000);
    expect(expectedGainLoss(null, 5_000_000)).toBeNull();
  });

  it("says a depreciation rate as people do", () => {
    expect(rateText(2500)).toBe("25% a year");
    expect(rateText(1250)).toBe("12.5% a year");
    expect(rateText(null)).toBe("-");
  });

  it("draws the same barcode for the same tag, and a different one for another", () => {
    expect(barsFor("MPT/LAP/0001")).toEqual(barsFor("MPT/LAP/0001"));
    expect(barsFor("MPT/LAP/0001")).not.toEqual(barsFor("MPT/LAP/0002"));
    expect(barsFor("X").every((b) => b >= 1 && b <= 3)).toBe(true);
  });
});

describe("grouping and tabs", () => {
  it("folds statuses into where things are", () => {
    const g = groupStatuses({ in_store: 2, allocated: 3, in_transit: 1, received: 1, lost: 1, stolen: 1 });
    expect(g.map((x) => [x.label, x.value])).toEqual([
      ["In store", 2],
      ["With somebody", 4],
      ["Being dealt with", 1],
      ["Lost or stolen", 2],
      ["Disposed", 0],
    ]);
  });

  it("places an asset on its road, or off it", () => {
    expect(roadIndex("received")).toBe(0);
    expect(roadIndex("allocated")).toBe(3);
    expect(roadIndex("under_maintenance")).toBe(-1);
  });

  it("puts each request under the right desk tab and names its subject", () => {
    expect(inTab(assetRequest({ status: "approved" }), "to_fulfil")).toBe(true);
    expect(inTab(assetRequest({ status: "converted" }), "done")).toBe(true);
    expect(inTab(assetRequest({ status: "cancelled" }), "closed")).toBe(true);
    expect(inTab(assetRequest({ status: "draft" }), "to_fulfil")).toBe(false);
    expect(requestSubject(assetRequest())).toBe("Laptops");
    expect(requestSubject(assetRequest({ asset: { id: "a1", tagNo: "MPT/LAP/0001", name: "Dell", status: "allocated" } }))).toBe("MPT/LAP/0001 Dell");
  });

  it("says where a gate pass stands", () => {
    const pass = (over: Partial<GatePass>): GatePass => ({ id: "g", number: "GP1", holder: null, purpose: null, destination: null, outAt: "2026-10-01T09:00:00Z", dueBackOn: "2026-10-10", returnedAt: null, overdue: false, assets: [], ...over });
    expect(passState(pass({}), "2026-10-06")).toEqual({ label: "Due back 10 Oct 2026", hue: "sky" });
    expect(passState(pass({ dueBackOn: "2026-10-07" }), "2026-10-06")).toEqual({ label: "Due back in 1 day", hue: "sun" });
    expect(passState(pass({ dueBackOn: "2026-10-06" }), "2026-10-06").label).toBe("Due back today");
    expect(passState(pass({ dueBackOn: "2026-10-03", overdue: true }), "2026-10-06")).toEqual({ label: "3 days overdue", hue: "rose" });
    expect(passState(pass({ returnedAt: "2026-10-05T10:00:00Z" }), "2026-10-06").label).toBe("Back in");
  });
});
