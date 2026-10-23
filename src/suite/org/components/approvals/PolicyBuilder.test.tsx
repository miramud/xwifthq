import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import type { PolicyDetail } from "@/lib/api/org-foundations-client";
import PolicyBuilder from "./PolicyBuilder";

/**
 * The policy builder: a draft saves its whole definition, a 422 lands next to
 * the control it names and in a summary, and submitting says what happens.
 */

const api = vi.hoisted(() => ({
  policy: vi.fn(),
  processes: vi.fn(),
  policies: vi.fn(),
  saveDraft: vi.fn(),
  submit: vi.fn(),
  discardDraft: vi.fn(),
  newDraft: vi.fn(),
  simulate: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: api.push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org/approvals/policies/p-2",
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
        policy: api.policy,
        processes: api.processes,
        policies: api.policies,
        saveDraft: api.saveDraft,
        submit: api.submit,
        discardDraft: api.discardDraft,
        newDraft: api.newDraft,
        simulate: api.simulate,
      },
    },
  };
});

vi.mock("./lookups", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lookups")>();
  return { ...actual, useLookup: () => ({ status: "ready", options: [{ value: "BURSAR", label: "Bursar" }] }) };
});

const DRAFT: PolicyDetail = {
  id: "p-2",
  process: "core.memo",
  processName: "Approval memo",
  version: 2,
  status: "draft",
  effectiveFrom: null,
  templateKey: null,
  notes: null,
  ruleCount: 1,
  createdBy: "Ada",
  publishedBy: null,
  publishedAt: null,
  changeInstanceId: null,
  definition: {
    schema: 1,
    rules: [
      {
        id: "big",
        label: "Big spend",
        when: { field: "amount", op: "gt", value: 500000000 },
        stages: [
          { key: "bursar", name: "Bursar", order: 10, type: "approval", completion: "one", quorum: null, resolver: { kind: "role", role: "BURSAR" }, fallback: null, slaHours: null, parallelGroup: null, distinctPerson: false, canAmend: [] },
        ],
      },
    ],
    bypass: [],
    splitting: { enabled: false, windowDays: 30 },
  },
};

function renderBuilder() {
  return render(
    <ConfirmProvider>
      <PolicyBuilder id="p-2" />
    </ConfirmProvider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.policy.mockResolvedValue(DRAFT);
  api.processes.mockResolvedValue({
    data: [
      {
        code: "core.memo",
        name: "Approval memo",
        description: "",
        module: "core",
        enabled: true,
        settings: { slaHours: 48, splitWindowDays: 30 },
        activeVersion: 1,
        usingDefault: false,
        draftVersion: 2,
        pendingVersion: null,
        controlStages: [{ key: "fcu", name: "Financial control", who: "Financial Control Unit" }],
        openRequests: 0,
        templates: [],
        fields: [{ key: "amount", label: "Amount", type: "money", options: [] }],
        amendable: ["amount"],
        draftPolicyId: "p-2",
        pendingPolicyId: null,
      },
    ],
    meta: { soleAdmin: true },
    resolvers: [{ kind: "role", label: "Approval role", params: { role: "role" } }],
  });
  api.policies.mockResolvedValue([{ ...DRAFT }, { ...DRAFT, id: "p-1", version: 1, status: "active" }]);
});

