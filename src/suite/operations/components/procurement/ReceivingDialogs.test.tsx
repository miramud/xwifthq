import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/operations-procurement-client";
import { GrnDialog, InvoiceDialog } from "./ReceivingDialogs";
import { InvoiceMatch } from "./InvoiceMatch";
import { exceptionInvoice, matchedInvoice, receivableLine, receivableOrder } from "./fixtures";

/** Receiving: a serial for each item accepted, the API's refusals on the line, and the match outcome. */

const api = vi.hoisted(() => ({ grn: vi.fn(), invoice: vi.fn() }));
vi.mock("@/lib/api/operations-procurement-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-procurement-client")>();
  return { ...actual, procurement: { ...actual.procurement, receiving: { ...actual.procurement.receiving, grn: api.grn, invoice: api.invoice } } };
});

/** An accepted order of 4 laptops, nothing received yet, as the receiving desk lists it. */
const order = () => receivableOrder({ id: "po-1", lines: [receivableLine({ id: "pol-1" })] });

/** The same order with all 4 received and approved, `invoiced` of them already on a matched invoice. */
const received = (invoiced = 0) => receivableOrder({ id: "po-1", status: "received", lines: [receivableLine({ id: "pol-1", received: 4, outstanding: 0, invoiced, toInvoice: 4 - invoiced })] });

beforeEach(() => {
  api.grn.mockReset();
  api.invoice.mockReset();
});

describe("GrnDialog", () => {
  it("wants one serial for each item accepted before it records anything", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    api.grn.mockResolvedValue({ id: "g", number: "MPT/GRN/2026/0002" });
    render(<GrnDialog po={order()} onDone={onDone} onClose={() => undefined} />);

    // Four arrived and are accepted by default; three serials typed.
    await user.type(screen.getByLabelText(/^Serial numbers/), "5CG1\n5CG2\n5CG3");
    expect(screen.getByText(/3 of 4 · optional/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Record the GRN" }));
    expect(screen.getByText("3 serials for 4 accepted: give one for each item accepted.")).toBeInTheDocument();
    expect(api.grn).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/^Serial numbers/), "\n5CG4");
    await user.click(screen.getByRole("button", { name: "Record the GRN" }));
    expect(api.grn).toHaveBeenCalledWith("po-1", expect.objectContaining({ lines: [{ poLineId: "pol-1", received: 4, accepted: 4, rejected: 0, serials: ["5CG1", "5CG2", "5CG3", "5CG4"], notes: null }] }));
    expect(onDone).toHaveBeenCalled();
  }, 15_000);

  it("refuses more accepted than arrived, and shows the API's refusal on its line", async () => {
    const user = userEvent.setup();
    render(<GrnDialog po={order()} onDone={() => undefined} onClose={() => undefined} />);
    const arrived = screen.getByLabelText(/^Arrived, line/);
    const accepted = screen.getByLabelText(/^Accepted/);
    await user.clear(accepted);
    await user.type(accepted, "5");
    await user.click(screen.getByRole("button", { name: "Record the GRN" }));
    expect(screen.getByText("Accepted and rejected together are more than arrived.")).toBeInTheDocument();

    await user.clear(arrived);
    await user.type(arrived, "5");
    await user.click(screen.getByRole("button", { name: "Record the GRN" }));
    expect(screen.getByText("Only 4 more can be accepted on this line.")).toBeInTheDocument();

    await user.clear(arrived);
    await user.type(arrived, "4");
    await user.clear(accepted);
    await user.type(accepted, "4");
    api.grn.mockRejectedValue(new ApiError("Invalid.", 422, { "lines.0.serials": ["Line 1: one serial for each item accepted."] }));
    await user.click(screen.getByRole("button", { name: "Record the GRN" }));
    expect(await screen.findByText("Line 1: one serial for each item accepted.")).toBeInTheDocument();
  }, 15_000);
});

