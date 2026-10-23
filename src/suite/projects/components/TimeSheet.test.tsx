import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TimeSheet from "./TimeSheet";
import { chooseOption, openCombobox } from "@/test/selectOption";
import type { BoardSetup, Project, Sprint, TimeLog } from "@/lib/api/projects-client";

/**
 * The timesheet.
 *
 * **Logging has to be the easiest thing on the screen**, or nobody logs
 * anything and every cost figure is fiction. So the form opens on today, asks
 * for hours rather than minutes, and defaults to billable.
 *
 * **The money is absent for most readers, not zero.** `meta.canSeeCost` is the
 * server's answer and is never inferred here — a list of everybody's hours with
 * everybody's cost attached is a rate card assembled from the back.
 *
 * **Project time is the default "against".** A stand-up, a client call and a
 * day of interviewing belong to no ticket, and forcing one makes people invent
 * one.
 */

const { list, log, remove, listItems, repricePreview, reprice } = vi.hoisted(() => ({
  list: vi.fn(),
  log: vi.fn(),
  remove: vi.fn(),
  listItems: vi.fn(),
  repricePreview: vi.fn(),
  reprice: vi.fn(),
}));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return {
    ...actual,
    time: { ...actual.time, list, log, remove, repricePreview, reprice },
    workItems: { ...actual.workItems, list: listItems },
  };
});

