import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openCombobox } from "@/test/selectOption";
import MailSettingsBoard from "./MailSettingsBoard";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import { ApiError } from "@/lib/api/admin-client";
import type { MailProvider, MailSettings } from "@/lib/api/mail-settings-client";

/**
 * How the organisation's email leaves the platform.
 *
 * What matters here is the guard rails, not the forms (those come from the
 * API's schema): a provider's own error comes back verbatim, a provider can't
 * be switched on before a real test email has gone out, a stored secret is
 * never shown and a blank box keeps it, and removing credentials asks first,
 * because they are erased, not binned.
 */

const api = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  test: vi.fn(),
  activate: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/api/mail-settings-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/mail-settings-client")>();
  return { ...actual, mailSettings: api };
});

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { id: "u-me", email: "adaeze@meridian.test", role: "admin" }, loading: false }),
}));

function provider(over: Partial<MailProvider> = {}): MailProvider {
  return {
    key: "resend",
    label: "Resend",
    configured: false,
    verifiedAt: null,
    fields: [{ key: "apiKey", label: "API key", type: "password", required: true }],
    values: {},
    ...over,
  };
}

function settings(over: Partial<MailSettings> = {}): MailSettings {
  return {
    active: null,
    fromName: "Meridian Polytechnic",
    fromAddress: "no-reply@meridian.test",
    replyTo: null,
    providers: [
      provider(),
      provider({
        key: "smtp",
        label: "SMTP",
        fields: [
          { key: "host", label: "Host", type: "text", required: true },
          { key: "port", label: "Port", type: "text", required: true },
          { key: "password", label: "Password", type: "password", required: false },
          { key: "encryption", label: "Encryption", type: "select", required: true, options: ["tls", { value: "ssl", label: "SSL" }] },
        ],
      }),
    ],
    ...over,
  };
}

function renderBoard() {
  return render(
    <ConfirmProvider>
      <MailSettingsBoard />
    </ConfirmProvider>,
  );
}

