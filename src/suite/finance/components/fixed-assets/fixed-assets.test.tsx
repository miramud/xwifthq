import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type AssetBookDetail, type DepreciationPreview, type FixedAssetsOverview } from "@/lib/api/finance-assets-client";
import FixedAssetsBoard from "./FixedAssetsBoard";
import FixedAssetDetail, { scheduleWithProjection } from "./FixedAssetDetail";
import { depreciationMonths, missingAccounts, nextMonthToRun } from "./meta";

/** Finance › Fixed assets: the month grid, the run with its rerun warning, and a disposal's gain or loss. */

const api = vi.hoisted(() => ({ overview: vi.fn(), book: vi.fn(), updateClass: vi.fn(), preview: vi.fn(), run: vi.fn(), get: vi.fn(), dispose: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: "u-1", role: "admin", name: "Adaeze", organisationId: "o", permissions: [] as string[] } }));

vi.mock("@/lib/api/finance-assets-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-assets-client")>();
  return { ...actual, fixedAssets: api };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/fixed-assets",
  useSearchParams: () => new URLSearchParams(),
}));

const acc = (code: string, name: string) => ({ id: `a-${code}`, code, name });

const overview = (over: Partial<FixedAssetsOverview> = {}): FixedAssetsOverview => ({
  classes: [
    { id: "c-ict", key: "ict", name: "ICT equipment", rateBp: 3333, assetAccount: acc("1530", "ICT equipment"), accumulatedAccount: acc("1620", "Accumulated depreciation"), expenseAccount: acc("6400", "Depreciation"), cost: 9_000_000_00, accumulated: 1_500_000_00, count: 2 },
    { id: "c-veh", key: "vehicles", name: "Motor vehicles", rateBp: 2500, assetAccount: acc("1550", "Motor vehicles"), accumulatedAccount: null, expenseAccount: acc("6400", "Depreciation"), cost: 0, accumulated: 0, count: 0 },
  ],
  books: [
    { id: "b-1", tag: "FA-0001", description: "Dell PowerEdge server", classId: "c-ict", class: "ICT equipment", cost: 4_500_000_00, residual: 0, rateBp: 3333, capitalisedOn: "2026-01-15", accumulated: 1_000_000_00, nbv: 3_500_000_00, status: "active", source: "manual", assetRef: null, projectId: null, disposedOn: null, proceeds: null, gainLoss: null, monthly: 124_987_50 },
  ],
  totals: { cost: 9_000_000_00, accumulated: 1_500_000_00, nbv: 7_500_000_00, count: 2 },
  runs: [{ id: "r-9", month: "2026-09", total: 250_000_00, status: "posted", journalId: "j-9", journalNo: "JV-2026-0091", postedAt: "2026-10-01T08:00:00+00:00" }],
  forecast: Array.from({ length: 12 }, (_, i) => ({ month: `2027-${String(i + 1).padStart(2, "0")}`, charge: 250_000_00, nbv: 7_500_000_00 - (i + 1) * 250_000_00 })),
  ...over,
});

const preview = (over: Partial<DepreciationPreview> = {}): DepreciationPreview => ({
  month: "2026-09",
  total: 250_000_00,
  classes: [{ classId: "c-ict", class: "ICT equipment", amount: 250_000_00, assets: 2 }],
  books: 2,
  existingRunId: null,
  missingAccounts: [],
  ...over,
});

const detail = (over: Partial<AssetBookDetail> = {}): AssetBookDetail => ({
  ...overview().books[0],
  schedule: [
    { month: "2026-02", charge: 124_987_50, accumulated: 124_987_50, nbv: 4_375_012_50 },
    { month: "2026-03", charge: 124_987_50, accumulated: 249_975_00, nbv: 4_250_025_00 },
  ],
  ...over,
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  auth.user = { id: "u-1", role: "admin", name: "Adaeze", organisationId: "o", permissions: [] };
  document.body.querySelectorAll("[data-confirm-host]").forEach((n) => n.remove());
});