describe("GrnDialog put-away", () => {
  const STORES = [
    { id: "s-main", name: "Main store", location: "Admin block" },
    { id: "s-ict", name: "ICT store", location: "ICT Centre" },
  ];

  it("asks which store stock lines go into, and sends it", async () => {
    const user = userEvent.setup();
    api.grn.mockResolvedValue({ id: "g", number: "MPT/GRN/2026/0003" });
    const po = receivableOrder({ id: "po-1", lines: [receivableLine({ id: "pol-1", description: "HP 410A toner, black", unit: "cartridge", quantity: 6, outstanding: 6, itemId: "i-toner" })] });
    render(<GrnDialog po={po} stores={STORES} onDone={() => undefined} onClose={() => undefined} />);

    expect(screen.getByText("Into stock")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Into store"));
    await user.click(await screen.findByRole("option", { name: /ICT store/ }));
    await user.click(screen.getByRole("button", { name: "Record the GRN" }));
    expect(api.grn).toHaveBeenCalledWith("po-1", expect.objectContaining({ storeId: "s-ict", lines: [expect.objectContaining({ poLineId: "pol-1", accepted: 6 })] }));
  }, 15_000);

  it("says an asset line wants one serial per item, and asks for no store without stock lines", () => {
    const po = receivableOrder({ id: "po-1", lines: [receivableLine({ id: "pol-1", assetCategoryId: "ac-lap" })] });
    render(<GrnDialog po={po} stores={STORES} onDone={() => undefined} onClose={() => undefined} />);
    expect(screen.getByText("To the asset register")).toBeInTheDocument();
    expect(screen.getByText(/Give one serial per item so each can be told apart/)).toBeInTheDocument();
    expect(screen.getByText(/0 of 4 · one per item accepted/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Into store")).not.toBeInTheDocument();
  });
});

describe("InvoiceDialog", () => {
  it("shows the match the moment the invoice is recorded: the memo raised with the FCU", async () => {
    const user = userEvent.setup();
    api.invoice.mockResolvedValue(matchedInvoice());
    const onDone = vi.fn();
    render(<InvoiceDialog po={received()} onDone={onDone} onClose={() => undefined} />);
    await user.type(screen.getByLabelText("Invoice number"), "KB-INV-90433");
    await user.click(screen.getByRole("button", { name: "Record and match" }));
    expect(api.invoice).toHaveBeenCalledWith("po-1", { invoiceNo: "KB-INV-90433", invoiceDate: expect.any(String), lines: [{ poLineId: "pol-1", quantity: 4, unitPrice: 915_000_00 }] });
    expect(await screen.findByRole("heading", { name: "Invoice matched" })).toBeInTheDocument();
    expect(screen.getByText(/Payment memo raised with the FCU/)).toBeInTheDocument();
    expect(screen.getByText("MPT/MEMO/GEN/2026/0001")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ status: "matched" }));
  }, 15_000);

  it("shows an exception's problems, line by line", async () => {
    const user = userEvent.setup();
    api.invoice.mockResolvedValue(exceptionInvoice());
    render(<InvoiceDialog po={received()} onDone={() => undefined} onClose={() => undefined} />);
    await user.type(screen.getByLabelText("Invoice number"), "KB-INV-90501");
    await user.click(screen.getByRole("button", { name: "Record and match" }));
    expect(await screen.findByRole("heading", { name: "Invoice recorded as an exception" })).toBeInTheDocument();
    expect(screen.getByText("Price 930,000.00 is not the order's 915,000.00.")).toBeInTheDocument();
    expect(screen.getByText(/No payment is raised until this is resolved/)).toBeInTheDocument();
  }, 15_000);
});

describe("InvoiceDialog defaults", () => {
  it("starts each line at what was received and not yet invoiced", () => {
    render(<InvoiceDialog po={received(3)} onDone={() => undefined} onClose={() => undefined} />);
    expect(screen.getByLabelText(/^Quantity/)).toHaveValue("1");
    expect(screen.getByText(/invoiced 3 · 1 to invoice/)).toBeInTheDocument();
  });
});

describe("InvoiceMatch", () => {
  it("says a match in words and links the memo when Finance's register is open to the viewer", () => {
    render(<InvoiceMatch invoice={matchedInvoice()} memoHref={(id) => `/suite/finance/memos/${id}`} />);
    expect(screen.getByText("Matched")).toBeInTheDocument();
    expect(screen.getByText(/Line 1: Laptop/)).toHaveTextContent("matches");
    expect(screen.getByRole("link", { name: /Open the memo/ })).toHaveAttribute("href", "/suite/finance/memos/memo-2");
  });

  it("shows a rejected invoice's resolution", () => {
    render(<InvoiceMatch invoice={exceptionInvoice({ status: "rejected", resolution: "Returned to the vendor." })} />);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Returned to the vendor.")).toBeInTheDocument();
  });
});
