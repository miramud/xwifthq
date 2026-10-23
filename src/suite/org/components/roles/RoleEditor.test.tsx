import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RoleEditor from "./RoleEditor";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import { ApiError } from "@/lib/api/admin-client";
import type { Catalogue, Permission, RoleDetail, Scope } from "@/lib/api/roles-client";

/**
 * The role editor. Each feature takes a bundle at a scope; Customise picks
 * single actions; confidential features need the module's Confidential
 * access; a scope today's checks don't honour is marked, not hidden. A
 * module's "Set all" only touches what it covers; a built-in role opens
 * read-only with a way to copy it.
 */

const api = vi.hoisted(() => ({
  catalogue: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  duplicate: vi.fn(),
  list: vi.fn(),
}));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/roles-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/roles-client")>();
  return {
    ...actual,
    permissions: { catalogue: api.catalogue },
    roles: { list: api.list, get: api.get, create: api.create, update: api.update, remove: api.remove, duplicate: api.duplicate },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org/roles",
  useSearchParams: () => new URLSearchParams(),
}));

const perm = (
  key: string,
  label: string,
  bundle: Permission["bundle"],
  scopes: Scope[] = ["organisation"],
  confidential = false,
): Permission => ({ key, action: key.split(".").pop()!, label, description: null, bundle, scopes, confidential });

const CATALOGUE: Catalogue = {
  modules: [
    {
      key: "lms",
      label: "Learning",
      defaultScope: "organisation",
      features: [
        {
          key: "courses",
          label: "Courses",
          permissions: [
            perm("lms.courses.view", "View", "view", ["own", "organisation"]),
            perm("lms.courses.create", "Create", "work", ["own", "organisation"]),
            perm("lms.courses.approve", "Approve", "full"),
          ],
        },
        {
          key: "paths",
          label: "Learning paths",
          permissions: [perm("lms.paths.view", "View", "view")],
        },
      ],
    },
    {
      key: "hrm",
      label: "HR",
      defaultScope: "organisation",
      features: [
        {
          key: "leave",
          label: "Leave",
          permissions: [
            perm("hrm.leave.view", "View", "view", ["reports", "organisation"]),
            perm("hrm.leave.approve", "Approve", "work", ["reports", "organisation"]),
          ],
        },
        {
          key: "payroll",
          label: "Payroll",
          permissions: [
            perm("hrm.payroll.view", "View", "view", ["organisation"], true),
            perm("hrm.payroll.run", "Run", "work", ["organisation"], true),
          ],
        },
        {
          key: "offboarding",
          label: "Offboarding",
          permissions: [
            perm("hrm.offboarding.view", "View", "view"),
            perm("hrm.offboarding.settle", "Settle", "full", ["organisation"], true),
          ],
        },
      ],
    },
    {
      key: "projects",
      label: "Projects",
      defaultScope: "assigned",
      features: [
        {
          key: "work_items",
          label: "Work items",
          permissions: [
            perm("projects.work_items.view", "View", "view", ["assigned", "organisation"]),
            perm("projects.work_items.edit", "Edit", "work", ["assigned", "organisation"]),
          ],
        },
      ],
    },
  ],
  scopes: [
    { key: "own", label: "Own" },
    { key: "reports", label: "My reports" },
    { key: "assigned", label: "Assigned projects" },
    { key: "organisation", label: "Organisation" },
  ],
  bundles: [
    { key: "view", label: "View" },
    { key: "work", label: "Work" },
    { key: "full", label: "Full" },
  ],
  live: { scopes: { lms: ["organisation"], hrm: ["organisation"], projects: ["organisation", "assigned"] }, seededRoles: false },
};

const SETTINGS = { joinsEveryProject: false, projectActivity: "digest" as const, confidentialModules: [] as string[], organisationAdmin: false };

function role(over: Partial<RoleDetail> = {}): RoleDetail {
  const grants = over.grants ?? [{ key: "lms.courses.view", scope: "organisation" as const }];
  return {
    id: "role-1",
    name: "Course reviewer",
    description: "Checks courses before they go live.",
    kind: "custom",
    systemKey: null,
    seeded: false,
    templateKey: null,
    permissions: grants.map((g) => g.key),
    grants,
    settings: SETTINGS,
    usersCount: 2,
    editable: true,
    createdAt: "2026-09-26T09:00:00Z",
    updatedAt: "2026-09-26T09:00:00Z",
    users: [{ id: "u-1", name: "Ruth Akande", email: "ruth@meridian.test" }],
    ...over,
  };
}

