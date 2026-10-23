import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ApprovalRoutePreview } from "./ApprovalRoutePreview";
import type { RoutePreview } from "@/lib/api/approvals-client";

/**
 * The route preview asks the engine once the context settles (400ms), not on
 * every keystroke, and draws the stages with their people, control markers
 * and warnings.
 */

const api = vi.hoisted(() => ({ simulate: vi.fn() }));
vi.mock("@/lib/api/approvals-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/approvals-client")>();
  return { ...actual, approvals: { ...actual.approvals, simulate: api.simulate } };
});

function preview(over: Partial<RoutePreview> = {}): RoutePreview {
  return {
    outcome: "routed",
    reason: null,
    flags: [],
    documentAmount: 100_000_00,
    aggregatedAmount: 100_000_00,
    unresolvedStages: [],
    trace: [],
    summary: "Head of unit (Bursar) → Rector (Rector)",
    stages: [
      { key: "hou", name: "Head of unit", order: 1, type: "approval", completion: "one", quorum: null, isControl: false, reasons: [], notes: [], approvers: [{ id: "u1", name: "Bursar", via: "role", scope: null, onBehalfOf: null, source: "resolved" }] },
      { key: "audit", name: "Internal audit", order: 2, type: "control", completion: "one", quorum: null, isControl: true, reasons: [], notes: [], approvers: [{ id: "u2", name: "Auditor", via: "role", scope: null, onBehalfOf: null, source: "resolved" }] },
    ],
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  api.simulate.mockReset();
});
afterEach(() => vi.useRealTimers());

async function flush(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("ApprovalRoutePreview", () => {
  it("waits for the context to settle before asking", async () => {
    api.simulate.mockResolvedValue(preview());
    const { rerender } = render(<ApprovalRoutePreview process="core.approval_memo" context={{ amount: 1 }} />);
    await flush(200);
    rerender(<ApprovalRoutePreview process="core.approval_memo" context={{ amount: 12 }} />);
    await flush(200);
    rerender(<ApprovalRoutePreview process="core.approval_memo" context={{ amount: 123 }} />);
    expect(api.simulate).not.toHaveBeenCalled();

    await flush(400);
    expect(api.simulate).toHaveBeenCalledTimes(1);
    expect(api.simulate).toHaveBeenCalledWith("core.approval_memo", { amount: 123 });
  });

  it("does not ask again for an equal context", async () => {
    api.simulate.mockResolvedValue(preview());
    const { rerender } = render(<ApprovalRoutePreview process="p" context={{ amount: 1 }} />);
    await flush(450);
    rerender(<ApprovalRoutePreview process="p" context={{ amount: 1 }} />);
    await flush(450);
    expect(api.simulate).toHaveBeenCalledTimes(1);
  });

  it("draws each stage with its people and a control marker", async () => {
    api.simulate.mockResolvedValue(preview());
    render(<ApprovalRoutePreview process="p" context={{}} />);
    await flush(450);

    expect(screen.getByText("Head of unit")).toBeInTheDocument();
    expect(screen.getByText("Bursar")).toBeInTheDocument();
    expect(screen.getByText("Internal audit")).toBeInTheDocument();
    expect(screen.getByText("control stage")).toBeInTheDocument();
    expect(screen.getByText("Your request will go to: Head of unit (Bursar) → Rector (Rector)")).toBeInTheDocument();
  });

  it("says when a purchase looks split and when a stage has nobody", async () => {
    api.simulate.mockResolvedValue(preview({ outcome: "unresolved", flags: ["SPLIT_SUSPECTED"], unresolvedStages: ["audit"] }));
    render(<ApprovalRoutePreview process="p" context={{}} />);
    await flush(450);

    expect(screen.getByText("Possibly split from a larger purchase")).toBeInTheDocument();
    expect(screen.getByText("Nobody holds this role yet")).toBeInTheDocument();
    expect(screen.getByText(/an admin will route it by hand/)).toBeInTheDocument();
  });

  it("says when nobody needs to sign it off", async () => {
    api.simulate.mockResolvedValue(preview({ outcome: "auto_approved", stages: [] }));
    render(<ApprovalRoutePreview process="p" context={{}} />);
    await flush(450);
    expect(screen.getByText(/approved as soon as you send it/)).toBeInTheDocument();
  });
});
