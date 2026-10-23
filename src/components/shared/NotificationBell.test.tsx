import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationBell, { notificationHref, notificationVisual } from "./NotificationBell";
import type { AppNotification } from "@/lib/api/notifications-client";

/**
 * Projects notifications in the bell: each event reads as what it is (an
 * assignment, a deadline, a sprint), and a click goes to the item it is about.
 */

const hook = vi.hoisted(() => ({
  items: [] as AppNotification[],
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}));

vi.mock("@/lib/api/notifications-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/notifications-client")>();
  return {
    ...actual,
    useNotifications: () => ({
      items: hook.items,
      unread: hook.items.filter((n) => n.unread).length,
      loading: false,
      error: null,
      refresh: vi.fn(),
      markRead: hook.markRead,
      markAllRead: hook.markAllRead,
    }),
  };
});

function note(kind: string, over: Partial<AppNotification> = {}): AppNotification {
  return {
    id: `n-${kind}`,
    kind: kind as AppNotification["kind"],
    title: "Title",
    message: "Message",
    url: null,
    unread: true,
    createdAt: new Date().toISOString(),
    data: {},
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  hook.items = [];
});

describe("notificationVisual", () => {
  it.each([
    ["projects.assigned", "lucide-user-round-plus"],
    ["projects.unassigned", "lucide-user-round-minus"],
    ["projects.due_soon", "lucide-calendar-clock"],
    ["projects.overdue", "lucide-siren"],
    ["projects.sprint_started", "lucide-rocket"],
    ["projects.sprint_closed", "lucide-flag-triangle-right"],
    ["projects.story_complete", "lucide-circle-check-big"],
    ["projects.status_changed", "lucide-arrow-right-left"],
    ["projects.something_new", "lucide-folder-kanban"],
  ])("gives %s its own icon", (kind, cls) => {
    const { icon: Icon } = notificationVisual(kind);
    const { container } = render(<Icon />);
    expect(container.querySelector("svg")).toHaveClass(cls);
  });

  it("tells a step back from a step forward", () => {
    const back = notificationVisual("projects.status_changed", { direction: "back" });
    const done = notificationVisual("projects.status_changed", { direction: "done" });
    const { container: a } = render(<back.icon />);
    const { container: b } = render(<done.icon />);
    expect(a.querySelector("svg")).toHaveClass("lucide-undo-2");
    expect(b.querySelector("svg")).toHaveClass("lucide-circle-check-big");
  });

  it("keeps the existing kinds as they were", () => {
    const { icon: Icon, tone } = notificationVisual("payment_failed");
    const { container } = render(<Icon />);
    expect(container.querySelector("svg")).toHaveClass("lucide-circle-alert");
    expect(tone).toContain("error");
  });
});

it("links a projects notification to its item and marks it read", async () => {
  hook.items = [
    note("projects.assigned", {
      id: "n-1",
      title: "Ada assigned you “Build login endpoint”",
      url: "/suite/projects/hrm-system?item=wi-9",
    }),
  ];
  render(<NotificationBell />);

  await userEvent.click(screen.getByRole("button", { name: "Notifications (1 unread)" }));
  const link = screen.getByRole("link", { name: /Build login endpoint/ });
  expect(link).toHaveAttribute("href", "/suite/projects/hrm-system?item=wi-9");

  await userEvent.click(link);
  expect(hook.markRead).toHaveBeenCalledWith("n-1");
});

describe("the notifications added with batch 3", () => {
  it.each([
    ["projects.member_added", "lucide-users"],
    ["course_assigned", "lucide-graduation-cap"],
    ["learning_path_assigned", "lucide-route"],
    ["hrm.appraisal_launched", "lucide-clipboard-check"],
    ["hrm.self_assessment_due", "lucide-clipboard-pen"],
    ["hrm.review_ready_to_acknowledge", "lucide-signature"],
    ["hrm.calibration_published", "lucide-scale"],
  ])("gives %s its own icon", (kind, cls) => {
    const { icon: Icon } = notificationVisual(kind);
    const { container } = render(<Icon />);
    expect(container.querySelector("svg")).toHaveClass(cls);
  });

  it("keeps a task assignment distinct from joining a project", () => {
    const { icon: Icon } = notificationVisual("projects.assigned");
    const { container } = render(<Icon />);
    expect(container.querySelector("svg")).toHaveClass("lucide-user-round-plus");
  });
});

describe("operations notifications", () => {
  it.each([
    ["operations.gate_pass", "lucide-door-open"],
    ["operations.travel", "lucide-plane"],
    ["operations.client_payments", "lucide-banknote"],
    ["operations.assets", "lucide-package-check"],
    ["operations.stores", "lucide-boxes"],
    ["operations.compliance", "lucide-shield-check"],
    ["operations.facilities", "lucide-building-2"],
    ["operations.service_desk", "lucide-life-buoy"],
    ["operations.something_new", "lucide-briefcase"],
  ])("gives %s its desk's icon", (kind, cls) => {
    const { icon: Icon } = notificationVisual(kind);
    const { container } = render(<Icon />);
    expect(container.querySelector("svg")).toHaveClass(cls);
  });
});

describe("notificationHref", () => {
  const origin = "http://localhost:3000";

  it("keeps a relative url and makes a same-site absolute one relative", () => {
    expect(notificationHref({ url: "/learn/sql", data: {} }, origin)).toBe("/learn/sql");
    expect(
      notificationHref({ url: "http://localhost:3000/suite/projects/acme?item=wi-1#c", data: {} }, origin),
    ).toBe("/suite/projects/acme?item=wi-1#c");
    expect(notificationHref({ url: "https://slack.com/x", data: {} }, origin)).toBe("https://slack.com/x");
  });

  it("derives a link from the payload when there is no url", () => {
    expect(notificationHref({ url: null, data: { courseSlug: "intro-sql" } }, origin)).toBe("/learn/intro-sql");
    expect(notificationHref({ url: null, data: { projectSlug: "acme", workItemId: "wi-9" } }, origin)).toBe(
      "/suite/projects/acme?item=wi-9",
    );
    expect(notificationHref({ url: null, data: { projectSlug: "acme" } }, origin)).toBe("/suite/projects/acme");
    expect(notificationHref({ url: null, data: { reviewId: "r-1" } }, origin)).toBe("/suite/hrm/reviews");
    expect(notificationHref({ url: null, data: {} }, origin)).toBeNull();
  });
});

it("links a member-added notification to its project even without a url", async () => {
  hook.items = [
    note("projects.member_added", {
      id: "n-2",
      title: "You were added to HRM system",
      data: { projectSlug: "hrm-system" },
    }),
  ];
  render(<NotificationBell />);

  await userEvent.click(screen.getByRole("button", { name: "Notifications (1 unread)" }));
  expect(screen.getByRole("link", { name: /added to HRM system/ })).toHaveAttribute("href", "/suite/projects/hrm-system");
});
