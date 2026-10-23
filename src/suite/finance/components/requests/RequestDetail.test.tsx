import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RequestDetail from "./RequestDetail";
import { OPTIONS, memoFull } from "./fixtures";

/** My request: the road, answering the FCU, withdrawing, and the vouchers paying it. */

const api = vi.hoisted(() => ({ get: vi.fn(), answer: vi.fn(), withdraw: vi.fn(), options: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/api/finance-spend-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-spend-client")>();
  return { ...actual, spend: { ...actual.spend, me: { ...actual.spend.me, get: api.get, answer: api.answer, withdraw: api.withdraw, options: api.options } } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-tunde", role: "user", name: "Tunde Bello", organisationId: "o", permissions: [] }, loading: false }) }));
const router = vi.hoisted(() => ({ push: (...a: unknown[]) => api.push(...a), replace: () => undefined, refresh: () => undefined, back: () => undefined, prefetch: () => undefined }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/suite/finance/requests/m1", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.options.mockResolvedValue(OPTIONS);
});

describe("RequestDetail", () => {
  it("shows where it is and lets me answer the FCU, which sends it back to them", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(
      memoFull({
        status: "fcu_queried",
        queries: [
          {
            id: "q1",
            checkpoint: 1,
            status: "open",
            raisedBy: "Ruth Akande",
            raisedAt: "2026-09-03T10:00:00+01:00",
            messages: [{ id: "x", author: "Ruth Akande", authorId: "u-ruth", body: "• The amount agrees with the invoice: the invoice says ₦1,150,000.00.", at: "2026-09-03T10:00:00+01:00" }],
          },
        ],
      }),
    );
    api.answer.mockResolvedValue([]);
    render(<RequestDetail id="m1" />);

    expect(await screen.findByRole("heading", { name: "Swiftlink: September fibre lease" })).toBeInTheDocument();
    const road = screen.getByRole("list", { name: "Where this request is" });
    expect(within(road).getByText("FCU cleared").closest("li")).toHaveAttribute("aria-current", "step");
    expect(within(road).getByText("(waiting on you)")).toBeInTheDocument();
    expect(screen.getByText("Next: answer the FCU's query.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Your answer"), "The 53.75 is the stamp duty; the corrected invoice is attached.");
    await user.click(screen.getByRole("button", { name: "Answer the FCU" }));
    expect(api.answer).toHaveBeenCalledWith("q1", "The 53.75 is the stamp duty; the corrected invoice is attached.");
    expect(api.get).toHaveBeenCalledTimes(2);
    // While queried, documents can be added to each checklist item.
    expect(screen.getByLabelText("Add another to vendor invoice or bill", { selector: "input" })).toBeInTheDocument();
  }, 15_000);

  it("withdraws a request in approval after asking", async () => {
    const user = userEvent.setup();
    const m = memoFull({ status: "in_approval", fundsSnapshot: null });
    api.get.mockResolvedValue(m);
    api.withdraw.mockResolvedValue({ ...m, status: "cancelled" });
    render(<RequestDetail id="m1" />);

    await user.click(await screen.findByRole("button", { name: "Withdraw it" }));
    await user.type(screen.getByLabelText("Reason for withdrawing"), "Supplier dropped the price");
    await user.click(screen.getByRole("button", { name: "Withdraw request" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Withdraw request" }));
    expect(api.withdraw).toHaveBeenCalledWith("m1", "Supplier dropped the price");
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
  });

  it("lists the voucher paying it, without a link for somebody outside Finance", async () => {
    api.get.mockResolvedValue(memoFull({ status: "fcu_cleared", vouchers: [{ id: "pv1", pvNo: "PV-2026-0003", status: "in_approval", amount: 1_150_053_75, net: 1_150_053_75 }] }));
    render(<RequestDetail id="m1" />);
    expect(await screen.findByText("PV-2026-0003")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "PV-2026-0003" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the approval" })).toHaveAttribute("href", "/suite/approvals/ap-1");
  });
});
