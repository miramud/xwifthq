import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentSettingsBoard from "./PaymentSettingsBoard";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import { ApiError, type PaymentSettings } from "@/lib/api/platform-billing-client";

/**
 * Choosing the checkout gateway. Switching asks first (it moves every new
 * checkout), a cancelled question sends nothing, and a refusal from the API —
 * a gateway whose keys aren't configured — is shown in its own words.
 */

const api = vi.hoisted(() => ({ get: vi.fn(), setGateway: vi.fn() }));

vi.mock("@/lib/api/platform-billing-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/platform-billing-client")>();
  return { ...actual, platformPaymentSettings: api };
});

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { id: "owner", role: "super_admin", name: "Owner", organisationId: null }, loading: false }),
}));

function settings(gateway: string): PaymentSettings {
  const urls = (g: string) => ({
    webhookUrl: `http://localhost/api/webhooks/${g}`,
    callbackUrls: {
      modules: "http://localhost:3000/suite/org/billing/return",
      seats: "http://localhost:3000/suite/org/seats/verify",
    },
  });
  return {
    gateway,
    currency: "NGN",
    gateways: [
      { key: "paystack", label: "Paystack", configured: true, testMode: true, secretHashConfigured: null, ...urls("paystack") },
      { key: "flutterwave", label: "Flutterwave", configured: true, testMode: true, secretHashConfigured: true, ...urls("flutterwave") },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue(settings("paystack"));
});

function renderBoard() {
  return render(
    <ConfirmProvider>
      <PaymentSettingsBoard />
    </ConfirmProvider>,
  );
}

describe("PaymentSettingsBoard", () => {
  it("asks before switching checkout, then switches", async () => {
    api.setGateway.mockResolvedValue(settings("flutterwave"));
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("radio", { name: /flutterwave/i }));
    const dialog = await screen.findByRole("alertdialog", { name: /take payments through flutterwave/i });
    expect(within(dialog).getByText(/for modules and for seats/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /use flutterwave/i }));

    expect(api.setGateway).toHaveBeenCalledWith("flutterwave");
    expect(await screen.findByText(/new checkouts now use flutterwave/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /flutterwave/i })).toHaveAttribute("aria-checked", "true");
  });

  it("sends nothing when the question is cancelled", async () => {
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("radio", { name: /flutterwave/i }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: /cancel/i }));

    expect(api.setGateway).not.toHaveBeenCalled();
  });

  it("shows the API's reason when the gateway can't be used", async () => {
    api.setGateway.mockRejectedValue(new ApiError("Flutterwave isn't configured on this server.", 422));
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("radio", { name: /flutterwave/i }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: /use flutterwave/i }));

    expect(await screen.findByText("Flutterwave isn't configured on this server.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /paystack/i })).toHaveAttribute("aria-checked", "true");
  });

  it("warns that a localhost webhook can't be reached", async () => {
    renderBoard();
    expect(await screen.findByText(/these webhook addresses point at this machine/i)).toBeInTheDocument();
    expect(screen.getAllByText("Not reachable from the internet").length).toBeGreaterThan(0);
  });
});
