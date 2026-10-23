import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BillingReturn, POLL_ATTEMPTS } from "./BillingReturn";

/**
 * Coming back from the gateway. The URL is only a hint; the API re-verifies.
 * Paid refreshes the session so the new modules show at once; pending polls,
 * then settles calmly; failed and cancelled offer another go.
 */

const refresh = vi.fn(async () => {});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: null, loading: false, refresh }) }));

const verify = vi.fn<(reference: string) => Promise<unknown>>();
vi.mock("@/lib/api/billing-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/billing-client")>("@/lib/api/billing-client");
  return { ...actual, billing: { verify: (r: string) => verify(r) } };
});

function purchase(status: string) {
  return {
    id: "p1",
    kind: "module",
    reference: "EL-MOD-1",
    gateway: "flutterwave",
    status,
    amountMinor: 200_000,
    currency: "USD",
    period: null,
    modules: [
      { key: "hrm", label: "HR", startsOn: null, endsOn: null },
      { key: "finance", label: "Finance", deliveredWhenReleased: true },
    ],
    seats: null,
    createdAt: "2026-09-26T10:00:00Z",
    paidAt: status === "paid" ? "2026-09-26T10:01:00Z" : null,
  };
}

beforeEach(() => {
  verify.mockReset();
  refresh.mockClear();
});

describe("returning from the gateway", () => {
  it("confirms a paid purchase, lists what switched on, and refreshes the session", async () => {
    verify.mockResolvedValue(purchase("paid"));
    render(<BillingReturn reference="EL-MOD-1" />);

    expect(await screen.findByRole("heading", { name: "Payment received" })).toBeInTheDocument();
    // A one-time purchase: no end dates, and Finance waits for its release.
    expect(screen.getByText(/\$2,000 received, once/)).toBeInTheDocument();
    expect(screen.getByText("Active now")).toBeInTheDocument();
    expect(screen.getByText("Switches on when released")).toBeInTheDocument();
    expect(screen.queryByText(/Active until/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View receipt/ })).toHaveAttribute("href", "/suite/org/billing/receipts/p1");
    expect(verify).toHaveBeenCalledWith("EL-MOD-1");
    expect(refresh).toHaveBeenCalled();
  });

  it("polls while pending, then settles on a calm still-clearing message", async () => {
    verify.mockResolvedValue(purchase("pending"));
    render(<BillingReturn reference="EL-MOD-1" pollMs={1} />);

    expect(await screen.findByRole("heading", { name: "Payment still clearing" })).toBeInTheDocument();
    expect(verify).toHaveBeenCalledTimes(POLL_ATTEMPTS);
    expect(screen.getByText(/email you as soon as it clears/)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("offers another go when the payment failed", async () => {
    verify.mockResolvedValue(purchase("failed"));
    render(<BillingReturn reference="EL-MOD-1" />);

    expect(await screen.findByRole("heading", { name: "Payment didn't go through" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Try again/ })).toHaveAttribute("href", "/suite/org/billing");
  });

  it("reads a cancelled checkout as cancelled, not as an error", async () => {
    verify.mockResolvedValue(purchase("cancelled"));
    render(<BillingReturn reference="EL-MOD-1" gatewayStatus="cancelled" />);

    expect(await screen.findByRole("heading", { name: "Payment cancelled" })).toBeInTheDocument();
    expect(screen.getByText(/Nothing was charged/)).toBeInTheDocument();
  });

  it("refuses a link with no reference without calling the API", async () => {
    render(<BillingReturn reference="" />);

    expect(await screen.findByText(/missing its payment reference/)).toBeInTheDocument();
    await waitFor(() => expect(verify).not.toHaveBeenCalled());
  });
});
