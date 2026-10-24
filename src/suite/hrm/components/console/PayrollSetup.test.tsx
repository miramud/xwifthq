import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  GrantLoanDialog,
  PayElements,
  Readiness,
  StatutoryRates,
  salariesSummary,
} from "./PayrollSetup";
import type { PayElement, StatutorySchedule } from "@/lib/api/hrm-client";
import { chooseOption } from "@/test/selectOption";

/**
 * Setting payroll up.
 *
 * None of this could be done through a screen before. What is worth pinning is
 * the arithmetic at the boundary, figures are typed in naira and percent and
 * stored in kobo and basis points, and a form that got that wrong would be
 * wrong by a factor of a hundred on a payslip.
 *
 * The other half is what the forms *say*. Each one carries a decision somebody
 * would otherwise have to discover: that a rate change supersedes rather than
 * edits, and that an advance comes back in one go.
 */

const {
  elements,
  createElement,
  schedules,
  supersedeSchedule,
  grantLoan,
} = vi.hoisted(() => ({
  elements: vi.fn(),
  createElement: vi.fn(),
  schedules: vi.fn(),
  supersedeSchedule: vi.fn(),
  grantLoan: vi.fn(),
}));

// DataView reads the app router to open rows; there is none under jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/hrm/payroll",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return {
    ...actual,
    hrm: {
      payroll: { elements, createElement, schedules, supersedeSchedule, grantLoan },
    },
  };
});

const HOUSING: PayElement = {
  id: "pe-1",
  name: "Housing allowance",
  code: "HOUSING",
  description: null,
  kind: "earning",
  kindLabel: "Earning",
  addsToGross: true,
  reducesNet: false,
  basis: "percent_of_basic",
  basisLabel: "Percentage of basic",
  isPercentage: true,
  amountKobo: 0,
  rateBasisPoints: 2500,
  ratePercent: 25,
  isTaxable: true,
  isPensionable: true,
  sequence: 100,
  isActive: true,
};

