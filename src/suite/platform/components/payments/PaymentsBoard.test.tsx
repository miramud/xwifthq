import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption } from "@/test/selectOption";
import PaymentsBoard from "./PaymentsBoard";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import type { Payment } from "@/lib/api/platform-commerce-client";

/**
 * Reconciling payments by hand.
 *
 * What carries weight: a resolution never goes without a note, marking a
 * payment failed asks first (it withholds what was bought), cancelling that
 * question sends nothing, and a resolved row leaves the queue it was in.
 */

const api = vi.hoisted(() => ({
  list: vi.fn(),
  summary: vi.fn(),
  verify: vi.fn(),
  resolve: vi.fn(),
}));

vi.mock("@/lib/api/platform-commerce-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/platform-commerce-client")>();
  return { ...actual, platformPayments: api };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/platform/payments",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { id: "owner", role: "super_admin", name: "Owner", organisationId: null }, loading: false }),
}));

function payment(over: Partial<Payment> = {}): Payment {
  return {
    id: "pay-1",
    reference: "PSK_991204",
    provider: "paystack",
    kind: "seats",
    organisation: { slug: "acme", name: "Acme Institute" },
    expectedKobo: 25_000_000,
    receivedKobo: null,
    status: "pending",
    webhookAt: null,
    verifiedAt: null,
    note: null,
    createdAt: "2026-09-24T10:00:00Z",
    ...over,
  };
}

function page(rows: Payment[]) {
  return { data: rows, meta: { currentPage: 1, lastPage: 1, perPage: 20, total: rows.length } };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.summary.mockResolvedValue({ matched: 4, pending: 1, mismatch: 0, orphan: 0, unreconciledKobo: 25_000_000 });
  api.list.mockResolvedValue(page([payment()]));
});

function renderBoard() {
  return render(
    <ConfirmProvider>
      <PaymentsBoard />
    </ConfirmProvider>,
  );
}

async function openResolve() {
  const user = userEvent.setup();
  renderBoard();
  await screen.findByText("PSK_991204");
  await user.click(screen.getByRole("button", { name: /resolve/i }));
  const dialog = await screen.findByRole("dialog", { name: /resolve psk_991204/i });
  return { user, dialog };
}

describe("PaymentsBoard: resolving by hand", () => {
  it("won't resolve without a note", async () => {
    const { user, dialog } = await openResolve();

    const submit = within(dialog).getByRole("button", { name: "Mark as paid" });
    expect(submit).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/note/i), "ok");
    expect(submit).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/note/i), ", bank statement checked");
    expect(submit).toBeEnabled();
  });

  it("marks a payment paid with the note, and takes it off the pending queue", async () => {
    api.resolve.mockResolvedValue(payment({ status: "matched", note: "Bank statement checked" }));
    const { user, dialog } = await openResolve();

    await user.type(within(dialog).getByLabelText(/note/i), "Bank statement checked");
    await user.click(within(dialog).getByRole("button", { name: "Mark as paid" }));

    expect(api.resolve).toHaveBeenCalledWith("pay-1", "mark_paid", "Bank statement checked");
    expect(await screen.findByRole("status")).toHaveTextContent(/PSK_991204 marked as paid/i);
    expect(screen.queryByText("PSK_991204")).not.toBeInTheDocument();
  });

  it("asks before marking a payment failed, and sends nothing if cancelled", async () => {
    const { user, dialog } = await openResolve();

    await user.click(within(dialog).getByRole("radio", { name: /mark as failed/i }));
    await user.type(within(dialog).getByLabelText(/note/i), "No money on the statement");
    await user.click(within(dialog).getByRole("button", { name: "Mark as failed" }));

    const question = await screen.findByRole("alertdialog", { name: /mark psk_991204 as failed/i });
    await user.click(within(question).getByRole("button", { name: "Cancel" }));

    expect(api.resolve).not.toHaveBeenCalled();
    // The resolve dialog is still open with what was typed.
    expect(within(dialog).getByLabelText(/note/i)).toHaveValue("No money on the statement");
  });

  it("marks a payment failed once confirmed", async () => {
    api.resolve.mockResolvedValue(payment({ status: "matched" }));
    const { user, dialog } = await openResolve();

    await user.click(within(dialog).getByRole("radio", { name: /mark as failed/i }));
    await user.type(within(dialog).getByLabelText(/note/i), "No money on the statement");
    await user.click(within(dialog).getByRole("button", { name: "Mark as failed" }));

    const question = await screen.findByRole("alertdialog", { name: /mark psk_991204 as failed/i });
    await user.click(within(question).getByRole("button", { name: "Mark as failed" }));

    expect(api.resolve).toHaveBeenCalledWith("pay-1", "mark_failed", "No money on the statement");
  });

  it("shows a refusal from the API in the dialog", async () => {
    const { ApiError } = await import("@/lib/api/platform-commerce-client");
    api.resolve.mockRejectedValue(new ApiError("This payment was already resolved by someone else.", 409));
    const { user, dialog } = await openResolve();

    await user.type(within(dialog).getByLabelText(/note/i), "Bank statement checked");
    await user.click(within(dialog).getByRole("button", { name: "Mark as paid" }));

    expect(await within(dialog).findByText(/already resolved by someone else/i)).toBeInTheDocument();
  });
});

