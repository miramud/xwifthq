import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContractsBoard from "./ContractsBoard";
import ContractEditor from "./ContractEditor";
import { CONTRACTS_META, contract, contractDetail } from "./fixtures";

/** The contract register (billing progress, ready-to-bill, projects with none) and the editor's refusal to schedule past the value. */

const api = vi.hoisted(() => ({
  list: vi.fn(),
  projects: vi.fn(),
  invoice: vi.fn(),
  forProject: vi.fn(),
  workItems: vi.fn(),
  save: vi.fn(),
  complete: vi.fn(),
  accounts: vi.fn(),
  counterparties: vi.fn(),
}));
const nav = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/lib/api/finance-revenue-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-revenue-client")>();
  return {
    ...actual,
    revenue: {
      ...actual.revenue,
      contracts: {
        ...actual.revenue.contracts,
        list: api.list,
        invoiceMilestone: api.invoice,
        forProject: api.forProject,
        workItems: api.workItems,
        save: api.save,
        completeMilestone: api.complete,
      },
      projects: api.projects,
    },
  };
});
vi.mock("@/lib/api/finance-ledger-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-ledger-client")>();
  return { ...actual, ledger: { ...actual.ledger, accounts: { ...actual.ledger.accounts, list: api.accounts } } };
});
vi.mock("@/lib/api/org-foundations-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/org-foundations-client")>();
  return { ...actual, orgFoundations: { ...actual.orgFoundations, lookups: { ...actual.orgFoundations.lookups, counterparties: api.counterparties } } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-1", role: "admin", name: "Accountant", organisationId: "o", permissions: [] }, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/revenue/contracts",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  nav.push.mockReset();
  api.list.mockResolvedValue({
    contracts: [
      contract(),
      contract({
        id: "ct-lsk",
        title: "Library self-service kiosks",
        project: { id: "proj-lsk", name: "Library Self-Service Kiosk", code: "LSK", status: "complete" },
        readyToBill: [{ id: "ms-go", name: "Go-live and training", amount: 5_000_000_00, dueOn: "2026-09-30" }],
      }),
    ],
    meta: CONTRACTS_META,
  });
  api.projects.mockResolvedValue([
    { id: "proj-sbp", name: "Scholarship Board Portal", code: "SBP" },
    { id: "proj-lsk", name: "Library Self-Service Kiosk", code: "LSK" },
    { id: "proj-hr", name: "HR Records Digitisation", code: "HRD" },
  ]);
  api.accounts.mockResolvedValue({ accounts: [], templates: [], systemKeys: [] });
  api.counterparties.mockResolvedValue([{ id: "cp-essb", code: null, name: "Eastgate State Scholarship Board", roles: ["client"] }]);
  api.workItems.mockResolvedValue([{ id: "wi-open", title: "Milestone: applications open", type: "milestone", dueOn: "2026-11-23", status: "To Do", done: false }]);
});

describe("ContractsBoard", () => {
  it("shows each contract's billing progress, and the projects that have none", async () => {
    render(<ContractsBoard />);
    expect(await screen.findByText("Scholarship application and award portal")).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar", { name: "Invoiced against the contract value" })[0]).toHaveAttribute("aria-valuenow", "13");
    expect(screen.getAllByText("1 of 3")[0]).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /HR Records Digitisation/ })).toHaveAttribute("href", "/suite/finance/revenue/contracts/proj-hr");
  });

  it("invoices an accepted milestone and opens the new draft", async () => {
    const user = userEvent.setup();
    api.invoice.mockResolvedValue({ id: "inv-new", status: "draft" });
    render(<ContractsBoard />);
    expect(await screen.findByText("Go-live and training")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Invoice it" }));
    expect(api.invoice).toHaveBeenCalledWith("ms-go");
    expect(nav.push).toHaveBeenCalledWith("/suite/finance/revenue/invoices/inv-new?notice=drafted");
  });
});

describe("ContractEditor", { timeout: 20_000 }, () => {
  it("locks invoiced milestones, and refuses milestones past the contract value", async () => {
    const user = userEvent.setup();
    api.forProject.mockResolvedValue({ id: "proj-sbp", name: "Scholarship Board Portal", code: "SBP", contract: contractDetail() });
    render(<ContractEditor projectId="proj-sbp" />);
    expect(await screen.findByDisplayValue("Mobilisation")).toBeDisabled();
    expect(screen.getByDisplayValue("Applications open to students")).toBeEnabled();

    const amount = screen.getAllByLabelText("Amount")[2];
    await user.clear(amount);
    await user.type(amount, "40,000,000");
    expect(await screen.findByRole("alert")).toHaveTextContent("The milestones come to ₦5,000,000.00 more than the contract value");
    expect(screen.getByRole("button", { name: "Save the contract" })).toBeDisabled();

    await user.clear(amount);
    await user.type(amount, "35,000,000");
    await user.click(screen.getByRole("button", { name: "Save the contract" }));
    expect(api.save).toHaveBeenCalledWith(
      "proj-sbp",
      expect.objectContaining({
        clientId: "cp-essb",
        value: 95_000_000_00,
        vatApplicable: false,
        paymentTermsDays: 14,
        milestones: [
          expect.objectContaining({ id: "ms-1", amount: 12_500_000_00 }),
          expect.objectContaining({ id: "ms-2", amount: 47_500_000_00, workItemId: "wi-open" }),
          expect.objectContaining({ id: "ms-3", amount: 35_000_000_00, workItemId: null }),
        ],
      }),
    );
  });

  it("marks a planned milestone with no Projects work accepted, after asking", async () => {
    const user = userEvent.setup();
    api.forProject.mockResolvedValue({ id: "proj-sbp", name: "Scholarship Board Portal", code: "SBP", contract: contractDetail() });
    api.complete.mockResolvedValue({ id: "ms-3", status: "completed" });
    render(<ContractEditor projectId="proj-sbp" />);
    const buttons = await screen.findAllByRole("button", { name: "Mark accepted" });
    expect(buttons).toHaveLength(1); // ms-2 follows its Projects milestone; ms-1 is invoiced.
    await user.click(buttons[0]);
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Mark accepted" }));
    expect(api.complete).toHaveBeenCalledWith("ms-3", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });
});
