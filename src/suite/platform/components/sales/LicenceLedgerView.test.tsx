import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LicenceLedgerView from "./LicenceLedgerView";
import type { LicenceRow } from "@/lib/api/platform-client";

/**
 * The licence ledger finance audits: filters reach the API, totals stay per
 * currency, and the CSV link asks for exactly the rows on screen.
 */

const licences = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/platform-commerce-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/platform-commerce-client")>();
  return { ...actual, platformSales: { ...actual.platformSales, licences } };
});

// DataView reads the router to open rows; the test has no app router mounted.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/platform/sales",
  useSearchParams: () => new URLSearchParams("view=licences"),
}));

const ROW: LicenceRow = {
  id: "lic-1",
  reference: "LIC-0007",
  status: "paid",
  organisation: { slug: "acme", name: "Acme Institute" },
  channel: "offline",
  gateway: "offline",
  kind: "upgrade",
  modules: ["hrm"],
  modulesBefore: 1,
  modulesAdded: 1,
  modulesAfter: 2,
  currency: "NGN",
  amountMinor: 180_000_000,
  listPriceMinor: 450_000_000,
  creditMinor: 250_000_000,
  discountMinor: 20_000_000,
  paymentMethod: "bank_transfer",
  paymentReference: "GTB-778812",
  note: null,
  paidBy: null,
  recordedBy: { name: "Ada Owner", email: "ada@elevate.test" },
  paidAt: "2026-09-20T09:00:00Z",
  createdAt: "2026-09-20T09:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  licences.mockResolvedValue({
    data: [ROW],
    totals: [
      {
        currency: "NGN",
        sales: 1,
        paidMinor: 180_000_000,
        listPriceMinor: 450_000_000,
        creditMinor: 250_000_000,
        discountMinor: 20_000_000,
        offline: 1,
        online: 0,
        newPurchases: 0,
        upgrades: 1,
      },
    ],
  });
});

describe("LicenceLedgerView", () => {
  it("lists paid module sales with per-currency totals", async () => {
    render(<LicenceLedgerView from="2026-09-01" to="2026-09-30" />);

    expect(await screen.findByText("LIC-0007")).toBeInTheDocument();
    expect(licences).toHaveBeenCalledWith({ from: "2026-09-01", to: "2026-09-30" });
    expect(screen.getByText("NGN · 1 sale")).toBeInTheDocument();
    expect(screen.getAllByText("₦1,800,000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("₦200,000 below list").length).toBeGreaterThan(0);
    expect(screen.getByText("1 by hand")).toBeInTheDocument();
    expect(screen.getByText("Recorded by Ada Owner")).toBeInTheDocument();
  });

  it("sends the filters and points the CSV download at the same rows", async () => {
    const user = userEvent.setup();
    render(<LicenceLedgerView from="2026-09-01" />);
    await screen.findByText("LIC-0007");

    await user.click(screen.getByRole("radio", { name: "Licensed by hand" }));
    await user.click(screen.getByRole("radio", { name: "Upgrades" }));
    await user.click(screen.getByRole("radio", { name: "USD" }));

    await waitFor(() =>
      expect(licences).toHaveBeenLastCalledWith({ from: "2026-09-01", channel: "offline", kind: "upgrade", currency: "USD" }),
    );

    const csv = screen.getByRole("link", { name: /download csv/i });
    const url = new URL(csv.getAttribute("href")!, "http://localhost");
    expect(url.pathname).toBe("/api/platform/sales/licences");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      from: "2026-09-01",
      channel: "offline",
      kind: "upgrade",
      currency: "USD",
      format: "csv",
    });
    expect(csv).toHaveAttribute("download");
  });
});
