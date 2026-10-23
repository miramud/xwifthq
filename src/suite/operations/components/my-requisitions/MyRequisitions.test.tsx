import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyRequisitions, { toAcknowledge } from "./MyRequisitions";
import { toRequisition } from "./NewRequisitionDialog";
import { requisition } from "@/suite/operations/components/stores/fixtures";
import { ME_OPTIONS } from "@/suite/operations/components/procurement/fixtures";

/** My requisitions: asking the store for items, and saying "I received these". */

const api = vi.hoisted(() => ({ list: vi.fn(), catalogue: vi.fn(), create: vi.fn(), acknowledge: vi.fn(), options: vi.fn(), cancel: vi.fn() }));

vi.mock("@/lib/api/operations-stores-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-stores-client")>();
  return { ...actual, stores: { ...actual.stores, me: { ...actual.stores.me, requisitions: api.list, catalogue: api.catalogue, createRequisition: api.create, acknowledge: api.acknowledge, cancelRequisition: api.cancel } } };
});
vi.mock("@/lib/api/operations-procurement-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-procurement-client")>();
  return { ...actual, procurement: { ...actual.procurement, me: { ...actual.procurement.me, options: api.options } } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-chinonso", role: "user", name: "Chinonso Okeke", organisationId: "o", permissions: [] }, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/operations/my/requisitions",
  useSearchParams: () => new URLSearchParams(),
}));

const CATALOGUE = {
  stores: [{ id: "s-main", name: "Main store", location: "Admin block" }],
  items: [
    { id: "i-paper", code: "STA-001", name: "A4 paper, 80gsm", category: "stationery", unit: "ream" },
    { id: "i-tea", code: "REF-003", name: "Lipton tea, 100 bags", category: "refreshments", unit: "pack" },
  ],
  categories: { stationery: "Stationery", refreshments: "Refreshments" },
};

const siv = { id: "siv-1", number: "MPT/SIV/2026/0001", lines: [{ itemId: "i-paper", code: "STA-001", name: "A4 paper, 80gsm", unit: "ream", quantity: 10, unitCost: 4_500_00 }], issuedBy: "Ngozi Eze", issuedAt: "2026-10-05T10:00:00+00:00", acknowledgedBy: null, acknowledgedAt: null };

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.catalogue.mockResolvedValue(CATALOGUE);
  api.options.mockResolvedValue(ME_OPTIONS);
  document.body.querySelectorAll("[data-confirm-host]").forEach((n) => n.remove());
});

describe("the requisition form", () => {
  it("wants a store and an item, and refuses the same item twice", () => {
    const blank = toRequisition({ storeId: "", purpose: "", funding: "costCentre", projectId: "", costCentreId: "", rows: [{ key: "a", itemId: "", quantity: "1" }] });
    expect(blank.errors).toEqual({ storeId: "Choose the store to draw from.", lines: "Ask for at least one item." });
    const twice = toRequisition({
      storeId: "s-main",
      purpose: "",
      funding: "costCentre",
      projectId: "",
      costCentreId: "",
      rows: [
        { key: "a", itemId: "i-paper", quantity: "2" },
        { key: "b", itemId: "i-paper", quantity: "1" },
      ],
    });
    expect(twice.errors["row.b"]).toMatch(/already on the list/);
    const ok = toRequisition({ storeId: "s-main", purpose: " Exam week ", funding: "project", projectId: "p-spr", costCentreId: "cc-x", rows: [{ key: "a", itemId: "i-paper", quantity: "2.5" }] });
    expect(ok.input).toEqual({ storeId: "s-main", purpose: "Exam week", projectId: "p-spr", costCentreId: null, lines: [{ itemId: "i-paper", quantity: 2.5 }] });
  });

  it("lists the vouchers still to acknowledge, newest first", () => {
    const rows = [
      requisition({ id: "a", issues: [{ ...siv, id: "s1", issuedAt: "2026-10-01" }, { ...siv, id: "s2", acknowledgedAt: "2026-10-02" }] }),
      requisition({ id: "b", issues: [{ ...siv, id: "s3", issuedAt: "2026-10-04" }] }),
    ];
    expect(toAcknowledge(rows).map((x) => x.issue.id)).toEqual(["s3", "s1"]);
  });
});

describe("MyRequisitions", () => {
  it("opens each requisition on its own page, and offers the voucher to print while it waits", async () => {
    api.list.mockResolvedValue([requisition({ status: "partly_issued", issues: [siv] })]);
    render(<MyRequisitions />);
    expect(await screen.findByRole("link", { name: "Open MPT/IRQ/2026/0004 from Main store" })).toHaveAttribute("href", "/suite/operations/my/requisitions/rq-1");
    expect(screen.getByRole("link", { name: "Voucher: MPT/SIV/2026/0001" })).toHaveAttribute("href", "/api/operations/me/issues/siv-1/pdf");
  });

  it("asks the store for items from the catalogue", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([]);
    api.create.mockResolvedValue(requisition({ status: "in_approval" }));
    render(<MyRequisitions />);

    await user.click((await screen.findAllByRole("button", { name: "New requisition" }))[0]);
    const dialog = await screen.findByRole("dialog", { name: "Ask the store for items" });
    await user.click(within(dialog).getByLabelText("Item 1"));
    await user.click(await screen.findByRole("option", { name: /Lipton tea/ }));
    const q = within(dialog).getByLabelText(/How many \(pack\), item 1/);
    await user.clear(q);
    await user.type(q, "3");
    await user.type(within(dialog).getByLabelText("What it is for"), "Board meeting");
    await user.click(within(dialog).getByRole("button", { name: "Send requisition" }));

    expect(api.create).toHaveBeenCalledWith({ storeId: "s-main", purpose: "Board meeting", projectId: null, costCentreId: null, lines: [{ itemId: "i-tea", quantity: 3 }] });
    expect((await screen.findAllByText(/with your head of unit to approve/)).length).toBeGreaterThan(0);
  }, 30_000);

  it("confirms what was received", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([requisition({ status: "partly_issued", issues: [siv] })]);
    api.acknowledge.mockResolvedValue({ ...siv, acknowledgedAt: "2026-10-06" });
    render(<MyRequisitions />);

    expect(await screen.findByText("Did you receive these?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "I received these" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/10 ream A4 paper, 80gsm/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "I received these" }));
    expect(api.acknowledge).toHaveBeenCalledWith("siv-1");
  }, 30_000);

  it("cancels a requisition after asking, and closes a partly issued one", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([
      requisition({ status: "in_approval" }),
      requisition({ id: "rq-2", number: "MPT/IRQ/2026/0005", status: "partly_issued", issues: [{ ...siv, acknowledgedAt: "2026-10-05" }] }),
      requisition({ id: "rq-3", number: "MPT/IRQ/2026/0006", status: "issued" }),
    ]);
    api.cancel.mockResolvedValue(requisition({ status: "cancelled" }));
    render(<MyRequisitions />);

    await user.click(await screen.findByRole("button", { name: "Cancel MPT/IRQ/2026/0004" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/withdrawn from your head of unit/);
    await user.click(within(dialog).getByRole("button", { name: "Cancel requisition" }));
    expect(api.cancel).toHaveBeenCalledWith("rq-1");
    expect((await screen.findAllByText("MPT/IRQ/2026/0004 cancelled.")).length).toBeGreaterThan(0);

    expect(screen.getByRole("button", { name: "Close MPT/IRQ/2026/0005" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /MPT\/IRQ\/2026\/0006/ })).not.toBeInTheDocument();
  }, 30_000);
});
