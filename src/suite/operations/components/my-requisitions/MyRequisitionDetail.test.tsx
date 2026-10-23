import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyRequisitionDetail from "./MyRequisitionDetail";
import { requisition } from "@/suite/operations/components/stores/fixtures";

/** One of my requisitions: lines asked and issued, the vouchers to print and sign for, closing it. */

const api = vi.hoisted(() => ({ get: vi.fn(), acknowledge: vi.fn(), cancel: vi.fn() }));

vi.mock("@/lib/api/operations-stores-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-stores-client")>();
  return { ...actual, stores: { ...actual.stores, me: { ...actual.stores.me, requisition: api.get, acknowledge: api.acknowledge, cancelRequisition: api.cancel } } };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/suite/operations/my/requisitions/rq-1", useSearchParams: () => new URLSearchParams() }));

const siv = {
  id: "siv-1",
  number: "MPT/SIV/2026/0001",
  lines: [{ itemId: "i-paper", code: "STA-001", name: "A4 paper, 80gsm", unit: "ream", quantity: 10, unitCost: 4_500_00 }],
  issuedBy: "Ngozi Eze",
  issuedAt: "2026-10-05T10:00:00+00:00",
  acknowledgedBy: null,
  acknowledgedAt: null,
};

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  document.body.querySelectorAll("[data-confirm-host]").forEach((n) => n.remove());
});

describe("MyRequisitionDetail", () => {
  it("shows what was asked and issued, prints each voucher and signs for the one still open", async () => {
    const user = userEvent.setup();
    const signed = { ...siv, id: "siv-0", number: "MPT/SIV/2026/0000", acknowledgedAt: "2026-10-04T10:00:00+00:00", acknowledgedBy: "Chinonso Okeke" };
    const req = requisition({ status: "partly_issued", issues: [signed, siv] });
    api.get.mockResolvedValue(req);
    api.acknowledge.mockResolvedValue({ ...siv, acknowledgedAt: "2026-10-06T10:00:00+00:00" });
    render(<MyRequisitionDetail id={req.id} />);

    const table = await screen.findByRole("table", { name: "Items asked for and issued" });
    expect(within(table).getAllByRole("row")).toHaveLength(req.lines.length + 1);
    expect(api.get).toHaveBeenCalledWith("rq-1");
    expect(screen.getByRole("link", { name: "Voucher: MPT/SIV/2026/0001" })).toHaveAttribute("href", "/api/operations/me/issues/siv-1/pdf");
    expect(screen.getByRole("link", { name: "Voucher: MPT/SIV/2026/0000" })).toHaveAttribute("href", "/api/operations/me/issues/siv-0/pdf");
    // Only the voucher not yet signed for can be acknowledged.
    const buttons = screen.getAllByRole("button", { name: "I received these" });
    expect(buttons).toHaveLength(1);

    await user.click(buttons[0]);
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "I received these" }));
    expect(api.acknowledge).toHaveBeenCalledWith("siv-1");
    expect(await screen.findByText("MPT/SIV/2026/0001 acknowledged. Thank you.", { selector: "p:not(.sr-only)" })).toBeInTheDocument();
  });

  it("closes a partly issued requisition after saying what that means", async () => {
    const user = userEvent.setup();
    const req = requisition({ status: "partly_issued" });
    api.get.mockResolvedValue(req);
    api.cancel.mockResolvedValue({ ...req, status: "issued" });
    render(<MyRequisitionDetail id={req.id} />);

    await user.click(await screen.findByRole("button", { name: "Close requisition" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("What the store has issued stays yours.");
    await user.click(within(dialog).getByRole("button", { name: "Close requisition" }));
    expect(api.cancel).toHaveBeenCalledWith("rq-1");
  });
});
