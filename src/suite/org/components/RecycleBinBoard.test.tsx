import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecycleBinBoard from "./RecycleBinBoard";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import { ApiError, type BinEntry } from "@/lib/api/recycle-bin-client";

/**
 * The organisation's recycle bin.
 *
 * What matters: deleting for good never happens on one click, cancelling
 * keeps the item, and a refused restore says why on the row it belongs to.
 */

const api = vi.hoisted(() => ({
  list: vi.fn(),
  summary: vi.fn(),
  restore: vi.fn(),
  purge: vi.fn(),
  empty: vi.fn(),
}));

vi.mock("@/lib/api/recycle-bin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/recycle-bin-client")>();
  return { ...actual, recycleBin: api };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org/recycle-bin",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { id: "u-admin", role: "admin", name: "Adaeze", organisationId: "org-1" }, loading: false }),
}));

function entry(over: Partial<BinEntry> = {}): BinEntry {
  return {
    id: "bin-1",
    type: "lms.course",
    typeLabel: "Course",
    module: "lms",
    label: "Fire safety refresher",
    deletedAt: "2026-09-25T09:00:00Z",
    deletedBy: { id: "u-admin", name: "Adaeze Okonkwo" },
    restorable: true,
    blockedReason: null,
    ...over,
  };
}

function page(rows: BinEntry[]) {
  return { data: rows, meta: { currentPage: 1, lastPage: 1, perPage: 25, total: rows.length } };
}

function renderBoard() {
  return render(
    <ConfirmProvider>
      <RecycleBinBoard />
    </ConfirmProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.summary.mockResolvedValue({ total: 1, types: [{ type: "lms.course", typeLabel: "Course", module: "lms", count: 1 }] });
});

describe("deleting permanently", () => {
  it("asks first, and cancelling keeps the item", async () => {
    api.list.mockResolvedValue(page([entry()]));
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("button", { name: "Delete Fire safety refresher permanently" }, { timeout: 5000 }));

    const dialog = screen.getByRole("alertdialog", { name: "Delete “Fire safety refresher” permanently?" });
    expect(within(dialog).getByText(/can't be undone/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(api.purge).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByText("Fire safety refresher")).toBeInTheDocument();
  });

  it("deletes once confirmed", async () => {
    api.list.mockResolvedValue(page([entry()]));
    api.purge.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("button", { name: "Delete Fire safety refresher permanently" }, { timeout: 5000 }));
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));

    expect(api.purge).toHaveBeenCalledWith("bin-1");
    expect(await screen.findByText("Fire safety refresher was deleted permanently.", { selector: "span" })).toBeInTheDocument();
  });

  it("states how many items emptying the bin removes", async () => {
    api.list.mockResolvedValue(page([entry()]));
    api.empty.mockResolvedValue({ deleted: 1 });
    const user = userEvent.setup();
    renderBoard();

    await screen.findByText("Fire safety refresher", undefined, { timeout: 5000 });
    await user.click(screen.getByRole("button", { name: "Empty bin" }));

    const dialog = screen.getByRole("alertdialog", { name: "Empty the recycle bin?" });
    expect(within(dialog).getByText(/All 1 item in the bin will be deleted permanently/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Empty bin" }));
    expect(api.empty).toHaveBeenCalledTimes(1);
  });
});

describe("restoring", () => {
  it("needs no confirmation and removes the row", async () => {
    api.list.mockResolvedValue(page([entry()]));
    api.restore.mockResolvedValue(entry());
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("button", { name: "Restore Fire safety refresher" }, { timeout: 5000 }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(api.restore).toHaveBeenCalledWith("bin-1");
    expect(await screen.findByText("Fire safety refresher was restored.", { selector: "span" })).toBeInTheDocument();
  });

  it("shows a refusal on the row it belongs to", async () => {
    api.list.mockResolvedValue(page([entry({ id: "bin-2", label: "Draft the brief", typeLabel: "Work item", module: "projects" })]));
    api.restore.mockRejectedValue(new ApiError("Restore the project “Portal rebuild” first.", 409));
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("button", { name: "Restore Draft the brief" }, { timeout: 5000 }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Restore the project “Portal rebuild” first.");
    expect(screen.getByText("Draft the brief")).toBeInTheDocument();
  });

  it("can't restore an item whose parent is still deleted", async () => {
    api.list.mockResolvedValue(
      page([entry({ restorable: false, blockedReason: "Its course is in the bin. Restore the course first." })]),
    );
    renderBoard();

    const restore = await screen.findByRole("button", { name: "Restore Fire safety refresher" }, { timeout: 5000 });
    expect(restore).toBeDisabled();
    expect(screen.getByText("Its course is in the bin. Restore the course first.")).toBeInTheDocument();
  });
});
