import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import HrRolesBoard from "./HrRolesBoard";
import { chooseOption, comboboxLabel, openCombobox } from "@/test/selectOption";
import { ApiError, type Employee, type HrRole, type HrRoleHolder } from "@/lib/api/hrm-client";

/**
 * HR's roles board (roles redesign, phase 3a).
 *
 * The API decides which roles somebody may give; the board's job is to send
 * the person's whole set of hand-given roles on every change (the API sets
 * exactly that set), to leave holders the system gave a role to alone and
 * say why, and to put a refusal next to the control it was about.
 */

const api = vi.hoisted(() => ({
  roles: { list: vi.fn(), sync: vi.fn() },
  employees: { listAll: vi.fn() },
}));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();
  return { ...actual, hrm: api };
});

let currentUser: { id: string; role: string } = { id: "u-admin", role: "admin" };

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: currentUser, loading: false, refresh: vi.fn() }),
}));

function person(id: string, name: string): Employee {
  return {
    id: `emp-${id}`,
    person: { id: `u-${id}`, name, email: `${id}@example.test`, avatar: null },
    jobTitle: "Engineer",
    isCurrent: true,
  } as Employee;
}

const TOLU = person("tolu", "Tolu Ade");
const MO = person("mo", "Mo Bello");
const ADA = person("ada", "Ada Obi");
const KEMI = person("kemi", "Kemi Adebanjo");

function holder(p: Employee, source: HrRoleHolder["source"] = null): HrRoleHolder {
  return {
    userId: p.person.id,
    employeeId: p.id,
    name: p.person.name ?? "",
    email: p.person.email ?? "",
    automatic: source != null,
    source,
  };
}

function catalogue(): HrRole[] {
  return [
    {
      id: "r-instructor",
      name: "Instructor",
      description: "Teaches courses.",
      seeded: true,
      followsReportingLine: false,
      holders: [holder(TOLU)],
    },
    {
      id: "r-line",
      name: "Line Manager",
      description: "Approves their reports' leave.",
      seeded: true,
      followsReportingLine: true,
      holders: [holder(MO, "reporting_line")],
    },
    {
      id: "r-org-admin",
      name: "Organisation admin",
      description: "Runs the organisation.",
      seeded: true,
      followsReportingLine: false,
      // Given by the system for a reason the board doesn't name.
      holders: [{ ...holder(KEMI), automatic: true }],
    },
    {
      id: "r-recruiter",
      name: "Recruiter",
      description: null,
      seeded: false,
      followsReportingLine: false,
      holders: [holder(MO)],
    },
    {
      id: "r-auditor",
      name: "Auditor",
      description: "Reads the audit log.",
      seeded: true,
      followsReportingLine: false,
      holders: [],
    },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  document.querySelectorAll("[data-confirm-host]").forEach((n) => n.remove());
  currentUser = { id: "u-admin", role: "admin" };
  api.roles.list.mockResolvedValue(catalogue());
  api.roles.sync.mockResolvedValue({ employeeId: "x", userId: "x", roleIds: [] });
  api.employees.listAll.mockResolvedValue([TOLU, MO, ADA, KEMI]);
});

const card = async (name: string) =>
  (await screen.findByRole("heading", { name, level: 3 })).closest("article") as HTMLElement;

/** Unfolds a card's give control and returns its picker, once the people have loaded. */
async function openGive(user: UserEvent, role: string) {
  const c = await card(role);
  await user.click(within(c).getByRole("button", { name: `Give role: ${role}` }));
  const picker = within(c).getByRole("combobox", { name: `Give ${role} to` });
  await waitFor(() => expect(picker).not.toHaveProperty("disabled", true));
  return { card: c, picker };
}

