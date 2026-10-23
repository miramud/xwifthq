import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SystemUsersBoard from "./SystemUsersBoard";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import type { SystemUser } from "@/lib/api/platform-access-client";

/**
 * Deleting a system user.
 *
 * It always asks, says the account goes to the recycle bin, sends nothing
 * when cancelled, never offers to delete yourself, and shows the API's words
 * when it refuses (the last super admin).
 */

const api = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  resendInvite: vi.fn(),
}));

vi.mock("@/lib/api/platform-access-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/platform-access-client")>();
  return { ...actual, systemUsers: api, platformRoles: { ...actual.platformRoles, list: () => Promise.resolve([]) } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/platform/users",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { id: "me", role: "super_admin", name: "Owner", organisationId: null }, loading: false }),
}));

function person(over: Partial<SystemUser>): SystemUser {
  return {
    id: "u-ada",
    name: "Ada Obi",
    email: "ada@platform.test",
    role: "platform_staff",
    roles: [{ id: "r-1", name: "Billing support", kind: "custom" }],
    status: "active",
    lastActiveAt: null,
    createdAt: "2026-09-01T00:00:00Z",
    ...over,
  };
}

function page(rows: SystemUser[]) {
  return { data: rows, meta: { currentPage: 1, lastPage: 1, perPage: 25, total: rows.length } };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue(
    page([person({}), person({ id: "me", name: "Owner Self", email: "owner@platform.test", role: "super_admin", roles: [] })]),
  );
});

function renderBoard() {
  return render(
    <ConfirmProvider>
      <SystemUsersBoard />
    </ConfirmProvider>,
  );
}

describe("SystemUsersBoard — deleting", () => {
  it("asks first, says where the account goes, and cancelling sends nothing", async () => {
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("button", { name: "Delete Ada Obi" }));

    const question = await screen.findByRole("alertdialog", { name: "Delete Ada Obi?" });
    expect(question).toHaveTextContent(/recycle bin/i);

    await user.click(within(question).getByRole("button", { name: "Cancel" }));
    expect(api.remove).not.toHaveBeenCalled();
  });

  it("moves the account to the bin once confirmed", async () => {
    api.remove.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("button", { name: "Delete Ada Obi" }));
    const question = await screen.findByRole("alertdialog", { name: "Delete Ada Obi?" });
    await user.click(within(question).getByRole("button", { name: "Delete user" }));

    expect(api.remove).toHaveBeenCalledWith("u-ada");
    expect(await screen.findByText(/ada obi was moved to the recycle bin/i)).toBeInTheDocument();
  });

  it("never offers to delete your own account", async () => {
    renderBoard();
    await screen.findByText("Owner Self");

    expect(screen.getByRole("button", { name: /you can't delete your own account/i })).toBeDisabled();
  });

  it("shows the API's refusal in its own words", async () => {
    const { ApiError } = await import("@/lib/api/platform-access-client");
    api.remove.mockRejectedValue(new ApiError("The platform must keep at least one super admin.", 422));
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("button", { name: "Delete Ada Obi" }));
    const question = await screen.findByRole("alertdialog", { name: "Delete Ada Obi?" });
    await user.click(within(question).getByRole("button", { name: "Delete user" }));

    expect(await screen.findByText(/must keep at least one super admin/i)).toBeInTheDocument();
  });
});
