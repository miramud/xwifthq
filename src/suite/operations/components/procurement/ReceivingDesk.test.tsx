import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/operations-procurement-client";
import ReceivingDesk from "./ReceivingDesk";
import { exceptionInvoice, poFull, receivableLine, receivableOrder, receivingDesk } from "./fixtures";

/** The receiving desk: opening an order to receive, a separation-of-duties refusal said plainly, and rejecting an exception. */

const api = vi.hoisted(() => ({ desk: vi.fn(), approveGrn: vi.fn(), rejectInvoice: vi.fn(), get: vi.fn(), list: vi.fn(), permissions: [] as string[] }));
vi.mock("@/lib/api/operations-procurement-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-procurement-client")>();
  return {
    ...actual,
    procurement: {
      ...actual.procurement,
      receiving: { ...actual.procurement.receiving, desk: api.desk, approveGrn: api.approveGrn, rejectInvoice: api.rejectInvoice },
      orders: { ...actual.procurement.orders, get: api.get, list: api.list },
    },
  };
});
const csv = vi.hoisted(() => vi.fn());
vi.mock("@/components/workspace/csv", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/components/workspace/csv")>()), downloadCsv: csv }));
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-kemi", role: "user", name: "Kemi Adebanjo", organisationId: "o", permissions: api.permissions }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/suite/operations/procurement/receiving", useSearchParams: () => new URLSearchParams() }));

const grn = poFull().grns[0];

beforeEach(() => {
  for (const f of [api.desk, api.approveGrn, api.rejectInvoice, api.get, api.list, csv]) f.mockReset();
  api.permissions = ["create_grn", "approve_grn", "create_scc", "approve_scc", "create_invoice", "reject_invoice"].map((a) => `admin.receiving.${a}`);
});

describe("ReceivingDesk", () => {
  it("records what arrived from the desk's own lines, without reading the order", async () => {
    const user = userEvent.setup();
    api.desk.mockResolvedValue(receivingDesk());
    render(<ReceivingDesk />);
    await user.click(await screen.findByRole("button", { name: "Record goods received" }));
    expect(await screen.findByRole("dialog", { name: "Record goods received" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Arrived, line/)).toHaveValue("4");
    expect(api.get).not.toHaveBeenCalled();
    expect(api.list).not.toHaveBeenCalled();
  }, 15_000);

  it("lists what is ready to invoice and opens the invoice at what is left to invoice", async () => {
    const user = userEvent.setup();
    const ready = receivableOrder({ id: "po-1", number: "MPT/LPO/2026/0001", status: "received", lines: [receivableLine({ id: "pol-1", received: 4, outstanding: 0, invoiced: 1, toInvoice: 3 })] });
    api.desk.mockResolvedValue(receivingDesk({ toReceive: [], toInvoice: [ready] }));
    render(<ReceivingDesk />);
    expect(await screen.findByText("line 1: 3 each")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Record the invoice" }));
    expect(screen.getByRole("dialog", { name: "Record the vendor's invoice" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Quantity/)).toHaveValue("3");
    expect(api.get).not.toHaveBeenCalled();
  }, 15_000);

  it("shows a separation-of-duties refusal plainly, on the note", async () => {
    const user = userEvent.setup();
    api.desk.mockResolvedValue(receivingDesk({ grns: [{ ...grn, status: "draft", approvedBy: null, approvedAt: null, poNumber: "MPT/LPO/2026/0001" }] }));
    api.approveGrn.mockRejectedValue(new ApiError("Invalid.", 422, { duties: ["SOD_VIOLATION: you are the person who raised the order, so you cannot also approve what was received."] }));
    render(<ReceivingDesk />);
    expect(await screen.findByRole("link", { name: "Print: MPT/GRN/2026/0001" })).toHaveAttribute("href", "/api/operations/grns/grn-1/pdf");
    await user.click(await screen.findByRole("button", { name: "Approve" }));
    await user.click(screen.getByRole("button", { name: "Approve the GRN" }));
    expect(api.approveGrn).toHaveBeenCalledWith("grn-1");
    expect(await screen.findByText("You are the person who raised the order, so you cannot also approve what was received.")).toBeInTheDocument();
  }, 15_000);

  it("rejects an exception only with a resolution", async () => {
    const user = userEvent.setup();
    api.desk.mockResolvedValue(receivingDesk({ exceptions: [exceptionInvoice()] }));
    api.rejectInvoice.mockResolvedValue(exceptionInvoice({ status: "rejected" }));
    render(<ReceivingDesk />);
    expect(await screen.findByText("Invoiced 5 but only 4 accepted and not yet invoiced.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reject invoice" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Resolution"), "Returned: charged five, four arrived.");
    await user.click(within(dialog).getByRole("button", { name: "Reject the invoice" }));
    expect(api.rejectInvoice).toHaveBeenCalledWith("inv-2", "Returned: charged five, four arrived.");
  }, 15_000);

  it("offers nothing to somebody without the receiving keys", async () => {
    api.permissions = ["admin.receiving.view"];
    api.desk.mockResolvedValue(receivingDesk({ exceptions: [exceptionInvoice()] }));
    render(<ReceivingDesk />);
    expect(await screen.findByText("MPT/LPO/2026/0003")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record goods received" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject invoice" })).not.toBeInTheDocument();
  }, 15_000);
});

describe("ReceivingDesk, CSV and vendor links", () => {
  it("downloads both order lists as CSV, money in naira with its currency", async () => {
    const user = userEvent.setup();
    const ready = receivableOrder({ id: "po-1", number: "MPT/LPO/2026/0001", status: "received", lines: [receivableLine({ id: "pol-1", received: 4, outstanding: 0, invoiced: 1, toInvoice: 3 })] });
    api.desk.mockResolvedValue(receivingDesk({ toInvoice: [ready] }));
    render(<ReceivingDesk />);
    await user.click(await screen.findByRole("button", { name: "Download CSV" }));
    expect(csv).toHaveBeenCalledTimes(1);
    const [name, rows] = csv.mock.calls[0];
    expect(name).toMatch(/^receiving.*\.csv$/);
    expect(rows[0]).toEqual(["List", "Number", "Vendor", "Type", "Delivery by", "Total", "Currency", "Status", "To invoice before VAT"]);
    expect(rows.find((r: string[]) => r[0] === "To receive")).toEqual(expect.arrayContaining(["MPT/LPO/2026/0003", "Konga Business", "2026-10-10", "3934500.00", "NGN"]));
    expect(rows.find((r: string[]) => r[0] === "Ready to invoice")?.[1]).toBe("MPT/LPO/2026/0001");
  }, 15_000);

  it("links the vendor to its page only for somebody who can open clients and vendors", async () => {
    const ready = receivableOrder({ id: "po-1", number: "MPT/LPO/2026/0001", status: "received", lines: [receivableLine({ id: "pol-1", received: 4, outstanding: 0, invoiced: 1, toInvoice: 3 })] });
    api.desk.mockResolvedValue(receivingDesk({ toReceive: [], toInvoice: [ready] }));
    const { unmount } = render(<ReceivingDesk />);
    expect(await screen.findByText("Konga Business")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Konga Business" })).not.toBeInTheDocument();
    unmount();

    api.permissions = [...api.permissions, "core.counterparties.view"];
    render(<ReceivingDesk />);
    expect(await screen.findByRole("link", { name: "Konga Business" })).toHaveAttribute("href", "/suite/org/counterparties/v-konga");
  }, 15_000);
});
