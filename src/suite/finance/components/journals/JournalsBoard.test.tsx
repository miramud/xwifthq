import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JournalSummary } from "@/lib/api/finance-ledger-client";
import JournalsBoard from "./JournalsBoard";

/** The journal list: the tab from the address, server filters, search and the total of what is shown. */

const list = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({ value: "status=pending_approval" }));
const csv = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock("../reports/shared", async (importOriginal) => ({ ...(await importOriginal<typeof import("../reports/shared")>()), downloadCsv: csv }));
vi.mock("@/lib/api/finance-ledger-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-ledger-client")>();
  return { ...actual, ledger: { ...actual.ledger, journals: { ...actual.ledger.journals, list } } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u", role: "admin", name: "Bursar", organisationId: "o" }, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/journals",
  useSearchParams: () => new URLSearchParams(search.value),
}));

const j = (over: Partial<JournalSummary>): JournalSummary => ({
  id: "x",
  journalNo: "JV-1",
  journalDate: "2026-09-01",
  type: "manual",
  narration: "N",
  status: "pending_approval",
  total: 100_00,
  sourceType: null,
  sourceId: null,
  createdBy: "Amaka Obi",
  postedAt: null,
  reversesJournalId: null,
  reversedByJournalId: null,
  approvalId: "ap",
  ...over,
});

beforeEach(() => {
  window.localStorage.clear();
  search.value = "status=pending_approval";
  csv.mockReset();
  list.mockReset();
  list.mockResolvedValue([
    j({ id: "a", journalNo: "JV-0101", narration: "Accrued electricity for September", total: 2_000_000_00 }),
    j({ id: "b", journalNo: "JV-0102", narration: "Imprest retirement, Works department", total: 150_000_00 }),
  ]);
});

describe("JournalsBoard", () => {
  it("opens on the tab in the address, totals the list, and narrows it by search", async () => {
    const user = userEvent.setup();
    render(<JournalsBoard />);
    expect(screen.getByRole("tab", { name: "Awaiting approval" })).toHaveAttribute("aria-selected", "true");
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: "pending_approval" }));

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Accrued electricity for September")).toBeInTheDocument();
    expect(screen.getByText("₦2,150,000.00")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search journals" }), "imprest");
    expect(within(screen.getByRole("table")).queryByText("Accrued electricity for September")).not.toBeInTheDocument();
    expect(screen.getByText(/journal ·/).closest("p")).toHaveTextContent("1 journal · ₦150,000.00");

    await user.click(screen.getByRole("tab", { name: "Posted" }));
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: "posted" }));
  });

  it("takes a month and a short tab name from a link, and downloads what is listed as CSV", async () => {
    search.value = "tab=pending&from=2026-08-01&to=2026-08-31";
    const user = userEvent.setup();
    render(<JournalsBoard />);
    expect(screen.getByRole("tab", { name: "Awaiting approval" })).toHaveAttribute("aria-selected", "true");
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: "pending_approval", from: "2026-08-01", to: "2026-08-31" }));
    expect(screen.getByLabelText("From")).toHaveValue("2026-08-01");

    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(csv).toHaveBeenCalledTimes(1);
    const [name, rows] = csv.mock.calls[0];
    expect(name).toBe("journals_pending_approval_2026-08-01_2026-08-31.csv");
    expect(rows[0]).toEqual(["Date", "Number", "Narration", "Type", "Status", "Amount", "Keyed by", "Posted at"]);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual(expect.arrayContaining(["JV-0101", "Accrued electricity for September", "2000000.00"]));
  });

  it("marks a journal a recurring template made, opening the template", async () => {
    const user = userEvent.setup();
    push.mockReset();
    list.mockResolvedValue([
      j({ id: "r", journalNo: null, narration: "Release of prepaid office rent - October 2026", sourceType: "fin_recurring_journal", sourceId: "rj-1", recurringJournalId: "rj-1" }),
      j({ id: "m", narration: "Hand-keyed accrual" }),
    ]);
    render(<JournalsBoard />);

    const table = await screen.findByRole("table");
    const chip = within(table).getByRole("link", { name: /Recurring: open the template/ });
    expect(within(table).getAllByRole("link", { name: /Recurring: open the template/ })).toHaveLength(1);
    await user.click(chip);
    expect(push).toHaveBeenCalledWith("/suite/finance/journals/recurring/rj-1");
    expect(push).toHaveBeenCalledTimes(1);

    // The way to the templates.
    expect(screen.getByRole("link", { name: "Recurring" })).toHaveAttribute("href", "/suite/finance/journals/recurring");
  });
});
