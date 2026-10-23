import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClientsBoard from "./ClientsBoard";
import { clientSummary } from "./fixtures";

/** The client list: where each account stands, totals across the book, search, and each row opening its statement. */

const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/api/finance-revenue-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-revenue-client")>();
  return { ...actual, revenue: { ...actual.revenue, clients: { list: api.list } } };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/revenue/clients",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  window.localStorage.clear();
  api.list.mockReset();
  api.list.mockResolvedValue([
    clientSummary(),
    clientSummary({ clientId: "cp-mlsb", client: "Meridian Library Services Board", outstanding: 0, overdue: 0, retention: 0, lastReceipt: null }),
  ]);
});

describe("ClientsBoard", () => {
  it("lists each client's account, totals the book, and opens a client's statement", async () => {
    render(<ClientsBoard />);
    const table = await screen.findByRole("table");
    const row = within(table).getByText("Eastgate State Scholarship Board").closest("tr") as HTMLElement;
    expect(within(row).getByText("₦9,000,000.00")).toBeInTheDocument();
    expect(within(row).getByText("₦1,075,000.00")).toBeInTheDocument();
    expect(within(row).getByText(/overdue/)).toBeInTheDocument();
    expect(within(table).getByText("None yet")).toBeInTheDocument();
    expect(screen.getByText("1 client owes")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: /Eastgate State Scholarship Board/ })).toHaveAttribute("href", "/suite/finance/revenue/clients/cp-essb");
  });

  it("finds a client by name", async () => {
    const user = userEvent.setup();
    render(<ClientsBoard />);
    await screen.findByRole("table");
    await user.type(screen.getByRole("searchbox", { name: "Search clients" }), "library");
    expect(within(screen.getByRole("table")).queryByText("Eastgate State Scholarship Board")).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Meridian Library Services Board")).toBeInTheDocument();
  });

  it("says when the list did not load", async () => {
    api.list.mockRejectedValue(new Error("boom"));
    render(<ClientsBoard />);
    expect(await screen.findByText(/boom|didn't load/)).toBeInTheDocument();
  });
});
