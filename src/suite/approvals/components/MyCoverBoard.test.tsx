import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyCoverBoard, { validateCover } from "./MyCoverBoard";
import type { Delegation } from "@/lib/api/approvals-client";

/** My cover: the list, the rules for a new cover, and ending one after confirming. */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/approvals/cover",
  useSearchParams: () => new URLSearchParams(),
}));

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), revoke: vi.fn(), processes: vi.fn() }));
vi.mock("@/lib/api/approvals-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/approvals-client")>();
  return {
    ...actual,
    approvals: { ...actual.approvals, processes: api.processes, delegations: { list: api.list, create: api.create, revoke: api.revoke } },
  };
});
vi.mock("@/lib/api/org-foundations-client", () => ({
  orgFoundations: { lookups: { people: vi.fn().mockResolvedValue([{ id: "u-2", name: "Bola Bursar", jobTitle: "Bursar", unit: "Bursary" }]) } },
}));

const running: Delegation = {
  id: "d-1",
  delegator: { id: "u-me", name: "Me" },
  delegate: { id: "u-2", name: "Bola Bursar" },
  startsAt: "2026-10-01T09:00:00Z",
  endsAt: "2026-10-10T17:00:00Z",
  processes: null,
  maxAmount: 1_000_000_00,
  reason: "Annual leave",
  status: "running",
  mine: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue([running]);
  api.processes.mockResolvedValue([]);
});

describe("validateCover", () => {
  it("needs a colleague and an end after the start", () => {
    const f = { delegateId: "", startsAt: "2026-10-10T09:00", endsAt: "2026-10-09T09:00", processes: [], cap: "x", reason: "" };
    expect(validateCover(f)).toEqual({
      delegateId: "Choose who covers for you.",
      endsAt: "End after it starts.",
      maxAmount: "Enter a cap in naira, or leave it blank.",
    });
  });
});

describe("My cover", () => {
  it("lists cover with its status in words and ends it after confirming", async () => {
    const user = userEvent.setup();
    api.revoke.mockResolvedValue({ ...running, status: "revoked" });
    render(<MyCoverBoard />);

    expect(await screen.findByText("Bola Bursar covers for you")).toBeInTheDocument();
    expect(screen.getByText("Running now")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "End cover" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "End cover" }));
    await waitFor(() => expect(api.revoke).toHaveBeenCalledWith("d-1"));
  });

  it("refuses a cover with nobody chosen", async () => {
    const user = userEvent.setup();
    render(<MyCoverBoard />);
    await screen.findByText("Bola Bursar covers for you");
    await user.click(screen.getByRole("button", { name: "Set cover" }));
    expect(screen.getByText("Choose who covers for you.")).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });
});
