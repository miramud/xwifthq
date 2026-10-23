import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption } from "@/test/selectOption";
import RetirementForm from "./RetirementForm";
import { OPTIONS, memoFull } from "./fixtures";

/** Retiring an advance: the sum worked out live, minor units to the API, receipts, then the FCU. */

const api = vi.hoisted(() => ({ save: vi.fn(), submit: vi.fn(), upload: vi.fn(), options: vi.fn(), banks: vi.fn() }));
vi.mock("@/lib/api/finance-spend-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-spend-client")>();
  return {
    ...actual,
    spend: { ...actual.spend, me: { ...actual.spend.me, saveRetirement: api.save, submitRetirement: api.submit, uploadRetirement: api.upload, options: api.options } },
  };
});
vi.mock("@/suite/finance/components/banking/lookups", () => ({
  lookupText: () => "",
}));
vi.mock("@/lib/api/org-foundations-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/org-foundations-client")>();
  return { ...actual, orgFoundations: { ...actual.orgFoundations, lookups: { ...actual.orgFoundations.lookups, costCentres: vi.fn().mockResolvedValue([]) } } };
});

const advance = memoFull({ id: "adv1", type: "advance", status: "awaiting_retirement", paidAmount: 200_000_00, approvedAmount: 200_000_00, balance: 0 });

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.options.mockResolvedValue(OPTIONS);
  api.banks.mockResolvedValue([]);
});

describe("RetirementForm", () => {
  it("works the sum out as you type and only sends it when it balances", async () => {
    const user = userEvent.setup();
    render(<RetirementForm memo={advance} onChanged={() => undefined} />);

    expect(screen.getByText("₦200,000.00 still to account for: add what was spent, or the cash returned.")).toBeInTheDocument();
    const send = screen.getByRole("button", { name: "Send to the FCU" });
    expect(send).toBeDisabled();

    await user.type(screen.getByLabelText("Amount (₦)"), "150000");
    await user.type(screen.getByLabelText("Amount paid back (₦)"), "60000");
    expect(screen.getByText(/₦10,000.00 more than the advance/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Amount paid back (₦)"));
    await user.type(screen.getByLabelText("Amount paid back (₦)"), "50000");
    expect(screen.getByText(/It balances/)).toBeInTheDocument();
    expect(send).toBeEnabled();
  });

  it("asks for what is missing before saving, then saves in minor units", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    api.save.mockResolvedValue({ id: "r1", status: "draft", advanced: 200_000_00, spent: 200_000_00, refund: 0, refundBankAccountId: null, journalId: null, lines: [], documents: [], queries: [] });
    render(<RetirementForm memo={advance} onChanged={changed} />);

    await user.click(screen.getByRole("button", { name: "Save retirement" }));
    expect(screen.getByText("Choose the account it was spent on.")).toBeInTheDocument();
    expect(screen.getByText("Say what it was spent on.")).toBeInTheDocument();
    expect(api.save).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Description"), "Hotel, two nights in Abuja");
    await chooseOption(user, "Account", "6200 · Travel and accommodation");
    await user.type(screen.getByLabelText("Amount (₦)"), "200,000");
    await user.click(screen.getByRole("button", { name: "Save retirement" }));
    expect(api.save).toHaveBeenCalledWith("adv1", {
      lines: [{ accountId: "acc-travel", projectId: "p1", costCentreId: null, description: "Hotel, two nights in Abuja", amount: 200_000_00 }],
      refund: 0,
      refundBankAccountId: null,
    });
    expect(changed).toHaveBeenCalled();
    expect(await screen.findByText("Saved. Attach the receipts, then send it to the FCU.")).toBeInTheDocument();
  });
});
