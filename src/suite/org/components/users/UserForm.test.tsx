import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EMPTY_USER, UserForm, toInput } from "./UserForm";
import { chooseOption } from "@/test/selectOption";
import { primeJobTitlesCache } from "@/lib/api/job-titles-client";
import { roles as rolesApi, type Role, type RoleSettings } from "@/lib/api/roles-client";

vi.mock("@/lib/api/roles-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/roles-client")>();
  return {
    ...actual,
    roles: { ...actual.roles, list: vi.fn().mockResolvedValue([]) },
    permissions: { ...actual.permissions, catalogue: vi.fn().mockResolvedValue({ modules: [] }) },
  };
});

const jt = (id: string, name: string, position: number) => ({
  id,
  key: id,
  name,
  position,
  isActive: true,
  peopleCount: 0,
});

beforeEach(() => {
  primeJobTitlesCache([jt("t-1", "Finance Officer", 1), jt("t-2", "QA Engineer", 2)]);
});

function role(id: string, name: string, settings: Partial<RoleSettings> = {}): Role {
  return {
    id,
    name,
    description: null,
    kind: "custom",
    systemKey: null,
    seeded: true,
    permissions: [],
    settings: { joinsEveryProject: false, projectActivity: "digest", confidentialModules: [], organisationAdmin: false, ...settings },
    usersCount: 0,
    editable: true,
    createdAt: null,
    updatedAt: null,
  } as Role;
}

const ROLES = [
  role("r-admin", "Organisation admin", { organisationAdmin: true }),
  role("r-hr", "HR Management Lead", { confidentialModules: ["hrm"] }),
  role("r-instructor", "Instructor"),
];

function renderForm(canGrantAdmin?: boolean) {
  render(
    <UserForm initial={EMPTY_USER} onSubmit={vi.fn()} canGrantAdmin={canGrantAdmin}>
      {() => null}
    </UserForm>,
  );
}

describe("UserForm roles", () => {
  it("makes an admin with the Organisation admin role, not a separate Admin/User choice", async () => {
    vi.mocked(rolesApi.list).mockResolvedValueOnce(ROLES);
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <UserForm initial={{ ...EMPTY_USER, name: "Ada", email: "ada@example.com" }} onSubmit={onSubmit}>
        {() => <button type="submit">Save</button>}
      </UserForm>,
    );

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    await user.click(await screen.findByRole("checkbox", { name: /^Organisation admin/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const input = toInput(onSubmit.mock.calls[0][0]);
    expect(input.roleIds).toEqual(["r-admin"]);
    expect(input).not.toHaveProperty("role");
  });

  it("leaves roles carrying Organisation admin or Confidential access to an admin", async () => {
    vi.mocked(rolesApi.list).mockResolvedValueOnce(ROLES);
    renderForm(false);

    expect(await screen.findByRole("checkbox", { name: /^Organisation admin/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /^HR Management Lead/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /^Instructor/ })).toBeEnabled();
    expect(screen.getAllByText("Only an organisation admin can give this role.")).toHaveLength(2);
  });

  it("keeps your own admin role ticked", async () => {
    vi.mocked(rolesApi.list).mockResolvedValueOnce(ROLES);
    render(
      <UserForm initial={{ ...EMPTY_USER, roleIds: ["r-admin", "r-instructor"] }} onSubmit={vi.fn()} self>
        {() => null}
      </UserForm>,
    );

    const admin = await screen.findByRole("checkbox", { name: /^Organisation admin/ });
    expect(admin).toBeChecked();
    expect(admin).toBeDisabled();
    expect(screen.getByText("You can't remove your own admin access. Another admin can.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Organisation admin" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Instructor" })).toBeInTheDocument();
  });
});

describe("UserForm job title", () => {
  it("picks the job title from the organisation's list", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <UserForm initial={{ ...EMPTY_USER, name: "Ada", email: "ada@example.com" }} onSubmit={onSubmit}>
        {() => <button type="submit">Save</button>}
      </UserForm>,
    );

    await chooseOption(user, "Job title", "QA Engineer");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(toInput(onSubmit.mock.calls[0][0]).jobTitle).toBe("QA Engineer");
  });

  it("keeps the title somebody already has", () => {
    render(
      <UserForm initial={{ ...EMPTY_USER, jobTitle: "Head of Vibes" }} onSubmit={vi.fn()}>
        {() => null}
      </UserForm>,
    );
    expect(screen.getByRole("combobox", { name: "Job title" })).toHaveTextContent("Head of Vibes");
  });
});

describe("UserForm effective permissions", () => {
  it("calls an empty list self-service rather than '0 in total'", async () => {
    renderForm();
    expect(await screen.findByText("Self-service only")).toBeInTheDocument();
    expect(screen.getByText(/their own employment, learning and project work/i)).toBeInTheDocument();
    expect(screen.queryByText(/0 in total/)).not.toBeInTheDocument();
  });
});
