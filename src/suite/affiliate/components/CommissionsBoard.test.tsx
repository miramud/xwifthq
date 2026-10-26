import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommissionsBoard from "./CommissionsBoard";
import { COMMISSION, pageOf } from "./fixtures";
import type { Commission, CommissionStatus, Page } from "@/lib/api/affiliate-client";

/**
 * An affiliate's commissions: each status tab asks the API for that status,
 * every row shows how the commission was worked out, and a reversed one says
 * why it was reversed.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/affiliate/commissions",
  useSearchParams: () => new URLSearchParams(),
}));

const commissions = vi.fn<(q: { status?: CommissionStatus; page?: number }) => Promise<Page<Commission>>>();

vi.mock("@/lib/api/affiliate-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/affiliate-client")>();
  return { ...actual, myAffiliate: { ...actual.myAffiliate, commissions: (q: { status?: CommissionStatus; page?: number }) => commissions(q) } };
});

beforeEach(() => {
  window.localStorage.clear();
  commissions.mockReset().mockResolvedValue(pageOf([COMMISSION]));
});

describe("affiliate commissions", () => {
  it("lists every commission with how it was worked out", async () => {
    render(<CommissionsBoard />);

    expect(await screen.findByText("Acme Holdings")).toBeInTheDocument();
    expect(commissions).toHaveBeenCalledWith({ status: undefined, page: 1 });
    expect(screen.getByText("₦45,000")).toBeInTheDocument();
    expect(screen.getByText("₦5,000")).toBeInTheDocument();
    expect(screen.getByText("₦50,000")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
    expect(screen.getByText("₦10,000")).toBeInTheDocument();
    expect(screen.getByText(/Base is what they paid plus their discount/)).toBeInTheDocument();
  });

  it("asks the API for the chosen status", async () => {
    const user = userEvent.setup();
    render(<CommissionsBoard />);
    await screen.findByText("Acme Holdings");

    await user.click(screen.getByRole("tab", { name: "Ready to pay" }));
    expect(commissions).toHaveBeenLastCalledWith({ status: "approved", page: 1 });

    commissions.mockResolvedValue(pageOf([]));
    await user.click(screen.getByRole("tab", { name: "On hold" }));
    expect(commissions).toHaveBeenLastCalledWith({ status: "pending", page: 1 });
    expect(await screen.findByText("Nothing on hold")).toBeInTheDocument();
  });

  it("shows why a commission was reversed", async () => {
    commissions.mockResolvedValue(
      pageOf([{ ...COMMISSION, status: "reversed", statusLabel: "Reversed", reversalNote: "Payment refunded on 3 Oct." }]),
    );
    render(<CommissionsBoard />);

    expect(await screen.findByText("Payment refunded on 3 Oct.")).toBeInTheDocument();
    expect(screen.getAllByText("Reversed").length).toBeGreaterThan(0);
  });
});
