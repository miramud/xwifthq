import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { BudgetDashboard, LineBarsView } from "./EventParts";
import BudgetTotals from "../my-events/BudgetTotals";
import { eventBudget } from "./budget";
import { eventFull } from "../travel/fixtures";

/** The event dashboard's bars and links, and the editor's budget total with its contingency cap. */

const bar = (container: HTMLElement, key: string) => container.querySelector(`[data-bar="${key}"]`) as HTMLElement;

describe("LineBarsView", () => {
  it("draws budget, committed and paid on one scale, with their figures", () => {
    const { container } = render(<LineBarsView line={{ budget: 25_500_000, committed: 24_000_000, paid: 12_000_000 }} />);
    expect(bar(container, "budget").style.width).toBe("100%");
    expect(bar(container, "committed").style.width).toBe("94.1%");
    expect(bar(container, "paid").style.width).toBe("47.1%");
    expect(screen.getByText("₦255,000.00")).toBeInTheDocument();
    expect(screen.getByText("₦240,000.00")).toBeInTheDocument();
    expect(screen.getByText("₦120,000.00")).toBeInTheDocument();
  });

  it("turns the committed bar rose and says by how much when a line runs over", () => {
    const { container } = render(<LineBarsView line={{ budget: 100_000, committed: 125_000, paid: 0 }} />);
    expect(bar(container, "committed")).toHaveClass("bg-rose-500");
    expect(bar(container, "budget").style.width).toBe("80%");
    expect(screen.getByText(/Committed ₦250.00 beyond the line's budget/)).toBeInTheDocument();
  });
});

describe("BudgetDashboard", () => {
  it("lists each line with its channel and links what was raised from it", () => {
    const ev = eventFull();
    render(
      <BudgetDashboard
        dashboard={ev.dashboard!}
        links={{ request: (d) => `/suite/operations/my/requests/${d.id}`, order: () => null, trip: (d) => `/suite/operations/my/trips/${d.id}` }}
        actions={(l) => <button type="button">Raise for line {l.lineNo}</button>}
      />,
    );
    expect(screen.getByText("₦1.1M")).toBeInTheDocument(); // budget total, compact
    const printing = screen.getByRole("article", { name: "Line 3: Training booklets and certificates" });
    expect(within(printing).getByRole("link", { name: "MPT/PR/2026/0004" })).toHaveAttribute("href", "/suite/operations/my/requests/pr-4");
    expect(within(printing).getByText("Vendor")).toBeInTheDocument();
    const contingency = screen.getByRole("article", { name: "Line 4: Contingency" });
    expect(within(contingency).getByText("Advance")).toBeInTheDocument();
    expect(within(contingency).getByText(/Nothing raised from this line yet/)).toBeInTheDocument();
    expect(within(contingency).getByRole("button", { name: "Raise for line 4" })).toBeInTheDocument();
  });
});

describe("BudgetTotals", () => {
  it("shows the live total and the contingency cap", () => {
    render(<BudgetTotals summary={eventBudget([{ category: "venue", amount: 70_000_000 }, { category: "contingency", amount: 5_000_000 }])} />);
    expect(screen.getByText("₦750,000.00")).toBeInTheDocument();
    expect(screen.getByText("₦70,000.00")).toBeInTheDocument(); // the cap
    expect(screen.getByRole("meter", { name: "Contingency against its cap" })).toHaveAttribute("aria-valuetext", "₦50,000.00 of ₦70,000.00");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says by how much contingency is over its cap", () => {
    render(<BudgetTotals summary={eventBudget([{ category: "venue", amount: 70_000_000 }, { category: "contingency", amount: 8_000_000 }])} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Contingency is ₦10,000.00 over its cap. Lower it to ₦70,000.00 or less.");
  });
});
