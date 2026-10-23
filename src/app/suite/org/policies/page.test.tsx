import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PoliciesPage from "./page";

/**
 * The institution policies screen.
 *
 * The thing worth testing is the third state. "Follow platform" has to be
 * distinguishable from "off" everywhere it matters: in what the control shows,
 * in the sentence under it, and — the one that actually costs something if it
 * is wrong — in what gets sent to the API, where `null` clears the answer and
 * `false` locks the institution out of every future platform change.
 */

let currentUser: Record<string, unknown> | null = {
  role: "admin",
  name: "Admin",
  organisationId: "org-1",
};

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: currentUser, loading: false, refresh: vi.fn() }),
  AuthError: class extends Error {},
}));

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<unknown>>();

/** Both policies, each following the platform, with approval off by default. */
function inherited() {
  return [
    {
      key: "require_course_approval",
      label: "Require admin approval before a course goes live",
      effect: "Your instructors submit a course for review instead of publishing it themselves.",
      value: false,
      source: "platform",
      platformDefault: false,
    },
    {
      key: "require_review_approval",
      label: "Hold new learner reviews for moderation",
      effect: "A review starts as pending and stays invisible until an admin publishes it.",
      value: false,
      source: "platform",
      platformDefault: false,
    },
  ];
}

function respondWith(policies: unknown) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ data: { policies } }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { role: "admin", name: "Admin", organisationId: "org-1" };
  respondWith(inherited());
  vi.stubGlobal("fetch", fetchMock);
});

describe("PoliciesPage — access", () => {
  it("sends the platform owner to Settings instead of loading policies", () => {
    currentUser = { role: "super_admin", name: "Owner", organisationId: null };

    render(<PoliciesPage />);

    expect(screen.getByText(/policies belong to an institution/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("PoliciesPage — the inherited state", () => {
  it("shows an unanswered policy as following the platform, not as off", async () => {
    render(<PoliciesPage />);

    const group = await screen.findByRole("group", {
      name: /require admin approval before a course goes live/i,
    });

    expect(within(group).getByRole("radio", { name: "Follow platform" })).toBeChecked();
    expect(within(group).getByRole("radio", { name: "Not required" })).not.toBeChecked();
  });

  it("says what the platform currently does, so 'follow' is not a blank cheque", async () => {
    respondWith([{ ...inherited()[0], value: true, platformDefault: true }]);

    render(<PoliciesPage />);

    expect(
      await screen.findByText(/following the platform, which currently has this required/i),
    ).toBeInTheDocument();
  });

  it("names the override when an institution disagrees with the platform", async () => {
    respondWith([
      { ...inherited()[0], value: false, source: "organisation", platformDefault: true },
    ]);

    render(<PoliciesPage />);

    expect(
      await screen.findByText(/overriding the platform default of required/i),
    ).toBeInTheDocument();
  });
});

describe("PoliciesPage — saving", () => {
  it("sends only the policy that moved", async () => {
    const user = userEvent.setup();
    render(<PoliciesPage />);

    const group = await screen.findByRole("group", {
      name: /require admin approval before a course goes live/i,
    });

    await user.click(within(group).getByRole("radio", { name: "Required" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const [, init] = fetchMock.mock.calls[1];
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ require_course_approval: true });
  });

  /** The reason the column is nullable — `false` here would be a different bug. */
  it("clears an answer with null rather than false", async () => {
    respondWith([{ ...inherited()[0], value: true, source: "organisation" }]);

    const user = userEvent.setup();
    render(<PoliciesPage />);

    const group = await screen.findByRole("group", {
      name: /require admin approval before a course goes live/i,
    });

    await user.click(within(group).getByRole("radio", { name: "Follow platform" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const [, init] = fetchMock.mock.calls[1];
    expect(JSON.parse(String(init?.body))).toEqual({ require_course_approval: null });
  });

  it("keeps Save unavailable until something changes", async () => {
    const user = userEvent.setup();
    render(<PoliciesPage />);

    await screen.findByRole("group", {
      name: /require admin approval before a course goes live/i,
    });

    const save = screen.getByRole("button", { name: /save changes/i });
    expect(save).toBeDisabled();

    const group = screen.getByRole("group", {
      name: /hold new learner reviews for moderation/i,
    });
    await user.click(within(group).getByRole("radio", { name: "Required" }));
    expect(save).toBeEnabled();

    // Choosing the original answer again is not a change.
    await user.click(within(group).getByRole("radio", { name: "Follow platform" }));
    expect(save).toBeDisabled();
  });

  it("reports a failed save without dropping what the admin chose", async () => {
    const user = userEvent.setup();
    render(<PoliciesPage />);

    const group = await screen.findByRole("group", {
      name: /require admin approval before a course goes live/i,
    });
    await user.click(within(group).getByRole("radio", { name: "Required" }));

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: "You cannot change that." }),
    });

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("You cannot change that.")).toBeInTheDocument();
    expect(within(group).getByRole("radio", { name: "Required" })).toBeChecked();
  });
});
