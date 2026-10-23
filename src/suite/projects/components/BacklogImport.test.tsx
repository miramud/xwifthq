import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BacklogImport from "./BacklogImport";
import { chooseOption, comboboxValue, openCombobox } from "@/test/selectOption";
import {
  ApiError,
  type BacklogImport as Import,
  type ImportRow,
  type Project,
  type Sprint,
} from "@/lib/api/projects-client";

/**
 * The import screen.
 *
 * Five things are worth defending, and none of them is that a table renders.
 *
 * **A skipped row is shown with its reason.** The sheet this was built against
 * has a second table pasted under the backlog, whose review comments sit in
 * the assignee column. Dropping those rows silently loses six review findings
 * and tells nobody; the only acceptable outcome is that they are skipped *and
 * said out loud*, next to the row number somebody can go and look at.
 *
 * **Nothing is created by looking.** The upload is a preview; only the commit
 * button creates work.
 *
 * **Correcting one column sends one column.** The API merges it over the rest,
 * and a form that sent its whole state would have to be right about all of it.
 *
 * **An empty estimate column is stated once.** Not as a note on 118 rows.
 *
 * **A reader who cannot import gets no upload control**, and is told why
 * rather than shown a button that 403s.
 */

const { list, get, upload, remap, commit, discard, template } = vi.hoisted(() => ({
  template: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  upload: vi.fn(),
  remap: vi.fn(),
  commit: vi.fn(),
  discard: vi.fn(),
}));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return {
    ...actual,
    imports: { ...actual.imports, list, get, upload, remap, commit, discard, template },
  };
});

