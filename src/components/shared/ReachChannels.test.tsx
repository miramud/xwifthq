import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReachChannels, { reachSubtitle } from "./ReachChannels";
import { ApiError, normaliseE164, type MyNotificationChannels } from "@/lib/api/integrations-client";

/**
 * "Where to reach me". Slack and WhatsApp are each person's own choice, only
 * offered once the organisation has connected them — and WhatsApp is never a
 * bare switch: it asks for the number and an explicit yes, because Meta
 * requires the recipient's opt-in.
 */

const api = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), test: vi.fn() }));

vi.mock("@/lib/api/integrations-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/integrations-client")>();
  return { ...actual, notificationChannels: api };
});

function channels(over: {
  slack?: Partial<MyNotificationChannels["slack"]>;
  whatsapp?: Partial<MyNotificationChannels["whatsapp"]>;
} = {}): MyNotificationChannels {
  return {
    slack: { available: true, enabled: false, linked: false, handle: null, problem: null, ...over.slack },
    whatsapp: {
      available: true,
      enabled: false,
      number: null,
      optedInAt: null,
      suggestedNumber: null,
      ...over.whatsapp,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

it("shows nothing when the organisation has connected neither", async () => {
  api.get.mockResolvedValue(channels({ slack: { available: false }, whatsapp: { available: false } }));
  const { container } = render(<ReachChannels />);

  await vi.waitFor(() => expect(api.get).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});

it("shows nothing when the endpoint is missing", async () => {
  api.get.mockRejectedValue(new ApiError("Not found", 404));
  const { container } = render(<ReachChannels />);

  await vi.waitFor(() => expect(api.get).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});

describe("subtitle", () => {
  it("names only the channels on offer", async () => {
    api.get.mockResolvedValue(channels({ whatsapp: { available: false } }));
    render(<ReachChannels />);

    expect(await screen.findByText("Every notification lands in XwiftHQ. Add Slack to get a copy there too.")).toBeInTheDocument();
    expect(screen.queryByText(/WhatsApp/)).not.toBeInTheDocument();
  });

  it("lists several in plain English", () => {
    expect(reachSubtitle(["Slack", "WhatsApp", "email"])).toBe(
      "Every notification lands in XwiftHQ. Add Slack, WhatsApp or email to get a copy there too.",
    );
    expect(reachSubtitle([false, "WhatsApp", "email"])).toBe(
      "Every notification lands in XwiftHQ. Add WhatsApp or email to get a copy there too.",
    );
    expect(reachSubtitle([false, false, null])).toBe("Every notification lands in XwiftHQ.");
  });
});

describe("Slack", () => {
  it("is offered only when the organisation has it", async () => {
    api.get.mockResolvedValue(channels({ slack: { available: false } }));
    render(<ReachChannels />);

    expect(await screen.findByText("Where to reach me")).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Slack" })).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "WhatsApp" })).toBeInTheDocument();
  });

  it("says who it matched", async () => {
    api.get.mockResolvedValue(channels({ slack: { enabled: true, linked: true, handle: "ada" } }));
    render(<ReachChannels />);

    expect(await screen.findByText("@ada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send me a test" })).toBeInTheDocument();
  });

  it("says why it could not match, after switching on", async () => {
    api.get.mockResolvedValue(channels());
    api.update.mockResolvedValue(
      channels({ slack: { enabled: true, problem: "ada@rexwift.com is not in the Rexwift Slack workspace." } }),
    );
    render(<ReachChannels />);

    await userEvent.click(await screen.findByRole("switch", { name: "Slack" }));
    expect(api.update).toHaveBeenCalledWith({ slack: { enabled: true } });
    expect(await screen.findByText(/is not in the Rexwift Slack workspace/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send me a test" })).not.toBeInTheDocument();
  });
});

describe("WhatsApp", () => {
  it("asks for the number and consent before turning on", async () => {
    api.get.mockResolvedValue(channels({ whatsapp: { suggestedNumber: "+2348012345678" } }));
    api.update.mockResolvedValue(
      channels({ whatsapp: { enabled: true, number: "+2348012345678", optedInAt: "2026-09-25T10:00:00Z" } }),
    );
    render(<ReachChannels />);

    await userEvent.click(await screen.findByRole("switch", { name: "WhatsApp" }));
    expect(api.update).not.toHaveBeenCalled();

    const number = screen.getByLabelText("WhatsApp number");
    expect(number).toHaveValue("+2348012345678");
    expect(screen.getByText(/From your HR record/)).toBeInTheDocument();

    const turnOn = screen.getByRole("button", { name: "Turn on WhatsApp" });
    expect(turnOn).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox", { name: /I agree to receive work notifications/ }));
    await userEvent.click(turnOn);

    expect(api.update).toHaveBeenCalledWith({
      whatsapp: { enabled: true, number: "+2348012345678", consent: true },
    });
    expect(await screen.findByText("+2348012345678")).toBeInTheDocument();
    expect(screen.queryByLabelText("WhatsApp number")).not.toBeInTheDocument();
  });

  it("refuses a number without its country code", async () => {
    api.get.mockResolvedValue(channels());
    render(<ReachChannels />);

    await userEvent.click(await screen.findByRole("switch", { name: "WhatsApp" }));
    await userEvent.type(screen.getByLabelText("WhatsApp number"), "08012345678");
    await userEvent.click(screen.getByRole("checkbox", { name: /I agree/ }));
    await userEvent.click(screen.getByRole("button", { name: "Turn on WhatsApp" }));

    expect(screen.getByText(/Enter the number with its country code/)).toBeInTheDocument();
    expect(screen.getByLabelText("WhatsApp number")).toHaveAttribute("aria-invalid", "true");
    expect(api.update).not.toHaveBeenCalled();
  });

  it("turns off in one step, and tests when on", async () => {
    const on = channels({ whatsapp: { enabled: true, number: "+2348012345678" } });
    api.get.mockResolvedValue(on);
    api.test.mockResolvedValue({ ok: true, detail: "Sent to +2348012345678." });
    api.update.mockResolvedValue(channels());
    render(<ReachChannels />);

    await userEvent.click(await screen.findByRole("button", { name: "Send me a test" }));
    expect(api.test).toHaveBeenCalledWith("whatsapp");
    expect(await screen.findByText(/Sent to \+2348012345678/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch", { name: "WhatsApp" }));
    expect(api.update).toHaveBeenCalledWith({ whatsapp: { enabled: false } });
  });

  it("shows the server's reason when it refuses", async () => {
    api.get.mockResolvedValue(channels());
    api.update.mockRejectedValue(
      new ApiError("The given data was invalid.", 422, { "whatsapp.number": ["That is not a WhatsApp number."] }),
    );
    render(<ReachChannels />);

    await userEvent.click(await screen.findByRole("switch", { name: "WhatsApp" }));
    await userEvent.type(screen.getByLabelText("WhatsApp number"), "+2348012345678");
    await userEvent.click(screen.getByRole("checkbox", { name: /I agree/ }));
    await userEvent.click(screen.getByRole("button", { name: "Turn on WhatsApp" }));

    expect(await screen.findByText("That is not a WhatsApp number.")).toBeInTheDocument();
  });
});

describe("normaliseE164", () => {
  it("accepts numbers as people write them", () => {
    expect(normaliseE164("+234 801 234-5678")).toBe("+2348012345678");
    expect(normaliseE164("+44 (20) 7946 0958")).toBe("+442079460958");
  });

  it("rejects local numbers and nonsense", () => {
    expect(normaliseE164("08012345678")).toBeNull();
    expect(normaliseE164("+0123456789")).toBeNull();
    expect(normaliseE164("+12")).toBeNull();
  });
});

describe("Email", () => {
  const withEmail = (email: Partial<NonNullable<MyNotificationChannels["email"]>>) => ({
    ...channels(),
    email: { available: true, enabled: false, address: "ada@rexwift.com", ...email },
  });

  it("names the sign-in address and switches on", async () => {
    api.get.mockResolvedValue(withEmail({}));
    api.update.mockResolvedValue(withEmail({ enabled: true }));
    render(<ReachChannels />);

    expect(await screen.findByText("ada@rexwift.com")).toBeInTheDocument();
    expect(screen.getByText(/Send my project alerts to/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: "Email" }));

    expect(api.update).toHaveBeenCalledWith({ email: { enabled: true } });
    expect(await screen.findByRole("switch", { name: "Email" })).toHaveAttribute("aria-checked", "true");
  });

  it("sends a test email and says what happened", async () => {
    api.get.mockResolvedValue(withEmail({ enabled: true }));
    api.test.mockResolvedValue({ ok: true, detail: "Sent to ada@rexwift.com." });
    render(<ReachChannels />);

    await screen.findByText("ada@rexwift.com");
    // Slack and WhatsApp are off here, so this is the email row's button.
    await userEvent.click(screen.getByRole("button", { name: "Send me a test" }));

    expect(api.test).toHaveBeenCalledWith("email");
    expect(await screen.findByText(/Sent to ada@rexwift\.com\./)).toHaveTextContent("Test sent.");
  });

  it("is locked, with the reason, until the organisation switches on a mailbox", async () => {
    api.get.mockResolvedValue(withEmail({ available: false }));
    render(<ReachChannels />);

    const toggle = await screen.findByRole("switch", { name: "Email" });
    expect(toggle).toBeDisabled();
    expect(screen.getByText(/hasn't switched on a mailbox yet/)).toBeInTheDocument();
  });
});
