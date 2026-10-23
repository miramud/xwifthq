import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, type CandidateLine } from "@/lib/api/finance-spend-client";
import PaymentConfirm, { splitOf } from "./PaymentConfirm";
import { voucherFull } from "@/suite/finance/components/requests/fixtures";

/** Checkpoint 3: the statement line or the bank's receipt, the four checks, and the provisional match later. */

const api = vi.hoisted(() => ({ get: vi.fn(), candidates: vi.fn(), confirm: vi.fn(), match: vi.fn(), upload: vi.fn(), queues: vi.fn() }));
vi.mock("@/lib/api/finance-spend-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-spend-client")>();
  return {
    ...actual,
    spend: {
      ...actual.spend,
      vouchers: { ...actual.spend.vouchers, get: api.get, upload: api.upload },
      fcu: { ...actual.spend.fcu, candidates: api.candidates, confirm: api.confirm, match: api.match, queues: api.queues },
    },
  };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-ruth", role: "user", name: "Ruth Akande", organisationId: "o", permissions: ["finance.fcu.confirm", "finance.fcu.match_provisional"] }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const LINE: CandidateLine = { id: "sl1", importId: "imp1", date: "2026-09-07", narration: "NIP TRF SWIFTLINK NETWORKS", amount: 1_150_053_75, feeSplit: { principal: 1_150_000_00, fee: 50_00, vat: 3_75 }, exact: false };
const CHECKS = { amount: "Amount paid equals net payable", beneficiary: "Paid to the vendor-master account", from: "Paid from the voucher's paying account", once: "Paid once" };

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.queues.mockResolvedValue({ memos: [], vouchers: [], payments: [], retirements: [], checklists: { "3": CHECKS } });
});

describe("splitOf", () => {
  it("reads principal, fee and VAT, or works them out from the net", () => {
    expect(splitOf(LINE, 1_150_000_00)).toEqual({ principal: 1_150_000_00, fee: 50_00, vat: 3_75, exact: false });
    expect(splitOf({ ...LINE, feeSplit: null }, 1_150_000_00)).toEqual({ principal: 1_150_000_00, fee: 53_75, vat: 0, exact: false });
    expect(splitOf({ ...LINE, exact: true, amount: 1_150_000_00 }, 1_150_000_00).exact).toBe(true);
  });
});

describe("PaymentConfirm", () => {
  it("confirms against the one statement line, with the fee split shown", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(voucherFull());
    api.candidates.mockResolvedValue([LINE]);
    api.confirm.mockResolvedValue(voucherFull({ status: "paid_confirmed" }));
    render(<PaymentConfirm id="pv1" />);

    expect(await screen.findByText("NIP TRF SWIFTLINK NETWORKS")).toBeInTheDocument();
    expect(screen.getByText("₦1,150,000.00 principal + ₦50.00 fee + ₦3.75 VAT")).toBeInTheDocument();
    // The only candidate is chosen for you.
    expect(screen.getByRole("radio", { name: /7 Sep 2026/ })).toBeChecked();
    expect(screen.getByText("CIB-778812")).toBeInTheDocument();

    const confirm = screen.getByRole("button", { name: "Confirm payment" });
    expect(confirm).toBeDisabled();
    for (const label of Object.values(CHECKS)) {
      await user.click(screen.getAllByRole("radio", { name: "OK" })[Object.values(CHECKS).indexOf(label)]);
    }
    // No "Query" mark at this checkpoint: a failed check means don't confirm.
    expect(screen.queryByRole("radio", { name: "Query" })).not.toBeInTheDocument();
    await user.click(confirm);
    expect(api.confirm).toHaveBeenCalledWith("pv1", {
      evidence: "statement_line",
      statementLineId: "sl1",
      documentId: null,
      items: { amount: { result: "ok", comment: null }, beneficiary: { result: "ok", comment: null }, from: { result: "ok", comment: null }, once: { result: "ok", comment: null } },
    });
    expect(await screen.findByText(/Payment confirmed against the statement/)).toBeInTheDocument();
  });

  it("says a discrepancy plainly and does not confirm", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(voucherFull());
    api.candidates.mockResolvedValue([LINE]);
    api.confirm.mockRejectedValue(new ApiError("x", 422, { statementLineId: ["PAYMENT_DISCREPANCY: the bank debited 1,150,053.75; the voucher pays 1,150,000.00. Escalate to the Finance manager."] }));
    render(<PaymentConfirm id="pv1" />);
    await screen.findByText("NIP TRF SWIFTLINK NETWORKS");
    for (const r of screen.getAllByRole("radio", { name: "OK" })) await user.click(r);
    await user.click(screen.getByRole("button", { name: "Confirm payment" }));
    const alert = await screen.findByText(/the bank debited 1,150,053.75/);
    expect(alert).toHaveTextContent("Don't confirm it");
    expect(alert).not.toHaveTextContent("PAYMENT_DISCREPANCY");
  });

  it("uploads the bank's receipt and confirms provisionally", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(voucherFull());
    api.candidates.mockResolvedValue([]);
    api.upload.mockResolvedValue([{ id: "doc7", itemCode: "cib_receipt", fileName: "receipt.pdf", mime: "application/pdf", size: 1000, sha256: "s", uploadedBy: "Ruth Akande", uploadedAt: null }]);
    api.confirm.mockResolvedValue(voucherFull({ status: "paid_confirmed", provisional: true }));
    render(<PaymentConfirm id="pv1" />);

    expect(await screen.findByText(/No line on the paying account's statement matches/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Bank's receipt/ }));
    const file = new File(["%PDF"], "receipt.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("Upload the bank's receipt", { selector: "input" }), file);
    expect(api.upload).toHaveBeenCalledWith("pv1", file, "cib_receipt");
    expect(await screen.findByRole("radio", { name: "receipt.pdf" })).toBeChecked();

    for (const r of screen.getAllByRole("radio", { name: "OK" })) await user.click(r);
    await user.click(screen.getByRole("button", { name: "Confirm provisionally" }));
    expect(api.confirm).toHaveBeenCalledWith("pv1", expect.objectContaining({ evidence: "cib_receipt", documentId: "doc7", statementLineId: null }));
  });

  it("matches the statement line to a provisional confirmation", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(voucherFull({ status: "paid_confirmed", provisional: true, confirmedAt: "2026-09-05T16:00:00+01:00" }));
    api.candidates.mockResolvedValue([LINE]);
    api.match.mockResolvedValue(voucherFull({ status: "paid_confirmed", provisional: false }));
    render(<PaymentConfirm id="pv1" />);
    await user.click(await screen.findByRole("button", { name: "Match this line" }));
    expect(api.match).toHaveBeenCalledWith("pv1", "sl1");
    expect(await screen.findByText(/Matched/)).toBeInTheDocument();
  });
});