/* The preview rows and the past imports are DataViews, which read the router. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/projects/data-catalogue",
  useSearchParams: () => new URLSearchParams(),
}));

const PROJECT = {
  slug: "data-catalogue",
  name: "Data Catalogue",
  can: { update: true, manageMembers: true, manageBoard: true, delete: false },
} as unknown as Project;

const READER = {
  ...PROJECT,
  can: { ...PROJECT.can, manageBoard: false },
} as unknown as Project;

const SPRINT = {
  id: "sp-1",
  sequence: 1,
  name: "Sprint 1",
  status: "planning",
  acceptsChanges: true,
} as unknown as Sprint;

const CLOSED_SPRINT = {
  id: "sp-0",
  sequence: 0,
  name: "Sprint 0",
  status: "closed",
  acceptsChanges: false,
} as unknown as Sprint;

const FIELDS = [
  { value: "title" as const, label: "Task" },
  { value: "task_ref" as const, label: "Task reference" },
  { value: "expected_outcome" as const, label: "Expected outcome" },
  { value: "ignore" as const, label: "Do not import" },
];

function row(over: Partial<ImportRow> & { row: number }): ImportRow {
  return {
    verdict: "import",
    reasons: [],
    cells: {},
    taskRef: null,
    title: "A task",
    story: null,
    description: null,
    expectedOutcome: null,
    type: "task",
    assignee: null,
    assigneeId: null,
    disciplineId: null,
    statusText: null,
    statusId: null,
    estimateHours: null,
    estimatePoints: null,
    dueOn: null,
    blockedReason: null,
    ...over,
  } as ImportRow;
}

function preview(over: Partial<Import> = {}): Import {
  return {
    id: "imp-1",
    projectId: "p-1",
    sprintId: null,
    filename: "D.G Tool Sprint Backlog.xlsx",
    sheetName: "SPRINT 2 - Data Catalogue Imple",
    sheets: [{ name: "SPRINT 2 - Data Catalogue Imple", rows: 6 }],
    status: "previewing",
    statusLabel: "Ready to review",
    isOpen: true,
    error: null,
    mapping: { A: "ignore", B: "task_ref", C: "title", D: "expected_outcome" },
    headers: { A: "Sprint ID", B: "Task ID", C: "Task", D: "Expected Outcome(s)" },
    counts: { rows: 6, importable: 4, skipped: 2, stories: 2, created: 0 },
    estimatesAllEmpty: false,
    verdicts: { import: 3, warn: 1, skip: 2 },
    rows: [
      row({ row: 2, taskRef: "1.1", title: "Implement a CRUD API", statusText: "Done" }),
      row({ row: 3, taskRef: "1.2", title: "Build a UI", statusText: "Done" }),
      row({ row: 4, taskRef: "2", title: "Document the API", statusText: "Done" }),
      row({
        row: 5,
        taskRef: "2.1",
        title: "E2E testing",
        assignee: "QA/QC",
        verdict: "warn",
        reasons: ['"Shadrach" is not on this project, so the task comes in unassigned.'],
      }),
      row({
        row: 20,
        title: "QA FINDINGS AND RECOMMENDATIONS",
        verdict: "skip",
        reasons: ["This has no reference, status or date, so it does not read as a task."],
      }),
      row({
        row: 22,
        title: "Metadata Template Section",
        assignee: 'For UX purposes, the "Add field" button should be after the list.',
        verdict: "skip",
        reasons: [
          "The assignee column holds a sentence rather than a name, so this row is a comment rather than a task.",
        ],
      }),
    ],
    uploadedBy: "Ada Lead",
    committedAt: null,
    createdAt: null,
    ...over,
  } as Import;
}

function file(name = "backlog.xlsx"): File {
  return new File(["Task ID,Task\n1.1,Do the thing\n"], name, { type: "text/csv" });
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue({ data: [], meta: { fields: FIELDS } });
});

describe("BacklogImport", () => {
  it("tells a reader who cannot import why, and offers no upload", async () => {
    render(<BacklogImport project={READER} sprints={[]} />);

    expect(
      await screen.findByText(/You cannot import into this project/i),
    ).toBeInTheDocument();

    expect(screen.queryByLabelText(/Spreadsheet to import/i)).toBeNull();
  });

  it("creates nothing by uploading", async () => {
    upload.mockResolvedValue({ data: preview(), meta: { fields: FIELDS } });

    render(<BacklogImport project={PROJECT} sprints={[]} />);

    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));

    expect(commit).not.toHaveBeenCalled();
    expect(await screen.findByText(/Import 4 tasks/i)).toBeInTheDocument();
  });

  /**
   * The rule the whole screen exists for. A skipped row is listed, with its
   * spreadsheet row number and the reason, so somebody can go and look at it.
   */
  it("shows every skipped row with the reason beside it", async () => {
    upload.mockResolvedValue({ data: preview(), meta: { fields: FIELDS } });

    render(<BacklogImport project={PROJECT} sprints={[]} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    expect(await screen.findByText("QA FINDINGS AND RECOMMENDATIONS")).toBeInTheDocument();
    expect(screen.getByText("Metadata Template Section")).toBeInTheDocument();

    expect(
      screen.getByText(/assignee column holds a sentence rather than a name/i),
    ).toBeInTheDocument();

    /* The spreadsheet's own row numbers, which is what somebody looks up. */
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("22")).toBeInTheDocument();
  });

  it("can hide the skipped rows without forgetting how many there were", async () => {
    upload.mockResolvedValue({ data: preview(), meta: { fields: FIELDS } });

    render(<BacklogImport project={PROJECT} sprints={[]} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    await screen.findByText("QA FINDINGS AND RECOMMENDATIONS");

    await userEvent.click(screen.getByLabelText(/Show the 2 skipped/i));

    expect(screen.queryByText("QA FINDINGS AND RECOMMENDATIONS")).toBeNull();
    expect(screen.getByText("Implement a CRUD API")).toBeInTheDocument();
  });

  /** A warning still imports; the note says what was left unset. */
  it("shows a warning beside a row that still imports", async () => {
    upload.mockResolvedValue({ data: preview(), meta: { fields: FIELDS } });

    render(<BacklogImport project={PROJECT} sprints={[]} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    expect(await screen.findByText("E2E testing")).toBeInTheDocument();
    expect(screen.getByText(/is not on this project/i)).toBeInTheDocument();

    /* Twice on the screen: the tally at the top and the row's own pill. */
    expect(screen.getAllByText("With a note")).toHaveLength(2);
  });

  /**
   * Correcting a column sends that column alone.
   *
   * The API merges it over the rest. A form that sent its whole state would
   * have to be right about all of it, and the first version of the endpoint
   * replaced the mapping wholesale — so one dropdown wiped nine columns.
   */
  it("sends only the column that changed", async () => {
    upload.mockResolvedValue({ data: preview(), meta: { fields: FIELDS } });
    remap.mockResolvedValue({
      data: preview({ mapping: { A: "ignore", B: "task_ref", C: "expected_outcome", D: "title" } }),
      meta: { fields: FIELDS },
    });

    render(<BacklogImport project={PROJECT} sprints={[]} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    /* The dropdown is labelled with the sheet's own header, not our field. */
    const dropdown = await screen.findByLabelText(/Task$/i);

    await chooseOption(userEvent.setup(), dropdown, "Expected outcome");

    await waitFor(() => expect(remap).toHaveBeenCalledTimes(1));

    expect(remap).toHaveBeenCalledWith("data-catalogue", "imp-1", {
      mapping: { C: "expected_outcome" },
    });
  });

  /** Said once about the file, not on every row. */
  it("states an entirely empty estimate column once", async () => {
    upload.mockResolvedValue({
      data: preview({ estimatesAllEmpty: true }),
      meta: { fields: FIELDS },
    });

    render(<BacklogImport project={PROJECT} sprints={[]} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    const notes = await screen.findAllByText(/these tasks arrive unestimated/i);

    expect(notes).toHaveLength(1);
    /* And says what that means, rather than leaving it as a fact. */
    expect(screen.getByText(/they are not zero/i)).toBeInTheDocument();
  });

  it("refuses to offer a commit when nothing can be imported", async () => {
    upload.mockResolvedValue({
      data: preview({
        counts: { rows: 2, importable: 0, skipped: 2, stories: 0, created: 0 },
        verdicts: { import: 0, warn: 0, skip: 2 },
      }),
      meta: { fields: FIELDS },
    });

    render(<BacklogImport project={PROJECT} sprints={[]} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    expect(await screen.findByText(/Nothing here can be imported/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Import 0 tasks/i })).toBeDisabled();
  });

  it("offers only sprints that still accept work", async () => {
    upload.mockResolvedValue({ data: preview(), meta: { fields: FIELDS } });

    render(<BacklogImport project={PROJECT} sprints={[CLOSED_SPRINT, SPRINT]} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    const list = await openCombobox(userEvent.setup(), await screen.findByLabelText(/Where the tasks go/i));

    expect(within(list).getByRole("option", { name: /Sprint 1/ })).toBeInTheDocument();
    /* A closed sprint's record of what it committed is fixed. */
    expect(within(list).queryByRole("option", { name: /Sprint 0/ })).toBeNull();
    expect(within(list).getByRole("option", { name: /Product backlog/i })).toBeInTheDocument();
  });

  it("commits and reports what was created", async () => {
    upload.mockResolvedValue({ data: preview(), meta: { fields: FIELDS } });
    commit.mockResolvedValue(
      preview({
        status: "committed",
        statusLabel: "Imported",
        isOpen: false,
        counts: { rows: 6, importable: 4, skipped: 2, stories: 2, created: 6 },
      }),
    );

    const onImported = vi.fn();

    render(<BacklogImport project={PROJECT} sprints={[]} onImported={onImported} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    await userEvent.click(await screen.findByRole("button", { name: /Import 4 tasks/i }));

    await waitFor(() => expect(commit).toHaveBeenCalledWith("data-catalogue", "imp-1"));

    expect(await screen.findByText(/6 items created/i)).toBeInTheDocument();
    /* The board behind this tab is now stale. */
    expect(onImported).toHaveBeenCalledTimes(1);
  });

  /**
   * The reason a file was refused is written to be read, so it is shown
   * instead of a generic failure.
   */
  it("shows the API's own reason when a file cannot be read", async () => {
    upload.mockRejectedValue(
      new ApiError(
        "That is the old Excel format (.xls). Open it in Excel and save it as .xlsx, then try again.",
        422,
      ),
    );

    render(<BacklogImport project={PROJECT} sprints={[]} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file("old.xls"));

    expect(await screen.findByText(/old Excel format/i)).toBeInTheDocument();
  });

  /** An import left mid-review is picked up rather than uploaded again. */
  it("resumes an import that was left open", async () => {
    const open = preview();

    list.mockResolvedValue({ data: [open], meta: { fields: FIELDS } });
    get.mockResolvedValue({ data: open, meta: { fields: FIELDS } });

    render(<BacklogImport project={PROJECT} sprints={[]} />);

    await waitFor(() => expect(get).toHaveBeenCalledWith("data-catalogue", "imp-1"));

    expect(await screen.findByText(/Import 4 tasks/i)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("lists past imports and what each one created", async () => {
    list.mockResolvedValue({
      data: [
        preview({
          id: "imp-old",
          status: "committed",
          statusLabel: "Imported",
          isOpen: false,
          rows: undefined,
          counts: { rows: 6, importable: 4, skipped: 2, stories: 2, created: 6 },
        }),
      ],
      meta: { fields: FIELDS },
    });

    render(<BacklogImport project={PROJECT} sprints={[]} />);

    expect(await screen.findByText(/Past imports/i)).toBeInTheDocument();
    expect(screen.getByText("6 created")).toBeInTheDocument();
    expect(screen.getByText("Ada Lead")).toBeInTheDocument();

    /* Nothing to resume, so no button to do it. */
    expect(screen.queryByRole("button", { name: /Resume/i })).toBeNull();
  });

  it("discards a preview without creating anything", async () => {
    upload.mockResolvedValue({ data: preview(), meta: { fields: FIELDS } });
    discard.mockResolvedValue({});

    render(<BacklogImport project={PROJECT} sprints={[]} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    await userEvent.click(await screen.findByRole("button", { name: /^Discard$/i }));
    /* Marked discarded and kept, never binned: the dialog does not promise a restore. */
    expect(await screen.findByText(/kept as a discarded record/)).toBeInTheDocument();
    expect(screen.queryByText(/recycle bin/)).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Discard import" }));

    await waitFor(() => expect(discard).toHaveBeenCalledWith("data-catalogue", "imp-1"));

    expect(commit).not.toHaveBeenCalled();
  });

  /**
   * A hundred-and-nineteen-row preview needs a way to find one row.
   *
   * Searched across the row number as well as the text, because "go and look
   * at row 147" is what the reasons beside each skipped row invite somebody to
   * do, and scrolling to it is the alternative.
   */
  it("finds a row by its spreadsheet row number", async () => {
    upload.mockResolvedValue({ data: preview(), meta: { fields: FIELDS } });

    render(<BacklogImport project={PROJECT} sprints={[]} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    await screen.findByText("Implement a CRUD API");

    await userEvent.type(screen.getByLabelText(/Search the rows/i), "22");

    expect(screen.getByText("Metadata Template Section")).toBeInTheDocument();
    expect(screen.queryByText("Implement a CRUD API")).toBeNull();
  });

  it("finds a row by its task text, and says when nothing matches", async () => {
    upload.mockResolvedValue({ data: preview(), meta: { fields: FIELDS } });

    render(<BacklogImport project={PROJECT} sprints={[]} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    const search = await screen.findByLabelText(/Search the rows/i);

    await userEvent.type(search, "CRUD");
    expect(screen.getByText("Implement a CRUD API")).toBeInTheDocument();
    expect(screen.queryByText("Build a UI")).toBeNull();

    await userEvent.clear(search);
    await userEvent.type(search, "zzzz");
    expect(screen.getByText(/Nothing matches that/i)).toBeInTheDocument();
  });

  /** Searching the reasons, so "which rows were skipped and why" is one query. */
  it("finds rows by the reason they were skipped", async () => {
    upload.mockResolvedValue({ data: preview(), meta: { fields: FIELDS } });

    render(<BacklogImport project={PROJECT} sprints={[]} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    await screen.findByText("Implement a CRUD API");

    await userEvent.type(screen.getByLabelText(/Search the rows/i), "sentence");

    expect(screen.getByText("Metadata Template Section")).toBeInTheDocument();
    expect(screen.queryByText("Implement a CRUD API")).toBeNull();
  });

  /**
   * A workbook's other tabs.
   *
   * The reader always read them all and the API always accepted a sheet name;
   * there was no way for anybody to discover the choices, so a workbook whose
   * backlog was not its fullest tab could not be imported at all.
   */
  it("offers the workbook's other sheets, with their row counts", async () => {
    upload.mockResolvedValue({
      data: preview({
        sheetName: "Backlog",
        sheets: [
          { name: "Cover", rows: 1 },
          { name: "Backlog", rows: 6 },
        ],
      }),
      meta: { fields: FIELDS },
    });

    render(<BacklogImport project={PROJECT} sprints={[]} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    const picker = await screen.findByLabelText(/Which sheet/i);

    expect(comboboxValue(picker)).toBe("Backlog");

    const list = await openCombobox(userEvent.setup(), picker);
    expect(within(list).getByRole("option", { name: "Cover" })).toHaveTextContent("1 row");
    expect(within(list).getByRole("option", { name: "Backlog" })).toHaveTextContent("6 rows");

    discard.mockResolvedValue({});

    await userEvent.click(within(list).getByRole("option", { name: "Cover" }));

    /* The old preview is replaced, so it is discarded rather than left open. */
    await waitFor(() => expect(discard).toHaveBeenCalledWith("data-catalogue", "imp-1"));

    expect(upload).toHaveBeenLastCalledWith(
      "data-catalogue",
      expect.any(File),
      { sheet: "Cover" },
    );
  });

  /** One option is not a choice, so it is not offered as one. */
  it("does not offer a sheet picker for a single-sheet workbook", async () => {
    upload.mockResolvedValue({ data: preview(), meta: { fields: FIELDS } });

    render(<BacklogImport project={PROJECT} sprints={[]} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    await screen.findByText(/Import 4 tasks/i);

    expect(screen.queryByLabelText(/Which sheet/i)).toBeNull();
  });

  /**
   * `AA` sorts before `B` alphabetically and after it in a spreadsheet, so a
   * mapping form ordered by object key would not line up with the file.
   */
  it("orders the column dropdowns the way the spreadsheet does", async () => {
    upload.mockResolvedValue({
      data: preview({
        mapping: { AA: "ignore", B: "task_ref", A: "ignore" },
        headers: { AA: "Twenty-seventh", B: "Second", A: "First" },
      }),
      meta: { fields: FIELDS },
    });

    render(<BacklogImport project={PROJECT} sprints={[]} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    await screen.findByText(/Columns/i);

    const labels = screen
      .getAllByText(/First|Second|Twenty-seventh/)
      .map((node) => node.textContent);

    expect(labels).toEqual(["AFirst", "BSecond", "AATwenty-seventh"]);
  });

  /**
   * The template is step one.
   *
   * Its Members tab carries the User IDs that make the assignee column match,
   * so it is offered before the upload — and handed to the browser as a file,
   * not opened as a page.
   */
  describe("the template", () => {
    const createObjectURL = vi.fn(() => "blob:template");
    const revokeObjectURL = vi.fn();

    beforeEach(() => {
      createObjectURL.mockClear();
      revokeObjectURL.mockClear();
      Object.assign(URL, { createObjectURL, revokeObjectURL });
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    });

    it("downloads the template as a file named by the API", async () => {
      const blob = new Blob(["xlsx"], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      template.mockResolvedValue({ blob, filename: "data-catalogue-backlog-template.xlsx" });

      render(<BacklogImport project={PROJECT} sprints={[]} />);

      await userEvent.click(await screen.findByRole("button", { name: /Download template/i }));

      await waitFor(() => expect(template).toHaveBeenCalledWith("data-catalogue"));
      expect(createObjectURL).toHaveBeenCalledWith(blob);
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
      expect(
        await screen.findByText(/Downloaded data-catalogue-backlog-template\.xlsx/i),
      ).toBeInTheDocument();
    });

    it("says so when the template cannot be downloaded", async () => {
      template.mockRejectedValue(new ApiError("The template could not be downloaded.", 502));

      render(<BacklogImport project={PROJECT} sprints={[]} />);

      await userEvent.click(await screen.findByRole("button", { name: /Download template/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /The template could not be downloaded/i,
      );
      expect(createObjectURL).not.toHaveBeenCalled();
    });

    it("is not offered to somebody who cannot import", async () => {
      render(<BacklogImport project={READER} sprints={[]} />);

      await screen.findByText(/You cannot import into this project/i);

      expect(screen.queryByRole("button", { name: /Download template/i })).toBeNull();
    });
  });

  /**
   * A User ID reads as the person it resolved to.
   *
   * The template's assignee column holds an opaque id; the preview turns it
   * into a name, and keeps what was written beneath it so a wrong paste can
   * still be seen. One that matched nobody is flagged in words.
   */
  /*
    P24: eight columns did not fit a 1440px screen, and Due and Verdict sat off
    the right edge. Row and ref share a column, and so do status and due.
  */
  it("fits the rows table in six columns, with status and due date together", async () => {
    upload.mockResolvedValue({
      data: preview({
        rows: [row({ row: 2, taskRef: "1.1", title: "Implement a CRUD API", statusText: "Done", dueOn: "2026-10-03" })],
      }),
      meta: { fields: FIELDS },
    });

    render(<BacklogImport project={PROJECT} sprints={[]} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    const title = await screen.findByText("Implement a CRUD API");
    const table = title.closest("table") as HTMLElement;
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((h) => h.textContent);

    expect(headers).toEqual(["Row", "Task", "Epic · story", "Assignee", "Status · due", "Verdict"]);

    const cells = within(title.closest("tr") as HTMLElement).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("2");
    expect(cells[0]).toHaveTextContent("1.1");
    expect(cells[4]).toHaveTextContent("Done");
    expect(cells[4]).toHaveTextContent("Due 3 Oct 2026");
  });

  it("shows an assignee id as the person it resolved to", async () => {
    upload.mockResolvedValue({
      data: preview({
        rows: [
          row({
            row: 2,
            title: "Wire up the search API",
            assignee: "9f1c2b7e-0000-4000-8000-000000000001",
            assigneeId: "9f1c2b7e-0000-4000-8000-000000000001",
            assigneeName: "Ada Lead",
          }),
          row({
            row: 3,
            title: "Write the release notes",
            assignee: "0000dead-0000-4000-8000-000000000000",
            verdict: "warn",
            reasons: [
              "Nobody on this project has the user id 0000dead-0000-4000-8000-000000000000, so the task comes in unassigned. The Members tab of the template lists the ids that work.",
            ],
          }),
        ],
      }),
      meta: { fields: FIELDS },
    });

    render(<BacklogImport project={PROJECT} sprints={[]} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    await screen.findByText("Wire up the search API");

    /* The name, not the id, is what the row says. */
    const resolved = screen.getByText("9f1c2b7e-0000-4000-8000-000000000001");
    expect(resolved.parentElement).toHaveTextContent("Ada Lead");

    /* An id nobody has is flagged, with the reason, once. */
    expect(screen.getByText("Not matched")).toBeInTheDocument();
    expect(screen.getAllByText(/Nobody on this project has the user id/i)).toHaveLength(1);
  });

  /**
   * Epic > story > task, visible before anything is created: the epic sits
   * over the story on each row, and the summary counts both.
   */
  it("shows each row's epic over its story, and counts epics and stories", async () => {
    upload.mockResolvedValue({
      data: preview({
        counts: { rows: 3, importable: 3, skipped: 0, epics: 1, stories: 2, created: 0 },
        epicCount: 1,
        storyCount: 2,
        verdicts: { import: 2, warn: 1, skip: 0 },
        rows: [
          row({ row: 2, title: "Build the card form", epic: "Payments", story: "Pay by card" }),
          row({ row: 3, title: "Send the receipt", story: "Email a receipt" }),
          row({
            row: 4,
            title: "Tidy the logs",
            verdict: "warn",
            reasons: ["Not under a user story — it will be a loose card."],
          }),
        ],
      }),
      meta: { fields: FIELDS },
    });

    render(<BacklogImport project={PROJECT} sprints={[]} />);
    await userEvent.upload(await screen.findByLabelText(/Spreadsheet to import/i), file());

    await screen.findByText("Build the card form");

    expect(screen.getByText(/1 epic · 2 stories/)).toBeInTheDocument();
    expect(screen.getByText("under 1 epic")).toBeInTheDocument();
    expect(screen.getAllByText("Payments").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pay by card").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/it will be a loose card/i).length).toBeGreaterThan(0);
  });

  it("says Epic is optional in the template help", async () => {
    render(<BacklogImport project={PROJECT} sprints={[]} />);

    expect(await screen.findByText(/optional — fill it in to group stories/i)).toBeInTheDocument();
  });
});
