import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RecurringJournalDetail as Detail } from "@/lib/api/finance-recurring-client";
import RecurringJournalDetail from "./RecurringJournalDetail";

/** One template: the journals it made, why one is waiting, and pause / resume / run now. */

const api = vi.hoisted(() => ({ get: vi.fn(), pause: vi.fn(), resume: vi.fn(), run: vi.fn(), remove: vi.fn() }));
const push = vi.hoisted(() => vi.fn());
const me = vi.hoisted(() => ({ role: "admin", permissions: [] as string[] }));

vi.mock("@/lib/api/finance-recurring-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-recurring-client")>();
  return { ...actual, recurring: { ...actual.recurring, ...api } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u", role: me.role, permissions: me.permissions, name: "Bursar", organisationId: "o" }, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/journals/recurring/rj-1",
  useSearchParams: () => new URLSearchParams(),
}));

const detail = (over: Partial<Detail> = {}): Detail => ({
  id: "rj-1",
  name: "Office rent release",
  narration: "Release of prepaid office rent",
  frequency: "monthly",
  dayOfMonth: 31,
  startDate: "2026-07-01",
  endDate: null,
  maxOccurrences: null,
  autoReverse: true,
  status: "active",
  nextRunOn: "2026-10-31",
  lastRunOn: "2026-08-31",
  occurrences: 3,
  amount: 250_000_00,
  currencies: [],
  lastError: null,
  lastErrorAt: null,
  createdBy: "Amaka Obi",
  baseCurrency: "NGN",
  updatedBy: null,
  upcoming: ["2026-10-31", "2026-11-30"],
  lines: [
    { lineNo: 1, account: { id: "rent", code: "6210", name: "Rent expense" }, debit: 250_000_00, credit: 0, currency: "NGN", project: null, costCentre: { id: "cc", name: "Head office" }, counterparty: null, person: null, unitId: null, narration: null },
    { lineNo: 2, account: { id: "pre", code: "1310", name: "Prepaid rent" }, debit: 0, credit: 250_000_00, currency: "NGN", project: null, costCentre: null, counterparty: null, person: null, unitId: null, narration: null },
  ],
  runs: [
    { id: "r3", occurrenceNo: 3, occurrenceDate: "2026-09-30", status: "skipped", reason: "PERIOD_LOCKED: September 2026 is locked. The journal is made once the month is reopened.", attempts: 2, attemptedAt: null, journal: null },
    { id: "r2", occurrenceNo: 2, occurrenceDate: "2026-08-31", status: "created", reason: null, attempts: 1, attemptedAt: null, journal: { id: "j-2", journalNo: null, status: "pending_approval", total: 250_000_00 } },
    { id: "r1", occurrenceNo: 1, occurrenceDate: "2026-07-31", status: "created", reason: null, attempts: 1, attemptedAt: null, journal: { id: "j-1", journalNo: "JV-2026-07-00012", status: "posted", total: 250_000_00 } },
  ],
  ...over,
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  push.mockReset();
  me.role = "admin";
  me.permissions = [];
  api.get.mockResolvedValue(detail());
});

afterEach(() => {
  document.querySelectorAll("[data-confirm-host]").forEach((n) => n.remove());
});

describe("RecurringJournalDetail", () => {
  it("shows the schedule, the lines and every journal made, with why one waits", async () => {
    render(<RecurringJournalDetail id="rj-1" />);

    expect(await screen.findByRole("heading", { name: "Office rent release" })).toBeInTheDocument();
    expect(screen.getByText("Monthly on the last day")).toBeInTheDocument();
    expect(screen.getByText("Reverses next month")).toBeInTheDocument();
    expect(screen.getByText("Head office")).toBeInTheDocument();

    const made = screen.getByRole("list", { name: "Journals made by this template" });
    const items = within(made).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText("Skipped, month locked")).toBeInTheDocument();
    expect(within(items[0]).getByText("September 2026 is locked. The journal is made once the month is reopened.")).toBeInTheDocument();
    expect(within(items[1]).getByText("Awaiting approval")).toBeInTheDocument();
    expect(within(items[2]).getByRole("link", { name: /JV-2026-07-00012/ })).toHaveAttribute("href", "/suite/finance/journals/j-1");
    expect(screen.getByText("1 waiting")).toBeInTheDocument();
    // It has made journals: it stays on record.
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("tries a skipped occurrence again", async () => {
    const user = userEvent.setup();
    api.run.mockResolvedValue({ run: {}, template: detail({ runs: detail().runs.slice(1) }) });
    render(<RecurringJournalDetail id="rj-1" />);

    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(api.run).toHaveBeenCalledWith("rj-1", "2026-09-30");
    expect((await screen.findAllByText("Tried 30 Sep 2026 again.")).length).toBeGreaterThan(0);
  });

  it("pauses, and makes the next journal early only once confirmed", async () => {
    const user = userEvent.setup();
    api.pause.mockResolvedValue(detail({ status: "paused" }));
    api.run.mockResolvedValue({ run: {}, template: detail({ nextRunOn: "2026-11-30" }) });
    render(<RecurringJournalDetail id="rj-1" />);

    await user.click(await screen.findByRole("button", { name: "Run next now" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("The journal for 31 Oct 2026 is made today");
    await user.click(within(dialog).getByRole("button", { name: "Make it now" }));
    expect(api.run).toHaveBeenCalledWith("rj-1", undefined);
    expect((await screen.findAllByText("Journal made and sent for approval.")).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(api.pause).toHaveBeenCalledWith("rj-1");
    expect(await screen.findByRole("button", { name: "Resume" })).toBeInTheDocument();
  });

  it("lets an accountant edit but not pause or run it", async () => {
    me.role = "user";
    me.permissions = ["finance.recurring_journals.view", "finance.recurring_journals.update"];
    render(<RecurringJournalDetail id="rj-1" />);

    expect(await screen.findByRole("link", { name: "Edit" })).toHaveAttribute("href", "/suite/finance/journals/recurring/rj-1/edit");
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run next now" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("deletes a template that never made a journal, once confirmed", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(detail({ runs: [], occurrences: 0, lastRunOn: null }));
    api.remove.mockResolvedValue(undefined);
    render(<RecurringJournalDetail id="rj-1" />);

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete template" }));
    expect(api.remove).toHaveBeenCalledWith("rj-1");
    expect(push).toHaveBeenCalledWith("/suite/finance/journals/recurring");
  });
});
