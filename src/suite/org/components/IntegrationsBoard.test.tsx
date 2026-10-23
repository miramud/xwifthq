import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IntegrationsBoard from "./IntegrationsBoard";
import { ApiError, type OrgIntegration } from "@/lib/api/integrations-client";

/**
 * The organisation's own Slack app and WhatsApp number.
 *
 * What matters here: a token is never shown back, "saved" never passes for
 * "works" (switching on needs a verified connection), the guides say exactly
 * what Slack and Meta ask for, and a test reports what actually happened.
 */

const api = vi.hoisted(() => ({
  list: vi.fn(),
  save: vi.fn(),
  test: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("@/lib/api/integrations-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/integrations-client")>();
  return { ...actual, orgIntegrations: api };
});

function row(provider: OrgIntegration["provider"], over: Partial<OrgIntegration> = {}): OrgIntegration {
  return {
    provider,
    connected: false,
    enabled: false,
    verifiedAt: null,
    lastError: null,
    lastUsedAt: null,
    settings: {},
    masked: null,
    ...over,
  };
}

const VERIFIED_SLACK = row("slack", {
  connected: true,
  verifiedAt: "2026-09-25T09:00:00Z",
  settings: { teamName: "Rexwift", botUser: "elevate" },
  masked: { botToken: "xoxb-…abcd" },
});

function card(name: string): HTMLElement {
  return screen.getByRole("heading", { name }).closest("section") as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Slack", () => {
  it("explains the exact scopes the app needs", async () => {
    api.list.mockResolvedValue([]);
    render(<IntegrationsBoard />);

    // The first render of the file pays for the cold import; allow for it.
    const slack = await screen.findByRole("heading", { name: "Slack" }, { timeout: 5000 });
    const panel = slack.closest("section") as HTMLElement;
    for (const scope of ["chat:write", "users:read", "users:read.email", "im:write"]) {
      expect(within(panel).getByText(scope)).toBeInTheDocument();
    }
    expect(within(panel).getByText(/Bot User OAuth Token/, { selector: "b" })).toBeInTheDocument();
  });

  it("cannot be switched on until a token has verified", async () => {
    api.list.mockResolvedValue([row("slack", { connected: true, masked: { botToken: "xoxb-…abcd" } })]);
    render(<IntegrationsBoard />);

    await screen.findByRole("heading", { name: "Slack" });
    const panel = card("Slack");
    expect(within(panel).getByRole("switch", { name: "Send Slack messages" })).toBeDisabled();
    expect(within(panel).getByText("Save a token that verifies before switching this on.")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Send me a test DM" })).toBeDisabled();
  });

  it("shows only the masked token, and sends a new one to be verified", async () => {
    api.list.mockResolvedValue([VERIFIED_SLACK]);
    api.save.mockResolvedValue({
      integration: { ...VERIFIED_SLACK, masked: { botToken: "xoxb-…wxyz" } },
      verification: { ok: true, detail: "Connected to Rexwift as elevate." },
    });
    render(<IntegrationsBoard />);

    await screen.findByText("Rexwift");
    const panel = card("Slack");
    expect(within(panel).getByText("Saved · xoxb-…abcd")).toBeInTheDocument();

    const box = within(panel).getByLabelText(/Bot User OAuth Token/);
    expect(box).toHaveValue("");
    await userEvent.type(box, "xoxb-new-token");
    await userEvent.click(within(panel).getByRole("button", { name: "Replace and verify" }));

    expect(api.save).toHaveBeenCalledWith("slack", { botToken: "xoxb-new-token" });
    expect(await within(panel).findByText("Saved · xoxb-…wxyz")).toBeInTheDocument();
    expect(within(panel).getByText("Connected to Rexwift as elevate.")).toBeInTheDocument();
    expect(within(panel).getByText("@elevate")).toBeInTheDocument();
    expect(box).toHaveValue("");
  });

  it("keeps a token that does not verify, and says why", async () => {
    api.list.mockResolvedValue([]);
    api.save.mockResolvedValue({
      integration: row("slack", { connected: true, lastError: "invalid_auth", masked: { botToken: "xoxb-…dead" } }),
      verification: { ok: false, detail: "Slack rejected the token (invalid_auth)." },
    });
    render(<IntegrationsBoard />);

    await screen.findByRole("heading", { name: "Slack" });
    const panel = card("Slack");
    await userEvent.type(within(panel).getByLabelText(/Bot User OAuth Token/), "xoxb-bad");
    await userEvent.click(within(panel).getByRole("button", { name: "Save and verify" }));

    expect(await within(panel).findByText(/Slack rejected the token/)).toHaveTextContent(/Saved, but it does not work yet/);
    expect(within(panel).getByRole("switch", { name: "Send Slack messages" })).toBeDisabled();
  });

  it("switches on once verified", async () => {
    api.list.mockResolvedValue([VERIFIED_SLACK]);
    api.save.mockResolvedValue({ integration: { ...VERIFIED_SLACK, enabled: true }, verification: null });
    render(<IntegrationsBoard />);

    await screen.findByText("Rexwift");
    await userEvent.click(within(card("Slack")).getByRole("switch", { name: "Send Slack messages" }));

    expect(api.save).toHaveBeenCalledWith("slack", { enabled: true });
    expect(within(card("Slack")).getByRole("switch", { name: "Send Slack messages" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("reports what the test reached, and the last problem", async () => {
    api.list.mockResolvedValue([{ ...VERIFIED_SLACK, lastError: "channel_not_found" }]);
    api.test.mockResolvedValue({ ok: false, detail: "Your email is not in the Rexwift workspace." });
    render(<IntegrationsBoard />);

    await screen.findByText("Rexwift");
    const panel = card("Slack");
    expect(within(panel).getByText("channel_not_found")).toBeInTheDocument();

    await userEvent.click(within(panel).getByRole("button", { name: "Send me a test DM" }));
    expect(await within(panel).findByText(/Your email is not in the Rexwift workspace/)).toBeInTheDocument();
    expect(within(panel).getByText(/Test failed/)).toBeInTheDocument();
  });

  it("asks before disconnecting", async () => {
    api.list.mockResolvedValueOnce([VERIFIED_SLACK]).mockResolvedValueOnce([]);
    api.disconnect.mockResolvedValue({});
    render(<IntegrationsBoard />);

    await screen.findByText("Rexwift");
    await userEvent.click(within(card("Slack")).getByRole("button", { name: "Disconnect" }));
    expect(api.disconnect).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("alertdialog", { name: "Disconnect Slack?" });
    expect(within(dialog).getByText(/credentials are erased for good/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(api.disconnect).toHaveBeenCalledWith("slack"));
  });
});

describe("WhatsApp", () => {
  it("guides to a Utility template and states the 24-hour rule", async () => {
    api.list.mockResolvedValue([]);
    render(<IntegrationsBoard />);

    await screen.findByRole("heading", { name: "WhatsApp" });
    const panel = card("WhatsApp");
    expect(within(panel).getByText("Utility")).toBeInTheDocument();
    expect(within(panel).getByText("Elevate update: {{1}}")).toBeInTheDocument();
    expect(within(panel).getByText(/within 24 hours of the person last messaging your number/)).toBeInTheDocument();
  });

  it("needs the phone number ID and template before saving", async () => {
    api.list.mockResolvedValue([]);
    render(<IntegrationsBoard />);

    await screen.findByRole("heading", { name: "WhatsApp" });
    const panel = card("WhatsApp");
    await userEvent.type(within(panel).getByLabelText(/Access token/), "EAAG-secret");
    await userEvent.click(within(panel).getByRole("button", { name: "Save and verify" }));

    expect(await within(panel).findByRole("alert")).toHaveTextContent(/phone number ID and the template name/);
    expect(api.save).not.toHaveBeenCalled();
  });

  it("saves the settings, keeping the stored token when the box is left blank", async () => {
    const connected = row("whatsapp", {
      connected: true,
      verifiedAt: "2026-09-25T09:00:00Z",
      settings: { phoneNumberId: "1098", templateName: "elevate_update", templateLanguage: "en", displayNumber: "+234 801 234 5678" },
      masked: { accessToken: "…wxyz" },
    });
    api.list.mockResolvedValue([connected]);
    api.save.mockResolvedValue({ integration: connected, verification: null });
    render(<IntegrationsBoard />);

    await screen.findByText("+234 801 234 5678");
    const panel = card("WhatsApp");
    const template = within(panel).getByLabelText("Template name");
    await userEvent.clear(template);
    await userEvent.type(template, "elevate_update_v2");
    await userEvent.click(within(panel).getByRole("button", { name: "Save and verify" }));

    expect(api.save).toHaveBeenCalledWith("whatsapp", {
      phoneNumberId: "1098",
      templateName: "elevate_update_v2",
      templateLanguage: "en",
    });
  });

  it("switches on with the saved number ID and template, which the API needs on every save", async () => {
    const connected = row("whatsapp", {
      connected: true,
      verifiedAt: "2026-09-25T09:00:00Z",
      settings: { phoneNumberId: "1098", templateName: "elevate_update", templateLanguage: "en_US" },
    });
    api.list.mockResolvedValue([connected]);
    api.save.mockResolvedValue({ integration: { ...connected, enabled: true }, verification: null });
    render(<IntegrationsBoard />);

    await screen.findByRole("heading", { name: "WhatsApp" });
    await userEvent.click(within(card("WhatsApp")).getByRole("switch", { name: "Send WhatsApp messages" }));

    expect(api.save).toHaveBeenCalledWith("whatsapp", {
      enabled: true,
      phoneNumberId: "1098",
      templateName: "elevate_update",
      templateLanguage: "en_US",
    });
  });
});

it("tells somebody without permission who can help", async () => {
  api.list.mockRejectedValue(new ApiError("Forbidden", 403));
  render(<IntegrationsBoard />);

  expect(await screen.findByText("Only admins and delivery leads can change integrations")).toBeInTheDocument();
});

describe("Email", () => {
  const VERIFIED_GMAIL = row("gmail", {
    connected: true,
    verifiedAt: "2026-09-29T09:00:00Z",
    settings: { address: "projects@rexwift.com", fromName: "Rexwift Projects" },
    masked: { appPassword: "…mnop" },
  });
  const SENDING_ZOHO = row("zoho_mail", {
    connected: true,
    enabled: true,
    verifiedAt: "2026-09-28T09:00:00Z",
    settings: { address: "pm@rexwift.com", region: "eu", account: "organisation" },
  });

  it("links to Google's own pages for 2-Step Verification and app passwords", async () => {
    api.list.mockResolvedValue([]);
    render(<IntegrationsBoard />);

    await screen.findByRole("heading", { name: "Gmail" });
    const panel = card("Gmail");
    expect(within(panel).getByRole("link", { name: /App passwords/ })).toHaveAttribute(
      "href",
      "https://myaccount.google.com/apppasswords",
    );
    expect(within(panel).getByRole("link", { name: /2-Step Verification/ })).toBeInTheDocument();
    expect(screen.getByText("No mailbox is sending project email yet.")).toBeInTheDocument();
  });

  it("saves the mailbox, app password without spaces, from name and default list", async () => {
    api.list.mockResolvedValue([]);
    api.save.mockResolvedValue({
      integration: VERIFIED_GMAIL,
      verification: { ok: true, detail: "Signed in to projects@rexwift.com." },
      disabled: null,
    });
    render(<IntegrationsBoard />);

    await screen.findByRole("heading", { name: "Gmail" });
    const panel = card("Gmail");
    await userEvent.type(within(panel).getByLabelText("Mailbox address"), "projects@rexwift.com");
    await userEvent.type(within(panel).getByLabelText(/App password/), "abcd efgh ijkl mnop");
    await userEvent.type(within(panel).getByLabelText("From name"), "Rexwift Projects");
    await userEvent.type(within(panel).getByLabelText(/Default team list/), "delivery@rexwift.com; leads@rexwift.com");
    await userEvent.click(within(panel).getByRole("button", { name: "Save and verify" }));

    expect(api.save).toHaveBeenCalledWith("gmail", {
      address: "projects@rexwift.com",
      appPassword: "abcdefghijklmnop",
      fromName: "Rexwift Projects",
      defaultList: "delivery@rexwift.com, leads@rexwift.com",
    });
    expect(await within(panel).findByText("Signed in to projects@rexwift.com.")).toBeInTheDocument();
    expect(within(panel).getByText("Saved · …mnop")).toBeInTheDocument();
    expect(within(panel).getByLabelText(/App password/)).toHaveValue("");
  });

  it("refuses a list address that isn't one, before asking the server", async () => {
    api.list.mockResolvedValue([]);
    render(<IntegrationsBoard />);

    await screen.findByRole("heading", { name: "Gmail" });
    const panel = card("Gmail");
    await userEvent.type(within(panel).getByLabelText("Mailbox address"), "projects@rexwift.com");
    await userEvent.type(within(panel).getByLabelText(/App password/), "abcdefghijklmnop");
    await userEvent.type(within(panel).getByLabelText(/Default team list/), "delivery@rexwift.com, leads");
    await userEvent.click(within(panel).getByRole("button", { name: "Save and verify" }));

    expect(await within(panel).findByText("“leads” is not an email address.")).toBeInTheDocument();
    expect(api.save).not.toHaveBeenCalled();
  });

  it("cannot be switched on until the app password has verified", async () => {
    api.list.mockResolvedValue([row("gmail", { connected: true, settings: { address: "projects@rexwift.com" } })]);
    render(<IntegrationsBoard />);

    await screen.findByRole("heading", { name: "Gmail" });
    const panel = card("Gmail");
    expect(within(panel).getByRole("switch", { name: "Send project email from Gmail" })).toBeDisabled();
    expect(within(panel).getByText("Save an app password that verifies before switching this on.")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Send me a test email" })).toBeDisabled();
  });

  it("says switching on turns the other mailbox off, and reports it when the server does", async () => {
    api.list.mockResolvedValue([VERIFIED_GMAIL, SENDING_ZOHO]);
    api.save.mockResolvedValue({
      integration: { ...VERIFIED_GMAIL, enabled: true },
      verification: null,
      disabled: "zoho_mail",
    });
    render(<IntegrationsBoard />);

    await screen.findByRole("heading", { name: "Gmail" });
    expect(screen.getByText(/Sending project email from/)).toHaveTextContent("Zoho Mail as pm@rexwift.com");
    const gmail = card("Gmail");
    expect(
      within(gmail).getByText("Off. Zoho Mail is sending project email now. Switching this on turns Zoho Mail off."),
    ).toBeInTheDocument();

    await userEvent.click(within(gmail).getByRole("switch", { name: "Send project email from Gmail" }));

    expect(api.save).toHaveBeenCalledWith("gmail", {
      enabled: true,
      address: "projects@rexwift.com",
      fromName: "Rexwift Projects",
      defaultList: null,
    });
    expect(
      await screen.findByText(/Zoho Mail was switched off\. Project email now goes out from Gmail\./),
    ).toBeInTheDocument();
    expect(within(card("Gmail")).getByRole("switch", { name: "Send project email from Gmail" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      within(card("Zoho Mail")).getByRole("switch", { name: "Send project email from Zoho Mail" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("sends Zoho's data centre and account type, and links to that data centre", async () => {
    api.list.mockResolvedValue([]);
    api.save.mockResolvedValue({ integration: row("zoho_mail", { connected: true }), verification: null, disabled: null });
    render(<IntegrationsBoard />);

    await screen.findByRole("heading", { name: "Zoho Mail" });
    const panel = card("Zoho Mail");
    await userEvent.type(within(panel).getByLabelText("Mailbox address"), "pm@rexwift.com");
    await userEvent.type(within(panel).getByLabelText(/App password/), "zoho-app-pass");

    await userEvent.click(within(panel).getByRole("combobox", { name: "Data centre" }));
    await userEvent.click(await screen.findByRole("option", { name: /zoho\.eu/ }));
    await userEvent.click(within(panel).getByRole("radio", { name: "Personal" }));

    expect(within(panel).getByRole("link", { name: /App Passwords/ })).toHaveAttribute(
      "href",
      "https://accounts.zoho.eu/home#security/app_password",
    );

    await userEvent.click(within(panel).getByRole("button", { name: "Save and verify" }));
    expect(api.save).toHaveBeenCalledWith("zoho_mail", {
      address: "pm@rexwift.com",
      appPassword: "zoho-app-pass",
      fromName: null,
      defaultList: null,
      region: "eu",
      account: "personal",
    });
  });
});