describe("PaymentsBoard: gateways and what was bought", () => {
  it("filters by gateway, and verifies a row with its own gateway", async () => {
    api.list.mockResolvedValue(
      page([
        payment({
          id: "pay-2",
          reference: "FLW_77120",
          provider: "flutterwave",
          gateway: "flutterwave",
          kind: "module",
          modules: ["hrm", "projects"],
        }),
      ]),
    );
    const user = userEvent.setup();
    renderBoard();

    const row = (await screen.findByText("FLW_77120")).closest("tr")!;
    expect(within(row).getAllByText("Modules")[0]).toBeInTheDocument();
    expect(within(row).getByText("HR")).toBeInTheDocument();
    expect(within(row).getByText("Projects")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Verify with Flutterwave" })).toBeInTheDocument();

    await chooseOption(user, screen.getByRole("combobox", { name: "Gateway" }), "Flutterwave");
    expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ gateway: "flutterwave", page: 1 }));

    await user.click(screen.getByRole("radio", { name: "Seats" }));
    expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ gateway: "flutterwave", kind: "seats" }));
  });
});

describe("PaymentsBoard: one-time checkouts (26 Sep 2026)", () => {
  it("shows a new organisation's sign-up, in dollars, before the organisation exists", async () => {
    api.list.mockResolvedValue(
      page([
        payment({
          id: "pay-signup",
          reference: "EL-SIGNUP-1",
          gateway: "flutterwave",
          kind: "signup",
          organisation: null,
          signup: { organisationName: "Kano Tech Hub", name: "Aisha Bello", email: "aisha@kanotech.example" },
          expectedKobo: undefined,
          expectedMinor: 500_000,
          receivedMinor: 500_000,
          currency: "USD",
          status: "matched",
        }),
      ]),
    );
    renderBoard();

    expect(await screen.findByText("EL-SIGNUP-1")).toBeInTheDocument();
    expect(screen.getAllByText("New organisation").length).toBeGreaterThan(0);
    expect(screen.getByText("Kano Tech Hub")).toBeInTheDocument();
    expect(screen.getByText(/Aisha Bello · aisha@kanotech.example/)).toBeInTheDocument();
    expect(screen.getByText("$5,000")).toBeInTheDocument();
    expect(screen.getByText("Received in full")).toBeInTheDocument();
  });
});

describe("PaymentsBoard: licences recorded by hand (27 Sep 2026)", () => {
  it("shows how a licence was paid and who recorded it, and offers no gateway check", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue(
      page([
        payment({
          id: "lic-1",
          reference: "LIC-0042",
          provider: "offline",
          gateway: "offline",
          kind: "licence",
          modules: ["hrm", "projects"],
          expectedMinor: 450_000_000,
          receivedMinor: 450_000_000,
          currency: "NGN",
          status: "matched",
          paymentMethod: "cheque",
          paymentReference: "CHQ-000918",
          recordedBy: "Ada Owner",
          purchaseKind: "upgrade",
          modulesAfter: 3,
        }),
        // Not matched, to prove the verify button is kept off licences, not just matched rows.
        payment({ id: "lic-2", reference: "LIC-0043", kind: "licence", status: "pending", paymentMethod: "cash" }),
      ]),
    );
    renderBoard();

    await user.click(await screen.findByRole("radio", { name: "Licences" }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "licence" })));

    const row = (await screen.findByText("LIC-0042")).closest("tr")!;
    expect(within(row).getByText(/Module licence · Upgrade · 3 modules after/)).toBeInTheDocument();
    expect(within(row).getByText("Licensed by hand")).toBeInTheDocument();
    expect(within(row).getByText("Cheque")).toBeInTheDocument();
    expect(within(row).getByText("CHQ-000918")).toBeInTheDocument();
    expect(within(row).getByText("Recorded by Ada Owner")).toBeInTheDocument();

    const pending = screen.getByText("LIC-0043").closest("tr")!;
    expect(within(pending).queryByRole("button", { name: /verify/i })).not.toBeInTheDocument();
  });
});
