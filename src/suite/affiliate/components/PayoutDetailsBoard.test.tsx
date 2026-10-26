import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PayoutDetailsBoard from "./PayoutDetailsBoard";
import { AFFILIATE, myAffiliateOf } from "./fixtures";
import { ApiError, type Affiliate, type MyAffiliate, type PayoutDetails } from "@/lib/api/affiliate-client";

/**
 * Payout details: the saved account shows masked, the form sends what was
 * typed, and the API's validation messages land on the field they are about.
 */

const get = vi.fn<() => Promise<MyAffiliate>>();
const update = vi.fn<(body: PayoutDetails) => Promise<Affiliate>>();

vi.mock("@/lib/api/affiliate-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/affiliate-client")>();
  return {
    ...actual,
    myAffiliate: { ...actual.myAffiliate, get: () => get(), updatePayoutDetails: (body: PayoutDetails) => update(body) },
  };
});

beforeEach(() => {
  get.mockReset().mockResolvedValue(myAffiliateOf());
  update.mockReset();
});

describe("affiliate payout details", () => {
  it("shows the saved details and saves new ones", async () => {
    const user = userEvent.setup();
    update.mockResolvedValue({
      ...AFFILIATE,
      payoutDetails: { bankName: "Access Bank", accountNumber: "******4321", accountName: "Amaka Obi" },
    });
    render(<PayoutDetailsBoard />);

    expect(await screen.findByText("******6789")).toBeInTheDocument();
    const bank = screen.getByLabelText("Bank name");
    expect(bank).toHaveValue("Zenith Bank");
    expect(screen.getByLabelText("Account number")).toHaveValue("");

    await user.clear(bank);
    await user.type(bank, "Access Bank");
    await user.type(screen.getByLabelText("Account number"), "0987654321");
    await user.click(screen.getByRole("button", { name: "Save payout details" }));

    expect(update).toHaveBeenCalledWith({ bankName: "Access Bank", accountNumber: "0987654321", accountName: "Amaka Obi" });
    expect(await screen.findByText("Payout details saved.")).toBeInTheDocument();
    expect(screen.getByText("******4321")).toBeInTheDocument();
    expect(screen.getByLabelText("Account number")).toHaveValue("");
  });

  it("puts the API's validation message on its field", async () => {
    const user = userEvent.setup();
    update.mockRejectedValue(
      new ApiError("The given data was invalid.", 422, { accountNumber: ["The account number must be 10 digits."] }),
    );
    render(<PayoutDetailsBoard />);
    await screen.findByText("******6789");

    await user.type(screen.getByLabelText("Account number"), "12345");
    await user.click(screen.getByRole("button", { name: "Save payout details" }));

    const input = screen.getByLabelText("Account number");
    expect(await screen.findByText("The account number must be 10 digits.")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/The account number must be 10 digits\./);
    expect(screen.queryByText("Payout details saved.")).not.toBeInTheDocument();
  });

  it("asks for every field before sending anything", async () => {
    const user = userEvent.setup();
    get.mockResolvedValue(myAffiliateOf({ payoutDetails: null }));
    render(<PayoutDetailsBoard />);

    expect(await screen.findByText(/None saved yet/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save payout details" }));

    expect(screen.getByText("Enter your bank's name.")).toBeInTheDocument();
    expect(screen.getByText("Enter your account number.")).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });
});
