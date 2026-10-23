import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminSettingsPage from "./page";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";

/**
 * Settings › Notifications and Settings › Admins.
 *
 * Notifications used to list its switches by hand, including one the server
 * had dropped (`notify_purchase_receipt`), so the tab crashed on
 * `spec.label`; it never showed the assignment, HR or Projects switches. The
 * list now comes from the server's schema.
 *
 * Removing an admin demotes them to User; the dialog has to say exactly that.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org/settings",
  useSearchParams: () => new URLSearchParams(),
}));

const session = vi.hoisted(() => ({ role: "admin" }));

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { role: session.role, name: "Ada", organisationId: "org-1" }, loading: false }),
  AuthError: class extends Error {},
}));

const getSettings = vi.fn<() => Promise<unknown>>();
const team = vi.hoisted(() => ({ list: vi.fn(), add: vi.fn(), remove: vi.fn() }));

vi.mock("@/lib/api/admin-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/admin-client")>("@/lib/api/admin-client");
  return { ...actual, settings: { get: () => getSettings(), update: vi.fn() }, team };
});

const bool = (label: string) => ({ group: "notifications", type: "bool", default: true, label, effect: `What ${label} does.` });
const text = (label: string, group = "general") => ({ group, type: "string", default: "", label, effect: "" });

function payload() {
  return {
    settings: {
      platform_name: "Elevate",
      support_email: "",
      platform_fee_percent: 30,
      require_course_approval: false,
      require_review_approval: false,
      seat_grace_days: 14,
      whatsapp_enabled: false,
      whatsapp_phone_number_id: "",
      whatsapp_access_token: "",
      whatsapp_api_version: "v21.0",
      whatsapp_template_name: "",
      whatsapp_template_language: "en",
      notify_licence_reminders: true,
      notify_course_assignment: true,
      notify_hrm_employee: false,
      notify_projects_sprints: true,
      // A value the schema no longer describes must not crash the tab.
      notify_purchase_receipt: true,
    },
    schema: {
      platform_name: text("Platform name"),
      support_email: text("Support email"),
      platform_fee_percent: text("Platform fee (%)", "payments"),
      require_course_approval: text("Course approval", "catalog"),
      require_review_approval: text("Review approval", "catalog"),
      seat_grace_days: text("Grace after a licence ends (days)", "billing"),
      whatsapp_enabled: text("Send notifications over WhatsApp", "whatsapp"),
      whatsapp_phone_number_id: text("Phone number ID", "whatsapp"),
      whatsapp_access_token: { ...text("Access token", "whatsapp"), type: "secret" },
      whatsapp_api_version: text("Graph API version", "whatsapp"),
      whatsapp_template_name: text("Approved template name", "whatsapp"),
      whatsapp_template_language: text("Template language", "whatsapp"),
      notify_licence_reminders: bool("Send licence renewal reminders"),
      notify_course_assignment: bool("Email learners when training is assigned"),
      notify_hrm_employee: bool("Email people about their own employment"),
      notify_projects_sprints: bool("Announce sprints starting and closing"),
    },
    integrations: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  session.role = "admin";
  getSettings.mockResolvedValue(payload());
  team.list.mockResolvedValue([
    { id: "a-1", name: "Ada Admin", email: "ada@acme.test", initials: "AA", joined: null, isYou: true },
    { id: "a-2", name: "Bola Admin", email: "bola@acme.test", initials: "BA", joined: null, isYou: false },
  ]);
});

describe("Settings › Notifications", () => {
  it("lists every switch in the server's notifications group, by module, without crashing", async () => {
    // The platform's settings are the platform owner's (O3).
    session.role = "super_admin";
    const user = userEvent.setup();
    render(<AdminSettingsPage />);
    await user.click(await screen.findByRole("tab", { name: "Notifications" }));

    expect(screen.getByRole("heading", { name: "Learning and licences" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "People (HR)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();

    expect(screen.getByRole("switch", { name: "Email learners when training is assigned" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Email people about their own employment" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Announce sprints starting and closing" })).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Platform name" })).not.toBeInTheDocument();
  });
});

describe("Settings › Admins", () => {
  it("shows an organisation admin only their admins, never the platform's settings (O3)", async () => {
    render(
      <ConfirmProvider>
        <AdminSettingsPage />
      </ConfirmProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Organisation admins" })).toBeInTheDocument();
    expect(await screen.findByText("Bola Admin")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Notifications" })).not.toBeInTheDocument();
    expect(getSettings).not.toHaveBeenCalled();
  });

  it("says removing an admin makes them a User and keeps their account", async () => {
    team.remove.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <AdminSettingsPage />
      </ConfirmProvider>,
    );
    const removeButtons = await screen.findAllByRole("button", { name: "Remove" });
    const enabled = removeButtons.find((b) => !(b as HTMLButtonElement).disabled);
    await user.click(enabled!);

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/becomes a User/)).toBeInTheDocument();
    expect(within(dialog).getByText(/account isn't deleted/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Remove admin access" }));
    expect(team.remove).toHaveBeenCalledWith("a-2");
    expect(await screen.findByText("Bola Admin is now a User. Their account and work are unchanged.")).toBeInTheDocument();
  });

  it("explains the last-admin rule in organisation terms", async () => {
    team.list.mockResolvedValue([{ id: "a-1", name: "Ada Admin", email: "ada@acme.test", initials: "AA", joined: null, isYou: false }]);
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <AdminSettingsPage />
      </ConfirmProvider>,
    );
    const buttons = await screen.findAllByRole("button", { name: "Remove" });
    expect(buttons[0]).toBeDisabled();
    expect(buttons[0]).toHaveAttribute("title", "The organisation must keep at least one admin");
  });
});
