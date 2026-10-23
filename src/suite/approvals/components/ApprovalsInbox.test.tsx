import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApprovalsInbox, { inboxHref } from "./ApprovalsInbox";
import { resetApprovalCounts } from "../lib/useApprovalCounts";
import { COUNTS, detail, row } from "./testFixtures";

/**
 * The inbox: tabs with counts, the due-date view, and `?open=` — what every
 * approval notification links to — opening the request.
 */

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/approvals",
  useSearchParams: () => new URLSearchParams(),
}));

const api = vi.hoisted(() => ({ inbox: vi.fn(), counts: vi.fn(), processes: vi.fn(), get: vi.fn() }));

vi.mock("@/lib/api/approvals-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/approvals-client")>();
  return { ...actual, approvals: { ...actual.approvals, ...api } };
});

vi.mock("@/lib/api/org-foundations-client", () => ({ orgFoundations: { lookups: { people: vi.fn().mockRejectedValue(new Error("offline")) } } }));

beforeEach(() => {
  vi.clearAllMocks();
  resetApprovalCounts();
  api.counts.mockResolvedValue(COUNTS);
  api.processes.mockResolvedValue([
    { code: "core.approval_memo", name: "Approval memo", description: "", module: "core", enabled: true, bulkApprovable: false, fields: [], amendable: [] },
  ]);
  api.inbox.mockImplementation(async (tab: string) => ({
    data: tab === "mine" ? [row({ id: "mine-1", title: "My own memo", task: undefined })] : [row({ task: { ...row().task!, dueAt: new Date(Date.now() - 3_600_000).toISOString(), overdue: true } })],
    counts: COUNTS,
  }));
  api.get.mockResolvedValue(detail());
});

describe("the approvals inbox", () => {
  it("shows each tab with its count and the stat strip", async () => {
    render(<ApprovalsInbox />);

    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "To approve3",
      "Delegated to me1",
      "Returned to me2",
      "My requests4",
      "Watching2",
      "Decided7",
    ]);
    expect(screen.getByText("Waiting on me")).toBeInTheDocument();
    expect((await screen.findAllByText("Buy lab chairs")).length).toBeGreaterThan(0);
  });

  it("puts overdue tasks on the due-date view with a worded chip", async () => {
    render(<ApprovalsInbox />);
    const panel = (await screen.findByText("What falls due")).closest("section")!;
    await waitFor(() => expect(within(panel).getByText("Buy lab chairs")).toBeInTheDocument());
    expect(within(panel).getAllByText("Overdue").length).toBeGreaterThan(0);
  });

  it("badges a row whose approval needs the approver's authenticator code", async () => {
    api.inbox.mockResolvedValue({ data: [row({ task: { ...row().task!, stepUp: true } }), row({ id: "small", title: "Pens" })], counts: COUNTS });
    render(<ApprovalsInbox />);
    expect((await screen.findAllByText("Needs verification code")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Pens")).length).toBeGreaterThan(0);
  });

  it("switches tab and asks the server for that tab", async () => {
    const user = userEvent.setup();
    render(<ApprovalsInbox />);
    await screen.findAllByText("Buy lab chairs");

    await user.click(screen.getByRole("tab", { name: /My requests/ }));
    await waitFor(() => expect(api.inbox).toHaveBeenCalledWith("mine", expect.anything()));
    expect(await screen.findByText("My own memo")).toBeInTheDocument();
    expect(nav.replace).toHaveBeenCalledWith("/suite/approvals?tab=mine", { scroll: false });
  });

  it("opens the request named by ?open=", async () => {
    render(<ApprovalsInbox initialOpen="11111111-1111-1111-1111-111111111111" />);

    const dialog = await screen.findByRole("dialog", { name: "Request" });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111"));
    expect(await within(dialog).findByRole("heading", { name: "Buy lab chairs" })).toBeInTheDocument();
  });

  it("opens a row in the panel and puts it in the address", async () => {
    const user = userEvent.setup();
    render(<ApprovalsInbox />);
    const table = await screen.findByRole("table");
    await user.click(within(table).getByText("Buy lab chairs"));

    expect(nav.replace).toHaveBeenCalledWith("/suite/approvals?open=11111111-1111-1111-1111-111111111111", { scroll: false });
    expect(await screen.findByRole("dialog", { name: "Request" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Request" })).not.toBeInTheDocument();
    expect(nav.replace).toHaveBeenLastCalledWith("/suite/approvals", { scroll: false });
  });

  it("filters to overdue on the server", async () => {
    const user = userEvent.setup();
    render(<ApprovalsInbox />);
    await screen.findAllByText("Buy lab chairs");
    await user.click(screen.getByRole("switch", { name: "Overdue only" }));
    await waitFor(() => expect(api.inbox).toHaveBeenCalledWith("to_approve", { process: undefined, sla: "overdue" }));
  });

  it("builds addresses that keep the tab and the open request", () => {
    expect(inboxHref("to_approve", null)).toBe("/suite/approvals");
    expect(inboxHref("done", "abc")).toBe("/suite/approvals?tab=done&open=abc");
  });
});