describe("HrRolesBoard", () => {
  it("shows each role with its holders, and says why system-given holders can't be removed here", async () => {
    render(<HrRolesBoard />);

    const instructor = await card("Instructor");
    expect(within(instructor).getByText("Seeded")).toBeTruthy();
    const holders = within(instructor).getByRole("list", { name: "Holders of Instructor" });
    expect(within(holders).getByText("tolu@example.test")).toBeTruthy();
    expect(within(instructor).getByRole("button", { name: "Take Instructor from Tolu Ade" })).toBeTruthy();

    const line = await card("Line Manager");
    expect(within(line).getByText("From the reporting line")).toBeTruthy();
    expect(within(line).getByText(/Keeps itself up to date/)).toBeTruthy();
    expect(within(line).queryByRole("button", { name: /Take Line Manager/ })).toBeNull();

    // Given automatically for another reason: not the reporting line, and not removable either.
    const orgAdmin = await card("Organisation admin");
    expect(within(orgAdmin).getByText("Given automatically")).toBeTruthy();
    expect(within(orgAdmin).queryByText("From the reporting line")).toBeNull();
    expect(within(orgAdmin).queryByRole("button", { name: /Take Organisation admin/ })).toBeNull();

    expect(within(await card("Recruiter")).getByText("Custom")).toBeTruthy();
  });

  it("puts Line Manager first and roles nobody holds in their own section", async () => {
    const user = userEvent.setup();
    render(<HrRolesBoard />);

    const held = (await screen.findByRole("region", { name: /^Held/ })) as HTMLElement;
    const names = within(held)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(names[0]).toBe("Line Manager");
    expect(names).not.toContain("Auditor");

    const empty = screen.getByRole("region", { name: /^Nobody holds yet/ });
    expect(within(empty).getByRole("heading", { name: "Auditor", level: 3 })).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: /^Held/ }));
    expect(screen.queryByRole("heading", { name: "Auditor", level: 3 })).toBeNull();
    expect(screen.getByRole("heading", { name: "Instructor", level: 3 })).toBeTruthy();
  });

  it("gives a role with the person's whole hand-given set, and offers only people without it", async () => {
    const user = userEvent.setup();
    render(<HrRolesBoard />);

    const { card: instructor, picker } = await openGive(user, "Instructor");

    const listbox = await openCombobox(user, picker);
    expect(within(listbox).queryByRole("option", { name: "Tolu Ade" })).toBeNull();
    expect(within(listbox).getByRole("option", { name: "Ada Obi" })).toBeTruthy();
    await user.keyboard("{Escape}");

    await chooseOption(user, picker, "Mo Bello");
    await user.click(within(instructor).getByRole("button", { name: "Give role" }));

    // Mo's Recruiter (by hand) is kept; Line Manager (from the reporting line) is never sent.
    await waitFor(() => expect(api.roles.sync).toHaveBeenCalledWith("emp-mo", ["r-recruiter", "r-instructor"]));
    // Said on the card acted on, and to screen readers.
    expect(await within(instructor).findByText("Given to Mo Bello")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Mo Bello now holds Instructor.");
    // The control folds back and focus returns to it.
    await waitFor(() =>
      expect(document.activeElement).toBe(within(instructor).getByRole("button", { name: "Give role: Instructor" })),
    );
  });

  it("works from the keyboard: open, type to search, Enter to choose", async () => {
    const user = userEvent.setup();
    render(<HrRolesBoard />);

    const { card: instructor, picker } = await openGive(user, "Instructor");
    // Unfolding the control puts focus on the picker.
    expect(document.activeElement).toBe(picker);

    await user.keyboard("{Enter}");
    const search = await screen.findByRole("textbox", { name: "Search Give Instructor to" });
    await waitFor(() => expect(document.activeElement).toBe(search));

    await user.keyboard("ada");
    const listbox = document.getElementById(picker.getAttribute("aria-controls") ?? "") as HTMLElement;
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual([
      expect.stringContaining("Ada Obi"),
    ]);

    await user.keyboard("{Enter}");
    expect(comboboxLabel(picker)).toBe("Ada Obi");
    await user.click(within(instructor).getByRole("button", { name: "Give role" }));
    await waitFor(() => expect(api.roles.sync).toHaveBeenCalledWith("emp-ada", ["r-instructor"]));
  });

  it("asks before taking a role, then sends the set without it", async () => {
    const user = userEvent.setup();
    render(<HrRolesBoard />);

    const recruiter = await card("Recruiter");
    // Mo is Recruiter's only holder: the list read back after the take has nobody.
    api.roles.list.mockResolvedValue(
      catalogue().map((r) => (r.id === "r-recruiter" ? { ...r, holders: [] } : r)),
    );
    await user.click(within(recruiter).getByRole("button", { name: "Take Recruiter from Mo Bello" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Take Recruiter from Mo Bello?")).toBeTruthy();
    expect(api.roles.sync).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Take role" }));
    await waitFor(() => expect(api.roles.sync).toHaveBeenCalledWith("emp-mo", []));
    await waitFor(() => expect(api.roles.list).toHaveBeenCalledTimes(2));
    // The card keeps its place and its size, says it is empty, and says what happened.
    expect(within(recruiter).getByText("Nobody holds this role yet.")).toBeTruthy();
    expect(within(recruiter).getByText("Taken from Mo Bello")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: /^Held/ })).getByRole("heading", { name: "Recruiter" })).toBeTruthy();
  });

  it("does nothing when the question is cancelled", async () => {
    const user = userEvent.setup();
    render(<HrRolesBoard />);

    const instructor = await card("Instructor");
    await user.click(within(instructor).getByRole("button", { name: "Take Instructor from Tolu Ade" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));

    expect(api.roles.sync).not.toHaveBeenCalled();
  });

  it("shows the API's refusal under the picker", async () => {
    const user = userEvent.setup();
    api.roles.sync.mockRejectedValueOnce(
      new ApiError("The given data was invalid.", 422, {
        roleIds: ["You can only give roles whose permissions you hold yourself, as far as you hold them."],
      }),
    );
    render(<HrRolesBoard />);

    const { card: instructor, picker } = await openGive(user, "Instructor");
    await chooseOption(user, picker, "Ada Obi");
    await user.click(within(instructor).getByRole("button", { name: "Give role" }));

    expect(
      await within(instructor).findByText(
        "You can only give roles whose permissions you hold yourself, as far as you hold them.",
      ),
    ).toBeTruthy();
    expect(api.roles.sync).toHaveBeenCalledWith("emp-ada", ["r-instructor"]);
  });

  it("finds roles by a holder's name, and says how many it is showing", async () => {
    const user = userEvent.setup();
    render(<HrRolesBoard />);
    await card("Instructor");

    await user.type(screen.getByRole("searchbox", { name: "Search roles and people" }), "tolu");

    expect(screen.getByRole("heading", { name: "Instructor", level: 3 })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Recruiter", level: 3 })).toBeNull();
    expect(screen.getByText(/Showing/).textContent).toMatch(/Showing 1 of 5 roles/);
  });

  it("explains an empty board, and links an admin to Users & roles", async () => {
    api.roles.list.mockResolvedValue([]);
    const { unmount } = render(<HrRolesBoard />);

    expect(await screen.findByText("There are no roles you can give")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Users & roles" }).getAttribute("href")).toBe("/suite/org/users");
    unmount();

    currentUser = { id: "u-hr", role: "user" };
    render(<HrRolesBoard />);
    expect(await screen.findByText("There are no roles you can give")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Open Users & roles" })).toBeNull();
  });

  it("offers a retry when the roles do not load", async () => {
    const user = userEvent.setup();
    api.roles.list.mockRejectedValueOnce(new Error("Server unavailable."));
    render(<HrRolesBoard />);

    // Not a refusal: the written message, not whatever the network said.
    expect(await screen.findByText("The roles did not load.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Instructor", level: 3 })).toBeTruthy();
  });
});
