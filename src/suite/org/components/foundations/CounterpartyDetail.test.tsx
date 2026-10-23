import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CounterpartyDetail, { counterpartyPatch } from "./CounterpartyDetail";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import { ApiError, type BankAccount, type Counterparty } from "@/lib/api/org-foundations-client";

/** One client or vendor: bank details under maker-checker, aliases, roles, and a delete the API may refuse. */

const api = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  setRoles: vi.fn(),
  addAlias: vi.fn(),
  removeAlias: vi.fn(),
  requestBankAccount: vi.fn(),
  approveBankAccount: vi.fn(),
  rejectBankAccount: vi.fn(),
  retireBankAccount: vi.fn(),
}));
const me = vi.hoisted(() => ({ id: "checker" }));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/org-foundations-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/org-foundations-client")>();
  return { ...actual, orgFoundations: { ...actual.orgFoundations, counterparties: api, lookups: { people: vi.fn().mockResolvedValue([]) } } };
});

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { id: me.id, role: "admin", name: "Me", organisationId: "org-1" }, loading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org/counterparties/cp-1",
  useSearchParams: () => new URLSearchParams(),
}));

const pending: BankAccount = {
  id: "ba-1",
  bankName: "Zenith Bank",
  bankCode: null,
  accountName: "Acme Supplies Ltd",
  number: "•••• 5678",
  currency: "NGN",
  isDefault: false,
  status: "pending_approval",
  requestedBy: { id: "maker", name: "Mary Maker" },
  decidedBy: null,
  decidedAt: null,
  rejectionReason: null,
  requestedAt: "2026-10-01T09:00:00Z",
};

const approved: BankAccount = {
  ...pending,
  id: "ba-0",
  bankName: "GTBank",
  number: "•••• 1111",
  status: "active",
  decidedBy: { id: "carl", name: "Carl Checker" },
  decidedAt: "2026-09-02T09:00:00Z",
};

const CP: Counterparty = {
  id: "cp-1",
  code: "V-0001",
  slug: "acme",
  roles: ["vendor"],
  kind: "organisation",
  name: "Acme Supplies",
  legalName: "Acme Supplies Ltd",
  website: null,
  sector: "Stationery",
  email: null,
  phone: null,
  address: null,
  country: "NG",
  tin: null,
  rcNumber: null,
  vatNumber: null,
  defaultCurrency: "NGN",
  paymentTermsDays: 30,
  notes: null,
  status: "active",
  kycStatus: "pending",
  aliases: [{ id: "al-1", alias: "ACME SUPP LTD" }],
  contacts: [],
  bankAccounts: [pending, approved],
  createdAt: null,
  bankChangesViaApprovals: false,
};

function renderDetail() {
  return render(
    <ConfirmProvider>
      <CounterpartyDetail id="cp-1" />
    </ConfirmProvider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  push.mockReset();
  me.id = "checker";
  api.get.mockResolvedValue(CP);
});

const card = async (bank: string) => (await screen.findByText(bank)).closest("li")!;

describe("bank accounts", () => {
  it("shows each account masked, with who entered and who decided it", async () => {
    renderDetail();
    const approvedCard = await card("GTBank");
    expect(within(approvedCard).getByText("•••• 1111")).toBeInTheDocument();
    expect(within(approvedCard).getByText("Approved", { selector: "p" })).toBeInTheDocument();
    expect(within(approvedCard).getByText(/by Carl Checker/)).toBeInTheDocument();

    const pendingCard = await card("Zenith Bank");
    expect(within(pendingCard).getByText("Awaiting approval")).toBeInTheDocument();
    expect(within(pendingCard).getByText(/by Mary Maker/)).toBeInTheDocument();
    expect(within(pendingCard).getByText("Waiting for a second person to check")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/\d{6,}/);
  });

  it("sends a pending account to Approvals when the organisation decides bank changes there", async () => {
    api.get.mockResolvedValue({ ...CP, bankChangesViaApprovals: true });
    renderDetail();

    const pendingCard = await card("Zenith Bank");
    expect(within(pendingCard).getByRole("link", { name: "Decide in Approvals" })).toHaveAttribute("href", "/suite/approvals");
    expect(within(pendingCard).queryByRole("button", { name: "Approve here" })).not.toBeInTheDocument();
  });

  it("explains the refusal if the decision has moved to Approvals meanwhile", async () => {
    const user = userEvent.setup();
    const msg = "These bank details are going through approval. Decide them from Approvals.";
    api.approveBankAccount.mockRejectedValue(new ApiError(msg, 422, { account: [msg] }));
    renderDetail();

    const pendingCard = await card("Zenith Bank");
    await user.click(within(pendingCard).getByRole("button", { name: "Approve here" }));
    expect(api.approveBankAccount).toHaveBeenCalledWith("cp-1", "ba-1");
    const alert = await within(pendingCard).findByRole("alert");
    expect(alert).toHaveTextContent(msg);
    expect(within(alert).getByRole("link", { name: "Open Approvals" })).toHaveAttribute("href", "/suite/approvals");
  });

  it("approves directly when the organisation allows it", async () => {
    const user = userEvent.setup();
    api.approveBankAccount.mockResolvedValue({ ...CP, bankAccounts: [{ ...pending, status: "active", decidedBy: { id: "checker", name: "Me" }, decidedAt: "2026-10-05T09:00:00Z" }, approved] });
    renderDetail();

    await user.click(within(await card("Zenith Bank")).getByRole("button", { name: "Approve here" }));
    expect(await screen.findByText("Zenith Bank •••• 5678 approved.", { selector: "p:not(.sr-only)" })).toBeInTheDocument();
    expect(within(await card("Zenith Bank")).getByText(/by Me/)).toBeInTheDocument();
  });

  it("never offers the maker a way to approve their own entry", async () => {
    me.id = "maker";
    renderDetail();
    const pendingCard = await card("Zenith Bank");
    expect(within(pendingCard).queryByRole("button", { name: "Approve here" })).not.toBeInTheDocument();
    expect(within(pendingCard).getByText(/You entered these details/)).toBeInTheDocument();
  });

  it("needs a reason to reject", async () => {
    const user = userEvent.setup();
    api.rejectBankAccount.mockResolvedValue({ ...CP, bankAccounts: [{ ...pending, status: "rejected", rejectionReason: "Wrong account name" }, approved] });
    renderDetail();

    await user.click(within(await card("Zenith Bank")).getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Reject bank details" }));
    expect(await within(dialog).findByText(/Say why/)).toBeInTheDocument();
    expect(api.rejectBankAccount).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText("Reason"), "Wrong account name");
    await user.click(within(dialog).getByRole("button", { name: "Reject bank details" }));
    await waitFor(() => expect(api.rejectBankAccount).toHaveBeenCalledWith("cp-1", "ba-1", "Wrong account name"));
    expect(await screen.findByText("Reason: Wrong account name")).toBeInTheDocument();
  });
});