const PAYE: StatutorySchedule = {
  id: "ss-1",
  kind: "paye",
  kindLabel: "PAYE",
  name: "PAYE (Nigeria)",
  isPlatformDefault: true,
  effectiveFrom: "2020-01-01",
  effectiveTo: null,
  isCurrent: true,
  employeeRateBasisPoints: 0,
  employerRateBasisPoints: 0,
  employeeRatePercent: 0,
  employerRatePercent: 0,
  isTaxRelief: false,
  config: null,
  isActive: true,
  bands: [
    {
      id: "b-1",
      position: 1,
      widthKobo: 30_000_000,
      isTopBand: false,
      rateBasisPoints: 700,
      ratePercent: 7,
    },
    {
      id: "b-2",
      position: 2,
      widthKobo: null,
      isTopBand: true,
      rateBasisPoints: 2400,
      ratePercent: 24,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  elements.mockResolvedValue([HOUSING]);
  createElement.mockResolvedValue(HOUSING);
  schedules.mockResolvedValue([PAYE]);
  supersedeSchedule.mockResolvedValue(PAYE);
  grantLoan.mockResolvedValue({});
});

describe("PayElements", () => {
  it("shows a percentage element as a percentage of its base", async () => {
    render(<PayElements />);

    expect(await screen.findByText("Housing allowance")).toBeInTheDocument();
    expect(screen.getByText(/25% of basic/)).toBeInTheDocument();
  });

  /*
    A percentage of gross that itself adds to gross is only well-defined
    because of the two-pass evaluation, and somebody configuring one deserves
    to know that rather than discovering it.
  */
  it("warns that percentages of gross cannot inflate each other", async () => {
    const user = userEvent.setup();
    render(<PayElements />);

    await user.click(await screen.findByRole("button", { name: "Add an element" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Add a pay element",
    });

    await chooseOption(
      user,
      within(dialog).getByLabelText(/How it is worked out/),
      "A percentage of gross",
    );

    expect(
      within(dialog).getByText(/cannot inflate each other/),
    ).toBeInTheDocument();
  });

  /* Typed in percent; stored in basis points so nothing rounds twice. */
  it("converts a percentage to basis points on the way out", async () => {
    const user = userEvent.setup();
    render(<PayElements />);

    await user.click(await screen.findByRole("button", { name: "Add an element" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Add a pay element",
    });

    await user.type(within(dialog).getByLabelText("Name"), "Transport");
    await user.type(within(dialog).getByLabelText("Short code"), "TRANSPORT");
    await user.clear(within(dialog).getByLabelText("Percentage"));
    await user.type(within(dialog).getByLabelText("Percentage"), "12.5");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(createElement).toHaveBeenCalledWith(
        expect.objectContaining({ rateBasisPoints: 1250, amountKobo: 0 }),
      ),
    );
  });

  it("converts a fixed amount to kobo on the way out", async () => {
    const user = userEvent.setup();
    render(<PayElements />);

    await user.click(await screen.findByRole("button", { name: "Add an element" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Add a pay element",
    });

    await user.type(within(dialog).getByLabelText("Name"), "Meal allowance");
    await user.type(within(dialog).getByLabelText("Short code"), "MEAL");
    await chooseOption(
      user,
      within(dialog).getByLabelText(/How it is worked out/),
      "A fixed amount",
    );
    await user.type(within(dialog).getByLabelText(/Amount/), "25000");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(createElement).toHaveBeenCalledWith(
        expect.objectContaining({ amountKobo: 2_500_000, rateBasisPoints: 0 }),
      ),
    );
  });

  /*
    Both flags are per element rather than inferred, which is what lets a
    non-taxable transport allowance exist without a special case.
  */
  it("offers tax and pension treatment only for earnings", async () => {
    const user = userEvent.setup();
    render(<PayElements />);

    await user.click(await screen.findByRole("button", { name: "Add an element" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Add a pay element",
    });

    expect(within(dialog).getByLabelText(/PAYE applies/)).toBeInTheDocument();

    await chooseOption(
      user,
      within(dialog).getByLabelText(/What it does/),
      "Deduction",
    );

    expect(within(dialog).queryByLabelText(/PAYE applies/)).not.toBeInTheDocument();
  });
});

describe("StatutoryRates", () => {
  it("marks a shared default so nobody thinks they are editing everybody's", async () => {
    render(<StatutoryRates />);

    expect(await screen.findByText("Shared default")).toBeInTheDocument();
  });

  it("shows the bands with the open-ended one named as such", async () => {
    render(<StatutoryRates />);

    expect(await screen.findByText("Everything above")).toBeInTheDocument();
    expect(screen.getByText("24%")).toBeInTheDocument();
  });

  /*
    The whole versioning model in one sentence. Somebody expecting an edit
    needs to know they are creating a version with a start date.
  */
  it("says that a change supersedes rather than edits", async () => {
    const user = userEvent.setup();
    render(<StatutoryRates />);

    await user.click(await screen.findByRole("button", { name: "Change" }));

    const dialog = await screen.findByRole("dialog", {
      name: /Change PAYE/,
    });

    expect(
      within(dialog).getByText(/creates a new version rather than editing/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/keep the rates they were calculated under/),
    ).toBeInTheDocument();
  });

  it("sends the band rates as basis points", async () => {
    const user = userEvent.setup();
    render(<StatutoryRates />);

    await user.click(await screen.findByRole("button", { name: "Change" }));

    const dialog = await screen.findByRole("dialog", { name: /Change PAYE/ });

    await user.type(within(dialog).getByLabelText("In force from"), "2027-01-01");
    await user.click(
      within(dialog).getByRole("button", { name: "Create version" }),
    );

    await waitFor(() =>
      expect(supersedeSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          effectiveFrom: "2027-01-01",
          bands: [
            { widthKobo: 30_000_000, rateBasisPoints: 700 },
            { widthKobo: null, rateBasisPoints: 2400 },
          ],
        }),
      ),
    );
  });
});

describe("GrantLoanDialog", () => {
  function setup() {
    const onGranted = vi.fn();

    render(
      <GrantLoanDialog
        employeeId="emp-1"
        employeeName="Ada Lovelace"
        onClose={vi.fn()}
        onGranted={onGranted}
      />,
    );

    return { user: userEvent.setup(), onGranted };
  }

  /*
    An advance is not a short loan. It is this month's own money early, and
    reporting it as borrowing misstates both the receivables and what the
    person owes.
  */
  it("explains that an advance comes back in one go", async () => {
    const { user } = setup();

    await chooseOption(
      user,
      screen.getByLabelText(/What kind/),
      "Salary advance, recovered next run",
    );

    expect(
      screen.getByText(/this month's own pay, early/),
    ).toBeInTheDocument();
  });

  it("hides the instalment count for an advance", async () => {
    const { user } = setup();

    expect(screen.getByLabelText("Over how many runs")).toBeInTheDocument();

    await chooseOption(
      user,
      screen.getByLabelText(/What kind/),
      "Salary advance, recovered next run",
    );

    expect(
      screen.queryByLabelText("Over how many runs"),
    ).not.toBeInTheDocument();
  });

  it("forces an advance to a single instalment whatever was typed", async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/Amount/), "150000");
    await chooseOption(
      user,
      screen.getByLabelText(/What kind/),
      "Salary advance, recovered next run",
    );
    await user.click(screen.getByRole("button", { name: "Advance" }));

    await waitFor(() =>
      expect(grantLoan).toHaveBeenCalledWith(
        "emp-1",
        expect.objectContaining({
          kind: "salary_advance",
          principalKobo: 15_000_000,
          instalmentsTotal: 1,
        }),
      ),
    );
  });

  /* Deductions never push somebody's pay below zero. */
  it("says collection is capped at what somebody can afford", async () => {
    setup();

    expect(
      screen.getByText(/never so far that/),
    ).toBeInTheDocument();
  });
});

