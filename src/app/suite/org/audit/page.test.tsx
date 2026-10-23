import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminAuditPage from "./page";
import type { AuditEntry, AuditPage } from "@/lib/api/admin-client";

/**
 * Audit & health. The trail used to be one page of fifty, counted in the
 * browser; it is now paged and filtered on the server, and its actions read
 * as words rather than keys.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org/audit",
  useSearchParams: () => new URLSearchParams(),
}));

const api = vi.hoisted(() => ({ page: vi.fn(), health: vi.fn() }));

vi.mock("@/lib/api/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin-client")>();
  return { ...actual, audit: { ...actual.audit, page: api.page }, health: { get: api.health } };
});

function entry(i: number, over: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: `e-${i}`,
    actor: "Ada Admin",
    action: "hrm.leave.approved",
    target: "LeaveRequest 9f2",
    meta: { name: "Annual leave" },
    ip: null,
    severity: "info",
    time: "2026-09-25T09:00:00Z",
    ...over,
  };
}

function result(page: number, rows: AuditEntry[]): AuditPage {
  return {
    data: rows,
    meta: { currentPage: page, lastPage: 3, perPage: 25, total: 61, severityCounts: { info: 50, warning: 9, critical: 2 } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.health.mockResolvedValue([{ label: "Database", value: "3 ms", status: "operational", detail: "ok" }]);
  api.page.mockImplementation(async (q: { page?: number }) => result(q.page ?? 1, [entry(q.page ?? 1)]));
});

describe("the audit log", () => {
  it("counts everything the server holds, not one page", async () => {
    render(<AdminAuditPage />);

    expect(await screen.findByText("Page 1 of 3 · 61 events")).toBeInTheDocument();
    // "Events recorded" and the donut both read the server's total, not the 1 row on this page.
    expect(screen.getAllByText("61").length).toBeGreaterThan(0);
    expect(screen.getAllByText("9").length).toBeGreaterThan(0);
  });

  it("pages on the server", async () => {
    const user = userEvent.setup();
    render(<AdminAuditPage />);

    await user.click(await screen.findByRole("button", { name: /Next/ }));
    await waitFor(() => expect(api.page).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    expect(await screen.findByText("Page 2 of 3 · 61 events")).toBeInTheDocument();
  });

  it("filters severity and search on the server, back to page one", async () => {
    const user = userEvent.setup();
    render(<AdminAuditPage />);

    await user.click(await screen.findByRole("button", { name: /Next/ }));
    await user.click(screen.getByRole("radio", { name: "Critical" }));
    await waitFor(() =>
      expect(api.page).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, severity: "critical" })),
    );

    await user.type(screen.getByRole("searchbox", { name: "Search the audit log" }), "bola");
    await waitFor(() => expect(api.page).toHaveBeenLastCalledWith(expect.objectContaining({ search: "bola" })), {
      timeout: 2000,
    });
  });

  it("shows actions as words and the subject from meta", async () => {
    render(<AdminAuditPage />);

    expect((await screen.findAllByText("Approved leave")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Annual leave").length).toBeGreaterThan(0);
    expect(screen.queryByText("hrm.leave.approved")).not.toBeInTheDocument();
  });
});
