import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InvoicesBoard from "./InvoicesBoard";
import { INVOICES_META, invoice } from "./fixtures";

/** The invoice register: tabs by `?status=`, the KPI strip, late invoices called out, search. */

const api = vi.hoisted(() => ({ list: vi.fn() }));
const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: "u-1", role: "admin", name: "Accountant", organisationId: "o", permissions: [] as string[] } }));

vi.mock("@/lib/api/finance-revenue-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-revenue-client")>();
  return { ...actual, revenue: { ...actual.revenue, invoices: { ...actual.revenue.invoices, list: api.list } } };
});
const csv = vi.hoisted(() => vi.fn());
vi.mock("@/components/workspace/csv", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/components/workspace/csv")>()), downloadCsv: csv }));
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace, refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/revenue/invoices",
  useSearchParams: () => nav.params,
}));

const rows = [
  invoice(),
  // Part paid, only its retention left: held back, never late.
  invoice({ id: "inv-2", invoiceNo: "INV/2026/0002", status: "part_paid", dueOn: "2026-09-13", daysLate: 0, outstanding: 591_250_00, retentionHeld: 591_250_00 }),
  invoice({ id: "inv-4", invoiceNo: "INV/2026/0004", client: "Northbank Polytechnic", dueOn: "2026-09-13", daysLate: 23, outstanding: 1_000_000_00, retentionHeld: 0 }),
  invoice({ id: "inv-9", invoiceNo: null, status: "draft", client: "Eastgate State Scholarship Board", project: null, outstanding: 0 }),
];

beforeEach(() => {
  api.list.mockReset();
  nav.replace.mockReset();
  csv.mockReset();
  nav.params = new URLSearchParams();
  auth.user = { id: "u-1", role: "admin", name: "Accountant", organisationId: "o", permissions: [] };
  api.list.mockResolvedValue({ invoices: rows, meta: INVOICES_META });
});

describe("InvoicesBoard", () => {
  it("shows the KPI strip, every invoice, and how late the late ones are, never calling retention late", async () => {
    render(<InvoicesBoard />);
    expect(await screen.findByText("₦8.7M")).toBeInTheDocument(); // outstanding
    expect(screen.getByRole("link", { name: /Overdue/ })).toHaveAttribute("href", "/suite/finance/revenue/invoices?status=overdue");
    expect(screen.getAllByText("Meridian Library Services Board").length).toBeGreaterThan(0);
    expect(screen.getAllByText("23 days late").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Retention held").length).toBeGreaterThan(0);
    expect(screen.getAllByText("₦591,250.00")[0]).not.toHaveClass("text-rose-700");
    expect(screen.getAllByText("₦1,000,000.00")[0]).toHaveClass("text-rose-700");
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    expect(api.list).toHaveBeenCalledWith({ status: undefined });
    expect(screen.getByRole("table", { name: "Invoices" })).toBeInTheDocument();
  });

  it("opens as cards on a phone, as a table elsewhere", async () => {
    const real = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("max-width: 639px"),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      render(<InvoicesBoard />);
      await screen.findAllByText("Meridian Library Services Board");
      expect(screen.queryByRole("table", { name: "Invoices" })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: /INV\/2026\/0003/ })).toHaveAttribute("href", "/suite/finance/revenue/invoices/inv-3");
    } finally {
      window.matchMedia = real;
    }
  });

  it("asks the API for the tab in the address, and moves the address when a tab is chosen", async () => {
    const user = userEvent.setup();
    nav.params = new URLSearchParams("status=overdue");
    render(<InvoicesBoard />);
    await screen.findAllByText("Meridian Library Services Board");
    expect(api.list).toHaveBeenCalledWith({ status: "overdue" });
    await user.click(screen.getByRole("tab", { name: /Paid/ }));
    expect(nav.replace).toHaveBeenCalledWith("/suite/finance/revenue/invoices?status=paid", { scroll: false });
  });

  it("downloads the invoices listed, after the search, as CSV", async () => {
    const user = userEvent.setup();
    render(<InvoicesBoard />);
    await screen.findAllByText("Meridian Library Services Board");
    await user.type(screen.getByLabelText("Search invoices"), "northbank");
    await user.click(screen.getByRole("button", { name: "Download CSV" }));
    const [name, out] = csv.mock.calls[0];
    expect(name).toBe("invoices.csv");
    expect(out[0].slice(0, 7)).toEqual(["Invoice", "Date", "Due", "Client", "Project", "Status", "Currency"]);
    expect(out).toHaveLength(2);
    expect(out[1].slice(0, 3)).toEqual(["INV/2026/0004", "2026-10-02", "2026-09-13"]);
    expect(out[1][3]).toBe("Northbank Polytechnic");
    expect(out[1][6]).toBe("NGN");
    expect(out[1][12]).toBe("1000000.00");
    expect(out[1][14]).toBe(23);
  });

  it("searches by client and number, and offers a new invoice only to those who may raise one", async () => {
    const user = userEvent.setup();
    auth.user = { ...auth.user, role: "staff", permissions: ["finance.invoices.read"] };
    render(<InvoicesBoard />);
    await screen.findAllByText("Meridian Library Services Board");
    expect(screen.queryByRole("link", { name: "New invoice" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Search invoices"), "eastgate");
    expect(screen.queryByText("Meridian Library Services Board")).not.toBeInTheDocument();
    expect(screen.getAllByText("Eastgate State Scholarship Board").length).toBeGreaterThan(0);
  });
});
