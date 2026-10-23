import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/admin-client";
import type { PaymentScheduleDetail } from "@/lib/api/finance-payments-client";
import ScheduleDetail from "./ScheduleDetail";
import { pv } from "../vouchers/fixtures";

/** A schedule at or above the organisation's step-up amount: approving asks for the approver's authenticator code. */

const api = vi.hoisted(() => ({ get: vi.fn(), approve: vi.fn(), status: vi.fn() }));

vi.mock("@/lib/api/finance-payments-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-payments-client")>();
  return { ...actual, spend: { ...actual.spend, schedules: { ...actual.spend.schedules, get: api.get, approve: api.approve } } };
});
vi.mock("@/lib/api/account-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/account-client")>();
  return { ...actual, mfa: { ...actual.mfa, status: api.status } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-fc", role: "admin", name: "Finance controller", organisationId: "o", permissions: [] }, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/payments",
  useSearchParams: () => new URLSearchParams(),
}));

const schedule = (over: Partial<PaymentScheduleDetail> = {}): PaymentScheduleDetail => ({
  id: "ps-1",
  reference: "PS/2026/10/0001",
  bankAccountId: "bank-1",
  bankAccount: "UBA Operations",
  status: "draft",
  total: 6_000_000_00,
  count: 1,
  createdBy: "Treasury",
  createdById: "u-tre",
  approvedBy: null,
  approvedAt: null,
  fileSha256: null,
  generatedAt: null,
  createdAt: "2026-10-05T09:00:00Z",
  stepUp: true,
  vouchers: [pv({ id: "v1", status: "scheduled", scheduleId: "ps-1", net: 6_000_000_00 })],
  ...over,
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  document.querySelectorAll("[data-confirm-host]").forEach((n) => n.remove());
});

describe("ScheduleDetail step-up", () => {
  it("asks for the code instead of a plain confirmation, and sends it", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce(schedule()).mockResolvedValue(schedule({ status: "approved", stepUp: false, approvedBy: "Finance controller" }));
    api.status.mockResolvedValue({ enabled: true, pending: false, confirmedAt: null, backupCodesLeft: 10, lastVerifiedAt: null });
    api.approve.mockResolvedValue({});
    render(<ScheduleDetail id="ps-1" />);

    expect(await screen.findByText("At this amount, approving needs the code from your authenticator app.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Approve schedule" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    const dialog = await screen.findByRole("dialog", { name: /with your code/ });
    await user.type(within(dialog).getByLabelText("6-digit code"), "246810");
    await user.click(within(dialog).getByRole("button", { name: "Approve schedule" }));

    await waitFor(() => expect(api.approve).toHaveBeenCalledWith("ps-1", "246810"));
    expect((await screen.findAllByText("Schedule approved. The bank file can now be downloaded.")).length).toBeGreaterThan(0);
  });

  it("tells somebody without an authenticator where to set one up", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(schedule());
    api.status.mockResolvedValue({ enabled: false, pending: false, confirmedAt: null, backupCodesLeft: 0, lastVerifiedAt: null });
    render(<ScheduleDetail id="ps-1" />);

    await user.click(await screen.findByRole("button", { name: "Approve schedule" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByRole("link", { name: /Set up two-step verification/ })).toHaveAttribute("href", "/account?tab=security");
    expect(api.approve).not.toHaveBeenCalled();
  });

  it("opens the prompt when the server asks for a code the page did not expect", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(schedule({ stepUp: false }));
    api.status.mockResolvedValue({ enabled: true, pending: false, confirmedAt: null, backupCodesLeft: 10, lastVerifiedAt: null });
    api.approve.mockRejectedValueOnce(new ApiError("Enter the code.", 428, { mfaCode: ["Enter the code."] }, "MFA_REQUIRED"));
    render(<ScheduleDetail id="ps-1" />);

    await user.click(await screen.findByRole("button", { name: "Approve schedule" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Approve schedule" }));
    expect(await screen.findByRole("dialog", { name: /with your code/ })).toBeInTheDocument();
  });
});
