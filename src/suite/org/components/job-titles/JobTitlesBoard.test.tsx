import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobTitlesBoard from "./JobTitlesBoard";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import { ApiError, type JobTitle } from "@/lib/api/job-titles-client";

/** The organisation's job-title list: add, rename in place, switch off, and delete only what nobody holds. */

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }));

vi.mock("@/lib/api/job-titles-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/job-titles-client")>();
  return { ...actual, jobTitles: api };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org/job-titles",
  useSearchParams: () => new URLSearchParams(),
}));

const jt = (over: Partial<JobTitle>): JobTitle => ({
  id: "t",
  key: "t",
  name: "Title",
  position: 1,
  isActive: true,
  peopleCount: 0,
  ...over,
});

const ROWS = [
  jt({ id: "t-1", name: "Analyst", position: 1, peopleCount: 3 }),
  jt({ id: "t-2", name: "Engineer", position: 2 }),
  jt({ id: "t-3", name: "Typist", position: 3, isActive: false }),
];

function renderBoard() {
  return render(
    <ConfirmProvider>
      <JobTitlesBoard />
    </ConfirmProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach((f) => f.mockReset());
  api.list.mockResolvedValue(ROWS);
});

describe("JobTitlesBoard", () => {
  it("lists offered titles with how many hold each, including the switched-off ones on request", async () => {
    const user = userEvent.setup();
    renderBoard();

    const table = await screen.findByRole("table");
    expect(api.list).toHaveBeenCalledWith({ all: true });
    expect(within(table).getByText("Analyst")).toBeInTheDocument();
    expect(within(table).getByText("3 people")).toBeInTheDocument();
    expect(within(table).queryByText("Typist")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /switched off/i }));
    expect(within(screen.getByRole("table")).getByText("Typist")).toBeInTheDocument();
  });

  it("adds a title", async () => {
    const user = userEvent.setup();
    api.create.mockResolvedValue(jt({ id: "t-4", name: "Staff Accountant", position: 4 }));
    renderBoard();
    await screen.findByRole("table");

    await user.type(screen.getByLabelText("New job title"), "Staff Accountant");
    await user.click(screen.getByRole("button", { name: "Add job title" }));

    expect(api.create).toHaveBeenCalledWith("Staff Accountant");
    expect(await within(screen.getByRole("table")).findByText("Staff Accountant")).toBeInTheDocument();
    expect(screen.getByLabelText("New job title")).toHaveValue("");
  });

  it("renames in place", async () => {
    const user = userEvent.setup();
    api.update.mockResolvedValue(jt({ id: "t-2", name: "Software Engineer", position: 2 }));
    renderBoard();
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Actions for Engineer" }));
    await user.click(screen.getByRole("menuitem", { name: /rename/i }));
    const field = screen.getByRole("textbox", { name: "New name for Engineer" });
    await user.clear(field);
    await user.type(field, "Software Engineer{Enter}");

    expect(api.update).toHaveBeenCalledWith("t-2", { name: "Software Engineer" });
    expect(await within(screen.getByRole("table")).findByText("Software Engineer")).toBeInTheDocument();
  });

  it("switches a title off", async () => {
    const user = userEvent.setup();
    api.update.mockResolvedValue(jt({ id: "t-2", name: "Engineer", position: 2, isActive: false }));
    renderBoard();
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Actions for Engineer" }));
    await user.click(screen.getByRole("menuitem", { name: /switch off/i }));

    expect(api.update).toHaveBeenCalledWith("t-2", { isActive: false });
    await waitFor(() => expect(within(screen.getByRole("table")).queryByText("Engineer")).not.toBeInTheDocument());
  });

  it("asks before deleting, and shows why a held title can't go", async () => {
    const user = userEvent.setup();
    api.remove.mockRejectedValue(new ApiError("3 people hold this job title. Switch it off instead.", 422));
    renderBoard();
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Actions for Analyst" }));
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/3 people hold this title/);
    await user.click(within(dialog).getByRole("button", { name: "Delete job title" }));

    expect(api.remove).toHaveBeenCalledWith("t-1");
    expect(await screen.findByText("3 people hold this job title. Switch it off instead.")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Analyst")).toBeInTheDocument();
  });

  it("deletes nothing when the question is cancelled", async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Actions for Engineer" }));
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));

    expect(api.remove).not.toHaveBeenCalled();
  });
});
