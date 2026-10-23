import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RecurringJournalSummary } from "@/lib/api/finance-recurring-client";
import RecurringJournalsBoard from "./RecurringJournalsBoard";

/** The recurring journals list: next and last run, status, what is waiting, and who may set one up. */

const list = vi.hoisted(() => vi.fn());
const me = vi.hoisted(() => ({ role: "admin", permissions: [] as string[] }));

vi.mock("@/lib/api/finance-recurring-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-recurring-client")>();
  return { ...actual, recurring: { ...actual.recurring, list } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u", role: me.role, permissions: me.permissions, name: "Bursar", organisationId: "o" }, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/journals/recurring",
  useSearchParams: () => new URLSearchParams(),
}));

const t = (over: Partial<RecurringJournalSummary>): RecurringJournalSummary => ({
  id: "x",
  name: "N",
  narration: "n",
  frequency: "monthly",
  dayOfMonth: 15,
  startDate: "2026-01-01",
  endDate: null,
  maxOccurrences: null,
  autoReverse: false,
  status: "active",
  nextRunOn: "2026-10-15",
  lastRunOn: "2026-09-15",
  occurrences: 9,
  amount: 250_000_00,
  currencies: [],
  lastError: null,
  lastErrorAt: null,
  createdBy: "Amaka Obi",
  outstanding: 0,
  ...over,
});

beforeEach(() => {
  window.localStorage.clear();
  list.mockReset();
  me.role = "admin";
  me.permissions = [];
  list.mockResolvedValue([
    t({ id: "a", name: "Office rent release" }),
    t({ id: "b", name: "Insurance prepayment", frequency: "quarterly", dayOfMonth: 31, status: "paused", nextRunOn: "2026-12-31", outstanding: 1 }),
    t({ id: "c", name: "Old lease", status: "ended", nextRunOn: null }),
  ]);
});

describe("RecurringJournalsBoard", () => {
  it("lists each template with its schedule, next and last run, and what is waiting", async () => {
    render(<RecurringJournalsBoard />);

    const rent = (await screen.findByText("Office rent release")).closest("tr")!;
    expect(within(rent).getByText("Monthly on the 15th")).toBeInTheDocument();
    expect(within(rent).getByText("15 Oct 2026")).toBeInTheDocument();
    expect(within(rent).getByText("15 Sep 2026")).toBeInTheDocument();
    expect(within(rent).getByText("Active")).toBeInTheDocument();
    expect(within(rent).getByText("250,000.00")).toBeInTheDocument();
    expect(within(rent).getByRole("link", { name: /Office rent release/ })).toHaveAttribute("href", "/suite/finance/journals/recurring/a");

    const insurance = screen.getByText("Insurance prepayment").closest("tr")!;
    expect(within(insurance).getByText("Quarterly on the last day")).toBeInTheDocument();
    expect(within(insurance).getByText("1 waiting")).toBeInTheDocument();
    expect(screen.getByText(/1 template has an occurrence waiting/)).toBeInTheDocument();

    expect(within(screen.getByText("Old lease").closest("tr")!).getByText("None")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New recurring journal" })).toHaveAttribute("href", "/suite/finance/journals/recurring/new");
    expect(screen.getByRole("link", { name: /Recurring/, current: "page" })).toBeInTheDocument();
  });

  it("filters by status and search", async () => {
    const user = userEvent.setup();
    render(<RecurringJournalsBoard />);
    await screen.findByText("Office rent release");

    await user.click(screen.getByRole("tab", { name: "Paused" }));
    expect(screen.queryByText("Office rent release")).not.toBeInTheDocument();
    expect(screen.getByText("Insurance prepayment")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "All" }));
    await user.type(screen.getByRole("searchbox", { name: "Search recurring journals" }), "lease");
    expect(screen.getByText("Old lease")).toBeInTheDocument();
    expect(screen.queryByText("Insurance prepayment")).not.toBeInTheDocument();
  });

  it("offers setting one up only to those who may", async () => {
    me.role = "user";
    me.permissions = ["finance.recurring_journals.view"];
    list.mockResolvedValue([]);
    render(<RecurringJournalsBoard />);

    expect(await screen.findByText("No recurring journals yet")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "New recurring journal" })).not.toBeInTheDocument();
  });
});