describe("Readiness", () => {
  /*
    Somebody with no pay profile is invisible on a list of profiles, they
    simply do not appear, and discovering that on payday is the worst version
    of this problem.
  */
  it("lists people with no salary set at all, and marks them worse", () => {
    render(
      <Readiness
        incomplete={[
          { employeeId: "e-1", name: "Grace Hopper", missing: ["Pension PIN"] },
        ]}
        withoutProfile={[
          { employeeId: "e-2", name: "Alan Turing", jobTitle: "Engineer" },
        ]}
      />,
    );

    // Named twice: visibly, and by the avatar for screen readers.
    expect(screen.getAllByText("Alan Turing")[0]).toBeInTheDocument();
    expect(screen.getByText("No salary set")).toBeInTheDocument();
    // And the merely incomplete one names what is missing.
    expect(screen.getByText("Pension PIN")).toBeInTheDocument();
  });

  it("renders nothing when everybody can be paid", () => {
    const { container } = render(
      <Readiness incomplete={[]} withoutProfile={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

/*
  "Cannot be paid" means what the run's own check means, no bank account
  number. Missing statutory details are counted separately, so the Salaries
  banner and "Before you approve" never disagree.
*/
describe("salariesSummary", () => {
  it("keeps details-missing and cannot-be-paid apart", () => {
    expect(salariesSummary(11, 1)).toBe("11 have details missing. 1 cannot be paid: no bank account number.");
  });

  it("does not say anybody cannot be paid when only details are missing", () => {
    expect(salariesSummary(3, 0)).toBe("3 have details missing, but everybody can be paid. Open one to see what is missing.");
  });

  it("is quiet when everything is filled in", () => {
    expect(salariesSummary(0, 0)).toBe("Everybody with a profile can be paid.");
  });
});
