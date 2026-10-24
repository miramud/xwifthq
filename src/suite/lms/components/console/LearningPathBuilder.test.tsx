import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LearningPathBuilder from "./LearningPathBuilder";
import type { LearningPath } from "@/lib/api/saas-client";

/**
 * The builder's whole contract is the payload it sends: which courses, in what
 * order, and which of them are required. Order is the information a path
 * carries (a track whose steps arrive shuffled is worse than no track), so
 * that is what these pin down.
 */

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const createPath = vi.fn(async (body: unknown) => ({ ...(body as object), slug: "new-path" }));
const updatePath = vi.fn(async (_slug: string, body: unknown) => ({
  ...(body as object),
  slug: "existing-path",
}));

vi.mock("@/lib/api/saas-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/saas-client")>();

  return {
    ...actual,
    learningPaths: {
      create: (body: unknown) => createPath(body),
      update: (slug: string, body: unknown) => updatePath(slug, body),
    },
  };
});

vi.mock("@/lib/api/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin-client")>();

  return {
    ...actual,
    courses: {
      list: async () => [
        { slug: "alpha", title: "Alpha Course", lectures: 4, status: "Published", gradient: null, thumbnailUrl: null },
        { slug: "beta", title: "Beta Course", lectures: 6, status: "Published", gradient: null, thumbnailUrl: null },
        { slug: "gamma", title: "Gamma Course", lectures: 2, status: "Draft", gradient: null, thumbnailUrl: null },
      ],
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

/** Opens the picker, whichever affordance is currently showing. */
async function openPicker() {
  await userEvent.click(
    screen.queryByRole("button", { name: /add another course/i }) ??
      screen.getByRole("button", { name: /^add courses$/i }),
  );

  return screen.findByRole("dialog");
}

/**
 * Adds a course the way an admin would.
 *
 * Scoped to the picker dialog on purpose: once a course is on the path it also
 * has "Move Alpha Course up/down" buttons, so an unscoped query by title
 * matches three elements.
 */
async function addCourse(title: string) {
  const picker = await openPicker();

  await userEvent.click(within(picker).getByRole("button", { name: new RegExp(title, "i") }));
}

describe("LearningPathBuilder: composing a path", () => {
  it("refuses to save without a title", async () => {
    render(<LearningPathBuilder />);

    expect(screen.getByRole("button", { name: /create path/i })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/^title/i), "Onboarding");

    expect(screen.getByRole("button", { name: /create path/i })).toBeEnabled();
  });

  it("adds courses and keeps them in the order they were added", async () => {
    render(<LearningPathBuilder />);

    await userEvent.type(screen.getByLabelText(/^title/i), "Onboarding");
    await addCourse("Beta Course");
    await addCourse("Alpha Course");

    await userEvent.click(screen.getByRole("button", { name: /create path/i }));

    expect(createPath).toHaveBeenCalledWith(
      expect.objectContaining({ courseSlugs: ["beta", "alpha"] }),
    );
  });

  it("does not offer a course that is already on the path", async () => {
    render(<LearningPathBuilder />);

    await addCourse("Alpha Course");

    const picker = await openPicker();

    expect(within(picker).queryByRole("button", { name: /alpha course/i })).not.toBeInTheDocument();
    expect(within(picker).getByRole("button", { name: /beta course/i })).toBeInTheDocument();
  });

  it("removes a course from the path", async () => {
    render(<LearningPathBuilder />);

    await userEvent.type(screen.getByLabelText(/^title/i), "Onboarding");
    await addCourse("Alpha Course");
    await addCourse("Beta Course");

    await userEvent.click(
      screen.getByRole("button", { name: /remove alpha course from this path/i }),
    );

    await userEvent.click(screen.getByRole("button", { name: /create path/i }));

    expect(createPath).toHaveBeenCalledWith(
      expect.objectContaining({ courseSlugs: ["beta"] }),
    );
  });
});

describe("LearningPathBuilder: ordering", () => {
  it("moves a course up, and sends the new order", async () => {
    render(<LearningPathBuilder />);

    await userEvent.type(screen.getByLabelText(/^title/i), "Onboarding");
    await addCourse("Alpha Course");
    await addCourse("Beta Course");

    await userEvent.click(screen.getByRole("button", { name: /move beta course up/i }));
    await userEvent.click(screen.getByRole("button", { name: /create path/i }));

    expect(createPath).toHaveBeenCalledWith(
      expect.objectContaining({ courseSlugs: ["beta", "alpha"] }),
    );
  });

  it("moves a course down", async () => {
    render(<LearningPathBuilder />);

    await userEvent.type(screen.getByLabelText(/^title/i), "Onboarding");
    await addCourse("Alpha Course");
    await addCourse("Beta Course");

    await userEvent.click(screen.getByRole("button", { name: /move alpha course down/i }));
    await userEvent.click(screen.getByRole("button", { name: /create path/i }));

    expect(createPath).toHaveBeenCalledWith(
      expect.objectContaining({ courseSlugs: ["beta", "alpha"] }),
    );
  });

  /** The ends of the list have nowhere to go: the controls say so. */
  it("disables the move controls at the ends of the list", async () => {
    render(<LearningPathBuilder />);

    await addCourse("Alpha Course");
    await addCourse("Beta Course");

    expect(screen.getByRole("button", { name: /move alpha course up/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /move beta course down/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /move alpha course down/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /move beta course up/i })).toBeEnabled();
  });

  /** Reordering is keyboard-operable, which drag-and-drop would not be. */
  it("can be reordered from the keyboard", async () => {
    render(<LearningPathBuilder />);

    await userEvent.type(screen.getByLabelText(/^title/i), "Onboarding");
    await addCourse("Alpha Course");
    await addCourse("Beta Course");

    screen.getByRole("button", { name: /move beta course up/i }).focus();
    await userEvent.keyboard("{Enter}");

    await userEvent.click(screen.getByRole("button", { name: /create path/i }));

    expect(createPath).toHaveBeenCalledWith(
      expect.objectContaining({ courseSlugs: ["beta", "alpha"] }),
    );
  });
});

describe("LearningPathBuilder: required vs optional", () => {
  it("marks everything required by default", async () => {
    render(<LearningPathBuilder />);

    await userEvent.type(screen.getByLabelText(/^title/i), "Onboarding");
    await addCourse("Alpha Course");
    await addCourse("Beta Course");

    await userEvent.click(screen.getByRole("button", { name: /create path/i }));

    expect(createPath).toHaveBeenCalledWith(
      expect.objectContaining({ requiredSlugs: ["alpha", "beta"] }),
    );
  });

  /**
   * Only required courses count towards the completion figure the learner is
   * shown, so an optional one has to actually reach the API as optional.
   */
  it("sends only the required subset when one is unticked", async () => {
    render(<LearningPathBuilder />);

    await userEvent.type(screen.getByLabelText(/^title/i), "Onboarding");
    await addCourse("Alpha Course");
    await addCourse("Beta Course");

    await userEvent.click(screen.getAllByRole("checkbox", { name: /required/i })[1]);
    await userEvent.click(screen.getByRole("button", { name: /create path/i }));

    expect(createPath).toHaveBeenCalledWith(
      expect.objectContaining({ courseSlugs: ["alpha", "beta"], requiredSlugs: ["alpha"] }),
    );
  });
});

describe("LearningPathBuilder: status", () => {
  it("starts as a draft", async () => {
    render(<LearningPathBuilder />);

    await userEvent.type(screen.getByLabelText(/^title/i), "Onboarding");
    await userEvent.click(screen.getByRole("button", { name: /create path/i }));

    expect(createPath).toHaveBeenCalledWith(expect.objectContaining({ status: "draft" }));
  });

  it("can be published on creation", async () => {
    render(<LearningPathBuilder />);

    await userEvent.type(screen.getByLabelText(/^title/i), "Onboarding");
    await userEvent.click(screen.getByRole("radio", { name: /published/i }));
    await userEvent.click(screen.getByRole("button", { name: /create path/i }));

    expect(createPath).toHaveBeenCalledWith(expect.objectContaining({ status: "published" }));
  });
});

describe("LearningPathBuilder: editing an existing path", () => {
  const existing: LearningPath = {
    slug: "existing-path",
    title: "Existing Track",
    description: "Already here",
    gradient: null,
    status: "published",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    courses: [
      {
        slug: "alpha",
        title: "Alpha Course",
        gradient: null,
        thumbnailUrl: null,
        totalLectures: 4,
        duration: null,
        position: 0,
        isRequired: true,
      },
    ],
  };

  it("loads the existing title, status and courses", () => {
    render(<LearningPathBuilder existing={existing} />);

    expect(screen.getByLabelText(/^title/i)).toHaveValue("Existing Track");
    expect(screen.getByRole("radio", { name: /published/i })).toBeChecked();
    expect(screen.getByText("Alpha Course")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });

  it("updates rather than creating", async () => {
    render(<LearningPathBuilder existing={existing} />);

    await addCourse("Beta Course");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(createPath).not.toHaveBeenCalled();
    expect(updatePath).toHaveBeenCalledWith(
      "existing-path",
      expect.objectContaining({ courseSlugs: ["alpha", "beta"] }),
    );
  });
});
