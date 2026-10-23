import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Condition } from "@/lib/api/org-foundations-client";
import { ConditionBuilder } from "./ConditionBuilder";
import type { BuilderField } from "./policy-logic";
import { chooseOption } from "@/test/selectOption";

/**
 * The condition builder edits the API's Condition JSON: typed naira become
 * kobo, groups nest as all/any, and a 422 path lands next to its control.
 */

vi.mock("./lookups", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lookups")>();
  return {
    ...actual,
    useLookup: (key: string | null) => ({
      status: "ready",
      options: key === "units" ? [{ value: "u-eng", label: "Faculty of Engineering" }] : [],
    }),
  };
});

const FIELDS: BuilderField[] = [
  { key: "amount", label: "Amount", type: "money", options: [] },
  {
    key: "category",
    label: "Memo category",
    type: "enum",
    options: [
      { value: "general", label: "General" },
      { value: "hiring", label: "Hiring" },
    ],
  },
  { key: "unitId", label: "Unit", type: "unit", options: [] },
];

function Harness({ initial, onJson, errors }: { initial: Condition; onJson: (c: Condition) => void; errors?: Record<string, string[]> }) {
  const [value, setValue] = useState<Condition>(initial);
  return (
    <ConditionBuilder
      value={value}
      onChange={(c) => {
        setValue(c);
        onJson(c);
      }}
      fields={FIELDS}
      path="rules.0.when"
      errors={errors}
    />
  );
}

describe("ConditionBuilder", () => {
  it("starts from 'every request' and adds a money comparison stored in kobo", async () => {
    const user = userEvent.setup();
    const onJson = vi.fn();
    render(<Harness initial={{ always: true }} onJson={onJson} />);

    expect(screen.getByText("Applies to every request.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add a condition" }));
    expect(onJson).toHaveBeenLastCalledWith({ all: [{ field: "amount", op: "gt", value: 0 }] });

    const amount = screen.getByLabelText("Amount in naira");
    await user.clear(amount);
    await user.type(amount, "5,000,000.50");
    expect(onJson).toHaveBeenLastCalledWith({ all: [{ field: "amount", op: "gt", value: 500000050 }] });
  });

  it("switches to 'between' with a low and high amount", async () => {
    const user = userEvent.setup();
    const onJson = vi.fn();
    render(<Harness initial={{ field: "amount", op: "gt", value: 100 }} onJson={onJson} />);

    fireEvent.change(screen.getByLabelText("Comparison"), { target: { value: "between" } });
    // A bare comparison stays bare: no group is invented around it.
    expect(onJson).toHaveBeenLastCalledWith({ field: "amount", op: "between", value: [0, 0] });

    await user.type(screen.getByLabelText("Lowest amount"), "1000");
    await user.type(screen.getByLabelText("Highest amount"), "250000");
    expect(onJson).toHaveBeenLastCalledWith({ field: "amount", op: "between", value: [100000, 25000000] });
  });

  it("nests an 'any' group inside 'all' and picks enum values for 'is one of'", async () => {
    const user = userEvent.setup();
    const onJson = vi.fn();
    render(<Harness initial={{ all: [{ field: "amount", op: "gte", value: 100 }] }} onJson={onJson} />);

    await user.click(screen.getByRole("button", { name: "Add group" }));
    const last = onJson.mock.lastCall![0] as { all: Condition[] };
    expect(last.all[1]).toEqual({ any: [{ field: "amount", op: "gt", value: 0 }] });

    // Point the nested condition at the category, then "is one of" Hiring.
    const fieldBoxes = screen.getAllByRole("combobox", { name: "Field" });
    await chooseOption(user, fieldBoxes[1], "Memo category");
    const comparisons = screen.getAllByLabelText("Comparison");
    fireEvent.change(comparisons[1], { target: { value: "in" } });
    await chooseOption(user, screen.getAllByRole("combobox").at(-1)!, "Hiring");

    expect(onJson).toHaveBeenLastCalledWith({
      all: [
        { field: "amount", op: "gte", value: 100 },
        { any: [{ field: "category", op: "in", value: ["hiring"] }] },
      ],
    });
  });

  it("turns a comparison into 'not' and flips a group to 'any'", async () => {
    const user = userEvent.setup();
    const onJson = vi.fn();
    render(
      <Harness
        initial={{ all: [{ field: "unitId", op: "within", value: "u-eng" }, { field: "amount", op: "lt", value: 5 }] }}
        onJson={onJson}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: "Turn into “not”" })[0]);
    expect(onJson).toHaveBeenLastCalledWith({
      all: [{ not: { field: "unitId", op: "within", value: "u-eng" } }, { field: "amount", op: "lt", value: 5 }],
    });

    await user.click(screen.getAllByRole("radio", { name: "Any one is true" })[0]);
    expect(onJson.mock.lastCall![0]).toHaveProperty("any");
  });

  it("shows a validator message beside the control it is about", () => {
    render(
      <Harness
        initial={{ all: [{ field: "amount", op: "gt", value: 1 }, { field: "category", op: "in", value: [] }] }}
        onJson={vi.fn()}
        errors={{ "rules.0.when.all.1.value": ["Give a list of values."] }}
      />,
    );
    const items = screen.getAllByRole("listitem");
    const second = items.find((li) => within(li).queryByText("Give a list of values."));
    expect(second).toBeTruthy();
    expect(within(second!).getAllByRole("combobox", { name: "Field" })[0]).toHaveTextContent("Memo category");
  });
});
