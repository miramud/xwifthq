import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectSettingsDialog, { normaliseSlackChannel } from "./ProjectSettingsDialog";
import type { Project } from "@/lib/api/projects-client";
import { chooseOption } from "@/test/selectOption";

/**
 * The project settings dialog, and the Slack channel that used to live in it.
 * The channel moved to the project's Notifications tab (ProjectChannels).
 */

const api = vi.hoisted(() => ({ update: vi.fn(), remove: vi.fn() }));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();
  return { ...actual, projects: { ...actual.projects, update: api.update, remove: api.remove } };
});

const PROJECT = {
  id: "p-1",
  slug: "hrm-system",
  code: "HRM",
  name: "HRM system",
  description: null,
  type: "internal",
  status: "active",
  startsOn: null,
  targetEndsOn: null,
  portfolio: null,
  externalCompanyId: null,
  slackChannel: null,
  can: { update: true, delete: false },
} as unknown as Project;

function open(project: Project = PROJECT) {
  const onSaved = vi.fn();
  render(
    <ProjectSettingsDialog
      project={project}
      portfolios={[]}
      companies={[]}
      onClose={vi.fn()}
      onSaved={onSaved}
      onDeleted={vi.fn()}
    />,
  );
  return { onSaved };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.update.mockResolvedValue({});
});

describe("Slack channel for team updates", () => {
  it("lives on the Notifications tab now, and saving settings leaves it alone", async () => {
    const { onSaved } = open({ ...PROJECT, slackChannel: "#hrm-delivery" } as Project);

    expect(screen.queryByLabelText("Slack channel for team updates")).not.toBeInTheDocument();
    expect(screen.getByText(/set on its Notifications tab/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    // Not sent at all, so a settings save can never clear the channel.
    expect(api.update).toHaveBeenCalledWith("hrm-system", expect.not.objectContaining({ slackChannel: expect.anything() }));
    expect(api.update.mock.calls[0][1]).not.toHaveProperty("slackChannel");
    expect(onSaved).toHaveBeenCalled();
  });
});

describe("normaliseSlackChannel", () => {
  it("writes a name the way Slack takes it", () => {
    expect(normaliseSlackChannel("hrm-delivery")).toBe("#hrm-delivery");
    expect(normaliseSlackChannel(" #HRM-Delivery ")).toBe("#hrm-delivery");
  });

  it("leaves a private channel's id alone, and blank as none", () => {
    expect(normaliseSlackChannel("C0123ABCD")).toBe("C0123ABCD");
    expect(normaliseSlackChannel("  ")).toBeNull();
  });
});

/* P16: type and currency change only until time or rates exist. */
describe("Type and currency", () => {
  it("can be changed while nothing has been recorded", async () => {
    open({ ...PROJECT, currency: "NGN", typeAndCurrencyLock: null } as Project);

    await chooseOption(userEvent.setup(), screen.getByLabelText("Currency"), "$ US dollar");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(api.update).toHaveBeenCalledWith("hrm-system", expect.objectContaining({ currency: "USD", type: "internal" }));
  });

  it("is fixed with the reason once time is logged, and never sent", async () => {
    open({
      ...PROJECT,
      currency: "NGN",
      typeAndCurrencyLock: "Time has been logged on this project, so its type and currency are fixed.",
    } as Project);

    expect(screen.queryByLabelText("Currency")).not.toBeInTheDocument();
    expect(screen.getByText(/Time has been logged on this project/)).toBeInTheDocument();
    expect(screen.getByText(/₦ Naira/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(api.update.mock.calls[0][1]).not.toHaveProperty("currency");
    expect(api.update.mock.calls[0][1]).not.toHaveProperty("type");
  });
});
