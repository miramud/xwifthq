import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PaymentScheduleDetail } from "@/lib/api/finance-payments-client";
import PaymentsBoard from "./PaymentsBoard";
import ScheduleDetail from "./ScheduleDetail";
import { bankFileName, groupHash, sha256Hex } from "./meta";
import { bank, pv } from "../vouchers/fixtures";

/** Treasury: approved vouchers into schedules, a second person's approval, the bank file and its hash, bank references. */

const api = vi.hoisted(() => ({
  list: vi.fn(),
  schedules: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  approve: vi.fn(),
  bankFile: vi.fn(),
  initiated: vi.fn(),
  failed: vi.fn(),
  cancel: vi.fn(),
  banks: vi.fn(),
}));
const push = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ user: { id: "u-tre", role: "admin", name: "Treasury", organisationId: "o", permissions: [] as string[] } }));

vi.mock("@/lib/api/finance-payments-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-payments-client")>();
  return {
    ...actual,
    spend: {
      ...actual.spend,
      vouchers: { ...actual.spend.vouchers, list: api.list },
      schedules: { list: api.schedules, get: api.get, create: api.create, approve: api.approve, bankFile: api.bankFile, initiated: api.initiated, failed: api.failed, cancel: api.cancel },
    },
  };
});
vi.mock("@/lib/api/finance-banking-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-banking-client")>();
  return { ...actual, banking: { ...actual.banking, accounts: { ...actual.banking.accounts, list: api.banks } } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/payments",
  useSearchParams: () => new URLSearchParams(),
}));

const schedule = (over: Partial<PaymentScheduleDetail> = {}): PaymentScheduleDetail => ({
  id: "ps-1",
  reference: "PS/2026/10/0001",
  bankAccountId: "bank-1",
  bankAccount: "UBA Operations",
  status: "draft",
  total: 1_925_000_00,
  count: 2,
  createdBy: "Treasury",
  createdById: "u-tre",
  approvedBy: null,
  approvedAt: null,
  fileSha256: null,
  generatedAt: null,
  createdAt: "2026-10-05T09:00:00Z",
  vouchers: [
    pv({ id: "v1", pvNo: "PV/2026/10/0003", status: "scheduled", scheduleId: "ps-1" }),
    pv({ id: "v2", pvNo: "PV/2026/10/0004", status: "scheduled", scheduleId: "ps-1", payee: "Brightline Supplies", net: 950_000_00 }),
  ],
  ...over,
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  push.mockReset();
  auth.user = { id: "u-tre", role: "admin", name: "Treasury", organisationId: "o", permissions: [] };
  api.banks.mockResolvedValue([bank(), bank({ id: "bank-2", name: "Zenith Projects", bankCode: "zenith", bookBalance: 10_000_00 })]);
  document.querySelectorAll("[data-confirm-host]").forEach((n) => n.remove());
});

