import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AgedReceivables, InvoiceDetail, InvoiceSummary, InvoiceTranche } from "@/lib/api/finance-revenue-client";
import { apportion, mulDiv, rateScaled, splitProblem, toBase, tranchesOf } from "./meta";
import CurrencySplitEditor, { draftsFrom, splitInput, type SplitDraft } from "./CurrencySplitEditor";
import TranchesPanel from "./TranchesPanel";
import { openRows } from "./ReceiptForm";
import ReceivablesBoard from "./ReceivablesBoard";

/**
 * Multi-currency revenue: the EMMS contract paid 60% NGN / 40% USD, priced
 * at ₦1,600/$. The arithmetic must land where the API lands; the screens
 * must never add naira to dollars.
 */

const api = vi.hoisted(() => ({ override: vi.fn(), aged: vi.fn(), wht: vi.fn(), advances: vi.fn() }));

vi.mock("@/lib/api/finance-revenue-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-revenue-client")>();
  return {
    ...actual,
    revenue: {
      ...actual.revenue,
      invoices: { ...actual.revenue.invoices, overrideRate: api.override },
      receivables: { ...actual.revenue.receivables, aged: api.aged, advances: api.advances },
      receipts: { ...actual.revenue.receipts, whtRegister: api.wht },
    },
  };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-1", role: "admin", name: "Bursar", organisationId: "o", permissions: [] }, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/revenue/receivables",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));

const SPLIT = [
  { currency: "NGN", shareBp: 6000 },
  { currency: "USD", shareBp: 4000, planningRate: "1600" },
];

const tranche = (p: Partial<InvoiceTranche>): InvoiceTranche => ({
  id: "t-ngn",
  currency: "NGN",
  shareBp: 6000,
  subtotal: 600_000_000,
  vat: 45_000_000,
  total: 645_000_000,
  retention: 32_250_000,
  settled: 0,
  outstanding: 645_000_000,
  retentionHeld: 32_250_000,
  expectedWht: 0,
  rate: "1",
  rateScaled: 100_000_000,
  rateAsOf: "2026-09-01",
  rateSource: "base",
  overrideReason: null,
  overriddenBy: null,
  baseTotal: 645_000_000,
  open: null,
  ...p,
});

const USD = tranche({
  id: "t-usd",
  currency: "USD",
  shareBp: 4000,
  subtotal: 250_000,
  vat: 18_750,
  total: 268_750,
  retention: 13_438,
  outstanding: 268_750,
  retentionHeld: 13_438,
  rate: "1550",
  rateScaled: 155_000_000_000,
  rateSource: "table",
  baseTotal: 268_750 * 1550,
});

describe("currency arithmetic", () => {
  it("splits a ₦10m milestone 60/40 into ₦6m and $2,500 at the planning rate, like the API", () => {
    const parts = apportion(1_000_000_000, "NGN", SPLIT, "NGN");
    expect(parts.map((p) => [p.currency, p.amount, p.base])).toEqual([
      ["NGN", 600_000_000, 600_000_000],
      ["USD", 250_000, 400_000_000],
    ]);
  });

  it("gives the remainder to the last share so the parts add up exactly", () => {
    const parts = apportion(1_001, "NGN", [{ currency: "NGN", shareBp: 3333 }, { currency: "GBP", shareBp: 3333, planningRate: "1" }, { currency: "EUR", shareBp: 3334, planningRate: "1" }], "NGN");
    expect(parts.reduce((s, p) => s + (p.amount ?? 0), 0)).toBe(1_001);
  });

  it("works rates as ×1e8 integers, rounding half away from zero", () => {
    expect(rateScaled("1550.25")).toBe(BigInt(155_025_000_000));
    expect(rateScaled("0")).toBeNull();
    expect(rateScaled("abc")).toBeNull();
    expect(mulDiv(13_437, BigInt(1), BigInt(2))).toBe(6_719);
    expect(toBase(268_750, "1550")).toBe(416_562_500);
    // ₦10bn at 1,550 without losing a kobo.
    expect(toBase(1_000_000_000_000, "1550.12345678")).toBe(1_550_123_456_780_000);
  });

  it("says what is wrong with a split before the API does", () => {
    expect(splitProblem(SPLIT, "NGN", "NGN")).toBeNull();
    expect(splitProblem([SPLIT[0], { ...SPLIT[1], shareBp: 3000 }], "NGN", "NGN")).toMatch(/90%; they must make 100%/);
    expect(splitProblem([SPLIT[0], { currency: "USD", shareBp: 4000 }], "NGN", "NGN")).toMatch(/USD rate/);
    expect(splitProblem(SPLIT, "GBP", "NGN")).toMatch(/priced in GBP/);
    expect(splitProblem([SPLIT[0]], "NGN", "NGN")).toMatch(/second currency/);
  });

  it("groups invoice lines into tranches by currency, in order of first appearance", () => {
    const g = tranchesOf(
      [
        { currency: "USD", amount: 1, vatRateBp: 0 },
        { currency: "", amount: 2, vatRateBp: 0 },
        { currency: "USD", amount: 3, vatRateBp: 0 },
      ],
      "NGN",
    );
    expect(g.map((x) => [x.currency, x.lines.length])).toEqual([
      ["USD", 2],
      ["NGN", 1],
    ]);
  });
});

