import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StatementsBoard from "./StatementsBoard";
import { account, summary } from "@/suite/finance/components/banking/fixtures";

/** Every statement across accounts, filtered on the server by account and status. */

const api = vi.hoisted(() => ({ accounts: vi.fn(), list: vi.fn() }));

vi.mock("@/lib/api/finance-banking-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-banking-client")>();
  return {
    ...actual,
    banking: { ...actual.banking, accounts: { ...actual.banking.accounts, list: api.accounts }, statements: { ...actual.banking.statements, list: api.list } },
  };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/banking/imports",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach((f) => f.mockReset());
  api.accounts.mockResolvedValue([account(), account({ id: "ba-2", name: "UBA fees account" })]);
});

describe("StatementsBoard", () => {
  it("labels every status and marks verified imports", async () => {
    api.list.mockResolvedValue([
      summary(),
      summary({ id: "imp-2", status: "failed_validation", verified: false, fileName: "bad.pdf" }),
      summary({ id: "imp-3", status: "posted", bankAccount: "UBA fees account", bankAccountId: "ba-2", fileName: "fees.csv" }),
    ]);
    render(<StatementsBoard />);

    const table = await screen.findByRole("table");
    expect(within(table).getAllByText("Ready for review").length).toBeGreaterThan(0);
    expect(within(table).getByText("Failed checks")).toBeInTheDocument();
    expect(within(table).getByText("Posted")).toBeInTheDocument();
    expect(within(table).getAllByText("Verified")).toHaveLength(2);
    expect(within(table).queryByText("ready_for_review")).not.toBeInTheDocument();
  });

  it("starts from the status in the link and filters by account", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([]);
    render(<StatementsBoard initialStatus="ready_for_review" />);
    await waitFor(() => expect(api.list).toHaveBeenCalledWith({ bankAccountId: undefined, status: "ready_for_review" }));
    expect(await screen.findByText("No statements match.")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Bank account" }));
    await user.click(await screen.findByRole("option", { name: /UBA fees account/ }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ bankAccountId: "ba-2", status: "ready_for_review" }));
  });
});
