import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MailSettingsBoard from "./MailSettingsBoard";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import { mailSettings, type MailSettings } from "@/lib/api/mail-settings-client";
import { alertTopic } from "@/suite/platform/components/OverviewBoard";

/**
 * The same board at the platform scope: the platform's own provider, which
 * carries onboarding, sales and owner mail and mail for people outside any
 * organisation. The clients are left real and `fetch` is mocked, so these
 * tests prove which API each scope calls, not just which copy it shows.
 */

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { id: "u-owner", email: "owner@xwifthq.com", role: "super_admin" }, loading: false }),
}));

function platformSettings(over: Partial<MailSettings> = {}): MailSettings {
  return {
    active: null,
    fromName: "XwiftHQ",
    fromAddress: "hello@xwifthq.com",
    replyTo: null,
    routing: "Organisations without a provider of their own currently use this one.",
    providers: [
      {
        key: "resend",
        label: "Resend",
        configured: true,
        verifiedAt: null,
        fields: [{ key: "apiKey", label: "API key", type: "password", required: true }],
        values: {},
      },
    ],
    ...over,
  };
}

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPlatformBoard() {
  return render(
    <ConfirmProvider>
      <MailSettingsBoard scope="platform" />
    </ConfirmProvider>,
  );
}

describe("MailSettingsBoard: platform scope", () => {
  it("loads from the platform API and explains platform mail and the routing order", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: platformSettings() }));
    renderPlatformBoard();

    expect(await screen.findByText("Using the server's default mail settings")).toBeTruthy();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/platform/mail-settings");

    expect(screen.getByText("Platform")).toBeTruthy();
    expect(screen.getByText(/welcomes for new organisations, sales and owner notices/)).toBeTruthy();

    const order = screen.getByRole("heading", { name: "How email finds its way out" }).closest("div")!;
    const steps = within(order).getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(steps[0]).toContain("The organisation's own provider");
    expect(steps[1]).toContain("This platform provider");
    expect(steps[2]).toContain("The server's default mail settings");
    expect(within(order).getByText(/currently use this one/)).toBeTruthy();

    // No organisation wording leaks into the platform scope.
    expect(screen.queryByText(/your organisation's/)).toBeNull();
  });

  it("doesn't repeat the API's list of routing steps, which the page already draws", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ data: { ...platformSettings(), routing: ["Organisation provider", "Platform provider", "Server default"] } }),
    );
    renderPlatformBoard();

    const order = (await screen.findByRole("heading", { name: "How email finds its way out" })).closest("div")!;
    expect(within(order).getAllByRole("listitem")).toHaveLength(3);
    expect(within(order).queryByText(/Right now/)).toBeNull();
    expect(within(order).queryByText(/Organisation providerPlatform provider/)).toBeNull();
  });

  it("sends the test email through the platform API, to the signed-in owner by default", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ data: platformSettings() }))
      .mockResolvedValueOnce(json({ data: { sent: true } }));
    renderPlatformBoard();

    await userEvent.click(await screen.findByRole("button", { name: "Send test email" }));
    const address = screen.getByLabelText("Send a test email to") as HTMLInputElement;
    expect(address.value).toBe("owner@xwifthq.com");

    await userEvent.click(screen.getByRole("button", { name: "Send test" }));

    expect(await screen.findByText(/Test email sent to owner@xwifthq.com/)).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/platform/mail-settings/resend/test");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ to: "owner@xwifthq.com" });
  });

  it("says platform email falls back to the server when a platform provider is switched off", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: platformSettings({ active: "resend", providers: [
      { ...platformSettings().providers[0], verifiedAt: "2026-09-26T10:00:00Z" },
    ] }) }));
    renderPlatformBoard();

    expect(await screen.findByText("Sending through Resend")).toBeTruthy();
    expect(screen.getByText(/also carries mail for organisations that haven't switched on a provider/)).toBeTruthy();
    expect(screen.getByText("Switched on. Platform email goes out through here.")).toBeTruthy();
  });
});

describe("scoped clients", () => {
  it("keeps the organisation client on the admin API", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: platformSettings() }));
    await mailSettings.get();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/mail-settings");
  });
});

describe("platform overview alerts", () => {
  it("send a mail failure to Email delivery, even when it names onboarding", () => {
    expect(alertTopic("platform.mail_failed")?.href).toBe("/suite/platform/settings/email");
    expect(alertTopic("onboarding.welcome_mail_failed")?.href).toBe("/suite/platform/settings/email");
    expect(alertTopic("onboarding.needs_attention")?.href).toBe("/suite/platform/payments?kind=signup");
  });
});
