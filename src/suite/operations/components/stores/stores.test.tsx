import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/operations-stores-client";
import RequisitionDetail from "./RequisitionDetail";
import CountSheet from "./CountSheet";
import StockDesk from "./StockDesk";
import { requisition, stockCount, stockDesk } from "./fixtures";

/** The stores desk: issuing a requisition, a count sheet's live variance and its approval, and the stock page. */

const api = vi.hoisted(() => ({
  desk: vi.fn(),
  reorder: vi.fn(),
  draftReorder: vi.fn(),
  getReq: vi.fn(),
  issue: vi.fn(),
  shortfall: vi.fn(),
  close: vi.fn(),
  getCount: vi.fn(),
  record: vi.fn(),
  decide: vi.fn(),
  options: vi.fn(),
}));
const auth = vi.hoisted(() => ({ user: { id: "u-1", role: "admin", name: "Adaeze", organisationId: "o", permissions: [] as string[] } }));

vi.mock("@/lib/api/operations-stores-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-stores-client")>();
  return {
    ...actual,
    stores: {
      ...actual.stores,
      desk: api.desk,
      reorder: api.reorder,
      draftReorder: api.draftReorder,
      requisitions: { ...actual.stores.requisitions, get: api.getReq, issue: api.issue, shortfall: api.shortfall, close: api.close },
      counts: { ...actual.stores.counts, get: api.getCount, record: api.record, decide: api.decide },
    },
  };
});
vi.mock("@/lib/api/operations-procurement-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-procurement-client")>();
  return { ...actual, procurement: { ...actual.procurement, me: { ...actual.procurement.me, options: api.options } } };
});
const csv = vi.hoisted(() => vi.fn());
vi.mock("@/components/workspace/csv", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/components/workspace/csv")>()), downloadCsv: csv }));
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/operations/stores",
  useSearchParams: () => new URLSearchParams(),
}));

/** Answer the confirmation dialog the way the person would. */
async function confirmWith(user: ReturnType<typeof userEvent.setup>, label: string) {
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: label }));
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  csv.mockReset();
  auth.user = { id: "u-1", role: "admin", name: "Adaeze", organisationId: "o", permissions: [] };
  api.options.mockResolvedValue({ projects: [], costCentres: [{ id: "cc-ops", code: "CC-OPS", name: "Operations" }], vendors: [], prCategories: {}, financeOn: true });
  document.body.querySelectorAll("[data-confirm-host]").forEach((n) => n.remove());
});

describe("RequisitionDetail", () => {
  it("starts each line at what is left or what the store has, and issues what is typed", async () => {
    const user = userEvent.setup();
    api.getReq.mockResolvedValue(requisition());
    api.issue.mockResolvedValue({ ...requisition({ status: "partly_issued" }), issued: { id: "siv-1", number: "MPT/SIV/2026/0001", lines: [{}, {}], issuedBy: "Adaeze", issuedAt: "2026-10-06", acknowledgedBy: null, acknowledgedAt: null } });
    render(<RequisitionDetail id="rq-1" />);

    const paper = await screen.findByLabelText("Issue now, A4 paper, 80gsm");
    const toner = screen.getByLabelText("Issue now, HP 410A toner, black");
    expect(paper).toHaveValue("10");
    expect(toner).toHaveValue("2");
    expect(screen.getByText("Store is short")).toBeInTheDocument();

    await user.clear(toner);
    await user.type(toner, "3");
    expect(screen.getByText("The store holds only 2 cartridge.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Issue the items" }));
    expect(screen.getByText("Fix the quantities marked below first.")).toBeInTheDocument();
    expect(api.issue).not.toHaveBeenCalled();

    await user.clear(toner);
    await user.type(toner, "1.5");
    await user.click(screen.getByRole("button", { name: "Issue the items" }));
    await confirmWith(user, "Issue the items");
    expect(api.issue).toHaveBeenCalledWith("rq-1", { "rl-1": 10, "rl-2": 1.5 });
    expect((await screen.findAllByText(/MPT\/SIV\/2026\/0001 raised for 2 lines/)).length).toBeGreaterThan(0);
  }, 30_000);

  it("turns the shortfall into a purchase request and links to it", async () => {
    const user = userEvent.setup();
    api.getReq.mockResolvedValue(requisition({ status: "partly_issued", lines: [{ ...requisition().lines[1], issued: 2, inStore: 0 }] }));
    api.shortfall.mockResolvedValue({ id: "pr-55", number: null, title: "Shortfall on MPT/IRQ/2026/0004", estimate: 95_000_00 });
    render(<RequisitionDetail id="rq-1" />);

    await user.click(await screen.findByRole("button", { name: "Buy the shortfall" }));
    await confirmWith(user, "Draft purchase request");
    expect(api.shortfall).toHaveBeenCalledWith("rq-1");
    expect(await screen.findByRole("link", { name: /Open the request/ })).toHaveAttribute("href", "/suite/operations/my/requests/pr-55");
  }, 30_000);

  it("prints each store issue voucher", async () => {
    const siv = { id: "siv-1", number: "MPT/SIV/2026/0001", lines: [{ itemId: "i-paper", code: "STA-001", name: "A4 paper, 80gsm", unit: "ream", quantity: 10, unitCost: 4_500_00 }], issuedBy: "Adaeze", issuedAt: "2026-10-06", acknowledgedBy: null, acknowledgedAt: null };
    api.getReq.mockResolvedValue(requisition({ status: "partly_issued", issues: [siv] }));
    render(<RequisitionDetail id="rq-1" />);
    expect(await screen.findByRole("link", { name: "Print voucher: MPT/SIV/2026/0001" })).toHaveAttribute("href", "/api/operations/issues/siv-1/pdf");
  }, 30_000);
});

