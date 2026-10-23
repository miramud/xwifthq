import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import type { DoaMatrix, OversightRow, ProcessSetup } from "@/lib/api/org-foundations-client";
import ProcessesBoard from "./ProcessesBoard";
import DoaBoard from "./DoaBoard";
import OversightBoard, { ageBucket, byProcess, overdueHeat } from "./OversightBoard";
import { committeeProblem } from "./AuthorityBoard";
import { chooseOption } from "@/test/selectOption";

/** Processes (switching approval on and off), the DoA document, and oversight's reassign. */

const api = vi.hoisted(() => ({
  processes: vi.fn(),
  policies: vi.fn(),
  updateProcess: vi.fn(),
  newDraft: vi.fn(),
  doa: vi.fn(),
  oversight: vi.fn(),
  reroute: vi.fn(),
  reassign: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: api.push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org/approvals",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/org-foundations-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/org-foundations-client")>();
  return {
    ...actual,
    orgFoundations: {
      ...actual.orgFoundations,
      approvals: {
        ...actual.orgFoundations.approvals,
        processes: api.processes,
        stepUp: () => Promise.resolve({ amount: null, currency: "NGN", baseCurrency: "NGN", enrolled: 0, people: 3, waiting: 0 }),
        policies: api.policies,
        updateProcess: api.updateProcess,
        newDraft: api.newDraft,
        doa: api.doa,
        oversight: api.oversight,
        reroute: api.reroute,
        reassign: api.reassign,
      },
    },
  };
});

vi.mock("./lookups", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lookups")>();
  return {
    ...actual,
    useLookup: (key: string | null) => ({
      status: "ready",
      options: key === "people" ? [{ value: "u-chi", label: "Chidi Eze" }, { value: "u-ada", label: "Ada Obi" }] : [],
    }),
  };
});

const proc = (over: Partial<ProcessSetup>): ProcessSetup => ({
  code: "core.memo",
  name: "Approval memo",
  description: "Internal memos that ask for a decision.",
  module: "core",
  enabled: true,
  settings: { slaHours: 48, splitWindowDays: 30 },
  activeVersion: 3,
  usingDefault: false,
  draftVersion: null,
  pendingVersion: null,
  controlStages: [],
  openRequests: 4,
  templates: [{ key: "university", name: "University (Council, Rector, Bursar)", description: "A tertiary institution's chain." }],
  fields: [{ key: "amount", label: "Amount", type: "money", options: [] }],
  amendable: ["amount"],
  draftPolicyId: null,
  pendingPolicyId: null,
  ...over,
});

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach((f) => f.mockReset());
});

