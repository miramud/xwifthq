import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ClientStatement from "./ClientStatement";
import { statement } from "./fixtures";

/** One client's statement: the PDF link follows the dates chosen, and a range brings an opening balance. */

const api = vi.hoisted(() => ({ statement: vi.fn() }));
vi.mock("@/lib/api/finance-revenue-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-revenue-client")>();
  return { ...actual, revenue: { ...actual.revenue, receivables: { ...actual.revenue.receivables, statement: api.statement } } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-1", role: "admin", name: "Accountant", organisationId: "o", permissions: [] }, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/revenue/clients/cp-essb",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  window.localStorage.clear();
  api.statement.mockReset();
  api.statement.mockResolvedValue(statement());
});

describe("ClientStatement", () => {
  it("prints the whole account, then the dates chosen with the opening balance", async () => {
    render(<ClientStatement clientId="cp-essb" />);
    const pdf = await screen.findByRole("link", { name: /Statement PDF/ });
    expect(pdf).toHaveAttribute("href", "/api/finance/clients/cp-essb/statement/pdf");
    expect(api.statement).toHaveBeenCalledWith("cp-essb", { from: null, to: null });

    api.statement.mockResolvedValue(statement({ from: "2026-09-01", opening: 12_500_000_00, entries: statement().entries.slice(1) }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-01" } });
    expect(api.statement).toHaveBeenLastCalledWith("cp-essb", { from: "2026-09-01", to: null });
    expect(screen.getByRole("link", { name: /Statement PDF/ })).toHaveAttribute("href", "/api/finance/clients/cp-essb/statement/pdf?from=2026-09-01");
    expect(await screen.findByText(/^Opening/)).toHaveTextContent(/Opening\s*12,500,000\.00/);
    expect(screen.getByRole("button", { name: "Whole account" })).toBeInTheDocument();
  });
});