describe("RequisitionDetail, closing and a shortfall already bought", () => {
  it("links the shortfall's purchase request and offers no second one while it stands", async () => {
    const owed = { ...requisition().lines[1], issued: 2, inStore: 0 };
    api.getReq.mockResolvedValue(requisition({ status: "partly_issued", lines: [owed], shortfallPr: { id: "pr-55", number: null, status: "draft" } }));
    const { unmount } = render(<RequisitionDetail id="rq-1" />);
    expect(await screen.findByRole("link", { name: "Draft purchase request" })).toHaveAttribute("href", "/suite/operations/procurement/requests/pr-55");
    expect(screen.queryByRole("button", { name: "Buy the shortfall" })).not.toBeInTheDocument();
    unmount();

    api.getReq.mockResolvedValue(requisition({ status: "partly_issued", lines: [owed], shortfallPr: { id: "pr-55", number: "MPT/PR/2026/0009", status: "rejected" } }));
    render(<RequisitionDetail id="rq-1" />);
    expect(await screen.findByRole("link", { name: "MPT/PR/2026/0009" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy the shortfall" })).toBeInTheDocument();
  }, 30_000);

  it("closes a partly issued requisition with a reason", async () => {
    const user = userEvent.setup();
    api.getReq.mockResolvedValueOnce(requisition({ status: "partly_issued" })).mockResolvedValue(requisition({ status: "issued" }));
    api.close.mockResolvedValue(requisition({ status: "issued" }));
    render(<RequisitionDetail id="rq-1" />);

    await user.click(await screen.findByRole("button", { name: "Close requisition" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/closes as issued/);
    await user.type(within(dialog).getByLabelText("Reason"), "Toner discontinued");
    await user.click(within(dialog).getByRole("button", { name: "Close requisition" }));
    expect(api.close).toHaveBeenCalledWith("rq-1", "Toner discontinued");
    expect((await screen.findAllByText(/closed as issued/)).length).toBeGreaterThan(0);
  }, 30_000);

  it("offers no close without the permission", async () => {
    auth.user = { ...auth.user, role: "user", permissions: ["admin.stores.issue"] };
    api.getReq.mockResolvedValue(requisition());
    render(<RequisitionDetail id="rq-1" />);
    await screen.findByRole("button", { name: "Issue the items" });
    expect(screen.queryByRole("button", { name: /Cancel requisition|Close requisition/ })).not.toBeInTheDocument();
  }, 30_000);
});

describe("CountSheet", () => {
  it("works out the difference as it is typed, and won't submit with a line blank", async () => {
    const user = userEvent.setup();
    api.getCount.mockResolvedValue(stockCount());
    api.desk.mockResolvedValue(stockDesk());
    api.record.mockResolvedValue(stockCount({ status: "submitted" }));
    render(<CountSheet id="c-1" />);

    const paper = await screen.findByLabelText("Counted, A4 paper, 80gsm (ream)");
    await user.type(paper, "10");
    const row = paper.closest("tr")!;
    expect(within(row).getByText("−2")).toBeInTheDocument();
    expect(within(row).getByText("-₦9,000.00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit for approval" }));
    expect(screen.getByText("Count every line before submitting: 1 still blank.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Counted, HP 410A toner, black (cartridge)"), "3");
    await user.click(screen.getByRole("button", { name: "Submit for approval" }));
    await confirmWith(user, "Submit the count");
    expect(api.record).toHaveBeenCalledWith("c-1", { "cl-1": 10, "cl-2": 3 }, true);
  }, 30_000);

  it("won't let the counter approve their own count, and shows the API's refusal for anyone else", async () => {
    const user = userEvent.setup();
    const submitted = stockCount({
      status: "submitted",
      lines: stockCount().lines.map((l) => ({ ...l, countedQty: l.systemQty - 1, variance: -1, varianceValue: l.itemId === "i-paper" ? -4_500_00 : -95_000_00 })),
    });
    api.getCount.mockResolvedValue(submitted);
    api.desk.mockResolvedValue(stockDesk());
    auth.user = { ...auth.user, id: "u-ngozi" };
    const { unmount } = render(<CountSheet id="c-1" />);
    expect(await screen.findByText(/You counted this, so somebody else approves it/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve and adjust" })).not.toBeInTheDocument();
    unmount();

    auth.user = { ...auth.user, id: "u-1" };
    api.decide.mockRejectedValue(new ApiError("Invalid.", 422, { count: ["SOD_VIOLATION: who counted cannot approve the count."] }));
    render(<CountSheet id="c-1" />);
    await user.click(await screen.findByRole("button", { name: "Approve and adjust" }));
    await confirmWith(user, "Approve and adjust stock");
    expect(api.decide).toHaveBeenCalledWith("c-1", true, null);
    expect(await screen.findByText("Who counted cannot approve the count.")).toBeInTheDocument();
  }, 30_000);
});

describe("StockDesk", () => {
  it("shows the KPIs and reorder state, and drafts a restock request that links to the request", async () => {
    const user = userEvent.setup();
    api.desk.mockResolvedValue(stockDesk());
    api.reorder.mockResolvedValue([
      { itemId: "i-toner", code: "TON-002", name: "HP 410A toner, black", unit: "cartridge", onHand: 2, onOrder: 0, reorderLevel: 4, suggested: 6, critical: true, avgCost: 95_000_00, vendorId: null },
      { itemId: "i-paper", code: "STA-001", name: "A4 paper, 80gsm", unit: "ream", onHand: 15, onOrder: 0, reorderLevel: 20, suggested: 50, critical: false, avgCost: 4_500_00, vendorId: null },
    ]);
    api.draftReorder.mockResolvedValue({ id: "pr-77", number: null, title: "Restock: items below reorder level", estimate: 570_000_00 });
    render(<StockDesk />);

    expect(await screen.findByText("Critical below reorder")).toBeInTheDocument();
    expect(screen.getAllByText("Below reorder").length).toBeGreaterThan(0);

    await user.click(await screen.findByRole("checkbox", { name: /A4 paper, 80gsm/ }));
    const toner = screen.getByLabelText("Quantity to buy of HP 410A toner, black (cartridge)");
    await user.clear(toner);
    await user.type(toner, "8");
    await user.click(screen.getByRole("button", { name: "Draft purchase request" }));
    await confirmWith(user, "Draft purchase request");
    expect(api.draftReorder).toHaveBeenCalledWith([{ itemId: "i-toner", quantity: 8 }], null);
    expect(await screen.findByRole("link", { name: /Open the request/ })).toHaveAttribute("href", "/suite/operations/my/requests/pr-77");
  }, 30_000);
});

describe("StockDesk, CSV", () => {
  it("downloads the items listed, one column per store, value in naira", async () => {
    const user = userEvent.setup();
    api.desk.mockResolvedValue(stockDesk());
    api.reorder.mockResolvedValue([]);
    render(<StockDesk />);
    await user.click(await screen.findByRole("button", { name: "Download CSV" }));
    const [name, rows] = csv.mock.calls[0];
    expect(name).toMatch(/^stock.*\.csv$/);
    expect(rows[0].slice(0, 6)).toEqual(["Code", "Name", "Category", "Unit", "Main store", "ICT store"]);
    const toner = rows.find((r: (string | number)[]) => r[0] === "TON-002");
    expect(toner).toEqual(expect.arrayContaining(["HP 410A toner, black", "Toner and ink", "95000.00", "190000.00", "NGN", "Yes"]));
  }, 30_000);
});
