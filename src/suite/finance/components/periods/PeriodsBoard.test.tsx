import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Period } from "@/lib/api/finance-ledger-client";
import PeriodsBoard from "./PeriodsBoard";

/** Months: statuses in words, a confirmed lock, a reason to reopen, and the revaluation preview. */

const api = vi.hoisted(() => ({ list: vi.fn(), setStatus: vi.fn(), preview: vi.fn(), revalue: vi.fn(), closeYear: vi.fn() }));

vi.mock("@/lib/api/finance-ledger-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-ledger-client")>();
  return {
    ...actual,
    ledger: {
      ...actual.ledger,
      periods: { list: api.list, setStatus: api.setStatus },
      periodEnd: { revaluationPreview: api.preview, revalue: api.revalue, closeYear: api.closeYear },
    },
  };
});

vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u", role: "admin", name: "Bursar", organisationId: "o" }, loading: false }) }));

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const period = (m: number, status: Period["status"], over: Partial<Period> = {}): Period => ({
  id: `p-${m}`,
  key: `2026-${String(m).padStart(2, "0")}`,
  label: `${MONTHS[m - 1]} 2026`,
  startsOn: `2026-${String(m).padStart(2, "0")}-01`,
  endsOn: `2026-${String(m).padStart(2, "0")}-28`,
  status,
  posted: m < 9 ? 12 : 0,
  postedTotal: m < 9 ? 5_000_000_00 : 0,
  drafts: 0,
  pending: 0,
  changedAt: null,
  reopenReason: null,
  ...over,
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.list.mockResolvedValue(Array.from({ length: 12 }, (_, i) => period(i + 1, i < 7 ? "locked" : i === 7 ? "soft_closed" : "open", i === 8 ? { drafts: 2 } : {})));
  api.setStatus.mockResolvedValue({ id: "x", status: "locked" });
  api.preview.mockResolvedValue([
    { accountId: "usd", code: "1140", name: "Domiciliary account (USD)", currency: "USD", currencyBalance: 1_000_000, carried: 1_500_000_000, rate: "1520", restated: 1_520_000_000, difference: 20_000_000 },
  ]);
});

describe("PeriodsBoard", () => {
  it("names each month's state and asks before locking one", async () => {
    const user = userEvent.setup();
    render(<PeriodsBoard initialYear={2026} />);

    const august = (await screen.findByRole("heading", { name: "August 2026" })).closest("section") as HTMLElement;
    expect(within(august).getByText("Closing")).toBeInTheDocument();
    const july = screen.getByRole("heading", { name: "July 2026" }).closest("section") as HTMLElement;
    expect(within(july).getByText("Locked")).toBeInTheDocument();

    await user.click(within(august).getByRole("button", { name: "Lock August" }));
    const ask = await screen.findByRole("alertdialog");
    expect(ask).toHaveTextContent("Nobody can post to August 2026");
    await user.click(within(ask).getByRole("button", { name: "Lock August" }));
    expect(api.setStatus).toHaveBeenCalledWith("p-8", "locked", undefined);
  });

  it("links a month's drafts to the journals dated in it", async () => {
    render(<PeriodsBoard initialYear={2026} />);
    const september = (await screen.findByRole("heading", { name: "September 2026" })).closest("section") as HTMLElement;
    expect(within(september).getByRole("link", { name: "2 draft journals in September 2026" })).toHaveAttribute(
      "href",
      "/suite/finance/journals?from=2026-09-01&to=2026-09-28&tab=draft",
    );
    // Nothing waiting, nothing to link.
    expect(within(september).queryByRole("link", { name: /awaiting approval/ })).not.toBeInTheDocument();
  });

  it("needs a reason to reopen a locked month", async () => {
    const user = userEvent.setup();
    render(<PeriodsBoard initialYear={2026} />);
    const july = (await screen.findByRole("heading", { name: "July 2026" })).closest("section") as HTMLElement;
    await user.click(within(july).getByRole("button", { name: "Reopen July" }));

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Reopen July" }));
    expect(await within(dialog).findByText("Say why the month is being reopened.")).toBeInTheDocument();
    expect(api.setStatus).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText(/Why is July being reopened/), "Auditor adjustment");
    await user.click(within(dialog).getByRole("button", { name: "Reopen July" }));
    expect(api.setStatus).toHaveBeenCalledWith("p-7", "open", "Auditor adjustment");
  });

  it("previews the revaluation gain per foreign-currency account", async () => {
    render(<PeriodsBoard initialYear={2026} />);
    const table = await screen.findByRole("table", { name: /Revaluation at the end of/ });
    expect(within(table).getByText("USD 10,000.00")).toBeInTheDocument();
    expect(within(table).getByText("200,000.00")).toBeInTheDocument();
    expect(screen.getByText("Gain 200,000.00")).toBeInTheDocument();
  });
});
