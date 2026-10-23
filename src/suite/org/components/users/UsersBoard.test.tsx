import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UsersBoard from "./UsersBoard";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import type { OrgUser } from "@/lib/api/users-client";

/**
 * User management. The delete path is the one with consequence:
 * it always asks, says the user goes to the recycle bin, and is not offered
 * on your own row.
 */

const api = vi.hoisted(() => ({
  list: vi.fn(),
  summary: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  resendInvite: vi.fn(),
}));

vi.mock("@/lib/api/users-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/users-client")>();
  return { ...actual, users: api };
});

vi.mock("@/lib/api/roles-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/roles-client")>();
  return { ...actual, roles: { ...actual.roles, list: vi.fn().mockResolvedValue([]) } };
});

const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org/users",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { id: "u-me", role: "admin", name: "Adaeze Okonkwo", organisationId: "org-1" }, loading: false }),
}));

function account(over: Partial<OrgUser> = {}): OrgUser {
  return {
    id: "u-ruth",
    name: "Ruth Akande",
    email: "ruth@meridian.test",
    avatarUrl: null,
    role: "user",
    roleLabel: "User",
    roles: [
      { id: "system:user", name: "User", kind: "system", systemKey: "user" },
      { id: "r-instructor", name: "Instructor", kind: "custom" },
    ],
    jobTitle: "QA Engineer",
    status: "active",
    createdAt: "2026-09-01T09:00:00Z",
    lastActiveAt: "2026-09-25T09:00:00Z",
    stats: { enrolments: 2, completed: 1, averageProgress: 60, certificates: 1 },
    ...over,
  };
}

function page(rows: OrgUser[]) {
  return { data: rows, meta: { currentPage: 1, lastPage: 1, perPage: 25, total: rows.length } };
}

function renderBoard() {
  return render(
    <ConfirmProvider>
      <UsersBoard />
    </ConfirmProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
  api.summary.mockResolvedValue({
    total: 2,
    byRole: { admin: 1, user: 1 },
    activeLast30Days: 2,
    newThisMonth: 1,
    invited: 0,
  });
});

describe("deleting a user", () => {
  it("asks first, says where they go, and cancelling keeps them", async () => {
    api.list.mockResolvedValue(page([account()]));
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("button", { name: "Actions for Ruth Akande" }, { timeout: 5000 }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    const dialog = screen.getByRole("alertdialog", { name: "Delete Ruth Akande?" });
    expect(within(dialog).getByText(/recycle bin/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(api.remove).not.toHaveBeenCalled();
  });

  it("deletes once confirmed and removes the row", async () => {
    api.list.mockResolvedValue(page([account()]));
    api.remove.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("button", { name: "Actions for Ruth Akande" }, { timeout: 5000 }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete user" }));

    expect(api.remove).toHaveBeenCalledWith("u-ruth");
    expect(await screen.findByText("Ruth Akande moved to the recycle bin.", { selector: "span" })).toBeInTheDocument();
  });

  it("isn't offered on your own row", async () => {
    api.list.mockResolvedValue(page([account({ id: "u-me", name: "Adaeze Okonkwo", role: "admin", roleLabel: "Admin" })]));
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("button", { name: "Actions for Adaeze Okonkwo" }, { timeout: 5000 }));
    expect(screen.getByRole("menuitem", { name: "View profile" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });
});

describe("arriving from a link", () => {
  it("honours ?sort=-createdAt from the Overview's new-users card", async () => {
    nav.search = "sort=-createdAt";
    api.list.mockResolvedValue(page([account()]));
    renderBoard();

    await screen.findByRole("button", { name: "Actions for Ruth Akande" }, { timeout: 5000 });
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ sort: "-createdAt" }));
  });

  it("ignores a sort it does not offer", async () => {
    nav.search = "sort=password";
    api.list.mockResolvedValue(page([account()]));
    renderBoard();

    await screen.findByRole("button", { name: "Actions for Ruth Akande" }, { timeout: 5000 });
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ sort: "name" }));
  });
});