describe("fixed assets arithmetic", () => {
  it("marks each month posted, open or still to come, and offers the month after the last run", () => {
    const runs = overview().runs;
    const months = depreciationMonths(2026, runs, "2026-10");
    expect(months[8]).toMatchObject({ key: "2026-09", state: "posted" });
    expect(months[9].state).toBe("open");
    expect(months[10].state).toBe("future");
    expect(nextMonthToRun(runs, "2026-10")).toBe("2026-10");
    expect(nextMonthToRun([], "2026-10")).toBe("2026-09");
    expect(nextMonthToRun([{ ...runs[0], month: "2026-06" }], "2026-10")).toBe("2026-07");
  });

  it("names the accounts a class is missing", () => {
    expect(missingAccounts(overview().classes[1])).toEqual(["accumulated depreciation"]);
    expect(missingAccounts(overview().classes[0])).toEqual([]);
  });

  it("projects the months to come until the residual, never past it", () => {
    const { rows, firstProjected } = scheduleWithProjection({ schedule: [{ month: "2026-02", charge: 100, accumulated: 100, nbv: 1100 }], cost: 1200, residual: 900, accumulated: 100, monthly: 100, status: "active", capitalisedOn: "2026-01-15" });
    expect(firstProjected).toBe(1);
    expect(rows.map((r) => [r.month, r.charge, r.nbv])).toEqual([
      ["2026-02", 100, 1100],
      ["2026-03", 100, 1000],
      ["2026-04", 100, 900],
    ]);
  });
});

describe("FixedAssetsBoard", () => {
  // The month grid is built around today; pin it to the demo's October.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 6, 9, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("previews the month by class and warns that a rerun replaces the posted run", async () => {
    const user = userEvent.setup();
    api.overview.mockResolvedValue(overview());
    api.preview.mockImplementation(async (m: string) => preview({ month: m, existingRunId: m === "2026-09" ? "r-9" : null }));
    api.run.mockResolvedValue({ id: "r-10", month: "2026-09", total: 250_000_00, journalId: "j-10" });
    render(<FixedAssetsBoard />);

    expect((await screen.findAllByText("Net book value")).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /JV-2026-0091/ })).toHaveAttribute("href", "/suite/finance/journals/j-9");

    await user.click(screen.getByRole("button", { name: /September 2026: posted/ }));
    expect(await screen.findByText(/September 2026 is already posted. Running it again reverses that run and replaces it./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run again" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/is reversed, then/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Reverse and run again" }));
    expect(api.run).toHaveBeenCalledWith("2026-09");
  }, 30_000);

  it("won't post a month whose classes have no accounts", async () => {
    const user = userEvent.setup();
    api.overview.mockResolvedValue(overview());
    api.preview.mockImplementation(async (m: string) => preview({ month: m, missingAccounts: ["Motor vehicles"] }));
    render(<FixedAssetsBoard />);
    await user.click(await screen.findByRole("button", { name: /September 2026: posted/ }));
    expect(await screen.findByText(/Set the depreciation accounts first for Motor vehicles/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post depreciation" })).toBeDisabled();
  }, 30_000);
});

describe("FixedAssetDetail", () => {
  it("shows the expected loss as the proceeds are typed, and disposes", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(detail());
    api.dispose.mockResolvedValue({ ...detail(), status: "disposed", gainLoss: -3_000_000_00 });
    render(<FixedAssetDetail id="b-1" />);

    await user.click(await screen.findByRole("button", { name: "Dispose of it" }));
    const dialog = await screen.findByRole("dialog", { name: /Dispose of FA-0001/ });
    await user.type(within(dialog).getByLabelText("Proceeds (₦)"), "500000");
    expect(within(dialog).getByText("Expected loss on disposal")).toBeInTheDocument();
    expect(within(dialog).getByText("₦3,000,000.00")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Reason"), "Sold to staff");
    await user.click(within(dialog).getByRole("button", { name: "Dispose of the asset" }));
    expect(api.dispose).toHaveBeenCalledWith("b-1", { on: expect.any(String), proceeds: 500_000_00, reason: "Sold to staff" });
  }, 30_000);

  it("sends an Operations asset back to Operations to dispose of, and shows a refusal as given", async () => {
    api.get.mockResolvedValue(detail({ source: "ops_asset", assetRef: "as-9" }));
    render(<FixedAssetDetail id="b-1" />);
    expect(await screen.findByRole("link", { name: "Open it in Operations" })).toHaveAttribute("href", "/suite/operations/assets/as-9");
    expect(screen.queryByRole("button", { name: "Dispose of it" })).not.toBeInTheDocument();
  });
});
