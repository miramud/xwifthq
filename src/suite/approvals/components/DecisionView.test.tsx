import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/admin-client";
import { DecisionView, STALE_MESSAGE, availableActions } from "./DecisionView";
import { detail, stage, task } from "./testFixtures";

/**
 * The decision view offers only what this person may do on their own open
 * task, asks for reasons where the backend requires them, and reloads with a
 * sentence when somebody else acted first (409).
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/approvals",
  useSearchParams: () => new URLSearchParams(),
}));

const api = vi.hoisted(() => ({
  get: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  returnForChanges: vi.fn(),
  release: vi.fn(),
  claim: vi.fn(),
  counts: vi.fn(),
}));

vi.mock("@/lib/api/approvals-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/approvals-client")>();
  return { ...actual, approvals: { ...actual.approvals, ...api } };
});

vi.mock("@/lib/api/org-foundations-client", () => ({ orgFoundations: { lookups: { people: vi.fn().mockRejectedValue(new Error("offline")) } } }));

beforeEach(() => {
  vi.clearAllMocks();
  api.counts.mockResolvedValue({ to_approve: 0, delegated: 0, returned: 0, mine: 0, overdue: 0, watching: 0, done: 0 });
});

describe("availableActions", () => {
  it("lets an approver approve, return, reject, hold, ask and refer", () => {
    const d = detail();
    const a = availableActions(d, d.stages[0].tasks[0], d.stages[0]);
    expect(a).toMatchObject({ approve: true, approveLabel: "Approve", returnForChanges: true, reject: true, hold: true, ask: true, refer: true, release: false, claim: false, amend: false });
  });

  it("calls a review's approval Recommend and never offers Reject", () => {
    const d = detail({ stages: [stage({ type: "review" })] });
    const a = availableActions(d, d.stages[0].tasks[0], d.stages[0]);
    expect(a.approveLabel).toBe("Recommend");
    expect(a.reject).toBe(false);
    expect(a.returnForChanges).toBe(true);
  });

  it("offers only Acknowledge on an acknowledge stage", () => {
    const d = detail({ stages: [stage({ type: "acknowledge" })] });
    const a = availableActions(d, d.stages[0].tasks[0], d.stages[0]);
    expect(a).toMatchObject({ approve: true, approveLabel: "Acknowledge", reject: false, returnForChanges: false, hold: false, refer: false, ask: false });
  });

  it("offers a lower amount only where the stage can amend it", () => {
    const d = detail({ stages: [stage({ canAmend: ["amount"] })] });
    expect(availableActions(d, d.stages[0].tasks[0], d.stages[0]).amend).toBe(true);
    const none = detail({ amount: null, stages: [stage({ canAmend: ["amount"] })] });
    expect(availableActions(none, none.stages[0].tasks[0], none.stages[0]).amend).toBe(false);
  });

  it("offers only Release on a held task, and Claim on a pool task", () => {
    const held = detail({ stages: [stage({ tasks: [task({ status: "on_hold" })] })] });
    expect(availableActions(held, held.stages[0].tasks[0], held.stages[0])).toMatchObject({ release: true, approve: false, reject: false });
    const pool = detail({ stages: [stage({ tasks: [task({ source: "pool" })] })] });
    expect(availableActions(pool, pool.stages[0].tasks[0], pool.stages[0]).claim).toBe(true);
  });

  it("requires a comment to approve a flagged request", () => {
    const d = detail({ flags: ["SPLIT_SUSPECTED"] });
    expect(availableActions(d, d.stages[0].tasks[0], d.stages[0]).commentRequired).toBe(true);
  });
});

describe("the decision view", () => {
  it("shows the request, its warning in words and the route", async () => {
    api.get.mockResolvedValue(detail({ flags: ["SPLIT_SUSPECTED"], stages: [stage({ isControl: true, completion: "quorum", quorum: 3, tasks: [task({ id: "t-1" }), task({ id: "t-2", assignee: { id: "u2", name: "Bola" }, status: "done", action: "approved" })] })] }));
    render(<DecisionView id="11111111-1111-1111-1111-111111111111" />);

    expect(await screen.findByRole("heading", { name: "Buy lab chairs" })).toBeInTheDocument();
    expect(screen.getByText("Possibly split from a larger purchase")).toBeInTheDocument();
    expect(screen.getByText("Control")).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 approved/)).toBeInTheDocument();
    expect(screen.getByText("Trail verified")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download approval record/ })).toHaveAttribute("href", "/api/approvals/11111111-1111-1111-1111-111111111111/pdf");
  });

  it("hides decisions from somebody with no open task", async () => {
    api.get.mockResolvedValue(detail({}, { openTaskIds: [] }));
    render(<DecisionView id="x" />);
    await screen.findByRole("heading", { name: "Buy lab chairs" });
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("asks for a reason before rejecting, then confirms", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(detail());
    api.reject.mockResolvedValue(detail({ status: "rejected" }, { openTaskIds: [] }));
    render(<DecisionView id="x" />);

    await user.click(await screen.findByRole("button", { name: "Reject" }));
    expect(await screen.findByText("Say why you are rejecting it.")).toBeInTheDocument();
    expect(api.reject).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Your comment"), "Over budget");
    await user.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Reject request" }));

    await waitFor(() => expect(api.reject).toHaveBeenCalledWith("t-1", 3, "Over budget"));
    expect(await screen.findByText("Rejected.")).toBeInTheDocument();
  });

  it("will not approve a flagged request without a comment", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(detail({ flags: ["SPLIT_SUSPECTED"] }));
    render(<DecisionView id="x" />);

    await user.click(await screen.findByRole("button", { name: "Approve" }));
    expect(screen.getByText("This request carries a warning. Say why you are approving it.")).toBeInTheDocument();
    expect(api.approve).not.toHaveBeenCalled();
  });

  it("approves a lower amount in kobo", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(detail({ stages: [stage({ canAmend: ["amount"] })] }));
    api.approve.mockResolvedValue(detail({}, { openTaskIds: [] }));
    render(<DecisionView id="x" />);

    await user.click(await screen.findByRole("button", { name: "Approve with a lower amount" }));
    await user.type(screen.getByLabelText("Amount you approve (₦)"), "500000");
    await user.click(screen.getByRole("button", { name: /^Approve ₦/ }));
    expect(await screen.findByText(/Enter less than/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Amount you approve (₦)"));
    await user.type(screen.getByLabelText("Amount you approve (₦)"), "400,000");
    await user.click(screen.getByRole("button", { name: /^Approve ₦/ }));
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith("t-1", 3, undefined, { amount: 400_000_00 }));
  });

  it("reloads with a sentence when the request changed underneath (409)", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce(detail()).mockResolvedValueOnce(detail({ revision: 4, status: "approved" }, { openTaskIds: [] }));
    api.approve.mockRejectedValue(new ApiError("Stale", 409));
    render(<DecisionView id="x" />);

    await user.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText(STALE_MESSAGE)).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument());
  });

  it("releases a held task", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(detail({ stages: [stage({ tasks: [task({ status: "on_hold", holdUntil: "2026-10-20T00:00:00Z" })] })] }));
    api.release.mockResolvedValue(detail());
    render(<DecisionView id="x" />);

    await user.click(await screen.findByRole("button", { name: "Release from hold" }));
    await waitFor(() => expect(api.release).toHaveBeenCalledWith("t-1"));
  });
});

describe("step-up approvals", () => {
  const big = () => detail({ amount: 6_000_000_00, stages: [stage({ tasks: [task({ stepUp: true })] })] }, { mfaEnrolled: true });

  it("flags approving (never rejecting) on a step-up task", () => {
    const d = big();
    expect(availableActions(d, d.stages[0].tasks[0], d.stages[0]).stepUp).toBe(true);
    const ack = detail({ stages: [stage({ type: "acknowledge", tasks: [task({ stepUp: true })] })] });
    expect(availableActions(ack, ack.stages[0].tasks[0], ack.stages[0]).stepUp).toBe(false);
  });

  it("asks for the authenticator code and sends it with the approval", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(big());
    api.approve.mockResolvedValue(detail({ status: "approved" }, { openTaskIds: [] }));
    render(<DecisionView id="x" />);

    expect(await screen.findByText("Approving this needs the 6-digit code from your authenticator app.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(api.approve).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog", { name: "Approve with your code" });
    const input = within(dialog).getByLabelText("6-digit code");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    await user.type(input, "12a3456");
    expect(input).toHaveValue("123456");
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(api.approve).toHaveBeenCalledWith("t-1", 3, undefined, undefined, "123456"));
    expect(await screen.findByText("Approved.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the dialog open on a wrong code and offers a backup code", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(big());
    api.approve.mockRejectedValueOnce(new ApiError("That code is not right.", 422, { mfaCode: ["That code is not right."] }, "MFA_INVALID"));
    api.approve.mockResolvedValueOnce(detail({ status: "approved" }, { openTaskIds: [] }));
    render(<DecisionView id="x" />);

    await user.click(await screen.findByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("6-digit code"), "000000");
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("That code is not right.");

    await user.click(within(dialog).getByRole("button", { name: "Use a backup code" }));
    await user.type(within(dialog).getByLabelText("Backup code"), "k7mq-x2vd");
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(api.approve).toHaveBeenLastCalledWith("t-1", 3, undefined, undefined, "k7mq-x2vd"));
  });

  it("points somebody without an authenticator to set one up", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(detail({ stages: [stage({ tasks: [task({ stepUp: true })] })] }, { mfaEnrolled: false }));
    render(<DecisionView id="x" />);

    expect(await screen.findByRole("link", { name: "Set up two-step verification" })).toHaveAttribute("href", "/account?tab=security");
    await user.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("link", { name: /Set up two-step verification/ })).toHaveAttribute("href", "/account?tab=security");
    expect(within(dialog).queryByLabelText("6-digit code")).not.toBeInTheDocument();
  });

  it("opens the code prompt when the server asks for one after the page loaded", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(detail());
    api.approve.mockRejectedValueOnce(new ApiError("Enter the code.", 428, { mfaCode: ["Enter the code."] }, "MFA_REQUIRED"));
    render(<DecisionView id="x" />);

    await user.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("dialog", { name: "Approve with your code" })).toBeInTheDocument();
  });
});
