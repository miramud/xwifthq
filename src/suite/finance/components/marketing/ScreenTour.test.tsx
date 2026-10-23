import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScreenTour, type TourStop } from "@/suite/finance/components/marketing/ScreenTour";

/**
 * The tour is a real tablist: clicking or arrowing swaps the visible screen,
 * the selection wraps, and every panel stays in the DOM (hidden) so its copy is
 * server-rendered and indexable.
 */
const STOPS: TourStop[] = [
  { id: "a", label: "Vouchers", title: "Payment vouchers", body: "Memo to bank.", screen: <p>Vouchers screen</p> },
  { id: "b", label: "Banking", title: "Bank statements", body: "Import and reconcile.", screen: <p>Banking screen</p> },
  { id: "c", label: "Budgets", title: "Company budgets", body: "Block or warn.", screen: <p>Budgets screen</p> },
];

describe("ScreenTour", () => {
  it("renders one tab per stop with the first selected and the rest hidden", () => {
    render(<ScreenTour stops={STOPS} label="Finance screens" ruleClass="bg-accent-500" />);

    expect(screen.getByRole("tablist", { name: "Finance screens" })).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Vouchers screen")).toBeVisible();
    expect(screen.getByText("Banking screen")).not.toBeVisible();
  });

  it("switches on click and on arrow keys, wrapping at the ends", async () => {
    const user = userEvent.setup();
    render(<ScreenTour stops={STOPS} label="Finance screens" ruleClass="bg-accent-500" />);
    const tabs = screen.getAllByRole("tab");

    await user.click(tabs[2]);
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Budgets screen")).toBeVisible();

    await user.keyboard("{ArrowDown}");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Home}");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
  });
});