describe("PolicyBuilder", () => {
  it("shows the rules, the locked control stage and the version history", async () => {
    renderBuilder();
    expect(await screen.findByRole("article", { name: "Big spend" })).toBeInTheDocument();
    expect(await screen.findByText("Financial control")).toBeInTheDocument();
    expect(screen.getByText(/control stage, always added/)).toBeInTheDocument();
    const versions = screen.getByRole("complementary", { name: "Simulator and history" });
    expect(within(versions).getByRole("link", { name: /Version 1/ })).toHaveAttribute("href", "/suite/org/approvals/policies/p-1");
  });

  it("saves the whole definition and maps a 422 onto the stage it names", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("@/lib/api/org-foundations-client");
    api.saveDraft.mockRejectedValue(
      new ApiError("The given data was invalid.", 422, { "rules.0.stages.0.resolver.role": ['No role "BURSAR" in this organisation.'] }),
    );
    renderBuilder();
    const rule = await screen.findByRole("article", { name: "Big spend" });

    const label = within(rule).getByLabelText("Rule name");
    await user.clear(label);
    await user.type(label, "Spending over ₦5m");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(api.saveDraft).toHaveBeenCalled());
    const [id, body] = api.saveDraft.mock.calls[0];
    expect(id).toBe("p-2");
    expect(body.definition.rules[0]).toMatchObject({ label: "Spending over ₦5m", when: { field: "amount", op: "gt", value: 500000000 } });
    expect(body.definition.rules[0].stages[0].resolver).toEqual({ kind: "role", role: "BURSAR" });

    // In place: under the role picker of that stage...
    const roleBox = within(rule).getByRole("combobox", { name: "Approval role" });
    expect(roleBox).toHaveAttribute("aria-invalid", "true");
    expect(within(rule).getAllByText('No role "BURSAR" in this organisation.').length).toBeGreaterThan(0);
    // ...and in the summary, in words.
    expect(screen.getByText("Fix these before saving:")).toBeInTheDocument();
    expect(screen.getByText(/Spending over ₦5m › Bursar › who approves › role/)).toBeInTheDocument();
  });

  it("simulates the unsaved rules on screen, and marks a 422 in place", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("@/lib/api/org-foundations-client");
    api.simulate
      .mockResolvedValueOnce({
        outcome: "routed",
        reason: null,
        flags: [],
        documentAmount: 600000000,
        aggregatedAmount: null,
        unresolvedStages: [],
        trace: ["Rule big matched"],
        summary: "Bursar",
        stages: [{ key: "bursar", name: "Bursar", order: 10, type: "approval", completion: "one", quorum: null, isControl: false, reasons: ["Amount over ₦5m"], notes: [], approvers: [{ id: "u-1", name: "Bola Ade", via: "Bursar", scope: null, onBehalfOf: null, source: "resolved" }] }],
      })
      .mockRejectedValueOnce(new ApiError("Invalid.", 422, { "rules.0.label": ["Give it a name."] }));
    renderBuilder();
    const rule = await screen.findByRole("article", { name: "Big spend" });
    await user.clear(within(rule).getByLabelText("Rule name"));
    await user.type(within(rule).getByLabelText("Rule name"), "Edited");

    const sim = screen.getByRole("complementary", { name: "Simulator and history" });
    const { chooseOption } = await import("@/test/selectOption");
    await chooseOption(user, within(sim).getByRole("combobox", { name: "Asked by" }), "Bursar");
    await user.click(within(sim).getByRole("button", { name: "Simulate" }));

    await waitFor(() => expect(api.simulate).toHaveBeenCalled());
    const [id, requester, , definition] = api.simulate.mock.calls[0];
    expect([id, requester]).toEqual(["p-2", "BURSAR"]);
    expect(definition.rules[0].label).toBe("Edited");
    expect(api.saveDraft).not.toHaveBeenCalled();
    expect(await within(sim).findByText("Bola Ade")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Rule name"));
    await user.click(within(sim).getByRole("button", { name: "Simulate" }));
    expect(await screen.findByText("Fix these before saving:")).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Rule 1" })).getAllByText("Give it a name.").length).toBeGreaterThan(0);
  });

  it("submits after confirming, and says when a sole admin's change is in force", async () => {
    const user = userEvent.setup();
    api.submit.mockResolvedValue({ ...DRAFT, status: "active" });
    renderBuilder();
    await screen.findByRole("article", { name: "Big spend" });

    await user.click(screen.getByRole("button", { name: "Submit for approval" }));
    const dialog = await screen.findByRole("alertdialog");
    // The organisation has one admin, so the dialog says it takes effect immediately.
    expect(dialog).toHaveTextContent(/only administrator, so this version takes effect immediately/);
    await user.click(within(dialog).getByRole("button", { name: "Put into force" }));

    await waitFor(() => expect(api.submit).toHaveBeenCalledWith("p-2"));
    expect(api.saveDraft).not.toHaveBeenCalled();
    expect(await screen.findByText("Version 2 is now in force.", { selector: "p:not(.sr-only)" })).toBeInTheDocument();
  });

  it("is read-only for a version in force, offering a new version", async () => {
    const user = userEvent.setup();
    api.policy.mockResolvedValue({ ...DRAFT, id: "p-1", version: 1, status: "active" });
    api.policies.mockResolvedValue([{ ...DRAFT, id: "p-1", version: 1, status: "active" }]);
    api.processes.mockResolvedValue({ ...(await api.processes()), data: (await api.processes()).data.map((x: object) => ({ ...x, draftPolicyId: null })) });
    api.newDraft.mockResolvedValue({ ...DRAFT, id: "p-3", version: 3 });
    renderBuilder();
    await screen.findByRole("article", { name: "Big spend" });

    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Rule name")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start a new version" }));
    await waitFor(() => expect(api.newDraft).toHaveBeenCalledWith("core.memo", "active"));
    expect(api.push).toHaveBeenCalledWith("/suite/org/approvals/policies/p-3");
  });
});
