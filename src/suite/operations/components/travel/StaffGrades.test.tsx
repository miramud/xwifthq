import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, type StaffGrades as Grades } from "@/lib/api/operations-travel-client";
import { chooseOption } from "@/test/selectOption";
import PolicyTable from "./PolicyTable";
import StaffGrades from "./StaffGrades";

/** Staff grades on the travel policy page: searched, filtered, and changed in place by those allowed. */

const api = vi.hoisted(() => ({ grades: vi.fn(), setGrade: vi.fn(), policy: vi.fn() }));
const auth = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock("@/lib/api/operations-travel-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-travel-client")>();
  return { ...actual, travel: { ...actual.travel, desk: { ...actual.travel.desk, grades: api.grades, setGrade: api.setGrade, policy: api.policy } } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-1", role: "user", name: "Halima Yusuf", organisationId: "o", permissions: auth.permissions }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/suite/operations/travel/policy", useSearchParams: () => new URLSearchParams() }));

const GRADES = { officer: "Officer", senior: "Senior staff", manager: "Manager / HOD", executive: "Management" };
const payload = (over: Partial<Grades> = {}): Grades => ({
  grades: GRADES,
  staff: [
    { userId: "u-efe", name: "Efe Omoregie", jobTitle: "Business analyst", grade: "senior", onRecord: true },
    { userId: "u-yusuf", name: "Yusuf Abdullahi", jobTitle: "Software engineer", grade: "officer", onRecord: false },
    { userId: "u-ngozi", name: "Ngozi Eze", jobTitle: "Financial controller", grade: "executive", onRecord: true },
  ],
  ...over,
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  auth.permissions = ["admin.travel_desk.view"];
  api.grades.mockResolvedValue(payload());
  api.policy.mockResolvedValue({ grades: GRADES, classes: { local_tier1: "Lagos / Abuja / Port Harcourt" }, rates: [] });
});

describe("StaffGrades", () => {
  it("lists everybody's grade, finds by name or job title, and shows who has none set", async () => {
    const user = userEvent.setup();
    render(<StaffGrades canEdit={false} />);
    const list = await screen.findByRole("list", { name: "Staff and their travel grades" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByText("Senior staff")).toBeInTheDocument();
    expect(within(list).getByText("Default, not set")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search staff" }), "controller");
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getAllByText("Ngozi Eze").length).toBeGreaterThan(0);

    await user.clear(screen.getByRole("searchbox", { name: "Search staff" }));
    await user.click(screen.getByRole("radio", { name: "No grade set (1)" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getAllByText("Yusuf Abdullahi").length).toBeGreaterThan(0);
  });

  it("sets a grade in place and shows the record the API returns", async () => {
    const user = userEvent.setup();
    api.setGrade.mockResolvedValue(
      payload({
        staff: [
          { userId: "u-efe", name: "Efe Omoregie", jobTitle: "Business analyst", grade: "senior", onRecord: true },
          { userId: "u-yusuf", name: "Yusuf Abdullahi", jobTitle: "Software engineer", grade: "senior", onRecord: true },
          { userId: "u-ngozi", name: "Ngozi Eze", jobTitle: "Financial controller", grade: "executive", onRecord: true },
        ],
      }),
    );
    render(<StaffGrades canEdit />);
    const grade = await screen.findByRole("combobox", { name: "Travel grade for Yusuf Abdullahi" });
    await chooseOption(user, grade, "Senior staff");
    expect(api.setGrade).toHaveBeenCalledWith("u-yusuf", "senior");
    expect(await screen.findByText("Yusuf Abdullahi now travels as Senior staff.")).toBeInTheDocument();
    expect(screen.queryByText("Default, not set")).not.toBeInTheDocument();
  });

  it("puts a refusal on the person's row", async () => {
    const user = userEvent.setup();
    api.setGrade.mockRejectedValue(new ApiError("The selected grade is invalid.", 422, { grade: ["The selected grade is invalid."] }));
    render(<StaffGrades canEdit />);
    await chooseOption(user, await screen.findByRole("combobox", { name: "Travel grade for Efe Omoregie" }), "Management");
    expect(await screen.findByRole("alert")).toHaveTextContent("Efe Omoregie's grade wasn't changed. The selected grade is invalid.");
  });
});

describe("PolicyTable's staff grades", () => {
  it("lets only somebody allowed to set grades change them", async () => {
    render(<PolicyTable />);
    expect(await screen.findByRole("heading", { name: "Staff grades" })).toBeInTheDocument();
    expect((await screen.findAllByText("Efe Omoregie")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("combobox", { name: /Travel grade for/ })).not.toBeInTheDocument();
  });

  it("offers the inline picker with the set_grade permission", async () => {
    auth.permissions = ["admin.travel_desk.view", "admin.travel_desk.set_grade"];
    render(<PolicyTable />);
    expect(await screen.findByRole("combobox", { name: "Travel grade for Efe Omoregie" })).toBeInTheDocument();
  });
});
