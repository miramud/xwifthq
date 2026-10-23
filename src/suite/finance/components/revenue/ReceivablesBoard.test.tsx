import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReceivablesBoard from "./ReceivablesBoard";
import { ADVANCES, WHT_REGISTER, aged } from "./fixtures";

/** Aged receivables: the tiles, a column per client by age with its data table, a client opened; the WHT register. */

const api = vi.hoisted(() => ({ aged: vi.fn(), wht: vi.fn(), note: vi.fn(), advances: vi.fn() }));
const nav = vi.hoisted(() => ({ params: new URLSearchParams() }));

vi.mock("@/lib/api/finance-revenue-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-revenue-client")>();
  return {
    ...actual,
    revenue: {
      ...actual.revenue,
      receivables: { ...actual.revenue.receivables, aged: api.aged, advances: api.advances },
      receipts: { ...actual.revenue.receipts, whtRegister: api.wht, creditNote: api.note },
    },
  };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-1", role: "admin", name: "Accountant", organisationId: "o", permissions: [] }, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/revenue/receivables",
  useSearchParams: () => nav.params,
}));

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  nav.params = new URLSearchParams();
  api.aged.mockResolvedValue(aged());
  api.wht.mockResolvedValue(WHT_REGISTER);
  api.advances.mockResolvedValue(ADVANCES);
});

describe("ReceivablesBoard", () => {
  it("shows the book's tiles and a column per client split by age, with the figures in a table", async () => {
    render(<ReceivablesBoard />);
    expect(await screen.findByText("Owed to us")).toBeInTheDocument();
    expect(screen.getAllByText("₦8.7M").length).toBeGreaterThan(0);
    expect(screen.getByText("Nothing past due")).toBeInTheDocument();
    // The donut's legend is in money, with each bucket's full name.
    expect(screen.getAllByText("₦7.7M").length).toBeGreaterThan(0);
    expect(screen.getAllByText("₦994.4K").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Over 90 days").length).toBeGreaterThan(0);
    expect(screen.queryByText("765937500")).not.toBeInTheDocument();

    const table = screen.getByRole("table", { name: /What each client owes by age/ });
    expect(within(table).getByRole("columnheader", { name: "Retention held" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: /Meridian Library/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Not yet due ₦7,659,375.00, Retention held ₦994,375.00" })).toBeInTheDocument();
  });

  it("opens a client to show the invoices behind their figure, each linked", async () => {
    const user = userEvent.setup();
    render(<ReceivablesBoard />);
    await user.click(await screen.findByRole("button", { name: /Meridian Library Services Board/ }));
    expect(screen.getByRole("link", { name: /INV\/2026\/0002/ })).toHaveAttribute("href", "/suite/finance/revenue/invoices/inv-2");
    expect(screen.getByText("Retention ₦591,250.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /statement/ })).toHaveAttribute("href", "/suite/finance/revenue/clients/cp-mlsb");
  });

  it("ages as at another date", async () => {
    render(<ReceivablesBoard />);
    const asAt = await screen.findByLabelText("As at");
    fireEvent.change(asAt, { target: { value: "2026-09-30" } });
    expect(api.aged).toHaveBeenLastCalledWith("2026-09-30");
  });

  it("lists WHT credit notes still to collect and records one received", async () => {
    const user = userEvent.setup();
    api.note.mockResolvedValue({ id: "rct-2", whtCreditNote: "received", whtCreditNoteRef: "MLSB/WHT/0021" });
    render(<ReceivablesBoard />);
    await user.click(await screen.findByRole("tab", { name: "WHT credit notes" }));
    expect(await screen.findByText("Waiting 1 day")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Credit note received" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Credit note reference"), "MLSB/WHT/0021");
    await user.click(within(dialog).getByRole("button", { name: "Save reference" }));
    expect(api.note).toHaveBeenCalledWith("rct-2", "MLSB/WHT/0021");
    expect((await screen.findAllByText("Credit note recorded for RCT/2026/0002.")).length).toBeGreaterThan(0);
  });

  it("lists the client advances held, each linked to its receipt", async () => {
    const user = userEvent.setup();
    render(<ReceivablesBoard />);
    await user.click(await screen.findByRole("tab", { name: "Client advances" }));
    expect(await screen.findByText("Client advances held")).toBeInTheDocument();
    expect(screen.getAllByText("₦1.5M").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /RCT\/2026\/0004/ })).toHaveAttribute("href", "/suite/finance/revenue/receipts/rct-4");
    expect(screen.getAllByText("₦1,500,000.00").length).toBeGreaterThan(0);
  });

  it("opens on the advances tab from the link", async () => {
    nav.params = new URLSearchParams("tab=advances");
    render(<ReceivablesBoard />);
    expect(await screen.findByText("Client advances held")).toBeInTheDocument();
    expect(api.aged).not.toHaveBeenCalled();
  });

  it("says when no advance is held", async () => {
    nav.params = new URLSearchParams("tab=advances");
    api.advances.mockResolvedValue({ rows: [], total: 0 });
    render(<ReceivablesBoard />);
    expect(await screen.findByText("No advances held")).toBeInTheDocument();
  });
});
