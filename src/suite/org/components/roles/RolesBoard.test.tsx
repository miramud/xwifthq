import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RolesBoard from "./RolesBoard";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import type { Role } from "@/lib/api/roles-client";

/** The roles list: built-in roles can't be edited or deleted; deleting a custom one always asks. */

const api = vi.hoisted(() => ({ list: vi.fn(), remove: vi.fn(), duplicate: vi.fn() }));

vi.mock("@/lib/api/roles-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/roles-client")>();
  return { ...actual, roles: { ...actual.roles, ...api } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org/roles",
  useSearchParams: () => new URLSearchParams(),
}));

function role(over: Partial<Role>): Role {
  return {
    id: "r",
    name: "Role",
    description: null,
    kind: "custom",
    systemKey: null,
    permissions: [],
    usersCount: 0,
    editable: true,
    createdAt: null,
    updatedAt: null,
    ...over,
  };
}

const ROLES = [
  // The one built-in role an organisation lists since the base Admin role retired (phase 3b).
  role({ id: "system:user", name: "User", kind: "system", systemKey: "user", editable: false, permissions: ["a", "b"] }),
  role({ id: "c-1", name: "Course reviewer", usersCount: 3, permissions: ["lms.courses.view"] }),
];

function renderBoard() {
  return render(
    <ConfirmProvider>
      <RolesBoard />
    </ConfirmProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue(ROLES);
});

describe("roles list", () => {
  it("offers no edit or delete on a built-in role", async () => {
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("button", { name: "Actions for User" }, { timeout: 5000 }));
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("asks before deleting a custom role, and cancelling keeps it", async () => {
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("button", { name: "Actions for Course reviewer" }, { timeout: 5000 }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    const dialog = screen.getByRole("alertdialog", { name: "Delete “Course reviewer”?" });
    expect(within(dialog).getByText(/3 users who hold it lose/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(api.remove).not.toHaveBeenCalled();
  });

  it("moves a confirmed delete to the recycle bin", async () => {
    api.remove.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("button", { name: "Actions for Course reviewer" }, { timeout: 5000 }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete role" }));

    expect(api.remove).toHaveBeenCalledWith("c-1");
    expect(await screen.findByText("Course reviewer moved to the recycle bin.", { selector: "p:not(.sr-only)" })).toBeInTheDocument();
  });
});