function SplitHarness({ initial }: { initial: SplitDraft[] }) {
  const [drafts, setDrafts] = useState(initial);
  return <CurrencySplitEditor drafts={drafts} onChange={setDrafts} value={100_000_000_00} currency="NGN" base="NGN" />;
}

describe("CurrencySplitEditor", () => {
  it("shows each currency's part of the contract value and its base equivalent", () => {
    render(<SplitHarness initial={draftsFrom(SPLIT)} />);
    expect(screen.getByText("Shares add up to 100%")).toBeInTheDocument();
    expect(screen.getByLabelText("Priced at (NGN per 1)", { selector: `input[value="1600"]` })).toBeInTheDocument();
    // 40% of ₦100m at ₦1,600 is $25,000.
    expect(screen.getByText(/25,000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Contract value in NGN at these rates/)).toBeInTheDocument();
  });

  it("flags shares that don't make 100% while they are typed", async () => {
    const user = userEvent.setup();
    render(<SplitHarness initial={draftsFrom(SPLIT)} />);
    const shares = screen.getAllByLabelText("Share %");
    await user.clear(shares[1]);
    await user.type(shares[1], "30");
    expect(screen.getByText(/Shares add up to 90%, 10% still to place/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("The shares add up to 90%; they must make 100%.");
  });

  it("is switched on with two currencies and sends shares in basis points", async () => {
    const user = userEvent.setup();
    render(<SplitHarness initial={[]} />);
    await user.click(screen.getByRole("checkbox", { name: "Paid in more than one currency" }));
    expect(screen.getAllByLabelText("Share %")).toHaveLength(2);
    expect(splitInput(draftsFrom(SPLIT), "NGN")).toEqual([
      { currency: "NGN", shareBp: 6000 },
      { currency: "USD", shareBp: 4000, planningRate: "1600" },
    ]);
  });
});

describe("TranchesPanel", () => {
  const draft = (canOverrideRate: boolean): Pick<InvoiceDetail, "id" | "status" | "tranches" | "canOverrideRate"> => ({
    id: "inv-9",
    status: "draft",
    tranches: [tranche({}), USD],
    canOverrideRate,
  });

  it("shows each tranche with its rate, where the rate came from, and the base total", () => {
    render(<TranchesPanel invoice={draft(false)} base="NGN" draft />);
    expect(screen.getByRole("heading", { name: "Billed in each currency" })).toBeInTheDocument();
    expect(screen.getByText("Recorded rate")).toBeInTheDocument();
    expect(screen.getByText(/NGN 1550 per 1/)).toBeInTheDocument();
    // Without the permission there is no way to change the rate.
    expect(screen.queryByRole("button", { name: "Use another rate" })).not.toBeInTheDocument();
  });

  it("lets someone allowed override a rate, with a reason, and shows it as overridden", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    api.override.mockResolvedValue({ id: "inv-9", tranches: [tranche({}), { ...USD, rate: "1500", rateSource: "override", overrideReason: "EMMS addendum", overriddenBy: "Bursar" }] });
    render(<TranchesPanel invoice={draft(true)} base="NGN" draft onChanged={onChanged} />);
    await user.click(screen.getByRole("button", { name: "Use another rate" }));
    const dialog = screen.getByRole("dialog");
    const rate = within(dialog).getByLabelText("NGN per 1 USD");
    await user.clear(rate);
    await user.type(rate, "1500");
    await user.click(within(dialog).getByRole("button", { name: "Use this rate" }));
    expect(within(dialog).getByText("Say why this rate is used instead of the recorded one.")).toBeInTheDocument();
    expect(api.override).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText(/Why/), "EMMS addendum");
    await user.click(within(dialog).getByRole("button", { name: "Use this rate" }));
    expect(api.override).toHaveBeenCalledWith("inv-9", "t-usd", "1500", "EMMS addendum");
    expect(onChanged).toHaveBeenCalled();
  });

  it("waits for unsaved changes before overriding", () => {
    render(<TranchesPanel invoice={draft(true)} base="NGN" draft dirty />);
    expect(screen.getByRole("button", { name: "Use another rate" })).toBeDisabled();
  });
});

