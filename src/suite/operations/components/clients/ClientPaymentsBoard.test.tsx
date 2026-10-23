import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ClientPaymentsBoard from "./ClientPaymentsBoard";
import { clientPayment } from "../travel/fixtures";
import type { ClientPaymentsMeta } from "@/lib/api/operations-travel-client";

/** The board: the totals, the pipeline by stage, and an overdue follow-up called out in words. */

const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/api/operations-travel-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-travel-client")>();
  return { ...actual, clientPayments: { ...actual.clientPayments, list: api.list } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u", role: "admin", name: "Admin", organisationId: "o", permissions: [] }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/suite/operations/clients/requests", useSearchParams: () => new URLSearchParams() }));

const META: ClientPaymentsMeta = {
  totals: { open: 2, value: 1_606_250_000, overdueFollowUps: 1, queried: 1 },
  byStage: [
    { stage: "prepared", label: "Prepared", count: 0, value: 0 },
    { stage: "under_verification", label: "Under verification", count: 1, value: 806_250_000 },
    { stage: "queried", label: "Queried", count: 1, value: 800_000_000 },
  ],
  ageing: { d30: 806_250_000, d60: 800_000_000, d90: 0, over90: 0, notSubmitted: 0 },
  stages: {},
};

beforeEach(() => {
  api.list.mockReset();
  api.list.mockResolvedValue({
    requests: [
      clientPayment({ stage: "under_verification", stageLabel: "Under verification", daysInStage: 3 }),
      clientPayment({ id: "cpr-3", number: "MPT/CPR/2026/003", client: "Northbank Polytechnic", stage: "queried", stageLabel: "Queried", nextFollowUpOn: "2026-10-01", followUpOverdue: true }),
      clientPayment({ id: "cpr-1", number: "MPT/CPR/2026/001", stage: "paid", stageLabel: "Paid", nextFollowUpOn: null }),
    ],
    meta: META,
  });
});

describe("ClientPaymentsBoard", () => {
  it("shows the totals, the pipeline and the overdue chase", async () => {
    render(<ClientPaymentsBoard />);
    expect(await screen.findByText("₦16.1M")).toBeInTheDocument();
    const pipeline = screen.getByRole("list", { name: "Open requests by stage" });
    expect(within(pipeline).getAllByRole("listitem")).toHaveLength(3);
    expect(within(pipeline).getByText("Under verification").closest("li")).toHaveTextContent("1");
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
    // The open tab leaves the paid request out.
    expect(screen.queryByText("MPT/CPR/2026/001", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Prepare a request" })).toHaveAttribute("href", "/suite/operations/clients/requests/new");
  });
});