describe("the record", () => {
  it("shows the API's refusal to delete one still in use", async () => {
    const user = userEvent.setup();
    api.remove.mockRejectedValue(new ApiError("Still used by 2 projects. Mark them former instead.", 422));
    renderDetail();

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Still used by 2 projects. Mark them former instead.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("adds another name, and shows when another company already has it", async () => {
    const user = userEvent.setup();
    api.addAlias.mockRejectedValueOnce(new ApiError("Another company already goes by that name.", 422, { alias: ["Another company already goes by that name."] }));
    renderDetail();

    await user.type(await screen.findByLabelText("Another name"), "ACME NIG");
    await user.click(screen.getByRole("button", { name: "Add name" }));
    expect(api.addAlias).toHaveBeenCalledWith("cp-1", "ACME NIG");
    expect(await screen.findByText("Another company already goes by that name.")).toBeInTheDocument();
  });

  it("saves only the changed identity fields", () => {
    const before = { name: "A", shortCode: "", legalName: "", kind: "organisation", sector: "", website: "", email: "", phone: "", address: "", country: "NG", tin: "", rcNumber: "", vatNumber: "", defaultCurrency: "", paymentTermsDays: "30", notes: "", status: "active", kycStatus: "pending" };
    expect(counterpartyPatch(before, { ...before, tin: " 123 ", paymentTermsDays: "45", country: "gh" })).toEqual({ tin: "123", paymentTermsDays: 45, country: "GH" });
    expect(counterpartyPatch(before, { ...before, paymentTermsDays: "" })).toEqual({ paymentTermsDays: null });
    expect(counterpartyPatch(before, { ...before, shortCode: " emms " })).toEqual({ shortCode: "EMMS" });
    expect(counterpartyPatch({ ...before, shortCode: "EMMS" }, before)).toEqual({ shortCode: null });
  });

  it("shows the short code beside the name and saves a new one in capitals", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ ...CP, shortCode: "ACME" });
    api.update.mockResolvedValue({ ...CP, shortCode: "ASL" });
    renderDetail();

    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Acme Supplies");
    expect(heading).toHaveTextContent("ACME");

    const field = screen.getByLabelText("Short code");
    expect(field).toHaveValue("ACME");
    expect(field).toHaveAccessibleDescription("Printed in reference numbers as {CLIENT}, e.g. EMMS. Leave empty to use the initials.");
    await user.clear(field);
    await user.type(field, "asl");
    expect(field).toHaveValue("ASL");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(api.update).toHaveBeenCalledWith("cp-1", { shortCode: "ASL" });
    expect(await screen.findByText("Changes saved.", { selector: "p:not(.sr-only)" })).toBeInTheDocument();
  });

  it("shows the server's word when another client or vendor holds the short code", async () => {
    const user = userEvent.setup();
    const taken = "Eastgate State Scholarship Board already uses the short code ESSB.";
    api.update.mockRejectedValue(new ApiError(taken, 422, { shortCode: [taken] }));
    renderDetail();

    const field = await screen.findByLabelText("Short code");
    await user.type(field, "essb");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(api.update).toHaveBeenCalledWith("cp-1", { shortCode: "ESSB" });
    expect(await screen.findAllByText(taken)).not.toHaveLength(0);
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("refuses a short code with spaces before sending", async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.type(await screen.findByLabelText("Short code"), "a b");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText(/letters, digits and dashes only/)).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
  });
});
