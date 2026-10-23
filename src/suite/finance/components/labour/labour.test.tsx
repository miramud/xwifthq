import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, type LabourOverview, type LabourPreview, type LabourRunDetail as Run } from "@/lib/api/finance-labour-client";
import LabourBoard from "./LabourBoard";
import LabourMonth from "./LabourMonth";
import LabourRunDetail from "./LabourRunDetail";
import { groupExceptions, splitShares } from "./LabourParts";
import { monthStates } from "./MonthCalendar";

/** Labour costing on the seeded Meridian figures (scratchpad api3 samples, trimmed). */

const api = vi.hoisted(() => ({ overview: vi.fn(), configure: vi.fn(), provisional: vi.fn(), run: vi.fn(), preview: vi.fn(), people: vi.fn(), post: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: "u-1", role: "admin", name: "Adaeze", organisationId: "o", permissions: [] as string[] } }));

vi.mock("@/lib/api/finance-labour-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-labour-client")>();
  return { ...actual, labour: api };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/labour",
  useSearchParams: () => new URLSearchParams(),
}));

const portal = "01a0cf9d-0f52-7111-8429-5e2839016286";
const closedMsg = "Hours were logged on a closed project. Reopen it, move the hours, or post with a Finance override.";

const preview = (over: Partial<LabourPreview> = {}): LabourPreview => ({
  month: "2026-08",
  method: "standard_hours",
  standardHours: 176,
  payrollRun: { id: "pr-8", reference: "PR-2026-08", status: "paid", posted: true },
  totals: { loaded: 1649166172, allocated: 275062919, unallocated: 1374103253, people: 12, hours: 403 },
  projects: [{ projectId: portal, project: "Student Portal Rebuild", status: "active", minutes: 24240, amount: 275062919, people: 7 }],
  people: null,
  exceptions: [
    { type: "no_timesheet", message: "No hours logged this month: the whole cost stays in overhead." },
    { type: "no_timesheet", message: "No hours logged this month: the whole cost stays in overhead." },
  ],
  existingRun: null,
  blockers: [],
  blockerCodes: [],
  overridable: false,
  ...over,
});

const withPeople = (over: Partial<LabourPreview> = {}): LabourPreview =>
  preview({
    people: [
      { userId: "u-c", name: "Chinonso Okeke", loaded: 159867500, hourlyRate: 908338, minutes: 4800, lines: [{ projectId: portal, minutes: 4800, amount: 72667045 }], bench: 87200455 },
    ],
    exceptions: [{ type: "no_timesheet", userId: "u-o", name: "Obinna Uzor", message: "No hours logged this month: the whole cost stays in overhead." }],
    ...over,
  });

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  auth.user = { id: "u-1", role: "admin", name: "Adaeze", organisationId: "o", permissions: [] };
});

describe("pure pieces", () => {
  it("splits the loaded cost between projects and the bench", () => {
    expect(splitShares(25, 75)).toEqual({ projects: 25, bench: 75 });
    expect(splitShares(0, 0)).toEqual({ projects: 0, bench: 0 });
  });

  it("groups exceptions by kind and keeps one sentence when they agree", () => {
    const g = groupExceptions([
      { type: "no_timesheet", message: "A" },
      { type: "over_120", message: "Logged 230 hours" },
      { type: "no_timesheet", message: "A" },
      { type: "over_120", message: "Logged 215 hours" },
    ]);
    expect(g.map((x) => [x.type, x.items.length, x.message])).toEqual([
      ["no_timesheet", 2, "A"],
      ["over_120", 2, null],
    ]);
  });

  it("reads each month of the year from the posted runs", () => {
    const run = (month: string, kind: "allocation" | "provisional", status: "posted" | "reversed" = "posted") =>
      ({ id: `${month}-${kind}`, kind, month, asOf: null, method: "standard_hours", loaded: 1, allocated: 1, bench: 0, status, journalId: null, exceptions: 0, postedBy: null, postedAt: null }) as const;
    const s = monthStates(2026, [run("2026-08", "allocation"), run("2026-09", "provisional"), run("2026-07", "allocation", "reversed")], "2026-10");
    expect(s[6].state).toBe("open");
    expect(s[7].state).toBe("allocated");
    expect(s[8].state).toBe("provisional");
    expect(s[9].state).toBe("open");
    expect(s[10].state).toBe("future");
  });
});