/** One provider's card: each is a list item under "Providers". */
async function card(label: string): Promise<HTMLElement> {
  const heading = await screen.findByRole("heading", { name: label });
  return heading.closest("li")!;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("with no provider switched on", () => {
  it("says mail still goes, from the platform's default sender", async () => {
    api.get.mockResolvedValue(settings());
    renderBoard();

    expect(await screen.findByText("Using the platform's default sender")).toBeInTheDocument();
    expect(screen.getByText(/It still arrives/)).toBeInTheDocument();
    const header = screen.getByLabelText("What recipients see");
    expect(within(header).getByText("Meridian Polytechnic <no-reply@meridian.test>")).toBeInTheDocument();
  });
});

describe("sending a test email", () => {
  it("shows the provider's own error, verbatim", async () => {
    api.get.mockResolvedValue(
      settings({ providers: [provider({ configured: true })] }),
    );
    api.test.mockRejectedValue(new ApiError("535 5.7.8 Authentication failed: invalid API key", 422));
    renderBoard();

    const resend = await card("Resend");
    await userEvent.click(within(resend).getByRole("button", { name: "Send test email" }));

    // Defaults to the signed-in admin's own address.
    const to = within(resend).getByLabelText("Send a test email to");
    expect(to).toHaveValue("adaeze@meridian.test");

    await userEvent.click(within(resend).getByRole("button", { name: "Send test" }));

    expect(api.test).toHaveBeenCalledWith("resend", "adaeze@meridian.test");
    expect(await within(resend).findByRole("alert")).toHaveTextContent(
      "535 5.7.8 Authentication failed: invalid API key",
    );
    // Still not provable, so still can't be switched on.
    expect(within(resend).getByRole("button", { name: "Switch on" })).toBeDisabled();
  });

  it("allows switching on once a test has gone out", async () => {
    api.get.mockResolvedValue(settings({ providers: [provider({ configured: true })] }));
    api.test.mockResolvedValue({ sent: true });
    api.activate.mockResolvedValue(settings({ active: "resend", providers: [provider({ configured: true, verifiedAt: "2026-09-26T10:00:00Z" })] }));
    renderBoard();

    const resend = await card("Resend");
    expect(within(resend).getByRole("button", { name: "Switch on" })).toBeDisabled();

    await userEvent.click(within(resend).getByRole("button", { name: "Send test email" }));
    await userEvent.click(within(resend).getByRole("button", { name: "Send test" }));

    expect(await within(resend).findByRole("status")).toHaveTextContent("Test email sent to adaeze@meridian.test");
    const on = within(resend).getByRole("button", { name: "Switch on" });
    expect(on).toBeEnabled();

    await userEvent.click(on);
    expect(api.activate).toHaveBeenCalledWith("resend");
    expect(await screen.findByText("Sending through Resend")).toBeInTheDocument();
  });
});

describe("removing credentials", () => {
  it("asks first, says they are erased rather than binned, and does nothing on cancel", async () => {
    api.get.mockResolvedValue(settings({ active: "resend", providers: [provider({ configured: true, verifiedAt: "2026-09-26T10:00:00Z" })] }));
    renderBoard();

    const resend = await card("Resend");
    await userEvent.click(within(resend).getByRole("button", { name: "Remove" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Remove Resend credentials?");
    expect(dialog).toHaveTextContent(/erased for good\. Nothing goes to the recycle bin/);
    // It is the active provider, so the fallback is spelled out.
    expect(dialog).toHaveTextContent(/platform's default sender/);

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(api.remove).not.toHaveBeenCalled();
  });

  it("removes them once confirmed", async () => {
    api.get.mockResolvedValue(settings({ providers: [provider({ configured: true })] }));
    api.remove.mockResolvedValue({});
    renderBoard();

    const resend = await card("Resend");
    await userEvent.click(within(resend).getByRole("button", { name: "Remove" }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove credentials" }));

    expect(api.remove).toHaveBeenCalledWith("resend");
    // Reloads so the card reflects what the server now holds.
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});

describe("configuring a provider", () => {
  it("never shows a stored secret, and a blank one is not sent", async () => {
    api.get.mockResolvedValue(
      settings({
        providers: [
          provider({
            key: "smtp",
            label: "SMTP",
            configured: true,
            fields: [
              { key: "host", label: "Host", type: "text", required: true },
              { key: "password", label: "Password", type: "password", required: false },
              { key: "encryption", label: "Encryption", type: "select", required: true, options: ["tls", { value: "ssl", label: "SSL" }] },
            ],
            values: { host: "smtp.meridian.test", encryption: "tls" },
          }),
        ],
      }),
    );
    api.save.mockResolvedValue(settings());
    renderBoard();

    const smtp = await card("SMTP");
    await userEvent.click(within(smtp).getByRole("button", { name: "Edit details" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Host")).toHaveValue("smtp.meridian.test");
    const password = within(dialog).getByLabelText("Password (optional)");
    expect(password).toHaveValue("");
    expect(password).toHaveAccessibleDescription("Stored. Leave blank to keep it.");
    const encryption = within(dialog).getByLabelText("Encryption");
    expect(encryption).toHaveTextContent("tls");
    const listbox = await openCombobox(userEvent.setup(), encryption);
    expect(within(listbox).getByRole("option", { name: "SSL" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    await userEvent.click(within(dialog).getByRole("button", { name: "Save details" }));

    expect(api.save).toHaveBeenCalledWith("smtp", {
      values: { host: "smtp.meridian.test", encryption: "tls" },
      fromName: "Meridian Polytechnic",
      fromAddress: "no-reply@meridian.test",
      replyTo: null,
    });
  });
});

it("tells a non-admin who can change it", async () => {
  api.get.mockRejectedValue(new ApiError("Forbidden", 403));
  renderBoard();

  expect(await screen.findByText("Only organisation admins can change email delivery")).toBeInTheDocument();
});