describe("receipt spreading", () => {
  it("offers a row per open tranche of a multi-currency invoice, each in its own currency", () => {
    const inv = {
      id: "inv-9",
      invoiceNo: "INV/2026/0009",
      currency: "NGN",
      subtotal: 0,
      open: { trade: 1, retention: 0 },
      tranches: [tranche({ open: { trade: 612_750_000, retention: 32_250_000 } }), { ...USD, open: { trade: 255_312, retention: 13_438 } }],
    } as unknown as InvoiceSummary;
    const single = { id: "inv-1", invoiceNo: "INV/2026/0001", currency: "NGN", subtotal: 1, open: { trade: 5, retention: 0 }, tranches: [tranche({ id: "t-1" })] } as unknown as InvoiceSummary;
    const rows = openRows([inv, single]);
    expect(rows.map((r) => [r.key, r.invoice.currency, r.open.trade, r.trancheId])).toEqual([
      ["inv-9:t-ngn", "NGN", 612_750_000, "t-ngn"],
      ["inv-9:t-usd", "USD", 255_312, "t-usd"],
      ["inv-1", "NGN", 5, "t-1"],
    ]);
    expect(rows[1].rate).toBe("1550");
  });
});

describe("ReceivablesBoard in several currencies", () => {
  it("shows what is owed in each currency beside the base totals, and each tranche in its money", async () => {
    const user = userEvent.setup();
    const book = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0, retention: 0 };
    const aged: AgedReceivables = {
      asOf: "2026-09-30",
      baseCurrency: "NGN",
      totals: {
        ...book,
        current: 612_750_000 + 155_312 * 1550,
        retention: 32_250_000 + 13_438 * 1550,
        total: 645_000_000 + 168_750 * 1550,
        byCurrency: [
          { currency: "NGN", ...book, current: 612_750_000, retention: 32_250_000, total: 645_000_000, base: 645_000_000 },
          { currency: "USD", ...book, current: 155_312, retention: 13_438, total: 168_750, base: 168_750 * 1550 },
        ],
      },
      clients: [
        {
          clientId: "c-1",
          client: "EMMS Programme Office",
          ...book,
          current: 612_750_000 + 155_312 * 1550,
          retention: 32_250_000 + 13_438 * 1550,
          total: 645_000_000 + 168_750 * 1550,
          byCurrency: [
            { currency: "NGN", ...book, total: 645_000_000, base: 645_000_000 },
            { currency: "USD", ...book, total: 168_750, base: 168_750 * 1550 },
          ],
          invoices: [
            { id: "inv-9", trancheId: "t-ngn", invoiceNo: "INV/2026/0009", dueOn: "2026-10-01", daysLate: 0, outstanding: 645_000_000, retentionHeld: 32_250_000, currency: "NGN", bucket: "current", outstandingBase: 645_000_000, rate: "1", multiCurrency: true },
            { id: "inv-9", trancheId: "t-usd", invoiceNo: "INV/2026/0009", dueOn: "2026-10-01", daysLate: 0, outstanding: 168_750, retentionHeld: 13_438, currency: "USD", bucket: "current", outstandingBase: 168_750 * 1550, rate: "1550", multiCurrency: true },
          ],
        },
      ],
    };
    api.aged.mockResolvedValue(aged);
    api.wht.mockResolvedValue({ rows: [], expected: 0, received: 0 });
    api.advances.mockResolvedValue({ rows: [], total: 0 });
    render(<ReceivablesBoard />);

    const strip = await screen.findByRole("region", { name: "Owed in each currency" });
    expect(within(strip).getByText("Owed in USD")).toBeInTheDocument();
    expect(within(strip).getByText("Owed in NGN")).toBeInTheDocument();
    expect(screen.getByText(/in NGN at booked rates/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /EMMS Programme Office/ }));
    expect(screen.getByText("USD part")).toBeInTheDocument();
    expect(screen.getByText(/at 1550/)).toBeInTheDocument();
  });
});