describe("ProcessesBoard", () => {
  beforeEach(() => {
    api.processes.mockResolvedValue({
      data: [
        proc({}),
        proc({ code: "core.approval_policy_change", name: "Approval rule change", openRequests: 0, controlStages: [{ key: "x", name: "Second administrator", who: "Org admins" }] }),
      ],
      meta: { soleAdmin: false },
      resolvers: [],
    });
    api.policies.mockResolvedValue([]);
  });

  function renderBoard() {
    return render(
      <ConfirmProvider>
        <ProcessesBoard />
      </ConfirmProvider>,
    );
  }

  it("asks before switching a process off, then saves it", async () => {
    const user = userEvent.setup();
    api.updateProcess.mockResolvedValue({ code: "core.memo", enabled: false });
    renderBoard();

    const toggle = await screen.findByRole("switch", { name: "Approval memo needs approval" });
    await user.click(toggle);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Switch off approval for Approval memo?");
    expect(dialog).toHaveTextContent("(4 open now)");
    await user.click(within(dialog).getByRole("button", { name: "Switch off" }));

    await waitFor(() => expect(api.updateProcess).toHaveBeenCalledWith("core.memo", { enabled: false }));
    expect(await screen.findByRole("switch", { name: "Approval memo needs approval" })).toHaveAttribute("aria-checked", "false");
  });

  it("does nothing when the switch-off is cancelled, and never lets the rule-change process be switched off", async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.click(await screen.findByRole("switch", { name: "Approval memo needs approval" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(api.updateProcess).not.toHaveBeenCalled();

    expect(screen.getByRole("switch", { name: "Approval rule change needs approval" })).toBeDisabled();
  });

  it("opens the existing draft directly instead of starting another", async () => {
    const user = userEvent.setup();
    api.processes.mockResolvedValue({ data: [proc({ draftVersion: 4, draftPolicyId: "p-4" })], meta: { soleAdmin: false }, resolvers: [] });
    renderBoard();
    await user.click(await screen.findByRole("button", { name: "Continue draft" }));
    expect(api.push).toHaveBeenCalledWith("/suite/org/approvals/policies/p-4");
    expect(api.newDraft).not.toHaveBeenCalled();
  });

  it("starts a draft from a template chosen in the dialog", async () => {
    const user = userEvent.setup();
    api.newDraft.mockResolvedValue({ id: "p-9" });
    renderBoard();
    const card = (await screen.findAllByText("Internal memos that ask for a decision."))[0].closest(".ws-card") as HTMLElement;
    await user.click(within(card).getByRole("button", { name: "Edit rules" }));

    const dialog = await screen.findByRole("dialog", { name: "New rules for Approval memo" });
    await user.click(within(dialog).getByRole("radio", { name: /University \(Council, Rector, Bursar\)/ }));
    await user.click(within(dialog).getByRole("button", { name: "Start draft" }));

    await waitFor(() => expect(api.newDraft).toHaveBeenCalledWith("core.memo", "template:university"));
    expect(api.push).toHaveBeenCalledWith("/suite/org/approvals/policies/p-9");
  });
});

const DOA: DoaMatrix = {
  organisation: "Meridian Polytechnic",
  currency: "NGN",
  generatedAt: "2026-10-05T09:00:00Z",
  sections: [
    {
      code: "core.memo",
      name: "Approval memo",
      version: 3,
      effectiveFrom: "2026-10-01",
      rules: [
        {
          rule: "Spending over ₦5m",
          when: "the amount is more than ₦5,000,000",
          stages: [
            { name: "Rector", who: "Approval role: Rector", type: "approval", order: 20 },
            { name: "Head of department", who: "Head of the requester's unit", type: "review", order: 10 },
          ],
        },
      ],
      controls: [{ name: "Financial control", who: "Financial Control Unit" }],
      bypass: [{ label: "Petty cash", when: "the amount is at most ₦5,000" }],
    },
  ],
  limits: [{ who: "Bursar (role)", process: "Approval memo", maxAmount: 500000000, validFrom: null, validTo: null }],
};

describe("DoaBoard", () => {
  it("renders the matrix as a document with approver chains in order, controls, automatic approvals and limits", async () => {
    api.doa.mockResolvedValue(DOA);
    render(<DoaBoard />);

    const doc = await screen.findByRole("article", { name: "Delegation of authority" });
    expect(within(doc).getByRole("heading", { name: "Meridian Polytechnic" })).toBeInTheDocument();
    expect(within(doc).getByText("the amount is more than ₦5,000,000")).toBeInTheDocument();

    const chain = within(doc).getByRole("list", { name: "Approvers in order" });
    const steps = within(chain).getAllByRole("listitem").map((li) => li.textContent);
    expect(steps[0]).toMatch(/^Head of department/);
    expect(steps[1]).toMatch(/^Rector/);

    expect(within(doc).getByText("Financial control")).toBeInTheDocument();
    expect(within(doc).getByText("Petty cash")).toBeInTheDocument();
    const limits = within(doc).getByRole("table", { name: "Approval limits" });
    expect(within(limits).getByText("Bursar (role)")).toBeInTheDocument();
    expect(within(limits).getByText("₦5,000,000")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Download PDF" })).toHaveAttribute("href", "/api/org/approvals/doa/pdf");
  });
});

const NOW = Date.parse("2026-10-05T12:00:00Z");

const row = (over: Partial<OversightRow>): OversightRow => ({
  id: "i-1",
  process: "core.memo",
  processName: "Approval memo",
  title: "Lab equipment",
  ref: "MEMO-0042",
  status: "in_progress",
  amount: 120000000,
  currency: "NGN",
  flags: [],
  requester: "Bola Ade",
  submittedAt: "2026-10-01T09:00:00Z",
  stages: [{ name: "Bursar", dueAt: "2026-10-03T09:00:00Z", overdue: true, waitingOn: [{ taskId: "t-1", name: "Ada Obi" }] }],
  ...over,
});

describe("oversight charts", () => {
  it("counts requests per process as on time, overdue or unrouted, and buckets overdue ones by age", () => {
    const rows = [
      row({}),
      row({ id: "i-2", stages: [{ name: "Bursar", dueAt: null, overdue: false, waitingOn: [] }] }),
      row({ id: "i-3", status: "needs_routing", stages: [] }),
      row({ id: "i-4", processName: "Bank details change", submittedAt: "2026-09-10T00:00:00Z" }),
    ];
    expect(byProcess(rows)).toEqual([
      { label: "Approval memo", values: { onTime: 1, overdue: 1, unrouted: 1 } },
      { label: "Bank details change", values: { onTime: 0, overdue: 1, unrouted: 0 } },
    ]);
    expect(ageBucket("2026-10-05T00:00:00Z", NOW)).toBe("Under a day");
    expect(ageBucket("2026-10-01T09:00:00Z", NOW)).toBe("3 to 7 days");
    const heat = overdueHeat(rows, NOW);
    expect(heat.rows).toEqual(["Approval memo", "Bank details change"]);
    expect(heat.cells.find((c) => c.row === "Bank details change" && c.col === "Over 2 weeks")?.value).toBe(1);
  });

  it("checks a committee has at least its quorum of members", () => {
    expect(committeeProblem(2, 3)).toMatch(/Add at least 1 more member/);
    expect(committeeProblem(3, 3)).toBeNull();
    expect(committeeProblem(3, null)).toMatch(/at least 1/);
  });
});

describe("OversightBoard", () => {
  beforeEach(() => {
    api.processes.mockResolvedValue({ data: [proc({})], meta: { soleAdmin: false }, resolvers: [] });
    api.oversight.mockResolvedValue([row({}), row({ id: "i-3", title: "Conference travel", status: "needs_routing", stages: [] })]);
  });

  function renderBoard() {
    return render(
      <ConfirmProvider>
        <OversightBoard />
      </ConfirmProvider>,
    );
  }

  it("reassigns a waiting task with a reason, after confirming", async () => {
    const user = userEvent.setup();
    api.reassign.mockResolvedValue({});
    renderBoard();

    const table = await screen.findByRole("table", { name: "Requests" });
    expect(api.oversight).toHaveBeenCalledWith({ status: "open", process: undefined });
    expect(within(table).getByRole("link", { name: /Lab equipment/ })).toHaveAttribute("href", "/suite/approvals?open=i-1");

    await user.click(within(table).getByRole("button", { name: /Reassign Ada Obi's task on Lab equipment/ }));
    const dialog = await screen.findByRole("dialog", { name: "Reassign a waiting task" });

    // Both are required.
    await user.click(within(dialog).getByRole("button", { name: "Reassign" }));
    expect(within(dialog).getByText("Choose who takes it over.")).toBeInTheDocument();
    expect(within(dialog).getByText("Say why. It goes on the record.")).toBeInTheDocument();
    expect(api.reassign).not.toHaveBeenCalled();

    await chooseOption(user, within(dialog).getByRole("combobox", { name: "Give it to" }), "Chidi Eze");
    await user.type(within(dialog).getByLabelText("Reason (required)"), "Ada is on leave until the 20th.");
    await user.click(within(dialog).getByRole("button", { name: "Reassign" }));

    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("Hand Ada Obi's task to somebody else?");
    await user.click(within(confirm).getByRole("button", { name: "Reassign task" }));

    await waitFor(() => expect(api.reassign).toHaveBeenCalledWith("t-1", "u-chi", "Ada is on leave until the 20th."));
    expect(await screen.findByText("“Lab equipment” now waits on Chidi Eze.", { selector: "p:not(.sr-only)" })).toBeInTheDocument();
    expect(api.oversight).toHaveBeenCalledTimes(2);
  });

  it("routes a stuck request again and filters by status", async () => {
    const user = userEvent.setup();
    api.reroute.mockResolvedValue({ status: "in_progress" });
    renderBoard();

    const table = await screen.findByRole("table", { name: "Requests" });
    await user.click(within(table).getByRole("button", { name: "Route again" }));
    await waitFor(() => expect(api.reroute).toHaveBeenCalledWith("i-3"));
    expect(await screen.findByText("“Conference travel” was routed again.", { selector: "p:not(.sr-only)" })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Overdue" }));
    await waitFor(() => expect(api.oversight).toHaveBeenLastCalledWith({ status: "overdue", process: undefined }));
  });
});
