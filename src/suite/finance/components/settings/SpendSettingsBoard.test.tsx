import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SpendSettings } from "@/lib/api/finance-payments-client";
import SpendSettingsBoard from "./SpendSettingsBoard";

/** Limits save only what changed; checklists and WHT rates edit in place; read-only without the keys. */

const api = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), addChecklistItem: vi.fn(), updateChecklistItem: vi.fn(), updateWhtRate: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: "u", role: "admin", name: "Bursar", organisationId: "o", permissions: [] as string[] } }));

vi.mock("@/lib/api/finance-payments-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-payments-client")>();
  return { ...actual, spend: { ...actual.spend, settings: api } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));

const DATA: SpendSettings = {
  checklists: [
    { id: "c1", memoType: "payment", code: "invoice", label: "Invoice", hint: "From the vendor", required: true, requiredFrom: null, active: true },
    { id: "c2", memoType: "payment", code: "quotes", label: "Three quotations", hint: null, required: true, requiredFrom: 1_000_000_00, active: true },
    { id: "c3", memoType: "advance", code: "budget", label: "Activity budget", hint: null, required: true, requiredFrom: null, active: true },
  ],
  whtRates: [
    { id: "w1", code: "technical", label: "Technical services", payeeKind: "company", rateBp: 1000, active: true },
    { id: "w2", code: "technical", label: "Technical services", payeeKind: "individual", rateBp: 500, active: true },
    { id: "w3", code: "none", label: "No withholding", payeeKind: "company", rateBp: 0, active: true },
  ],
  settings: { fund_control: true, advance_retirement_days: 30, memo_clear_days: 30, statement_match_days: 10, commitment_expiry_days: 90, memo_reminder_days: 30, commitment_alert_days: 60, commitment_auto_expire: false },
};

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  auth.user = { id: "u", role: "admin", name: "Bursar", organisationId: "o", permissions: [] };
  api.get.mockResolvedValue(DATA);
});

describe("SpendSettingsBoard", () => {
  it("saves only the limits that changed", async () => {
    const user = userEvent.setup();
    api.update.mockResolvedValue({});
    render(<SpendSettingsBoard />);
    const days = await screen.findByLabelText("Retire an advance within");
    await user.clear(days);
    await user.type(days, "21");
    await user.click(screen.getByRole("switch", { name: "Fund control" }));
    expect(screen.getByText(/Off: requests are not checked/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save limits" }));
    expect(api.update).toHaveBeenCalledWith({ fund_control: false, advance_retirement_days: 21 });
  });

  it("sets the reminder and alert ages and switches automatic expiry on", async () => {
    const user = userEvent.setup();
    api.update.mockResolvedValue({});
    render(<SpendSettingsBoard />);
    const remind = await screen.findByLabelText("Remind about an approved request with no voucher after");
    expect(remind).toHaveValue(30);
    expect(screen.getByLabelText("Flag an unpaid commitment after")).toHaveValue(60);
    await user.clear(remind);
    await user.type(remind, "14");
    expect(screen.getByText(/Off: they are listed on the exceptions board/)).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Expire unpaid requests automatically" }));
    expect(screen.getByText(/On: each morning, approved requests unpaid after 90 days expire/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save limits" }));
    expect(api.update).toHaveBeenCalledWith({ commitment_auto_expire: true, memo_reminder_days: 14 });
  });

  it("refuses a limit out of range, beside the field", async () => {
    const user = userEvent.setup();
    render(<SpendSettingsBoard />);
    const days = await screen.findByLabelText("Match a payment to the statement within");
    await user.clear(days);
    await user.type(days, "200");
    await user.click(screen.getByRole("button", { name: "Save limits" }));
    expect(screen.getByText("Enter a whole number of days from 1 to 90.")).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
  });

  it("edits a checklist item's threshold in naira and adds a document", async () => {
    const user = userEvent.setup();
    api.updateChecklistItem.mockResolvedValue({ id: "c2" });
    api.addChecklistItem.mockResolvedValue({ id: "c9" });
    render(<SpendSettingsBoard />);
    const row = (await screen.findByDisplayValue("Three quotations")).closest("li")!;
    expect(within(row).getByLabelText("Required from (₦)")).toHaveValue("1,000,000.00");
    await user.clear(within(row).getByLabelText("Required from (₦)"));
    await user.type(within(row).getByLabelText("Required from (₦)"), "2,000,000");
    await user.click(within(row).getByRole("button", { name: "Save" }));
    expect(api.updateChecklistItem).toHaveBeenCalledWith("c2", { label: "Three quotations", hint: null, required: true, requiredFrom: 2_000_000_00, active: true });

    await user.click(screen.getByRole("tab", { name: /Advances/ }));
    expect(screen.getByDisplayValue("Activity budget")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add a document" }));
    await user.type(screen.getByLabelText("Document", { selector: "input:not([value='Activity budget'])" }), "Line manager's note");
    await user.click(screen.getByRole("button", { name: "Add document" }));
    expect(api.addChecklistItem).toHaveBeenCalledWith({ memoType: "advance", label: "Line manager's note", hint: null, required: true, requiredFrom: null });
  });

  it("edits a WHT rate in percent", async () => {
    const user = userEvent.setup();
    api.updateWhtRate.mockResolvedValue({ id: "w2" });
    render(<SpendSettingsBoard />);
    const input = await screen.findByLabelText("Technical services, individual payee, rate in percent");
    expect(input).toHaveValue("5");
    expect(screen.queryByText("No withholding")).not.toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "7.5");
    await user.click(screen.getByRole("button", { name: "Save Technical services, individual payee" }));
    expect(api.updateWhtRate).toHaveBeenCalledWith("w2", { rateBp: 750 });
  });

  it("is read-only without the keys", async () => {
    auth.user = { id: "u", role: "staff", name: "Viewer", organisationId: "o", permissions: ["finance.spend_settings.view"] };
    render(<SpendSettingsBoard />);
    expect(await screen.findByText("10%")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save limits" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a document" })).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Fund control" })).toBeDisabled();
  });
});
