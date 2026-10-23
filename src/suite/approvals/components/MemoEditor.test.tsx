import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MemoEditor, { validateMemo } from "./MemoEditor";
import type { Memo } from "@/lib/api/approvals-client";

/**
 * Memos: a form while draft or returned, with the live route above the send
 * button; a document once sent.
 */

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/memos/new",
  useSearchParams: () => new URLSearchParams(),
}));

const api = vi.hoisted(() => ({
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  submit: vi.fn(),
  recall: vi.fn(),
  remove: vi.fn(),
  simulate: vi.fn(),
}));

vi.mock("@/lib/api/approvals-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/approvals-client")>();
  return {
    ...actual,
    memos: { ...actual.memos, get: api.get, create: api.create, update: api.update, submit: api.submit, recall: api.recall, remove: api.remove },
    approvals: { ...actual.approvals, simulate: api.simulate },
  };
});

vi.mock("@/lib/api/org-foundations-client", () => ({
  orgFoundations: {
    lookups: {
      units: vi.fn().mockResolvedValue([{ id: "unit-1", parentId: null, code: "BUR", name: "Bursary", kind: "department", depth: 0, defaultCostCentreId: null }]),
      costCentres: vi.fn().mockResolvedValue([]),
      counterparties: vi.fn().mockResolvedValue([]),
    },
  },
}));

function memo(over: Partial<Memo> = {}): Memo {
  return {
    id: "m-1",
    reference: null,
    title: "New chairs",
    category: "general",
    amount: 250_000_00,
    currency: "NGN",
    status: "draft",
    unit: null,
    submittedAt: null,
    decidedAt: null,
    updatedAt: "2026-10-05T09:00:00Z",
    body: "We need chairs.",
    costCentre: null,
    payee: null,
    projectIds: [],
    attachments: [],
    requester: { id: "u-me", name: "Rita Requester" },
    approvalId: null,
    isMine: true,
    editable: true,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.simulate.mockResolvedValue({ outcome: "routed", reason: null, flags: [], documentAmount: null, aggregatedAmount: null, unresolvedStages: [], trace: [], summary: "Bursar", stages: [] });
});

describe("validateMemo", () => {
  it("needs a title and a readable amount", () => {
    const base = { title: "", category: "general" as const, body: "", amount: "", unitId: "", costCentreId: "", payeeId: "" };
    expect(validateMemo(base)).toEqual({ title: "Give the memo a title." });
    expect(validateMemo({ ...base, title: "x", amount: "12abc" }).amount).toMatch(/naira/);
    expect(validateMemo({ ...base, title: "x", amount: "1,250.50" })).toEqual({});
  });
});

describe("a new memo", () => {
  it("won't save without a title", async () => {
    const user = userEvent.setup();
    render(<MemoEditor />);
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Give the memo a title.")).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("saves in kobo, sends it, and moves to its page", async () => {
    const user = userEvent.setup();
    api.create.mockResolvedValue(memo());
    api.submit.mockResolvedValue(memo({ status: "pending", editable: false, reference: "MEMO-2026-0009", approvalId: "ap-1", submittedAt: "2026-10-05T10:00:00Z" }));
    render(<MemoEditor />);

    await user.type(screen.getByLabelText(/Title/), "New chairs");
    await user.type(screen.getByLabelText(/Amount/), "250,000");
    await user.click(screen.getByRole("button", { name: "Send for approval" }));

    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ title: "New chairs", amount: 250_000_00, category: "general" })));
    expect(api.submit).toHaveBeenCalledWith("m-1");
    expect(nav.replace).toHaveBeenCalledWith("/suite/memos/m-1");
    expect(await screen.findByText("Sent for approval. You'll be told when it is decided.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Follow its approval/ })).toHaveAttribute("href", "/suite/approvals?open=ap-1");
  });

  it("shows the route the memo would take", async () => {
    render(<MemoEditor />);
    await waitFor(() => expect(api.simulate).toHaveBeenCalledWith("core.approval_memo", expect.objectContaining({ category: "general" })), { timeout: 2000 });
  });
});

describe("an existing memo", () => {
  it("reads as a document once sent, and can be withdrawn after confirming", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(memo({ status: "pending", editable: false, reference: "MEMO-1", approvalId: "ap-1" }));
    api.recall.mockResolvedValue(memo({ status: "withdrawn", editable: false, reference: "MEMO-1" }));
    render(<MemoEditor id="m-1" />);

    expect(await screen.findByRole("heading", { name: "New chairs" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send for approval" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download PDF/ })).toHaveAttribute("href", "/api/memos/m-1/pdf");

    await user.click(screen.getByRole("button", { name: "Withdraw" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Withdraw memo" }));
    await waitFor(() => expect(api.recall).toHaveBeenCalledWith("m-1"));
  });

  it("lets a returned memo be changed and resent", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(memo({ status: "returned", reference: "MEMO-1", approvalId: "ap-1" }));
    api.update.mockResolvedValue(memo({ status: "returned" }));
    api.submit.mockResolvedValue(memo({ status: "pending", editable: false }));
    render(<MemoEditor id="m-1" />);

    await user.click(await screen.findByRole("button", { name: "Resend for approval" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("m-1", expect.objectContaining({ title: "New chairs" })));
    expect(api.submit).toHaveBeenCalledWith("m-1");
  });

  it("deletes a draft only after confirming", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(memo());
    api.remove.mockResolvedValue({});
    render(<MemoEditor id="m-1" />);

    await user.click(await screen.findByRole("button", { name: "Delete draft" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(api.remove).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete draft" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete draft" }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("m-1"));
    expect(nav.push).toHaveBeenCalledWith("/suite/memos");
  });
});