describe("LabourMonth", () => {
  it("previews the split, lists projects with their hours, and groups the exceptions", async () => {
    const user = userEvent.setup();
    auth.user = { ...auth.user, role: "accountant", permissions: ["finance.labour.view", "finance.labour.post"] };
    api.preview.mockResolvedValue(preview());
    render(<LabourMonth month="2026-08" />);

    expect(await screen.findByRole("heading", { level: 1, name: "Labour for August 2026" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Loaded cost ₦16\.5M: ₦2\.8M to projects \(17%\), ₦13\.7M on the bench \(83%\)/ })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: /Labour charged to each project/ });
    expect(within(table).getByRole("link", { name: "Student Portal Rebuild" })).toHaveAttribute("href", `/suite/finance/projects/${portal}`);
    expect(within(table).getByText("404 h")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Exceptions/ }));
    expect(screen.getByText("No timesheet")).toBeInTheDocument();
    expect(screen.getByText("· 2 people")).toBeInTheDocument();
  });

  it("never asks for people, or shows rates, without the people key", async () => {
    auth.user = { ...auth.user, role: "accountant", permissions: ["finance.labour.view"] };
    api.preview.mockResolvedValue(preview());
    render(<LabourMonth month="2026-08" />);
    await screen.findByRole("heading", { level: 1 });
    expect(api.people).not.toHaveBeenCalled();
    expect(screen.queryByRole("tab", { name: /People/ })).not.toBeInTheDocument();
    expect(screen.queryByText("₦9,083.38")).not.toBeInTheDocument();
    // No post key: no post button.
    expect(screen.queryByRole("button", { name: "Post allocation" })).not.toBeInTheDocument();
  });

  it("shows a People tab with each person's rate to those who hold the key", async () => {
    const user = userEvent.setup();
    auth.user = { ...auth.user, role: "accountant", permissions: ["finance.labour.view", "finance.labour_people.view"] };
    api.people.mockResolvedValue(withPeople());
    render(<LabourMonth month="2026-08" />);
    await user.click(await screen.findByRole("tab", { name: /People/ }));
    const table = screen.getByRole("table", { name: /Each person's loaded cost/ });
    expect(within(table).getByText("Chinonso Okeke")).toBeInTheDocument();
    expect(within(table).getByText("₦9,083.38")).toBeInTheDocument();
    expect(api.preview).not.toHaveBeenCalled();
  });

  it("falls back to totals when the people route refuses", async () => {
    auth.user = { ...auth.user, role: "accountant", permissions: ["finance.labour.view", "finance.labour_people.view"] };
    api.people.mockRejectedValue(new ApiError("This action is unauthorized.", 403));
    api.preview.mockResolvedValue(preview());
    render(<LabourMonth month="2026-08" />);
    await screen.findByRole("heading", { level: 1 });
    await screen.findByRole("tab", { name: /Projects/ });
    expect(api.preview).toHaveBeenCalledWith("2026-08", null);
    expect(screen.queryByRole("tab", { name: /People/ })).not.toBeInTheDocument();
  });

  it("re-previews by the other method", async () => {
    const user = userEvent.setup();
    api.people.mockResolvedValue(withPeople());
    render(<LabourMonth month="2026-08" />);
    await user.click(await screen.findByRole("radio", { name: "Proportional" }));
    expect(api.people).toHaveBeenLastCalledWith("2026-08", "proportional");
  });

  it("blocks posting while the payroll is not in the books and links to it", async () => {
    api.people.mockResolvedValue(
      withPeople({
        payrollRun: { id: "pr-9", reference: "PR-2026-09", status: "approved", posted: false },
        blockers: ["September 2026 payroll is approved in HR but not yet posted to the books. Post it under Finance › Payroll first."],
        blockerCodes: ["payroll_not_posted"],
        overridable: false,
      }),
    );
    render(<LabourMonth month="2026-08" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("payroll is approved in HR but not yet posted");
    expect(screen.getByRole("button", { name: "Post allocation" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Post the payroll" })).toHaveAttribute("href", "/suite/finance/payroll");
  });

  it("keeps posting shut when the closed project is not the only blocker, whatever the sentences say", async () => {
    api.people.mockResolvedValue(
      withPeople({
        payrollRun: null,
        blockers: ["There is no approved payroll for August 2026 yet.", closedMsg],
        blockerCodes: ["no_payroll", "closed_project"],
        overridable: false,
      }),
    );
    render(<LabourMonth month="2026-08" />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This month can't be posted yet: 2 things first");
    expect(within(alert).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Post allocation" })).toBeDisabled();
  });

  it("posts past a closed-project blocker only with a reason, replacing the earlier run", async () => {
    const user = userEvent.setup();
    api.people.mockResolvedValue(
      withPeople({
        blockers: [closedMsg],
        blockerCodes: ["closed_project"],
        overridable: true,
        exceptions: [{ type: "closed_project", projectId: portal, project: "Student Portal Rebuild", message: "Hours logged on Student Portal Rebuild, which is completed." }],
        existingRun: { id: "run-8", allocated: 275062919, postedAt: "2026-09-03T10:00:00+00:00" },
      }),
    );
    api.post.mockResolvedValue({ id: "run-9", allocated: 275062919, bench: 1374103253, journalId: "j-1" });
    render(<LabourMonth month="2026-08" />);

    expect(await screen.findByText("Posting needs a Finance override")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Post allocation" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/reversed and replaced/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Any provisional labour charged for August 2026 is reversed/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Post allocation" }));
    expect(within(dialog).getByText("Say why this month can post with hours on a closed project.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText("Why post with hours on a closed project?"), "Snagging agreed with the client");
    await user.click(within(dialog).getByRole("button", { name: "Post allocation" }));
    expect(api.post).toHaveBeenCalledWith("2026-08", { method: "standard_hours", overrideReason: "Snagging agreed with the client" });
    expect(await screen.findByRole("link", { name: "Open the journal" })).toHaveAttribute("href", "/suite/finance/journals/j-1");
  });

  it("shows every refusal the API gives when posting fails", async () => {
    const user = userEvent.setup();
    api.people.mockResolvedValue(withPeople());
    api.post.mockRejectedValue(new ApiError("The given data was invalid.", 422, { month: ["There is no approved payroll for August 2026 yet.", "Second reason."] }));
    render(<LabourMonth month="2026-08" />);
    await user.click(await screen.findByRole("button", { name: "Post allocation" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Post allocation" }));
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("There is no approved payroll for August 2026 yet.");
    expect(alert).toHaveTextContent("Second reason.");
  });

  it("says so when the address is not a month", () => {
    render(<LabourMonth month="runs" />);
    expect(screen.getByText(/That isn't a month/)).toBeInTheDocument();
    expect(api.preview).not.toHaveBeenCalled();
  });
});

describe("LabourBoard", () => {
  const overview = (over: Partial<LabourOverview> = {}): LabourOverview => ({
    config: { method: "standard_hours", standardHours: 176 },
    methods: { standard_hours: "Standard hours (idle time shows)", proportional: "Proportional to hours logged" },
    runs: [
      { id: "run-8", kind: "allocation", month: "2026-08", asOf: "2026-08-31", method: "standard_hours", loaded: 1649166172, allocated: 275062919, bench: 1374103253, status: "posted", journalId: "j-8", exceptions: 5, postedBy: "Adaeze Okonkwo", postedAt: "2026-09-03T10:00:00+00:00" },
    ],
    utilisation: {
      months: [{ month: "2026-08", people: 12, loaded: 1649166172, allocated: 275062919, bench: 1374103253, hoursLogged: 404, hoursStandard: 2112, utilisationBp: 1912 }],
      people: [{ userId: "u-y", name: "Yusuf Abdullahi", hoursLogged: 85, utilisationBp: 4829, bench: 63325101 }],
    },
    seesPeople: true,
    ...over,
  });

  it("charts utilisation, lists runs with their journals, and shows people only when allowed", async () => {
    api.overview.mockResolvedValue(overview());
    const { unmount } = render(<LabourBoard />);
    expect(await screen.findByRole("group", { name: "Loaded payroll cost by month, split between projects and the bench" })).toBeInTheDocument();
    expect(screen.getByText("Who carried the hours")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open journal" })[0]).toHaveAttribute("href", "/suite/finance/journals/j-8");
    unmount();

    api.overview.mockResolvedValue(overview({ seesPeople: false, utilisation: { ...overview().utilisation, people: null } }));
    render(<LabourBoard />);
    await screen.findAllByText("Labour costing");
    expect(screen.queryByText("Who carried the hours")).not.toBeInTheDocument();
  });

  it("saves the method and standard hours", async () => {
    const user = userEvent.setup();
    api.overview.mockResolvedValue(overview());
    api.configure.mockResolvedValue({ method: "proportional", standardHours: 168 });
    render(<LabourBoard />);
    await user.click(await screen.findByRole("radio", { name: /Proportional to hours logged/ }));
    const hours = screen.getByLabelText("Standard hours a month");
    await user.clear(hours);
    await user.type(hours, "168");
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(api.configure).toHaveBeenCalledWith({ method: "proportional", standardHours: 168 });
    expect((await screen.findAllByText(/Labour costing settings saved/)).length).toBeGreaterThan(0);
  });

  it("charges provisional labour after confirming, and says when there is nothing to charge", async () => {
    const user = userEvent.setup();
    api.overview.mockResolvedValue(overview());
    api.provisional.mockResolvedValue(null);
    render(<LabourBoard />);
    await user.click(await screen.findByRole("button", { name: "Charge provisional labour now" }));
    await user.click(await screen.findByRole("button", { name: "Charge provisional labour" }));
    expect(api.provisional).toHaveBeenCalledTimes(1);
    expect((await screen.findAllByText(/Nothing to charge/)).length).toBeGreaterThan(0);
  });
});

describe("LabourRunDetail", () => {
  const run = (over: Partial<Run> = {}): Run => ({
    id: "run-8",
    kind: "allocation",
    month: "2026-08",
    asOf: "2026-08-31",
    method: "standard_hours",
    standardHours: 176,
    status: "posted",
    journalId: "j-8",
    loaded: 1649166172,
    allocated: 275062919,
    bench: 1374103253,
    exceptions: [],
    override: "Snagging agreed with the client",
    projects: [{ projectId: portal, project: "Student Portal Rebuild", hours: 404, amount: 275062919, people: 7 }],
    people: [{ userId: "u-c", name: "Chinonso Okeke", hourlyRate: 908338, hours: 80, projects: 72667045, bench: 87200455, lines: [] }],
    seesPeople: true,
    ...over,
  });

  it("shows the override, the journal, and people only with seesPeople", async () => {
    api.run.mockResolvedValue(run());
    const { unmount } = render(<LabourRunDetail id="run-8" />);
    expect(await screen.findByText("Snagging agreed with the client")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open journal" })).toHaveAttribute("href", "/suite/finance/journals/j-8");
    expect(screen.getByText("₦9,083.38")).toBeInTheDocument();
    unmount();

    api.run.mockResolvedValue(run({ seesPeople: false, people: null }));
    render(<LabourRunDetail id="run-8" />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("₦9,083.38")).not.toBeInTheDocument();
  });
});
