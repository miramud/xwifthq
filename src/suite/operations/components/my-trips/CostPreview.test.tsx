import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import CostPreview from "./CostPreview";
import { leadTime, tripCost } from "../travel/cost";
import { OPTIONS, RATES } from "../travel/fixtures";

/** The editor's live preview: each traveller's entitlement, the total, and the two warnings. */

const names = Object.fromEntries(OPTIONS.staff.map((s) => [s.id, s.name]));

function preview(travellers: { userId: string; grade: string; dta?: number | null; hotel?: number | null }[], departsOn = "2026-10-13", today = "2026-10-01") {
  const cost = tripCost({ rates: RATES, destinationClass: "local_tier1", departsOn, returnsOn: "2026-10-15", legs: [{ mode: "air" }], travellers, flightsEstimate: 36_000_000 });
  return render(<CostPreview cost={cost} lead={leadTime(departsOn, "local_tier1", today)} names={names} grades={OPTIONS.travelGrades} />);
}

describe("CostPreview", () => {
  it("shows each traveller's DTA, hotel and taxi and the trip estimate", () => {
    preview([
      { userId: "u-efe", grade: "senior" },
      { userId: "u-yusuf", grade: "officer" },
    ]);
    expect(screen.getByText("3 days · 2 nights")).toBeInTheDocument();
    const efe = screen.getByText("Efe Omoregie").closest("li") as HTMLElement;
    expect(within(efe).getByText("₦97,500.00")).toBeInTheDocument();
    expect(within(efe).getByText("₦117,000.00")).toBeInTheDocument();
    expect(within(efe).getByText("Airport taxi × 2")).toBeInTheDocument();
    expect(screen.getByText("₦439,500.00")).toBeInTheDocument(); // advance
    expect(screen.getByText("₦799,500.00")).toBeInTheDocument(); // estimate
    expect(screen.queryByText(/Above policy/)).not.toBeInTheDocument();
    expect(screen.queryByText(/booked at least/)).not.toBeInTheDocument();
  });

  it("flags a hand-set hotel above policy, with the policy figure beside it", () => {
    preview([{ userId: "u-yusuf", grade: "officer", hotel: 12_000_000 }]);
    expect(screen.getByText(/Above policy: needs justification and the MD/)).toBeInTheDocument();
    expect(screen.getByText("₦120,000.00")).toHaveClass("tabular-nums");
    expect(screen.getByText(/^policy/)).toHaveTextContent("policy ₦90,000.00");
  });

  it("warns when a local trip leaves inside its 7-day lead time", () => {
    preview([{ userId: "u-efe", grade: "senior" }], "2026-10-13", "2026-10-09");
    expect(screen.getByText(/Leaves in 4 days/)).toHaveTextContent("local trips are booked at least 7 days ahead");
    expect(screen.getByText("Say why it is booked late before you send it.")).toBeInTheDocument();
  });

  it("asks for travellers before it can cost anyone", () => {
    preview([]);
    expect(screen.getByText("Add who is travelling to see what each person is entitled to.")).toBeInTheDocument();
  });
});
