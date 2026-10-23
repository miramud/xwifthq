import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ComparisonSheet from "./ComparisonSheet";
import { comparison } from "./fixtures";

const auth = vi.hoisted(() => ({ user: { id: "u-1", role: "admin", name: "Adaeze", organisationId: "o", permissions: [] as string[] } }));
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));

/** The comparison sheet: lowest per line, totals with VAT on its own, and the award ballot. */

describe("ComparisonSheet", () => {
  it("marks the lowest on each line and leaves unquoted lines hatched", () => {
    render(<ComparisonSheet comparison={comparison()} />);
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    // header, two lines, then the footer rows
    const laptops = rows[1];
    const bags = rows[2];

    const laptopCells = within(laptops).getAllByRole("cell");
    expect(within(laptopCells[0]).getByText("Lowest")).toBeInTheDocument(); // Konga
    expect(within(laptopCells[1]).queryByText("Lowest")).not.toBeInTheDocument();
    expect(within(laptopCells[0]).getByText("₦915,000.00")).toBeInTheDocument();

    const bagCells = within(bags).getAllByRole("cell");
    expect(bagCells[0]).toHaveTextContent("Not quoted");
    expect(within(bagCells[1]).getByText("Lowest")).toBeInTheDocument(); // Zenith, the only quote
    expect(bagCells[2]).toHaveTextContent("Not quoted");
  });

  it("totals each vendor with VAT shown on its own, and how far over the lowest", () => {
    render(<ComparisonSheet comparison={comparison()} />);
    const vat = screen.getByRole("rowheader", { name: "VAT" }).closest("tr") as HTMLElement;
    expect(within(vat).getAllByRole("cell").map((c) => c.textContent)).toEqual(["₦274,500.00", "₦288,150.00", "₦297,000.00"]);
    const total = screen.getByRole("rowheader", { name: "Total" }).closest("tr") as HTMLElement;
    const cells = within(total).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("₦3,934,500.00");
    expect(cells[0]).toHaveTextContent("Lowest total");
    expect(cells[1]).toHaveTextContent("+5% on the lowest");
    expect(cells[2]).toHaveTextContent("+8.2% on the lowest");
    expect(screen.getByText("Does not meet it")).toBeInTheDocument();
    expect(screen.getByText("5 days")).toBeInTheDocument();
  });

  it("becomes the award ballot: one choice per line, lines may split across vendors", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<ComparisonSheet comparison={comparison()} picks={{ "l-1": "q-konga" }} onPick={onPick} />);
    expect(screen.getByRole("radio", { name: "Award line 1 to Konga Business" })).toBeChecked();
    // Line 2 can only go to the vendor who quoted it.
    expect(screen.queryByRole("radio", { name: "Award line 2 to Konga Business" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Award line 2 to Zenith Office Supplies Ltd" }));
    expect(onPick).toHaveBeenCalledWith("l-2", "q-zenith");
  });

  it("invites the first quotation when there are none", () => {
    render(<ComparisonSheet comparison={comparison({ vendors: [], lines: [] })} />);
    expect(screen.getByText("No quotations yet")).toBeInTheDocument();
  });

  it("puts each quotation's own file on its column, opened through the attachments route", () => {
    render(<ComparisonSheet comparison={comparison()} />);
    const files = screen.getByRole("rowheader", { name: "Quotation file" }).closest("tr") as HTMLElement;
    const cells = within(files).getAllByRole("cell");
    expect(within(cells[0]).getByRole("link", { name: "Open Konga quote W2RYW.pdf, Konga Business's quotation" })).toHaveAttribute("href", "/api/operations/attachments/att-q-konga");
    expect(cells[0]).toHaveTextContent("Keyed in by Ifeoma Nwosu");
    expect(cells[1]).toHaveTextContent("No file");
  });

  it("leaves the files out where the reader can't open them", () => {
    render(<ComparisonSheet comparison={comparison()} showFiles={false} />);
    expect(screen.queryByRole("rowheader", { name: "Quotation file" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Konga quote/ })).not.toBeInTheDocument();
  });
});

describe("ComparisonSheet, vendor links", () => {
  it("links each vendor's column to its counterparty page for an admin", () => {
    render(<ComparisonSheet comparison={comparison()} />);
    expect(screen.getByRole("link", { name: "Konga Business" })).toHaveAttribute("href", "/suite/org/counterparties/v-konga");
    expect(screen.getByRole("link", { name: "Zenith Office Supplies Ltd" })).toHaveAttribute("href", "/suite/org/counterparties/v-zenith");
  });
});
