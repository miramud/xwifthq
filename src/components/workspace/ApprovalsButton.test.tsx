import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApprovalsButton } from "./ApprovalsButton";
import { resetApprovalCounts } from "@/suite/approvals/lib/useApprovalCounts";

/** The top bar's approvals button: a count for people in an organisation, nothing for anybody else. */

const auth = vi.hoisted(() => ({ user: { id: "u", organisationId: "org-1" } as { id: string; organisationId: string | null } }));
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: auth.user }) }));

const api = vi.hoisted(() => ({ counts: vi.fn() }));
vi.mock("@/lib/api/approvals-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/approvals-client")>();
  return { ...actual, approvals: { ...actual.approvals, counts: api.counts } };
});

beforeEach(() => {
  vi.clearAllMocks();
  resetApprovalCounts();
  auth.user = { id: "u", organisationId: "org-1" };
});

describe("ApprovalsButton", () => {
  it("says how many requests wait", async () => {
    api.counts.mockResolvedValue({ to_approve: 3, delegated: 0, returned: 0, mine: 0, overdue: 0 });
    render(<ApprovalsButton />);
    expect(await screen.findByRole("link", { name: "Approvals, 3 waiting" })).toHaveAttribute("href", "/suite/approvals");
  });

  it("fails silently", async () => {
    api.counts.mockRejectedValue(new Error("down"));
    render(<ApprovalsButton />);
    expect(screen.getByRole("link", { name: "Approvals" })).toBeInTheDocument();
  });

  it("is hidden outside an organisation", () => {
    auth.user = { id: "u", organisationId: null };
    render(<ApprovalsButton />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(api.counts).not.toHaveBeenCalled();
  });
});
