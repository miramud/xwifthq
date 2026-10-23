import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StepUpPanel from "./StepUpPanel";

/** Organisation › Approvals: the amount at which approving needs an authenticator code. */

const api = vi.hoisted(() => ({ stepUp: vi.fn(), updateStepUp: vi.fn() }));

vi.mock("@/lib/api/org-foundations-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/org-foundations-client")>();
  return { ...actual, orgFoundations: { ...actual.orgFoundations, approvals: { ...actual.orgFoundations.approvals, ...api } } };
});

const base = { amount: null, currency: "NGN", baseCurrency: "NGN", enrolled: 3, people: 12, waiting: 0 };

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  document.querySelectorAll("[data-confirm-host]").forEach((n) => n.remove());
});

describe("StepUpPanel", () => {
  it("turns it on at an amount, in kobo, and shows who is ready", async () => {
    const user = userEvent.setup();
    api.stepUp.mockResolvedValue(base);
    api.updateStepUp.mockResolvedValue({ ...base, amount: 5_000_000_00, waiting: 2 });
    render(<StepUpPanel />);

    expect(await screen.findByText(/Off: nobody is asked for a code/)).toBeInTheDocument();
    expect(screen.getByText(/people have an authenticator app/)).toHaveTextContent("3 of 12 people have an authenticator app");

    await user.type(screen.getByLabelText("Ask for a code from"), "5,000,000");
    await user.click(screen.getByRole("button", { name: "Turn on" }));

    await waitFor(() => expect(api.updateStepUp).toHaveBeenCalledWith(5_000_000_00, "NGN"));
    expect(await screen.findByText((_, el) => el?.tagName === "P" && el.textContent === "2 open tasks need a code now.")).toBeInTheDocument();
  });

  it("turns it off after a confirmation", async () => {
    const user = userEvent.setup();
    api.stepUp.mockResolvedValue({ ...base, amount: 5_000_000_00 });
    api.updateStepUp.mockResolvedValue(base);
    render(<StepUpPanel />);

    await user.click(await screen.findByRole("button", { name: "Turn off" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(api.updateStepUp).toHaveBeenCalledWith(null, "NGN"));
  });

  it("refuses text that is not an amount", async () => {
    const user = userEvent.setup();
    api.stepUp.mockResolvedValue(base);
    render(<StepUpPanel />);

    await user.type(await screen.findByLabelText("Ask for a code from"), "lots");
    expect(screen.getByText("Type an amount, like 5,000,000.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn on" })).toBeDisabled();
  });
});
