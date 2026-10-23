import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption } from "@/test/selectOption";
import MemoRegister from "./MemoRegister";
import { memoSummary } from "@/suite/finance/components/requests/fixtures";

/** The register: server filters, totals, and a door for people outside Finance. */

const api = vi.hoisted(() => ({ list: vi.fn(), user: { id: "u", role: "user", name: "Amaka Obi", organisationId: "o", permissions: ["finance.memos.view"] as string[] } }));
vi.mock("@/lib/api/finance-spend-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-spend-client")>();
  return { ...actual, spend: { ...actual.spend, memos: { ...actual.spend.memos, list: api.list } } };
});
vi.mock("@/suite/finance/components/banking/lookups", () => ({
  useLookup: () => ({ status: "ready", options: [{ value: "p1", label: "Campus network upgrade" }] }),
  lookupText: () => "",
}));
const csv = vi.hoisted(() => vi.fn());
vi.mock("@/components/workspace/csv", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/components/workspace/csv")>()), downloadCsv: csv }));
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: api.user, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/memos",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  window.localStorage.clear();
  api.list.mockReset();
  csv.mockReset();
  api.user = { id: "u", role: "user", name: "Amaka Obi", organisationId: "o", permissions: ["finance.memos.view"] };
});

describe("MemoRegister", () => {
  it("totals what is approved and paid, and filters on the server", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([
      memoSummary({ id: "a", status: "fcu_cleared", approvedAmount: 1_000_000_00, balance: 1_000_000_00 }),
      memoSummary({ id: "b", title: "Projector lamps", status: "paid", approvedAmount: 200_000_00, paidAmount: 200_000_00, balance: 0 }),
    ]);
    render(<MemoRegister />);

    expect(await screen.findByText("Projector lamps")).toBeInTheDocument();
    expect(screen.getByText("₦1.2M")).toBeInTheDocument();
    expect(api.list).toHaveBeenLastCalledWith({ status: undefined, type: undefined, projectId: undefined });

    await chooseOption(user, "Status", "With the FCU");
    expect(api.list).toHaveBeenLastCalledWith({ status: "awaiting_fcu", type: undefined, projectId: undefined });
    await user.click(screen.getByRole("radio", { name: "Advances" }));
    expect(api.list).toHaveBeenLastCalledWith({ status: "awaiting_fcu", type: "advance", projectId: undefined });
  });

  it("downloads what is listed, after the search, as CSV in major units", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([
      memoSummary({ id: "a", status: "fcu_cleared", approvedAmount: 1_000_000_00, balance: 1_000_000_00 }),
      memoSummary({ id: "b", reference: "PM-2026-0009", title: "Projector lamps", status: "paid", approvedAmount: 200_000_00, paidAmount: 200_000_00, balance: 0 }),
    ]);
    render(<MemoRegister />);
    await screen.findByText("Projector lamps");
    await user.type(screen.getByRole("searchbox"), "projector");
    await user.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(csv).toHaveBeenCalledTimes(1);
    const [name, rows] = csv.mock.calls[0];
    expect(name).toBe("memo-register.csv");
    expect(rows[0]).toEqual(["Reference", "Title", "Type", "Requester", "Charged to", "Currency", "Amount", "Approved", "Paid", "Balance", "Status", "Sent"]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(["PM-2026-0009", "Projector lamps", "Payment", "Tunde Bello", "Campus network upgrade", "NGN", "1150053.75", "200000.00", "200000.00", "0.00", "Paid", "2026-09-01"]);
  });

  it("sends somebody outside Finance to their own requests", () => {
    api.user = { id: "s", role: "user", name: "Staff", organisationId: "o", permissions: [] };
    render(<MemoRegister />);
    expect(screen.getByText("The memo register is Finance's")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open my requests" })).toHaveAttribute("href", "/suite/finance/requests");
    expect(api.list).not.toHaveBeenCalled();
  });
});
