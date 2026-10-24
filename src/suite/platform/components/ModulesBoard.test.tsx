import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModulesBoard from "./ModulesBoard";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import type { PlatformModule } from "@/lib/api/platform-client";

/**
 * The platform-wide module switch: the widest lever in the console.
 *
 * Switching a module off asks first and says how far it reaches; cancelling
 * changes nothing; Core can't be switched off at all.
 */

const api = vi.hoisted(() => ({ list: vi.fn(), setEnabled: vi.fn() }));

vi.mock("@/lib/api/platform-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/platform-client")>();
  return { ...actual, platformModules: api };
});

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { id: "owner", role: "super_admin", name: "Owner", organisationId: null }, loading: false }),
}));

function mod(over: Partial<PlatformModule>): PlatformModule {
  return {
    key: "hrm",
    label: "HRM",
    deployed: true,
    enabled: true,
    sellable: true,
    organisations: 3,
    activeUsers30d: 120,
    features: 14,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue([
    mod({ key: "core", label: "Core", sellable: false, organisations: 5 }),
    mod({}),
  ]);
});

function renderBoard() {
  return render(
    <ConfirmProvider>
      <ModulesBoard />
    </ConfirmProvider>,
  );
}

describe("ModulesBoard: the platform-wide switch", () => {
  it("offers no switch for Core", async () => {
    renderBoard();
    await screen.findByRole("heading", { name: "Core" });

    expect(screen.queryByRole("switch", { name: /core/i })).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /hrm on across the platform/i })).toBeInTheDocument();
  });

  it("asks before switching a module off, naming who it reaches, and cancelling changes nothing", async () => {
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("switch", { name: /hrm on across the platform/i }));

    const question = await screen.findByRole("alertdialog", { name: /switch hrm off for everyone/i });
    expect(question).toHaveTextContent(/3 organisations lose access/i);
    expect(question).toHaveTextContent(/120 people/i);

    await user.click(within(question).getByRole("button", { name: "Cancel" }));

    expect(api.setEnabled).not.toHaveBeenCalled();
    expect(screen.getByRole("switch", { name: /hrm on across the platform/i })).toHaveAttribute("aria-checked", "true");
  });

  it("switches it off once confirmed", async () => {
    api.setEnabled.mockResolvedValue(mod({ enabled: false }));
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole("switch", { name: /hrm on across the platform/i }));
    const question = await screen.findByRole("alertdialog", { name: /switch hrm off for everyone/i });
    await user.click(within(question).getByRole("button", { name: "Switch HRM off" }));

    expect(api.setEnabled).toHaveBeenCalledWith("hrm", false);
    expect(await screen.findByText(/hrm is off across the platform/i)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /hrm on across the platform/i })).toHaveAttribute("aria-checked", "false");
  });
});
