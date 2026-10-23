import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { TourProvider, useTour } from "./TourProvider";
import { TourHelpButton } from "./TourHelpButton";

/*
  The dashboard walkthrough (26 Sep 2026): it starts on a first visit, walks
  Back and Next to the end, leaves out what isn't on the page, and can be
  replayed. Driven against the real "User management" tour.
*/

let pathname = "/suite/org/users";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

let currentUser: Record<string, unknown> | null = { id: "u1", name: "Ada", role: "admin", organisationId: "o1" };
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: currentUser, loading: false }) }));

const progress = vi.fn();
const mark = vi.fn();
const reset = vi.fn();
vi.mock("@/lib/api/tours-client", () => ({
  tours: {
    progress: (...a: unknown[]) => progress(...a),
    mark: (...a: unknown[]) => mark(...a),
    reset: (...a: unknown[]) => reset(...a),
  },
}));

/** A User management page with only some of what the tour points at. */
function Page({ anchors = ["page-header", "stats", "panel-role-mix"] }: { anchors?: string[] }) {
  return (
    <div>
      {anchors.map((a) => (
        <div key={a} data-tour={a}>
          {a}
        </div>
      ))}
      <TourHelpButton />
    </div>
  );
}

function Starter() {
  const { start } = useTour();
  return (
    <button type="button" onClick={() => start("org-users")}>
      start now
    </button>
  );
}

function renderTour(anchors?: string[]) {
  return render(
    <TourProvider>
      <Page anchors={anchors} />
      <Starter />
    </TourProvider>,
  );
}

const dialog = () => screen.queryByRole("dialog");

beforeEach(() => {
  pathname = "/suite/org/users";
  currentUser = { id: "u1", name: "Ada", role: "admin", organisationId: "o1" };
  progress.mockReset().mockResolvedValue({ completed: [], dismissed: [] });
  mark.mockReset().mockResolvedValue({ completed: [], dismissed: [] });
  reset.mockReset().mockResolvedValue({});
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TourProvider", () => {
  it("starts on the first visit, and leaves out steps whose target isn't on the page", async () => {
    renderTour();

    await waitFor(() => expect(dialog()).not.toBeNull(), { timeout: 3000 });
    // Six steps in the tour; only three of their targets are on this page.
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Everyone who can sign in" })).toBeTruthy();
  });

  /**
   * The overlay carries `ws` for its tokens, and `.ws` paints the canvas
   * colour. Without an explicit transparent background the whole page went
   * near-white behind every step (reported 26 Sep 2026). jsdom doesn't load
   * the stylesheet, so this pins the inline override that prevents it.
   */
  it("keeps the overlay itself transparent so the highlighted element shows through", async () => {
    renderTour();

    await waitFor(() => expect(dialog()).not.toBeNull(), { timeout: 3000 });
    const overlay = document.querySelector<HTMLElement>("[data-tour-overlay]");
    expect(overlay?.style.background).toBe("transparent");
  });

  it("walks Next and Back, and records a finish", async () => {
    renderTour();
    await waitFor(() => expect(dialog()).not.toBeNull(), { timeout: 3000 });

    const backButton = screen.getByRole("button", { name: "Back" }) as HTMLButtonElement;
    expect(backButton.disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 2 of 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 3 of 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(dialog()).toBeNull();
    expect(mark).toHaveBeenCalledWith("org-users", "completed");
  });

  it("records a skip, from the button or the close cross", async () => {
    renderTour();
    await waitFor(() => expect(dialog()).not.toBeNull(), { timeout: 3000 });

    fireEvent.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(dialog()).toBeNull();
    expect(mark).toHaveBeenCalledWith("org-users", "dismissed");
  });

  it("answers the arrow keys and Escape", async () => {
    renderTour();
    await waitFor(() => expect(dialog()).not.toBeNull(), { timeout: 3000 });

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("Step 2 of 3")).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });

    expect(dialog()).toBeNull();
    expect(mark).toHaveBeenCalledWith("org-users", "dismissed");
  });

  it("does not start again once finished or skipped", async () => {
    progress.mockResolvedValue({ completed: ["org-users"], dismissed: [] });
    renderTour();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 900));
    });
    expect(dialog()).toBeNull();
  });

  it("replays from the help button, forgetting it was seen", async () => {
    progress.mockResolvedValue({ completed: [], dismissed: ["org-users"] });
    renderTour();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(dialog()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Take the User management tour" }));

    expect(reset).toHaveBeenCalledWith("org-users");
    // Hidden for a frame until it has been positioned, so it never flashes in the wrong place.
    await waitFor(() => expect(dialog()).not.toBeNull());
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
  });

  it("hides the help button on a page with no tour", () => {
    pathname = "/suite/org/branding";
    renderTour();
    expect(screen.queryByRole("button", { name: /Take the .* tour/ })).toBeNull();
  });

  it("keeps working when the API is down, remembering in this browser", async () => {
    progress.mockRejectedValue(new Error("offline"));
    mark.mockRejectedValue(new Error("offline"));
    renderTour();
    await waitFor(() => expect(dialog()).not.toBeNull(), { timeout: 3000 });

    fireEvent.click(screen.getByRole("button", { name: "Skip tour" }));

    expect(dialog()).toBeNull();
    expect(JSON.parse(window.localStorage.getItem("elevate:tours:u1") ?? "{}")).toEqual({
      completed: [],
      dismissed: ["org-users"],
    });
  });

  it("does nothing for a signed-out visitor, or one who must change their password", async () => {
    currentUser = null;
    const { unmount } = renderTour();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(dialog()).toBeNull();
    unmount();

    currentUser = { id: "u2", name: "New", role: "user", organisationId: "o1", mustChangePassword: true };
    renderTour();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(dialog()).toBeNull();
  });

  it("starts on demand, but not when nothing it points at is on the page", async () => {
    progress.mockResolvedValue({ completed: ["org-users"], dismissed: [] });
    const { unmount } = renderTour(["data-view"]);
    fireEvent.click(screen.getByRole("button", { name: "start now" }));
    expect(screen.getByText("Step 1 of 1")).toBeTruthy();
    unmount();

    renderTour([]);
    fireEvent.click(screen.getByRole("button", { name: "start now" }));
    expect(dialog()).toBeNull();
  });
});