describe("PaymentsBoard", () => {
  it("groups approved vouchers by paying account and builds a schedule from the ticked ones", async () => {
    const user = userEvent.setup();
    api.list.mockImplementation(async ({ status }: { status: string }) =>
      status === "approved"
        ? [
            pv({ id: "v1", status: "approved" }),
            pv({ id: "v2", status: "approved", pvNo: "PV/2026/10/0004", payee: "Brightline Supplies", net: 950_000_00 }),
            pv({ id: "v3", status: "approved", pvNo: "PV/2026/10/0005", payee: "Lagos Print Co", payingBankAccountId: "bank-2", payingBankAccount: "Zenith Projects", net: 20_000_00 }),
          ]
        : [],
    );
    api.schedules.mockResolvedValue([]);
    api.create.mockResolvedValue({ id: "ps-9" });
    render(<PaymentsBoard />);

    const uba = (await screen.findByRole("heading", { name: "UBA Operations" })).closest("section")!;
    const zenith = screen.getByRole("heading", { name: "Zenith Projects" }).closest("section")!;
    // The small account can't cover its payment: said in words.
    expect(within(zenith).getByText(/More than the account's book balance/)).toBeInTheDocument();

    await user.click(within(uba).getByLabelText("Include PV/2026/10/0004, Brightline Supplies"));
    expect(within(uba).getByText("₦975,000.00", { selector: "span.font-bold" })).toBeInTheDocument();
    await user.click(within(uba).getByRole("button", { name: "Build schedule of 1" }));
    expect(api.create).toHaveBeenCalledWith("bank-1", ["v1"]);
    expect(push).toHaveBeenCalledWith("/suite/finance/payments/ps-9?notice=built");
  });
});

describe("ScheduleDetail", () => {
  it("won't let the person who built a schedule approve it, and says why", async () => {
    api.get.mockResolvedValue(schedule());
    render(<ScheduleDetail id="ps-1" />);
    const btn = await screen.findByRole("button", { name: "Approve schedule" });
    expect(btn).toBeDisabled();
    expect(screen.getByText("You built this schedule, so somebody else approves it.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record bank reference" })).not.toBeInTheDocument();
  });

  it("lets a second person approve it", async () => {
    const user = userEvent.setup();
    auth.user = { ...auth.user, id: "u-fc" };
    api.get.mockResolvedValueOnce(schedule()).mockResolvedValueOnce(schedule({ status: "approved", approvedBy: "Finance controller" }));
    api.approve.mockResolvedValue({});
    render(<ScheduleDetail id="ps-1" />);
    await user.click(await screen.findByRole("button", { name: "Approve schedule" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Approve schedule" }));
    expect(api.approve).toHaveBeenCalledWith("ps-1");
    expect(await screen.findByRole("button", { name: "Download bank file" })).toBeInTheDocument();
  });

  it("downloads the bank file, shows its fingerprint, and records a bank reference", async () => {
    const user = userEvent.setup();
    const csv = "Beneficiary Name,Account Number\r\n";
    const hash = (await sha256Hex(csv)) ?? "abc";
    api.get.mockResolvedValueOnce(schedule({ status: "approved", createdById: "u-other" })).mockResolvedValue(schedule({ status: "downloaded", createdById: "u-other", fileSha256: hash }));
    api.bankFile.mockResolvedValue(csv);
    api.initiated.mockResolvedValue({});
    const created = vi.fn(() => "blob:x");
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() });
    render(<ScheduleDetail id="ps-1" />);

    await user.click(await screen.findByRole("button", { name: "Download bank file" }));
    expect(api.bankFile).toHaveBeenCalledWith("ps-1");
    expect(created).toHaveBeenCalled();
    expect(await screen.findByText(groupHash(hash))).toBeInTheDocument();
    if (hash !== "abc") expect(screen.getByText("The file you downloaded matches the recorded fingerprint.")).toBeInTheDocument();

    const row = screen.getByText("Brightline Supplies").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Record bank reference" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Bank reference"), "CIB2610060012345");
    await user.click(within(dialog).getByRole("button", { name: "Record bank reference" }));
    expect(api.initiated).toHaveBeenCalledWith("v2", "CIB2610060012345");
  });

  it("cancels a schedule with a reason, sending its payments back to the queue", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce(schedule()).mockResolvedValue(schedule({ status: "cancelled" }));
    api.cancel.mockResolvedValue({});
    render(<ScheduleDetail id="ps-1" />);
    await user.click(await screen.findByRole("button", { name: "Cancel schedule" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Why it is cancelled"), "Wrong account");
    await user.click(within(dialog).getByRole("button", { name: "Cancel schedule" }));
    expect(api.cancel).toHaveBeenCalledWith("ps-1", "Wrong account");
    expect((await screen.findAllByText(/cancelled. Its payments are back in the queue/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Cancel schedule" })).not.toBeInTheDocument();
  });

  it("offers no cancel once a payment has gone out, or without the permission", async () => {
    api.get.mockResolvedValue(
      schedule({ status: "downloaded", createdById: "u-other", vouchers: [pv({ id: "v1", status: "payment_initiated", scheduleId: "ps-1" })] }),
    );
    const { unmount } = render(<ScheduleDetail id="ps-1" />);
    await screen.findByRole("button", { name: "Download bank file again" });
    expect(screen.queryByRole("button", { name: "Cancel schedule" })).not.toBeInTheDocument();
    unmount();

    auth.user = { ...auth.user, role: "user", permissions: ["finance.payments.approve"] };
    api.get.mockResolvedValue(schedule({ createdById: "u-other" }));
    render(<ScheduleDetail id="ps-1" />);
    await screen.findByRole("button", { name: "Approve schedule" });
    expect(screen.queryByRole("button", { name: "Cancel schedule" })).not.toBeInTheDocument();
  });

  it("names the bank file after the schedule", () => {
    expect(bankFileName("PS/2026/10/0001")).toBe("PS-2026-10-0001.csv");
    expect(groupHash("0123456789abcdef01")).toBe("01234567 89abcdef 01");
  });
});
