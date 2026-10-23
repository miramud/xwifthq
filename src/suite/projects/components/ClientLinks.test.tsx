import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClientLinks from "./ClientLinks";
import type { Project, ProjectShare } from "@/lib/api/projects-client";

/**
 * Making and revoking client links.
 *
 * Two things carry most of the weight here. **The token is shown once**, so
 * the screen has to say so unmistakably — somebody who closes the panel
 * assuming they can come back for it has lost the link. And **what the link
 * carries is listed before one is made**, because a person about to email a
 * URL to a client should not have to open it themselves to find out what is on
 * it.
 */

const { forProject, create, revoke } = vi.hoisted(() => ({
  forProject: vi.fn(),
  create: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return { ...actual, shares: { forProject, create, revoke } };
});

/* The links are a DataView, which reads the router. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/projects/acme-rebuild",
  useSearchParams: () => new URLSearchParams(),
}));

const PROJECT = { slug: "acme-rebuild", name: "Acme Rebuild" } as unknown as Project;

function share(over: Partial<ProjectShare> = {}): ProjectShare {
  return {
    id: "sh-1",
    label: "Acme, Tolu",
    hint: "a1b2c3",
    expiresOn: "2027-02-03",
    isLive: true,
    deadReason: null,
    daysLeft: 12,
    viewCount: 0,
    lastViewedAt: null,
    createdBy: "Ada Lead",
    createdOn: "2027-01-04",
    ...over,
  };
}

function listing(rows: ProjectShare[] = []) {
  return {
    data: rows,
    meta: {
      defaultDays: 30,
      maxDays: 90,
      shows: ["Status, start date and the date you promised", "Milestones, and which are done"],
      hides: ["Cost, rates and margin", "The critical path and how much slack anything has"],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ClientLinks", () => {
  it("says plainly when nobody outside can see the project", async () => {
    forProject.mockResolvedValue(listing());

    render(<ClientLinks project={PROJECT} />);

    expect(
      await screen.findByText("No live links — nobody outside can see this project"),
    ).toBeInTheDocument();
  });

  /**
   * **Before, not after.** The lists come from the server so the warning
   * cannot drift from what the payload actually contains.
   */
  it("lists what the link carries before one is made", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(listing());

    render(<ClientLinks project={PROJECT} />);

    await user.click(await screen.findByRole("button", { name: "New link" }));

    expect(screen.getByText("They will see")).toBeInTheDocument();
    expect(screen.getByText("They will not see")).toBeInTheDocument();
    expect(screen.getByText(/Cost, rates and margin/)).toBeInTheDocument();
    expect(screen.getByText(/how much slack anything has/)).toBeInTheDocument();
  });

  /** **The one sight of the token**, and the screen says so. */
  it("shows the full link once and warns that it will not return", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(listing());
    create.mockResolvedValue({
      data: share(),
      meta: { token: "f".repeat(64), shownOnce: true },
    });

    render(<ClientLinks project={PROJECT} />);

    await user.click(await screen.findByRole("button", { name: "New link" }));
    await user.type(screen.getByLabelText("Who is it for?"), "Acme, Tolu");
    await user.click(screen.getByRole("button", { name: "Make the link" }));

    const field = await screen.findByLabelText("The client link");

    expect((field as HTMLInputElement).value).toContain("f".repeat(64));
    expect((field as HTMLInputElement).value).toContain("/shared/");
    expect(screen.getByText(/only time it can be shown/)).toBeInTheDocument();
  });

  it("sends the label and the chosen lifetime", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(listing());
    create.mockResolvedValue({
      data: share(),
      meta: { token: "a".repeat(64), shownOnce: true },
    });

    render(<ClientLinks project={PROJECT} />);

    await user.click(await screen.findByRole("button", { name: "New link" }));
    await user.type(screen.getByLabelText("Who is it for?"), "Acme, Tolu");
    await user.type(screen.getByLabelText("Lasts for"), "14");
    await user.click(screen.getByRole("button", { name: "Make the link" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith("acme-rebuild", { label: "Acme, Tolu", days: 14 }),
    );
  });

  it("will not make a link without saying who it is for", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(listing());

    render(<ClientLinks project={PROJECT} />);

    await user.click(await screen.findByRole("button", { name: "New link" }));

    expect(screen.getByRole("button", { name: "Make the link" })).toBeDisabled();
  });

  /** Different causes, different remedies — so never one "inactive" badge. */
  it("tells a revoked link apart from an expired one", async () => {
    forProject.mockResolvedValue(
      listing([
        share({ id: "a", label: "Revoked one", isLive: false, deadReason: "revoked" }),
        share({ id: "b", label: "Expired one", isLive: false, deadReason: "expired" }),
      ]),
    );

    render(<ClientLinks project={PROJECT} />);

    expect(await screen.findByText("Revoked")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("shows how long a live link has left", async () => {
    forProject.mockResolvedValue(listing([share({ daysLeft: 1 })]));

    render(<ClientLinks project={PROJECT} />);

    expect(await screen.findByText("Live · 1 day left")).toBeInTheDocument();
  });

  /**
   * A link made three weeks ago and never opened is either the wrong address
   * or a client nobody told.
   */
  it("says when a link has never been opened", async () => {
    forProject.mockResolvedValue(listing([share({ viewCount: 0 })]));

    render(<ClientLinks project={PROJECT} />);

    expect(await screen.findByText("Never opened")).toBeInTheDocument();
  });

  it("says when it was last opened", async () => {
    forProject.mockResolvedValue(
      listing([share({ viewCount: 3, lastViewedAt: "2027-01-20" })]),
    );

    render(<ClientLinks project={PROJECT} />);

    expect(await screen.findByText(/Opened 3 times, last on 2027-01-20/)).toBeInTheDocument();
  });

  it("confirms before revoking", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(listing([share()]));
    revoke.mockResolvedValue(share({ isLive: false, deadReason: "revoked" }));

    render(<ClientLinks project={PROJECT} />);

    await user.click(
      await screen.findByRole("button", { name: "Revoke the link for Acme, Tolu" }),
    );

    expect(revoke).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Revoke it" }));

    await waitFor(() => expect(revoke).toHaveBeenCalledWith("acme-rebuild", "sh-1"));
  });

  it("offers no revoke on a link that is already dead", async () => {
    forProject.mockResolvedValue(
      listing([share({ isLive: false, deadReason: "expired" })]),
    );

    render(<ClientLinks project={PROJECT} />);

    await screen.findByText("Expired");

    expect(
      screen.queryByRole("button", { name: "Revoke the link for Acme, Tolu" }),
    ).not.toBeInTheDocument();
  });

  /** Only the hint is ever in the list — never the token. */
  it("shows only the hint against an existing link", async () => {
    forProject.mockResolvedValue(listing([share({ hint: "a1b2c3" })]));

    render(<ClientLinks project={PROJECT} />);

    expect(await screen.findByText("…a1b2c3")).toBeInTheDocument();
  });

  it("shows the server's refusal rather than a generic one", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(listing());

    const { ApiError } = await import("@/lib/api/admin-client");

    create.mockRejectedValue(
      new ApiError("The given data was invalid.", 422, {
        days: ["A link cannot last longer than 90 days."],
      }),
    );

    render(<ClientLinks project={PROJECT} />);

    await user.click(await screen.findByRole("button", { name: "New link" }));
    await user.type(screen.getByLabelText("Who is it for?"), "Acme");
    await user.click(screen.getByRole("button", { name: "Make the link" }));

    expect(
      await screen.findByText("A link cannot last longer than 90 days."),
    ).toBeInTheDocument();
  });
});
