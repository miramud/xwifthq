import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportsToDialog } from "./ReportsTo";
import { chooseOption, openCombobox } from "@/test/selectOption";
import { ApiError, type Employee } from "@/lib/api/hrm-client";

/**
 * "Reports to" on the employee record (S9/H12).
 *
 * The API owns the reporting-line rules; the dialog's job is to offer the
 * right people and to show the API's sentence under the field when a line is
 * refused, rather than a generic failure.
 */

const employees = vi.hoisted(() => ({ listAll: vi.fn(), update: vi.fn() }));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();
  return { ...actual, hrm: { employees } };
});

function person(id: string, name: string, extra: Partial<Employee> = {}): Employee {
  return {
    id,
    person: { id: `u-${id}`, name, email: `${id}@example.test`, avatar: null },
    jobTitle: "Engineer",
    department: "Engineering",
    isCurrent: true,
    manager: null,
    ...extra,
  } as Employee;
}

const TOLU = person("emp-tolu", "Tolu Ade");
const MO = person("emp-mo", "Mo Bello");
const GONE = person("emp-gone", "Gone Person", { isCurrent: false });

beforeEach(() => {
  vi.clearAllMocks();
  employees.listAll.mockResolvedValue([TOLU, MO, GONE]);
});

describe("ReportsToDialog", () => {
  it("offers current colleagues only, never the person themselves", async () => {
    const user = userEvent.setup();
    render(<ReportsToDialog employee={TOLU} onClose={vi.fn()} onSaved={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole("combobox", { name: "Reports to" })).not.toHaveProperty("disabled", true));
    const listbox = await openCombobox(user, "Reports to");

    expect(within(listbox).getByRole("option", { name: "Mo Bello" })).toBeTruthy();
    expect(within(listbox).queryByRole("option", { name: "Tolu Ade" })).toBeNull();
    expect(within(listbox).queryByRole("option", { name: "Gone Person" })).toBeNull();
  });

  it("saves the line, and shows the API's refusal under the field", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    employees.update.mockRejectedValueOnce(
      new ApiError("The given data was invalid.", 422, {
        manager_id: ["That would make the reporting line loop back on itself."],
      }),
    );

    render(<ReportsToDialog employee={TOLU} onClose={vi.fn()} onSaved={onSaved} />);

    await waitFor(() => expect(screen.getByRole("combobox", { name: "Reports to" })).not.toHaveProperty("disabled", true));
    await chooseOption(user, "Reports to", "Mo Bello");
    await user.click(screen.getByRole("button", { name: "Save reporting line" }));

    expect(await screen.findByText("That would make the reporting line loop back on itself.")).toBeTruthy();
    expect(employees.update).toHaveBeenCalledWith("emp-tolu", { managerId: "emp-mo" });
    expect(onSaved).not.toHaveBeenCalled();

    employees.update.mockResolvedValueOnce({ ...TOLU, manager: { id: "emp-mo", name: "Mo Bello", jobTitle: "Engineer" } });
    await user.click(screen.getByRole("button", { name: "Save reporting line" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
