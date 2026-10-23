import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FcuQueues } from "@/lib/api/finance-spend-client";
import FcuBoard from "./FcuBoard";

/** The FCU's four queues: counts, the tab in the address, and service levels said in words. */

const api = vi.hoisted(() => ({ queues: vi.fn(), replace: vi.fn(), search: { value: "" } }));
vi.mock("@/lib/api/finance-spend-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-spend-client")>();
  return { ...actual, spend: { ...actual.spend, fcu: { ...actual.spend.fcu, queues: api.queues } } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-ruth", role: "user", name: "Ruth Akande", organisationId: "o", permissions: ["finance.fcu.queues"] }, loading: false }) }));
const router = vi.hoisted(() => ({ push: () => undefined, replace: (...a: unknown[]) => api.replace(...a), refresh: () => undefined, back: () => undefined, prefetch: () => undefined }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/suite/finance/fcu", useSearchParams: () => new URLSearchParams(api.search.value) }));

const QUEUES: FcuQueues = {
  memos: [
    { id: "m1", reference: "PM-2026-0007", title: "Swiftlink: September fibre lease", type: "payment", amount: 1_150_053_75, currency: "NGN", projectId: "p1", requester: "Tunde Bello", status: "awaiting_fcu", waitingDays: 0.2, openQueries: 0 },
    { id: "m2", reference: "PM-2026-0005", title: "Lab consumables", type: "payment", amount: 300_000_00, currency: "NGN", projectId: null, requester: "Ada Eze", status: "fcu_queried", waitingDays: 6, openQueries: 1 },
  ],
  vouchers: [{ id: "pv2", pvNo: "PV-2026-0004", payee: "Campus Supplies", net: 90_000_00, currency: "NGN", status: "submitted_to_fcu", provisional: false, cibReference: null, waitingDays: 0.1 }],
  payments: [{ id: "pv1", pvNo: "PV-2026-0003", payee: "Swiftlink Networks", net: 1_150_053_75, currency: "NGN", status: "payment_initiated", provisional: false, cibReference: "CIB-778812", waitingDays: 1 }],
  retirements: [],
  checklists: {},
};

beforeEach(() => {
  api.queues.mockReset();
  api.replace.mockReset();
  api.search.value = "";
  window.localStorage.clear();
  api.queues.mockResolvedValue(QUEUES);
});

describe("FcuBoard", () => {
  it("counts each queue and says how long each memo has waited against its service level", async () => {
    const user = userEvent.setup();
    // Tuesday afternoon.
    render(<FcuBoard now={new Date(2026, 9, 6, 15, 0)} />);

    expect(await screen.findByRole("tab", { name: /Memos to vet/ })).toHaveTextContent("2");
    const table = await screen.findByRole("table", { name: "Memos waiting for FCU vetting" });
    expect(within(table).getByText("In time · arrived today")).toBeInTheDocument();
    expect(within(table).getByText(/Overdue · \d working days? late/)).toBeInTheDocument();
    expect(within(table).getByText("1 open query")).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: /Swiftlink/ })).toHaveAttribute("href", "/suite/finance/fcu/memos/m1");

    await user.click(screen.getByRole("tab", { name: /Payments to confirm/ }));
    expect(api.replace).toHaveBeenCalledWith("/suite/finance/fcu?tab=payments", { scroll: false });
    expect(screen.getByRole("link", { name: /Exceptions board/ })).toHaveAttribute("href", "/suite/finance/fcu/exceptions");
  });

  it("opens on the tab in the address", async () => {
    api.search.value = "tab=payments";
    render(<FcuBoard now={new Date(2026, 9, 6, 15, 0)} />);
    const table = await screen.findByRole("table", { name: "Payments waiting for confirmation against the bank" });
    expect(within(table).getByRole("link", { name: /PV-2026-0003/ })).toHaveAttribute("href", "/suite/finance/fcu/payments/pv1");
    expect(within(table).getByText("Sent, to confirm")).toBeInTheDocument();
  });
});
