import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddStudentsPanel from "./AddStudentsPanel";
import type { ImportResult } from "@/lib/api/saas-client";

/**
 * Provisioning learners. Both routes end at the credentials dialog, and the
 * behaviour worth pinning down is what happens when a file is partly wrong:
 * an admin pasting 400 learners needs the 397 that worked plus a list of the
 * three that did not, not a blanket failure.
 */

const createStudent = vi.fn();
const importStudents = vi.fn<(file: File) => Promise<ImportResult>>();

vi.mock("@/lib/api/saas-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/saas-client")>();

  return {
    ...actual,
    students: {
      create: (body: unknown) => createStudent(body),
      import: (file: File) => importStudents(file),
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();

  Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
  globalThis.URL.createObjectURL = vi.fn(() => "blob:fake");
  globalThis.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function csvFile(contents = "name,email\nAda,ada@acme.test") {
  return new File([contents], "students.csv", { type: "text/csv" });
}

function renderPanel(mode: "single" | "bulk") {
  const onAdded = vi.fn();
  const onClose = vi.fn();

  render(<AddStudentsPanel open mode={mode} onClose={onClose} onAdded={onAdded} />);

  return { onAdded, onClose };
}

describe("AddStudentsPanel — one at a time", () => {
  it("will not submit without a name and a valid-looking email", async () => {
    renderPanel("single");

    const submit = screen.getByRole("button", { name: /add learner/i });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/full name/i), "Ada Lovelace");
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/^email/i), "ada@acme.test");
    expect(submit).toBeEnabled();
  });

  it("normalises the email before sending it", async () => {
    createStudent.mockResolvedValue({ temporaryPassword: "GeneratedPass123" });
    renderPanel("single");

    await userEvent.type(screen.getByLabelText(/full name/i), "  Ada Lovelace  ");
    await userEvent.type(screen.getByLabelText(/^email/i), "  ADA@Acme.TEST  ");
    await userEvent.click(screen.getByRole("button", { name: /add learner/i }));

    expect(createStudent).toHaveBeenCalledWith({
      name: "Ada Lovelace",
      email: "ada@acme.test",
    });
  });

  it("hands the generated password straight to the credentials dialog", async () => {
    createStudent.mockResolvedValue({ temporaryPassword: "GeneratedPass123" });
    renderPanel("single");

    await userEvent.type(screen.getByLabelText(/full name/i), "Ada Lovelace");
    await userEvent.type(screen.getByLabelText(/^email/i), "ada@acme.test");
    await userEvent.click(screen.getByRole("button", { name: /add learner/i }));

    expect(await screen.findByText("GeneratedPass123")).toBeInTheDocument();
    expect(screen.getByText(/cannot be retrieved/i)).toBeInTheDocument();
  });

  it("warns up front that the password is shown once", () => {
    renderPanel("single");

    expect(screen.getByText(/shown to you once/i)).toBeInTheDocument();
  });
});

describe("AddStudentsPanel — bulk import", () => {
  /** A wrongly shaped file is the commonest way this fails. */
  it("shows the expected file format on the screen", () => {
    renderPanel("bulk");

    expect(screen.getByText(/name,email/)).toBeInTheDocument();
    expect(screen.getByText(/either order.*header row is optional/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download template/i })).toBeInTheDocument();
  });

  it("needs a file before it will submit", async () => {
    renderPanel("bulk");

    expect(screen.getByRole("button", { name: /import learners/i })).toBeDisabled();

    await userEvent.upload(screen.getByLabelText(/your file/i), csvFile());

    expect(screen.getByRole("button", { name: /import learners/i })).toBeEnabled();
  });

  it("goes straight to the credentials when every row worked", async () => {
    importStudents.mockResolvedValue({
      created: 1,
      skipped: 0,
      credentials: [{ name: "Ada", email: "ada@acme.test", temporaryPassword: "AdaPass12345678" }],
      errors: [],
    });

    renderPanel("bulk");

    await userEvent.upload(screen.getByLabelText(/your file/i), csvFile());
    await userEvent.click(screen.getByRole("button", { name: /import learners/i }));

    expect(await screen.findByText("AdaPass12345678")).toBeInTheDocument();
  });

  /**
   * The report comes first when rows failed, so the admin learns what was
   * skipped before the credentials take over the screen.
   */
  it("reports skipped rows by line before showing the passwords", async () => {
    importStudents.mockResolvedValue({
      created: 1,
      skipped: 2,
      credentials: [{ name: "Ada", email: "ada@acme.test", temporaryPassword: "AdaPass12345678" }],
      errors: [
        { line: 3, email: "not-an-email", reason: "The email must be a valid email address." },
        { line: 4, email: "taken@acme.test", reason: "The email has already been taken." },
      ],
    });

    renderPanel("bulk");

    await userEvent.upload(screen.getByLabelText(/your file/i), csvFile());
    await userEvent.click(screen.getByRole("button", { name: /import learners/i }));

    expect(await screen.findByText(/1 added/)).toBeInTheDocument();
    expect(screen.getByText(/2 skipped/)).toBeInTheDocument();

    // The line numbers point at the source file, which is what makes the
    // report actionable.
    expect(screen.getByText("Line 3")).toBeInTheDocument();
    expect(screen.getByText("Line 4")).toBeInTheDocument();
    expect(screen.getByText(/already been taken/i)).toBeInTheDocument();

    // Credentials are behind an explicit step, not shown yet.
    expect(screen.queryByText("AdaPass12345678")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /show the 1 password/i }));

    expect(await screen.findByText("AdaPass12345678")).toBeInTheDocument();
  });

  it("says plainly when nothing at all was created", async () => {
    importStudents.mockResolvedValue({
      created: 0,
      skipped: 1,
      credentials: [],
      errors: [{ line: 2, email: null, reason: "The name field is required." }],
    });

    renderPanel("bulk");

    await userEvent.upload(screen.getByLabelText(/your file/i), csvFile());
    await userEvent.click(screen.getByRole("button", { name: /import learners/i }));

    const button = await screen.findByRole("button", { name: /nothing was created/i });

    expect(button).toBeDisabled();
  });

  it("surfaces a whole-file rejection with the reason", async () => {
    const { ApiError } = await import("@/lib/api/saas-client");
    importStudents.mockRejectedValue(new ApiError("That file has no rows we could read.", 422));

    renderPanel("bulk");

    await userEvent.upload(screen.getByLabelText(/your file/i), csvFile());
    await userEvent.click(screen.getByRole("button", { name: /import learners/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no rows we could read/i);
  });
});