function renderEditor(id: string | null) {
  return render(
    <ConfirmProvider>
      <RoleEditor id={id} />
    </ConfirmProvider>,
  );
}

/** A feature's bundle radio group, and the row it sits in. */
async function bundles(feature: string) {
  const group = await screen.findByRole("radiogroup", { name: `${feature} access level` }, { timeout: 5000 });
  return { group, row: group.closest("li") as HTMLElement };
}

const savedGrants = () => {
  const body = (api.update.mock.calls.at(-1) ?? api.create.mock.calls.at(-1))!;
  const sent = (body.length === 2 ? body[1] : body[0]) as { grants: { key: string; scope: Scope }[] };
  return Object.fromEntries(sent.grants.map((g) => [g.key, g.scope]));
};

beforeEach(() => {
  vi.clearAllMocks();
  api.catalogue.mockResolvedValue(CATALOGUE);
  api.update.mockImplementation(async (_id: string, body: { grants: { key: string; scope: Scope }[] }) =>
    role({ grants: body.grants }),
  );
});

describe("bundles and scopes", () => {
  it("a bundle grants the actions it covers, and reads back as that bundle", async () => {
    api.get.mockResolvedValue(role({ grants: [] }));
    const user = userEvent.setup();
    renderEditor("role-1");

    const { group, row } = await bundles("Courses");
    expect(within(group).getByRole("radio", { name: "None" })).toHaveAttribute("aria-checked", "true");

    await user.click(within(group).getByRole("radio", { name: "Work" }));
    expect(within(group).getByRole("radio", { name: "Work" })).toHaveAttribute("aria-checked", "true");
    expect(row).toHaveTextContent("View, Create");
    expect(screen.getByText(/permissions selected/).textContent).toMatch(/2\s+of\s+12/);

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(savedGrants()).toEqual({ "lms.courses.view": "organisation", "lms.courses.create": "organisation" });
  });

  it("a narrower scope leaves out the actions that don't offer it, says so, and marks it as not live yet", async () => {
    api.get.mockResolvedValue(role({ grants: [] }));
    const user = userEvent.setup();
    renderEditor("role-1");

    const { group, row } = await bundles("Courses");
    await user.click(within(group).getByRole("radio", { name: "Full" }));
    const scope = within(row).getByRole("radiogroup", { name: "Courses scope" });
    expect(within(scope).getByRole("radio", { name: "Organisation" })).toHaveAttribute("aria-checked", "true");

    await user.click(within(scope).getByRole("radio", { name: "Own" }));
    expect(within(group).getByRole("radio", { name: "Full" })).toHaveAttribute("aria-checked", "true");
    expect(row.textContent).toMatch(/1 action only work organisation-wide and was left out/);
    expect(row.textContent).toMatch(/Takes effect when Learning switches to the new checks\. Until then this grant gives nothing/);

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(savedGrants()).toEqual({ "lms.courses.view": "own", "lms.courses.create": "own" });

    // Back to Organisation brings the left-out action back.
    await user.click(within(scope).getByRole("radio", { name: "Organisation" }));
    expect(row.textContent).not.toMatch(/left out/);
    expect(row).toHaveTextContent("View, Create, Approve");
  });

  it("with nothing held, a bundle takes the module's default scope", async () => {
    api.get.mockResolvedValue(role({ grants: [] }));
    const user = userEvent.setup();
    renderEditor("role-1");

    const { group, row } = await bundles("Work items");
    await user.click(within(group).getByRole("radio", { name: "View" }));
    const scope = within(row).getByRole("radiogroup", { name: "Work items scope" });
    expect(within(scope).getByRole("radio", { name: "Assigned projects" })).toHaveAttribute("aria-checked", "true");
    // Assigned is live in Projects today: no "takes effect" note.
    expect(row.textContent).not.toMatch(/Takes effect/);
  });

  it("keys that add up to no one bundle read as Custom, and a bundle click normalises them", async () => {
    api.get.mockResolvedValue(
      role({
        grants: [
          { key: "lms.courses.view", scope: "organisation" },
          { key: "lms.courses.approve", scope: "organisation" },
        ],
      }),
    );
    const user = userEvent.setup();
    renderEditor("role-1");

    const { group, row } = await bundles("Courses");
    expect(row).toHaveTextContent("Custom · 2 of 3");
    for (const r of within(group).getAllByRole("radio")) expect(r).toHaveAttribute("aria-checked", "false");

    await user.click(within(group).getByRole("radio", { name: "View" }));
    expect(row).not.toHaveTextContent("Custom ·");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(savedGrants()).toEqual({ "lms.courses.view": "organisation" });
  });

  it("keys at different scopes show the scope as mixed", async () => {
    api.get.mockResolvedValue(
      role({
        grants: [
          { key: "lms.courses.view", scope: "own" },
          { key: "lms.courses.create", scope: "organisation" },
        ],
      }),
    );
    renderEditor("role-1");

    const { row } = await bundles("Courses");
    expect(row).toHaveTextContent("Custom · 2 of 3");
    expect(row).toHaveTextContent(/Mixed scopes/);
    const scope = within(row).getByRole("radiogroup", { name: "Courses scope" });
    for (const r of within(scope).getAllByRole("radio")) expect(r).toHaveAttribute("aria-checked", "false");
  });

  it("a bundle that adds nothing over the one below is shown but unavailable", async () => {
    api.get.mockResolvedValue(role({ grants: [] }));
    const user = userEvent.setup();
    renderEditor("role-1");

    const { group } = await bundles("Learning paths");
    const work = within(group).getByRole("radio", { name: "Work" });
    expect(work).toHaveAttribute("aria-disabled", "true");
    expect(work).toHaveAttribute("title", "Nothing more in this feature");
    await user.click(work);
    expect(work).toHaveAttribute("aria-checked", "false");
    expect(within(group).getByRole("radio", { name: "None" })).toHaveAttribute("aria-checked", "true");
  });

  it("Customise opens the single actions, each with its own scope", async () => {
    api.get.mockResolvedValue(role({ grants: [] }));
    const user = userEvent.setup();
    renderEditor("role-1");

    await bundles("Leave");
    const toggle = screen.getByRole("button", { name: "Customise Leave" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("checkbox", { name: "Leave: Approve" }));
    const approveScope = screen.getByRole("radiogroup", { name: "Approve scope" });
    await user.click(within(approveScope).getByRole("radio", { name: "My reports" }));

    const { row } = await bundles("Leave");
    expect(row).toHaveTextContent("Custom · 1 of 2");
    expect(row.textContent).toMatch(/Takes effect when HR switches to the new checks/);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(savedGrants()).toEqual({ "hrm.leave.approve": "reports" });
  });
});

describe("set all", () => {
  it("a module's Set all bundles every feature in it and nothing outside it", async () => {
    api.get.mockResolvedValue(role({ grants: [] }));
    const user = userEvent.setup();
    renderEditor("role-1");

    const setAll = await screen.findByRole("radiogroup", { name: "Set all Learning features" }, { timeout: 5000 });
    await user.click(within(setAll).getByRole("radio", { name: "View" }));
    expect(within(setAll).getByRole("radio", { name: "View" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(savedGrants()).toEqual({ "lms.courses.view": "organisation", "lms.paths.view": "organisation" });
  });

  it("under a search it only touches the features shown", async () => {
    api.get.mockResolvedValue(role({ grants: [] }));
    const user = userEvent.setup();
    renderEditor("role-1");

    await user.type(await screen.findByLabelText("Search permissions", {}, { timeout: 5000 }), "paths");
    expect(screen.queryByRole("radiogroup", { name: "Courses access level" })).not.toBeInTheDocument();
    const setAll = screen.getByRole("radiogroup", { name: "Set all shown Learning features" });
    await user.click(within(setAll).getByRole("radio", { name: "Full" }));

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(savedGrants()).toEqual({ "lms.paths.view": "organisation" });
  });

  it("an action that matched the search is marked in the opened actions", async () => {
    api.get.mockResolvedValue(role({ grants: [] }));
    const user = userEvent.setup();
    renderEditor("role-1");

    await user.type(await screen.findByLabelText("Search permissions", {}, { timeout: 5000 }), "settle");
    expect(screen.getByRole("button", { name: "Customise Offboarding" })).toHaveAttribute("aria-expanded", "true");
    const settle = screen.getByRole("checkbox", { name: "Offboarding: Settle" }).closest("li")!;
    expect(settle).toHaveTextContent("Matches search");
    const view = screen.getByRole("checkbox", { name: "Offboarding: View" }).closest("li")!;
    expect(view).not.toHaveTextContent("Matches search");
  });

  it("search says so when nothing matches", async () => {
    api.get.mockResolvedValue(role());
    const user = userEvent.setup();
    renderEditor("role-1");

    await user.type(await screen.findByLabelText("Search permissions", {}, { timeout: 5000 }), "zzz");
    expect(screen.getByText("No permission matches “zzz”.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear the search" }));
    expect(screen.getByRole("radiogroup", { name: "Courses access level" })).toBeInTheDocument();
  });
});

describe("confidential features", () => {
  it("stay locked without Confidential access, and the lock leads to the setting", async () => {
    api.get.mockResolvedValue(role({ grants: [] }));
    const user = userEvent.setup();
    renderEditor("role-1");

    await bundles("Leave");
    expect(screen.queryByRole("radiogroup", { name: "Payroll access level" })).not.toBeInTheDocument();
    const [needs] = screen.getAllByRole("button", { name: "Needs Confidential access for HR" });
    await user.click(needs);
    const hr = screen.getByRole("checkbox", { name: "HR" });
    expect(hr).toHaveFocus();

    await user.click(hr);
    expect(await screen.findByRole("radiogroup", { name: "Payroll access level" })).toBeInTheDocument();
  });

  it("in a mixed feature, the bundles skip the confidential actions", async () => {
    api.get.mockResolvedValue(role({ grants: [] }));
    const user = userEvent.setup();
    renderEditor("role-1");

    const { group, row } = await bundles("Offboarding");
    expect(within(group).getByRole("radio", { name: "Full" })).toHaveAttribute("aria-disabled", "true");
    await user.click(within(group).getByRole("radio", { name: "View" }));
    expect(row.textContent).toMatch(/“Settle” is confidential and left out of the bundles/);

    await user.click(screen.getByRole("button", { name: "Customise Offboarding" }));
    expect(screen.getByRole("checkbox", { name: "Offboarding: Settle" })).toBeDisabled();
  });

  it("turning Confidential access off asks first, then removes what it covered", async () => {
    api.get.mockResolvedValue(
      role({
        grants: [
          { key: "hrm.payroll.view", scope: "organisation" },
          { key: "hrm.payroll.run", scope: "organisation" },
          { key: "hrm.offboarding.settle", scope: "organisation" },
          { key: "hrm.leave.view", scope: "organisation" },
        ],
        settings: { ...SETTINGS, confidentialModules: ["hrm"] },
      }),
    );
    const user = userEvent.setup();
    renderEditor("role-1");

    await bundles("Payroll");
    await user.click(screen.getByRole("checkbox", { name: "HR" }));
    const dialog = screen.getByRole("alertdialog", { name: "Remove 3 confidential permissions?" });
    expect(dialog).toHaveTextContent("Payroll, Offboarding");
    await user.click(within(dialog).getByRole("button", { name: "Remove them" }));

    expect(screen.getByRole("checkbox", { name: "HR" })).not.toBeChecked();
    expect(screen.queryByRole("radiogroup", { name: "Payroll access level" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(api.update).toHaveBeenCalledWith(
      "role-1",
      expect.objectContaining({
        grants: [{ key: "hrm.leave.view", scope: "organisation" }],
        settings: expect.objectContaining({ confidentialModules: [] }),
      }),
    );
  });

  it("keeps the access when the question is cancelled", async () => {
    api.get.mockResolvedValue(
      role({ grants: [{ key: "hrm.payroll.view", scope: "organisation" }], settings: { ...SETTINGS, confidentialModules: ["hrm"] } }),
    );
    const user = userEvent.setup();
    renderEditor("role-1");

    await bundles("Payroll");
    await user.click(screen.getByRole("checkbox", { name: "HR" }));
    const dialog = screen.getByRole("alertdialog", { name: "Remove 1 confidential permission?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("checkbox", { name: "HR" })).toBeChecked();
    expect(screen.getByRole("radiogroup", { name: "Payroll access level" })).toBeInTheDocument();
  });
});

describe("role settings", () => {
  it("saves the switches, and Project activity appears with Joins every project", async () => {
    api.get.mockResolvedValue(role());
    const user = userEvent.setup();
    renderEditor("role-1");

    await bundles("Courses");
    expect(screen.queryByRole("radiogroup", { name: "Project activity" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Joins every project" }));
    const activity = screen.getByRole("radiogroup", { name: "Project activity" });
    await user.click(within(activity).getByRole("radio", { name: "Everything" }));
    await user.click(screen.getByRole("switch", { name: "Organisation admin" }));

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(api.update).toHaveBeenCalledWith(
      "role-1",
      expect.objectContaining({
        settings: { joinsEveryProject: true, projectActivity: "everything", confidentialModules: [], organisationAdmin: true },
      }),
    );
  });

  it("shows each save error where it belongs", async () => {
    api.get.mockResolvedValue(role({ settings: { ...SETTINGS, organisationAdmin: true } }));
    api.update.mockRejectedValue(
      new ApiError("The given data was invalid.", 422, {
        permissions: ["You can only grant permissions you hold yourself."],
        settings: ["Only an organisation admin can make a role an Organisation admin."],
        roleIds: ["This would leave the organisation with no Organisation admin. Give the role to somebody else first."],
      }),
    );
    const user = userEvent.setup();
    renderEditor("role-1");

    await bundles("Courses");
    await user.click(screen.getByRole("switch", { name: "Organisation admin" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Check the highlighted fields.")).toBeInTheDocument();
    const permissions = screen.getByText("You can only grant permissions you hold yourself.");
    expect(permissions.closest("section")).toHaveTextContent("Permissions");
    const settings = screen.getByText("Only an organisation admin can make a role an Organisation admin.");
    expect(settings.closest("section")).toHaveTextContent("Role settings");
    expect(screen.getByText(/would leave the organisation with no Organisation admin/).closest("section")).toHaveTextContent(
      "Role settings",
    );
  });
});

describe("a seeded role", () => {
  it("shows its template key and says it doesn't grant anything yet", async () => {
    api.get.mockResolvedValue(role({ name: "PMO Lead", seeded: true, templateKey: "pmo_lead" }));
    renderEditor("role-1");

    expect(await screen.findByText("Seeded", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTitle("The key the product recognises this role by. Renaming the role doesn't change it.")).toHaveTextContent(
      "pmo_lead",
    );
    expect(screen.getByRole("note")).toHaveTextContent("Seeded roles don't grant anything yet.");
    // Every module says so too, so no grant further down reads as working today.
    for (const m of ["Learning", "HR", "Projects"]) {
      expect(screen.getByText(`Grants nothing in ${m} yet: seeded roles take effect when ${m} switches to the new checks.`)).toBeInTheDocument();
    }
  });

  it("says where seeded roles act already once a module has switched", async () => {
    api.catalogue.mockResolvedValue({
      ...CATALOGUE,
      live: {
        scopes: { ...CATALOGUE.live.scopes, projects: ["own", "reports", "assigned", "organisation"] },
        seededRoles: false,
        seededModules: ["projects", "hrm"],
      },
    });
    api.get.mockResolvedValue(role({ name: "PMO Lead", seeded: true, templateKey: "pmo_lead" }));
    renderEditor("role-1");

    expect(await screen.findByText("Seeded", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Seeded roles act in HR and Projects already.");
    for (const m of ["Learning"]) {
      expect(screen.getByText(`Grants nothing in ${m} yet: seeded roles take effect when ${m} switches to the new checks.`)).toBeInTheDocument();
    }
    expect(screen.queryByText(/Grants nothing in Projects/)).not.toBeInTheDocument();
  });

  it("a role that isn't seeded carries no such line", async () => {
    api.get.mockResolvedValue(role());
    renderEditor("role-1");

    await bundles("Courses");
    expect(screen.queryByText(/Grants nothing in/)).not.toBeInTheDocument();
  });
});

describe("a built-in role", () => {
  it("opens read-only, reads its keys as bundles at Organisation, and offers a copy to customise", async () => {
    api.get.mockResolvedValue(
      role({
        // The built-in User role; HR keys stand in for whatever it holds, to show them as bundles.
        id: "system:user",
        name: "User",
        kind: "system",
        systemKey: "user",
        editable: false,
        grants: [
          { key: "hrm.leave.view", scope: "organisation" },
          { key: "hrm.leave.approve", scope: "organisation" },
          { key: "hrm.payroll.view", scope: "organisation" },
        ],
        settings: null,
      }),
    );
    api.duplicate.mockResolvedValue(role({ id: "copy-1", name: "User (copy)" }));
    const user = userEvent.setup();
    renderEditor("system:user");

    const { group, row } = await bundles("Leave");
    expect(within(group).getByRole("radio", { name: "Work" })).toHaveAttribute("aria-checked", "true");
    for (const r of within(group).getAllByRole("radio")) expect(r).toBeDisabled();
    expect(within(within(row).getByRole("radiogroup", { name: "Leave scope" })).getByRole("radio", { name: "Organisation" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    // Confidential features are not locked on a built-in role: it shows what it holds.
    expect(within(await bundles("Payroll").then((b) => b.group)).getByRole("radio", { name: "View" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Customise Leave" }));
    const approve = screen.getByRole("checkbox", { name: "Leave: Approve" });
    expect(approve).toBeChecked();
    expect(approve).toBeDisabled();

    expect(screen.getByLabelText("Name")).toBeDisabled();
    expect(screen.getByText(/Built-in roles have no settings/)).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: /Set all/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Duplicate to customise" }));
    expect(api.duplicate).toHaveBeenCalledWith("system:user");
    expect(push).toHaveBeenCalledWith("/suite/org/roles/copy-1");
  });
});

describe("creating", () => {
  it("sends grants and the default settings", async () => {
    api.create.mockResolvedValue(role({ id: "new-1" }));
    const user = userEvent.setup();
    renderEditor(null);

    await user.type(await screen.findByLabelText("Name", {}, { timeout: 5000 }), "Course reviewer");
    const { group } = await bundles("Courses");
    await user.click(within(group).getByRole("radio", { name: "View" }));
    await user.click(screen.getByRole("button", { name: "Create role" }));

    expect(api.create).toHaveBeenCalledWith({
      name: "Course reviewer",
      description: null,
      grants: [{ key: "lms.courses.view", scope: "organisation" }],
      settings: SETTINGS,
    });
    expect(push).toHaveBeenCalledWith("/suite/org/roles/new-1");
  });
});

describe("leaving and deleting", () => {
  it("asks before discarding unsaved changes", async () => {
    api.get.mockResolvedValue(role());
    const user = userEvent.setup();
    renderEditor("role-1");

    const { group } = await bundles("Courses");
    await user.click(within(group).getByRole("radio", { name: "Work" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    const dialog = screen.getByRole("alertdialog", { name: "Discard your changes?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(push).not.toHaveBeenCalled();
  });

  it("is not dirty after a change is undone", async () => {
    api.get.mockResolvedValue(role());
    const user = userEvent.setup();
    renderEditor("role-1");

    const { group } = await bundles("Courses");
    await user.click(within(group).getByRole("radio", { name: "Work" }));
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await user.click(within(group).getByRole("radio", { name: "View" }));
    expect(screen.getByText("All changes saved.")).toBeInTheDocument();
  });

  it("confirms a delete and says holders lose it while it is in the bin", async () => {
    api.get.mockResolvedValue(role());
    api.remove.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderEditor("role-1");

    await user.click(await screen.findByRole("button", { name: "Delete" }, { timeout: 5000 }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete “Course reviewer”?" });
    expect(within(dialog).getByText(/2 users who hold it lose its permissions/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Delete role" }));
    expect(api.remove).toHaveBeenCalledWith("role-1");
    expect(push).toHaveBeenCalledWith("/suite/org/roles");
  });
});
