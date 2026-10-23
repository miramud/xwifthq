import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminSettingsPage from "./page";
import { SECRET_MASK as MASK } from "@/lib/api/admin-client";

/**
 * The WhatsApp panel on platform settings.
 *
 * One property is worth more than the rest: **the access token is write-only.**
 * The API returns a mask, the field starts empty, and saving the form without
 * retyping it must not erase the stored credential — an admin who edits the
 * template name beside it and loses the token has broken the channel for every
 * institution and has no way to know.
 */

// DataView reads the router to open rows; the test has no app router mounted.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { role: "super_admin", name: "Owner" }, loading: false }),
  AuthError: class extends Error {},
}));

const getSettings = vi.fn<() => Promise<unknown>>();
const updateSettings = vi.fn<(body: unknown) => Promise<unknown>>();

vi.mock("@/lib/api/admin-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/admin-client")>(
    "@/lib/api/admin-client",
  );

  return {
    ...actual,
    settings: { get: () => getSettings(), update: (b: unknown) => updateSettings(b) },
    team: { list: vi.fn().mockResolvedValue([]), add: vi.fn(), remove: vi.fn() },
  };
});

function spec(label: string, group = "whatsapp") {
  return { group, type: "string", default: "", label, effect: `What ${label} does.` };
}

function payload(over: Record<string, unknown> = {}) {
  return {
    settings: {
      platform_name: "XwiftHQ",
      support_email: "",
      platform_fee_percent: 30,
      require_course_approval: false,
      require_review_approval: false,
      seat_grace_days: 14,
      whatsapp_enabled: true,
      whatsapp_phone_number_id: "12345",
      whatsapp_access_token: MASK,
      whatsapp_api_version: "v21.0",
      whatsapp_template_name: "licence_reminder",
      whatsapp_template_language: "en",
      notify_licence_reminders: true,
      notify_course_assignment: true,
      notify_instructor_enrollment: true,
      notify_admin_sale: true,
      notify_payment_failed: true,
      notify_refund_processed: true,
      ...(over.settings as Record<string, unknown>),
    },
    schema: {
      platform_name: spec("Platform name", "general"),
      support_email: spec("Support email", "general"),
      platform_fee_percent: spec("Platform fee (%)", "payments"),
      require_course_approval: spec("Course approval", "catalog"),
      require_review_approval: spec("Review approval", "catalog"),
      seat_grace_days: spec("Grace after a licence ends (days)", "billing"),
      whatsapp_enabled: spec("Send notifications over WhatsApp"),
      whatsapp_phone_number_id: spec("Phone number ID"),
      whatsapp_access_token: { ...spec("Access token"), type: "secret" },
      whatsapp_api_version: spec("Graph API version"),
      whatsapp_template_name: spec("Approved template name"),
      whatsapp_template_language: spec("Template language"),
      notify_licence_reminders: spec("Send licence renewal reminders", "notifications"),
      notify_course_assignment: spec("Assignment", "notifications"),
      notify_instructor_enrollment: spec("Enrollment", "notifications"),
      notify_admin_sale: spec("Sale", "notifications"),
      notify_payment_failed: spec("Payment failed", "notifications"),
      notify_refund_processed: spec("Refund", "notifications"),
    },
    integrations: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSettings.mockResolvedValue(payload());
  updateSettings.mockImplementation(async () => payload());
});

async function openWhatsApp(user: ReturnType<typeof userEvent.setup>) {
  render(<AdminSettingsPage />);
  await user.click(await screen.findByRole("tab", { name: "WhatsApp" }));
}

describe("Platform settings — WhatsApp", () => {
  it("says a token is saved without ever showing it", async () => {
    const user = userEvent.setup();
    await openWhatsApp(user);

    const token = screen.getByLabelText(/access token/i);

    // Empty field, but the panel confirms one is stored.
    expect(token).toHaveValue("");
    expect(token).toHaveAttribute("type", "password");
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/leave blank to keep the saved token/i)).toBeInTheDocument();
  });

  /** The mistake that would silently break the channel for every institution. */
  it("does not send the token when it was not retyped", async () => {
    const user = userEvent.setup();
    await openWhatsApp(user);

    await user.clear(screen.getByLabelText(/phone number id/i));
    await user.type(screen.getByLabelText(/phone number id/i), "99887766");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalled());

    const sent = updateSettings.mock.calls[0][0] as Record<string, unknown>;

    expect(sent).toHaveProperty("whatsapp_phone_number_id", "99887766");
    expect(sent).not.toHaveProperty("whatsapp_access_token");
  });

  it("sends a token that was retyped", async () => {
    const user = userEvent.setup();
    await openWhatsApp(user);

    await user.type(screen.getByLabelText(/access token/i), "EAAG-new");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalled());

    expect(updateSettings.mock.calls[0][0]).toMatchObject({
      whatsapp_access_token: "EAAG-new",
    });
  });

  it("says a token has never been set, rather than leaving an unexplained empty box", async () => {
    getSettings.mockResolvedValue(payload({ settings: { whatsapp_access_token: "" } }));

    const user = userEvent.setup();
    await openWhatsApp(user);

    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/paste the access token/i)).toBeInTheDocument();
  });

  /** Switching the channel on does not, by itself, reach anybody. */
  it("explains that each institution still has to supply its own number", async () => {
    const user = userEvent.setup();
    await openWhatsApp(user);

    expect(screen.getByText(/its own admin adds a whatsapp number/i)).toBeInTheDocument();
    expect(screen.getByText(/whatsapp is the nudge, email is the record/i)).toBeInTheDocument();
  });
});
