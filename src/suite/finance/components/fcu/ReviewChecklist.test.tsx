import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/finance-spend-client";
import { ReviewPanel } from "./ReviewChecklist";

/** The FCU's checklist: keyboard marking, queries that say what they're about, and the one outcome. */

const ITEMS = [
  { code: "documents", label: "All required documents are attached" },
  { code: "amount", label: "The amount agrees with the invoice" },
  { code: "quotes", label: "The three-quote rule is met where it applies" },
];

describe("ReviewPanel", () => {
  it("marks items from the keyboard and clears only when nothing is queried", async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel kind="memo" items={ITEMS} onSubmit={submit} />);

    const clear = screen.getByRole("button", { name: "Clear for payment" });
    expect(clear).toBeDisabled();

    // Tab into the first item's group, then O / arrows / N.
    const first = screen.getByRole("radiogroup", { name: "All required documents are attached" });
    within(first).getByRole("radio", { name: "OK" }).focus();
    await user.keyboard("o");
    expect(within(first).getByRole("radio", { name: "OK" })).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{ArrowRight}");
    expect(within(first).getByRole("radio", { name: "Query" })).toHaveAttribute("aria-checked", "true");
    expect(within(first).getByRole("radio", { name: "Query" })).toHaveFocus();
    await user.keyboard("o");

    await user.click(screen.getByRole("button", { name: "Mark the rest OK" }));
    await user.click(within(screen.getByRole("radiogroup", { name: /three-quote/ })).getByRole("radio", { name: "Not applicable" }));
    expect(screen.getByText("3 of 3 marked")).toBeInTheDocument();

    await user.click(clear);
    expect(submit).toHaveBeenCalledWith(
      "cleared",
      { documents: { result: "ok", comment: null }, amount: { result: "ok", comment: null }, quotes: { result: "na", comment: null } },
      null,
    );
  });

  it("needs the query to say what it is about, then queries", async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel kind="voucher" items={ITEMS} onSubmit={submit} />);
    await user.click(screen.getByRole("button", { name: "Mark the rest OK" }));
    await user.click(within(screen.getByRole("radiogroup", { name: /amount agrees/ })).getByRole("radio", { name: "Query" }));

    const query = screen.getByRole("button", { name: "Query it" });
    expect(query).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear for authorisation" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/What is the query about/), "The invoice says ₦1,150,000.00");
    await user.click(query);
    expect(submit).toHaveBeenCalledWith("queried", expect.objectContaining({ amount: { result: "query", comment: "The invoice says ₦1,150,000.00" } }), null);
  });

  it("explains separation of duties when the API refuses on it", async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockRejectedValue(
      new ApiError("The given data was invalid.", 422, { duties: ["SOD_VIOLATION: you are the memo approver on this document, so you cannot also act as its FCU officer."] }),
    );
    render(<ReviewPanel kind="memo" items={ITEMS} onSubmit={submit} />);
    await user.click(screen.getByRole("button", { name: "Mark the rest OK" }));
    await user.click(screen.getByRole("button", { name: "Clear for payment" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("you are the memo approver on this document");
    expect(alert).toHaveTextContent("Leave this one for another FCU officer.");
    expect(alert).not.toHaveTextContent("SOD_VIOLATION");
  });

  it("asks for a reason, and confirmation, before rejecting a memo", async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel kind="memo" items={ITEMS} onSubmit={submit} />);
    await user.click(screen.getByRole("button", { name: "Mark the rest OK" }));
    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByText(/Say why it is rejected/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Note/), "Duplicate of PM-2026-0004");
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Reject memo" }));
    expect(submit).toHaveBeenCalledWith("rejected", expect.any(Object), "Duplicate of PM-2026-0004");
  });
});
