import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IssueContractDialog } from "./ContractActions";
import { chooseOption } from "@/test/selectOption";

/**
 * Issuing an agreement.
 *
 * H24 (NEEDS-REPRO): the handbook capture saw Notice period, Department and
 * Gross salary empty after "Kind of employment" was changed. The dialog keeps
 * every field in its own state and nothing resets on a kind change; this pins
 * that, so a regression shows up here rather than in a screenshot.
 */

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return {
    ...actual,
    hrm: {
      contracts: { issue: vi.fn() },
      employees: { list: vi.fn(), listAll: vi.fn(async () => []) },
    },
  };
});

vi.mock("@/lib/api/job-titles-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/job-titles-client")>();

  return { ...actual, loadJobTitles: vi.fn(async () => undefined) };
});

describe("IssueContractDialog", () => {
  it("keeps what was typed when the kind of employment changes", async () => {
    const user = userEvent.setup();

    render(<IssueContractDialog employeeId="e-1" onClose={() => {}} onIssued={() => {}} />);

    await user.type(screen.getByLabelText("Notice period (days)"), "30");
    await user.type(screen.getByLabelText("Department"), "Clinical");
    await user.type(screen.getByLabelText(/Gross salary/), "450000");

    await chooseOption(user, screen.getByLabelText("Kind of employment"), "Fixed term");

    expect(screen.getByLabelText("Notice period (days)")).toHaveValue(30);
    expect(screen.getByLabelText("Department")).toHaveValue("Clinical");
    expect(screen.getByLabelText(/Gross salary/)).toHaveValue(450000);
  });
});
