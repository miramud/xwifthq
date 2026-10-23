import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectChannels from "./ProjectChannels";
import { ApiError } from "@/lib/api/admin-client";
import type { Project } from "@/lib/api/projects-client";

/**
 * Where a project's team updates are posted: its own Slack channel and
 * WhatsApp group, or — left blank — the organisation's defaults, which the
 * panel names so that "blank" never reads as "nowhere".
 */

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));

vi.mock("@/lib/api/project-channels-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/project-channels-client")>();
  return { ...actual, projectChannels: api };
});

const PROJECT = { slug: "hrm-system", name: "HRM system" } as unknown as Project;

beforeEach(() => {
  vi.clearAllMocks();
});

it("names the organisation's defaults a blank field falls back to", async () => {
  api.get.mockResolvedValue({
    slackChannel: null,
    whatsappGroup: null,
    events: [],
    defaults: { slackChannel: "#delivery", whatsappGroup: "Delivery team" },
  });
  render(<ProjectChannels project={PROJECT} />);

  expect(await screen.findByLabelText("Slack channel")).toHaveAccessibleDescription(
    /default channel, #delivery/,
  );
  expect(screen.getByLabelText("WhatsApp group")).toHaveAccessibleDescription(/default group, Delivery team/);
});

it("still explains the fallback when the API doesn't say what the defaults are", async () => {
  api.get.mockResolvedValue({ slackChannel: null, whatsappGroup: null, events: [] });
  render(<ProjectChannels project={PROJECT} />);

  expect(await screen.findByLabelText("Slack channel")).toHaveAccessibleDescription(
    /Left blank, updates go to your organisation's default channel\./,
  );
});

it("saves the channel as Slack takes it, the group, and the chosen events", async () => {
  api.get.mockResolvedValue({ slackChannel: null, whatsappGroup: null, events: ["sprint_started"] });
  api.save.mockImplementation(async (_slug: string, body: unknown) => body);
  render(<ProjectChannels project={PROJECT} />);

  await userEvent.type(await screen.findByLabelText("Slack channel"), " HRM-Delivery ");
  await userEvent.type(screen.getByLabelText("WhatsApp group"), "  120363-hrm ");
  await userEvent.click(screen.getByRole("checkbox", { name: /Someone joins the project/ }));
  await userEvent.click(screen.getByRole("checkbox", { name: /A task or story is assigned/ }));
  await userEvent.click(screen.getByRole("checkbox", { name: /A sprint starts/ }));
  await userEvent.click(screen.getByRole("button", { name: "Save channels" }));

  expect(api.save).toHaveBeenCalledWith("hrm-system", {
    slackChannel: "#hrm-delivery",
    whatsappGroup: "120363-hrm",
    events: ["member_added", "item_assigned"],
  });
  expect(await screen.findByText(/Saved\. New updates will be posted here\./)).toBeInTheDocument();
});

it("sends blank fields as null, so the defaults apply", async () => {
  api.get.mockResolvedValue({ slackChannel: "#old", whatsappGroup: "old-group", events: [] });
  api.save.mockImplementation(async (_slug: string, body: unknown) => body);
  render(<ProjectChannels project={PROJECT} />);

  await userEvent.clear(await screen.findByLabelText("Slack channel"));
  await userEvent.clear(screen.getByLabelText("WhatsApp group"));
  await userEvent.click(screen.getByRole("button", { name: "Save channels" }));

  expect(api.save).toHaveBeenCalledWith("hrm-system", { slackChannel: null, whatsappGroup: null, events: [] });
});

it("shows a refusal under the field it is about", async () => {
  api.get.mockResolvedValue({ slackChannel: null, whatsappGroup: null, events: [] });
  api.save.mockRejectedValue(
    new ApiError("The given data was invalid.", 422, { slackChannel: ["The Slack app isn't in that channel."] }),
  );
  render(<ProjectChannels project={PROJECT} />);

  await userEvent.type(await screen.findByLabelText("Slack channel"), "secret-room");
  await userEvent.click(screen.getByRole("button", { name: "Save channels" }));

  expect(await screen.findByText("The Slack app isn't in that channel.")).toBeInTheDocument();
});