/* The entries are a DataView, which reaches for the app router. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/projects/acme-rebuild",
  useSearchParams: () => new URLSearchParams(),
}));

const PROJECT = {
  slug: "acme-rebuild",
  name: "Acme Rebuild",
  isBillable: true,
  can: {
    update: true,
    manageMembers: true,
    manageBoard: true,
    delete: false,
    viewCost: true,
    manageRates: true,
    logTimeForOthers: true,
  },
} as unknown as Project;

const SETUP = {
  statuses: [],
  disciplines: [],
  assignees: [
    { id: "u-1", name: "Shadrach", role: "member" },
    { id: "u-2", name: "Isaac", role: "member" },
  ],
} as unknown as BoardSetup;

const SPRINT = { id: "sp-1", sequence: 3, name: "Sprint 3" } as unknown as Sprint;

function entry(over: Partial<TimeLog> & { id: string }): TimeLog {
  return {
    projectId: "p-1",
    workItemId: null,
    workItem: null,
    userId: "u-1",
    user: "Shadrach",
    disciplineId: "d-be",
    discipline: "Backend",
    workedOn: "2026-09-24",
    minutes: 90,
    hours: 1.5,
    isBillable: true,
    note: "Built the endpoint",
    createdAt: null,
    ...over,
  } as TimeLog;
}

function meta(over: Record<string, unknown> = {}) {
  return {
    canSeeCost: true,
    canLogForOthers: true,
    hours: 1.5,
    billableHours: 1.5,
    costMinor: 3000,
    currency: "USD",
    unratedHours: 0,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue({
    data: [entry({ id: "t-1", rateMinor: 2000, costMinor: 3000, currency: "USD" })],
    meta: meta(),
  });
  listItems.mockResolvedValue({
    data: [
      {
        id: "wi-1",
        title: "Build the upload API",
        externalRef: "1.1",
        isComplete: false,
      },
      {
        id: "wi-9",
        title: "Shipped last month",
        externalRef: "0.9",
        isComplete: true,
      },
    ],
    meta: { total: 2, perPage: 200, currentPage: 1, lastPage: 1 },
  });
  log.mockResolvedValue({});
});

describe("TimeSheet", () => {
  it("shows the hours, and the cost to somebody who may see it", async () => {
    render(<TimeSheet project={PROJECT} sprints={[]} setup={SETUP} />);

    /*
      Both appear twice: the headline figures and the one row they are made of.
      A single-entry timesheet is the case where the total and the row agree,
      which is worth asserting loosely rather than picking one.
    */
    expect((await screen.findAllByText("1.5h")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$30.00").length).toBeGreaterThan(0);
  });

  /** Hours coordinate a team; the money is the sensitive part. */
  it("shows hours but no money to somebody who may not see cost", async () => {
    list.mockResolvedValue({
      data: [entry({ id: "t-1" })],
      meta: meta({ canSeeCost: false, costMinor: null, unratedHours: null }),
    });

    render(<TimeSheet project={PROJECT} sprints={[]} setup={SETUP} />);

    expect(await screen.findByText("1h 30m")).toBeInTheDocument();
    expect(screen.queryByText("$30.00")).toBeNull();
    /* The third figure becomes the head count rather than a blank. */
    expect(screen.getByText("People")).toBeInTheDocument();
  });

  /**
   * Hours logged before a rate was set cost nothing, so the total is short by
   * whatever they were worth. Only said to somebody who can see the total.
   */
  it("warns about unrated hours, and only to somebody who sees cost", async () => {
    list.mockResolvedValue({
      data: [entry({ id: "t-1" })],
      meta: meta({ unratedHours: 18 }),
    });

    render(<TimeSheet project={PROJECT} sprints={[]} setup={SETUP} />);

    expect(
      await screen.findByText(/18h were logged before a rate was set/i),
    ).toBeInTheDocument();
  });

  it("says nothing about unrated hours to a reader who cannot see cost", async () => {
    list.mockResolvedValue({
      data: [entry({ id: "t-1" })],
      meta: meta({ canSeeCost: false, costMinor: null, unratedHours: null }),
    });

    render(<TimeSheet project={PROJECT} sprints={[]} setup={SETUP} />);

    await screen.findByText("1h 30m");

    expect(screen.queryByText(/before a rate was set/i)).toBeNull();
  });

  /** An hour with no rate is named, not shown as free. */
  it("marks an hour that has no rate rather than showing it as free", async () => {
    list.mockResolvedValue({
      data: [
        entry({
          id: "t-1",
          rateMinor: 0,
          costMinor: 0,
          currency: "USD",
          rateSource: "none",
          rateSourceLabel: "No rate set",
        }),
      ],
      meta: meta({ costMinor: 0, unratedHours: 1.5 }),
    });

    render(<TimeSheet project={PROJECT} sprints={[]} setup={SETUP} />);

    expect(await screen.findByText("No rate")).toBeInTheDocument();

    /*
      The headline total is still $0.00, which is honest - it is what the
      logged hours cost - and the warning banner above it says why. What must
      not happen is the *row* reading as a free hour, and it reads "No rate".
    */
    expect(screen.getByText(/1.5h were logged before a rate was set/i)).toBeInTheDocument();
  });

  /* ------------------------------------------------------------------ */
  /*  Logging                                                           */
  /* ------------------------------------------------------------------ */

  it("logs hours against the project by default", async () => {
    render(<TimeSheet project={PROJECT} sprints={[]} setup={SETUP} />);

    await userEvent.click(await screen.findByRole("button", { name: /Log time/i }));

    await userEvent.type(screen.getByLabelText(/^Hours$/i), "1.5");
    await userEvent.click(screen.getByRole("button", { name: /Log it/i }));

    await waitFor(() => expect(log).toHaveBeenCalledTimes(1));

    const [slug, input] = log.mock.calls[0];

    expect(slug).toBe("acme-rebuild");
    expect(input).toMatchObject({
      hours: 1.5,
      /* The default, not an afterthought. */
      workItemId: null,
      userId: null,
      isBillable: true,
    });
  });

  /**
   * The dropdown had nothing in it in the first version — `BoardSetup` carries
   * columns and people and has never carried items.
   */
  it("offers the project's unfinished work to log against", async () => {
    render(<TimeSheet project={PROJECT} sprints={[]} setup={SETUP} />);

    await userEvent.click(await screen.findByRole("button", { name: /Log time/i }));

    await waitFor(() => expect(listItems).toHaveBeenCalled());

    const list = await openCombobox(userEvent.setup(), screen.getByLabelText(/^Against$/i));
    expect(
      await within(list).findByRole("option", { name: /1.1 · Build the upload API/ }),
    ).toBeInTheDocument();
    /* A ticket that shipped last month is not where today went. */
    expect(within(list).queryByRole("option", { name: /Shipped last month/ })).toBeNull();
    expect(within(list).getByRole("option", { name: /The project \(no ticket\)/ })).toBeInTheDocument();
  });

  it("logs against a chosen ticket", async () => {
    render(<TimeSheet project={PROJECT} sprints={[]} setup={SETUP} />);

    await userEvent.click(await screen.findByRole("button", { name: /Log time/i }));
    await waitFor(() => expect(listItems).toHaveBeenCalled());

    await userEvent.type(screen.getByLabelText(/^Hours$/i), "2");
    await chooseOption(userEvent.setup(), screen.getByLabelText(/^Against$/i), /Build the upload API/);
    await userEvent.click(screen.getByRole("button", { name: /Log it/i }));

    await waitFor(() => expect(log).toHaveBeenCalledTimes(1));

    expect(log.mock.calls[0][1]).toMatchObject({ hours: 2, workItemId: "wi-1" });
  });

  it("logs for somebody else when that is allowed", async () => {
    render(<TimeSheet project={PROJECT} sprints={[]} setup={SETUP} />);

    await userEvent.click(await screen.findByRole("button", { name: /Log time/i }));

    await userEvent.type(screen.getByLabelText(/^Hours$/i), "3");
    await chooseOption(userEvent.setup(), screen.getByLabelText(/^For$/i), "Isaac");
    await userEvent.click(screen.getByRole("button", { name: /Log it/i }));

    await waitFor(() => expect(log).toHaveBeenCalledTimes(1));

    expect(log.mock.calls[0][1]).toMatchObject({ userId: "u-2" });
  });

  it("offers no For field to somebody who may not log for others", async () => {
    list.mockResolvedValue({
      data: [entry({ id: "t-1" })],
      meta: meta({ canLogForOthers: false }),
    });

    render(<TimeSheet project={PROJECT} sprints={[]} setup={SETUP} />);

    await userEvent.click(await screen.findByRole("button", { name: /Log time/i }));

    expect(screen.queryByLabelText(/^For$/i)).toBeNull();
  });

  /** An internal project has a cost and no price, so nothing on it is billable. */
  it("offers no billable choice on an internal project", async () => {
    const internal = { ...PROJECT, isBillable: false } as unknown as Project;

    render(<TimeSheet project={internal} sprints={[]} setup={SETUP} />);

    await userEvent.click(await screen.findByRole("button", { name: /Log time/i }));

    expect(screen.queryByLabelText(/Billable/i)).toBeNull();
    expect(screen.getByText(/An internal project has a cost and no price/i))
      .toBeInTheDocument();
  });

  it("will not log nothing, or more than a day", async () => {
    render(<TimeSheet project={PROJECT} sprints={[]} setup={SETUP} />);

    await userEvent.click(await screen.findByRole("button", { name: /Log time/i }));

    /* Nothing typed yet. */
    expect(screen.getByRole("button", { name: /Log it/i })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/^Hours$/i), "30");

    expect(screen.getByRole("button", { name: /Log it/i })).toBeDisabled();
    expect(log).not.toHaveBeenCalled();
  });

  /* ------------------------------------------------------------------ */
  /*  Filters                                                           */
  /* ------------------------------------------------------------------ */

  it("filters to my own hours", async () => {
    render(<TimeSheet project={PROJECT} sprints={[]} setup={SETUP} />);

    await screen.findByText("1h 30m");

    await userEvent.click(screen.getByLabelText(/Only mine/i));

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        "acme-rebuild",
        expect.objectContaining({ mine: true }),
      ),
    );
  });

  it("filters by sprint and by date", async () => {
    render(<TimeSheet project={PROJECT} sprints={[SPRINT]} setup={SETUP} />);

    await screen.findByText("1h 30m");

    await chooseOption(userEvent.setup(), screen.getByRole("combobox", { name: /Filter by sprint/i }), "Sprint 3");

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        "acme-rebuild",
        expect.objectContaining({ sprintId: "sp-1" }),
      ),
    );

    await userEvent.type(screen.getByLabelText(/Worked from/i), "2026-09-01");

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        "acme-rebuild",
        expect.objectContaining({ from: "2026-09-01" }),
      ),
    );
  });

  it("deletes an entry", async () => {
    remove.mockResolvedValue({});

    render(<TimeSheet project={PROJECT} sprints={[]} setup={SETUP} />);

    await userEvent.click(
      await screen.findByRole("button", { name: /Delete 1h 30m on 2026-09-24/i }),
    );
    expect(remove).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole("button", { name: "Delete time" }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith("acme-rebuild", "t-1"));
  });

  it("says plainly when nothing has been logged", async () => {
    list.mockResolvedValue({
      data: [],
      meta: meta({ hours: 0, billableHours: 0, costMinor: 0 }),
    });

    render(<TimeSheet project={PROJECT} sprints={[]} setup={SETUP} />);

    expect(await screen.findByText(/No hours logged yet/i)).toBeInTheDocument();
  });

  /** X1: leave and holidays are said after the save, never in its way. */
  it("shows a non-blocking notice when the day was leave or a holiday", async () => {
    log.mockResolvedValue({
      log: entry({ id: "t-2" }),
      warnings: [{ code: "public_holiday", message: "Thu 1 Oct was a public holiday (Independence Day). The time is logged, so check the date if that was a mistake." }],
    });

    render(<TimeSheet project={PROJECT} sprints={[]} setup={SETUP} />);

    await userEvent.click(await screen.findByRole("button", { name: /Log time/i }));
    await userEvent.type(screen.getByLabelText(/^Hours$/i), "2");
    await userEvent.click(screen.getByRole("button", { name: /Log it/i }));

    expect(await screen.findByText(/Logged, but worth a second look/i)).toBeInTheDocument();
    expect(screen.getByText(/public holiday \(Independence Day\)/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Dismiss/i }));
    expect(screen.queryByText(/worth a second look/i)).toBeNull();
  });

  /** D21: previewed, confirmed, then repriced - offered to whoever manages rates. */
  it("reprices zero-cost hours after showing what it will add", async () => {
    list.mockResolvedValue({ data: [entry({ id: "t-1" })], meta: meta({ unratedHours: 2 }) });
    repricePreview.mockResolvedValue({
      logs: 1, hours: 2, costMinor: 4000, currency: "USD", unpriceable: 0, unpriceableHours: 0, applied: false,
    });
    reprice.mockResolvedValue({
      logs: 1, hours: 2, costMinor: 4000, currency: "USD", unpriceable: 0, unpriceableHours: 0, applied: true,
    });

    render(<TimeSheet project={PROJECT} sprints={[]} setup={SETUP} />);

    await userEvent.click(await screen.findByRole("button", { name: /Reprice zero-cost hours/i }));

    expect(await screen.findByText(/Reprice zero-cost hours\?/i)).toBeInTheDocument();
    expect(reprice).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /^Reprice hours$/i }));

    await waitFor(() => expect(reprice).toHaveBeenCalledWith("acme-rebuild"));
    expect(await screen.findByText(/Repriced 2h/i)).toBeInTheDocument();
  });

  it("offers no reprice to somebody who does not manage rates", async () => {
    list.mockResolvedValue({ data: [entry({ id: "t-1" })], meta: meta({ unratedHours: 2 }) });

    render(
      <TimeSheet project={{ ...PROJECT, can: { ...PROJECT.can, manageRates: false } } as Project} sprints={[]} setup={SETUP} />,
    );

    expect(await screen.findByText(/2h were logged before a rate was set/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reprice zero-cost hours/i })).toBeNull();
  });
});