describe("when the settings don't load", () => {
  it("says so and offers to try again", async () => {
    api.get.mockRejectedValueOnce(new ApiError("Server error", 500));
    api.get.mockResolvedValueOnce({ slackChannel: null, whatsappGroup: null, events: [] });
    render(<ProjectChannels project={PROJECT} />);

    expect(await screen.findByText("Channel settings didn't load")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByLabelText("Slack channel")).toBeInTheDocument();
  });
});

describe("team email", () => {
  it("is locked, with the reason and where to connect a mailbox, until one is switched on", async () => {
    api.get.mockResolvedValue({ slackChannel: null, whatsappGroup: null, events: [], emailConnected: false });
    api.save.mockImplementation(async (_slug: string, body: unknown) => body);
    render(<ProjectChannels project={PROJECT} />);

    const box = await screen.findByLabelText("Team email");
    expect(box).toBeDisabled();
    expect(box).toHaveAccessibleDescription(/hasn't switched on a mailbox/);
    // Projects' own Integrations page, which delivery leads can open too.
    expect(screen.getAllByRole("link", { name: "Integrations" }).map((l) => l.getAttribute("href"))).toContain(
      "/suite/projects/integrations",
    );
    // Including the footer: the org console is admin-only (P15).
    expect(
      screen.getAllByRole("link", { name: "Integrations" }).map((l) => l.getAttribute("href")),
    ).not.toContain("/suite/org/integrations");

    // A locked list is never sent, so saving can't wipe one kept from before.
    await userEvent.click(screen.getByRole("button", { name: "Save channels" }));
    expect(api.save).toHaveBeenCalledWith("hrm-system", { slackChannel: null, whatsappGroup: null, events: [] });
  });

  it("names the sending mailbox and the default list, and saves the addresses", async () => {
    api.get.mockResolvedValue({
      slackChannel: null,
      whatsappGroup: null,
      events: [],
      emailList: null,
      emailConnected: true,
      emailProvider: "zoho_mail",
      defaults: { emailList: "delivery@rexwift.com" },
    });
    api.save.mockImplementation(async (_slug: string, body: object) => ({ ...body, emailConnected: true }));
    render(<ProjectChannels project={PROJECT} />);

    const box = await screen.findByLabelText("Team email");
    expect(screen.getByText("Sent from Zoho Mail")).toBeInTheDocument();
    expect(box).toHaveAttribute("placeholder", "delivery@rexwift.com");
    expect(box).toHaveAccessibleDescription(/default list, delivery@rexwift\.com/);

    await userEvent.type(box, "ada@rexwift.com{enter}client@acme.com, ada@rexwift.com");
    expect(screen.getByText("2 of 10 addresses.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save channels" }));

    expect(api.save).toHaveBeenCalledWith("hrm-system", {
      slackChannel: null,
      whatsappGroup: null,
      emailList: "ada@rexwift.com, client@acme.com",
      events: [],
    });
  });

  it("shows the server's refusal under the list", async () => {
    api.get.mockResolvedValue({ slackChannel: null, whatsappGroup: null, events: [], emailConnected: true, emailProvider: "gmail" });
    api.save.mockRejectedValue(
      new ApiError("The given data was invalid.", 422, { emailList: ["“ada@” is not a valid email address."] }),
    );
    render(<ProjectChannels project={PROJECT} />);

    await userEvent.type(await screen.findByLabelText("Team email"), "ada@");
    await userEvent.click(screen.getByRole("button", { name: "Save channels" }));

    expect(await screen.findByText("“ada@” is not a valid email address.")).toBeInTheDocument();
    expect(screen.getByLabelText("Team email")).toHaveAttribute("aria-invalid", "true");
  });
});
