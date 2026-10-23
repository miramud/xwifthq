import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Funnel, GroupedColumns, Heatmap, MultiLine, Sparkline, StackedColumns, Waterfall, type CategoryDatum } from "./charts";

/** The hidden table behind a chart, found by its caption. */
function srTable(caption: string) {
  return screen.getByRole("table", { name: caption });
}

const series = [
  { key: "a", label: "Billable", hue: "blue" as const },
  { key: "b", label: "Internal", hue: "mint" as const, dashed: true },
];
const data: CategoryDatum[] = [
  { label: "Mon", values: { a: 6, b: 2 } },
  { label: "Tue", values: { a: 4, b: -3 } },
  { label: "Wed", values: { a: 0 } },
];

describe("StackedColumns", () => {
  it("names the chart and tabulates every category with its total", () => {
    render(<StackedColumns data={data} series={series} caption="Hours by day" showTotals />);
    expect(screen.getByRole("group", { name: "Hours by day" })).toBeInTheDocument();
    const table = srTable("Hours by day");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(4); // header + 3
    expect(within(rows[0]).getByText("Total")).toBeInTheDocument();
    expect(within(rows[2]).getByText("1")).toBeInTheDocument(); // 4 + (−3)
    expect(screen.getByRole("button", { name: /Tue: Billable 4, Internal -3; total 1/ })).toBeInTheDocument();
  });

  it("shows a bubble on focus and reports a click", () => {
    const onSelect = vi.fn();
    render(<StackedColumns data={data} series={series} caption="Hours" onSelect={onSelect} />);
    const mon = screen.getByRole("button", { name: /^Mon:/ });
    fireEvent.focus(mon);
    expect(screen.getAllByText("Total").length).toBeGreaterThan(1); // bubble + table head
    fireEvent.click(mon);
    expect(onSelect).toHaveBeenCalledWith("Mon");
  });

  it("puts a negative axis tick below zero", () => {
    const { container } = render(<StackedColumns data={data} series={series} caption="Hours" />);
    const ticks = Array.from(container.querySelectorAll("span.translate-y-1\\/2")).map((n) => n.textContent);
    expect(ticks).toContain("0");
    expect(ticks.some((t) => t?.startsWith("-"))).toBe(true);
  });

  it("has an empty state", () => {
    render(<StackedColumns data={[]} series={series} caption="Hours" />);
    expect(screen.getByText(/no data for this period yet/i)).toBeInTheDocument();
  });
});

describe("GroupedColumns", () => {
  it("tabulates each series per category and handles negatives", () => {
    render(<GroupedColumns data={data} series={series} caption="Plan vs actual" format={(v) => `${v}h`} />);
    const rows = within(srTable("Plan vs actual")).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[2]).getByText("-3h")).toBeInTheDocument();
    expect(rows[3].textContent).toBe("Wed0h0h"); // missing value reads as zero
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Billable", "Internal"]); // legend
  });

  it("has an empty state", () => {
    render(<GroupedColumns data={data} series={[]} caption="x" />);
    expect(screen.getByText(/no data for this period yet/i)).toBeInTheDocument();
  });
});

describe("Waterfall", () => {
  const steps = [
    { label: "Opening", value: 100, kind: "total" as const },
    { label: "Sales", value: 40 },
    { label: "Costs", value: -170 },
  ];

  it("carries the running total and signs each change", () => {
    render(<Waterfall steps={steps} caption="Cash movement" />);
    const rows = within(srTable("Cash movement")).getAllByRole("row");
    expect(rows.map((r) => r.textContent)).toEqual([
      "StepChangeRunning total",
      "OpeningTotal 100100",
      "Sales+40140",
      "Costs−170-30",
    ]);
    expect(screen.getByRole("button", { name: "Costs: down 170, running total -30" })).toBeInTheDocument();
    expect(screen.getByText("Decrease")).toBeInTheDocument();
  });

  it("has an empty state", () => {
    render(<Waterfall steps={[]} caption="x" />);
    expect(screen.getByText(/no data for this period yet/i)).toBeInTheDocument();
  });
});

describe("MultiLine", () => {
  const labels = ["W1", "W2", "W3", "W4"];
  const lines = [
    { key: "pv", label: "Planned", hue: "slate" as const, values: [10, 30, 60, 100], dashed: true },
    { key: "ev", label: "Earned", hue: "blue" as const, values: [8, 25, null, null], area: true },
    { key: "ac", label: "Actual", hue: "coral" as const, values: [12, null, 40, null] },
  ];

  it("tabulates every point, saying 'no data' for gaps", () => {
    render(<MultiLine labels={labels} series={lines} caption="Earned value" marker={{ index: 1, label: "Today" }} />);
    const table = srTable("Earned value (Today: W2)");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(5);
    expect(rows[3].textContent).toBe("W360no data40");
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("After today")).toBeInTheDocument();
  });

  it("is one tab stop that arrow keys walk", () => {
    render(<MultiLine labels={labels} series={lines} caption="EV" />);
    const points = screen.getAllByRole("button");
    expect(points.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    points[0].focus();
    fireEvent.keyDown(points[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(points[1]);
    expect(points[1]).toHaveAccessibleName("W2: Planned 30, Earned 25, Actual no data");
    fireEvent.keyDown(points[1], { key: "End" });
    expect(document.activeElement).toBe(points[3]);
  });

  it("breaks the line at nulls", () => {
    const { container } = render(<MultiLine labels={labels} series={[lines[2]]} caption="AC" />);
    // [12, null, 40, null]: two lone points, no line.
    expect(container.querySelectorAll("path[stroke]")).toHaveLength(0);
    expect(container.querySelectorAll("span.rounded-full.h-2")).toHaveLength(2);
  });

  it("has an empty state for all-null data", () => {
    render(<MultiLine labels={labels} series={[{ key: "x", label: "X", hue: "blue", values: [null, null] }]} caption="x" />);
    expect(screen.getByText(/no data for this period yet/i)).toBeInTheDocument();
  });

  it("handles negative values", () => {
    render(<MultiLine labels={["a", "b"]} series={[{ key: "x", label: "Margin", hue: "blue", values: [-5, 5] }]} caption="Margin" />);
    expect(within(srTable("Margin")).getByText("-5")).toBeInTheDocument();
  });
});

describe("Sparkline", () => {
  it("names itself with its label and last value", () => {
    render(<Sparkline values={[1, 4, 2, 9]} label="Headcount" showLast format={(v) => `${v} people`} />);
    expect(screen.getByRole("img", { name: "Headcount: 9 people" })).toBeInTheDocument();
  });

  it("says when there is no data", () => {
    render(<Sparkline values={[]} label="Headcount" />);
    expect(screen.getByRole("img", { name: "Headcount: no data" })).toBeInTheDocument();
  });

  it("draws negatives against a baseline", () => {
    const { container } = render(<Sparkline values={[-3, 2]} baseline={0} label="Net" />);
    expect(container.querySelector("line")).not.toBeNull();
    expect(screen.getByRole("img", { name: "Net: 2" })).toBeInTheDocument();
  });
});

describe("Heatmap", () => {
  const cells = [
    { row: "Eng", col: "Jan", value: 2 },
    { row: "Eng", col: "Feb", value: 10 },
    { row: "Ops", col: "Jan", value: null },
  ];

  it("tabulates every cell and hatches missing ones", () => {
    render(<Heatmap rows={["Eng", "Ops"]} cols={["Jan", "Feb"]} cells={cells} caption="Absence" />);
    const rows = within(srTable("Absence")).getAllByRole("row");
    expect(rows.map((r) => r.textContent)).toEqual(["JanFeb", "Eng210", "OpsNo dataNo data"]);
    const ops = screen.getByRole("button", { name: "Ops, Feb: no data" });
    expect(ops.className).toContain("ws-hatch");
    expect(screen.getByRole("button", { name: "Eng, Feb: 10" })).toHaveAttribute("data-bucket", "4");
    expect(within(screen.getByRole("list", { name: "Colour scale" })).getByText("No data")).toBeInTheDocument();
  });

  it("walks with arrow keys and selects", () => {
    const onSelect = vi.fn();
    render(<Heatmap rows={["Eng", "Ops"]} cols={["Jan", "Feb"]} cells={cells} caption="Absence" onSelect={onSelect} />);
    const first = screen.getByRole("button", { name: "Eng, Jan: 2" });
    expect(first.tabIndex).toBe(0);
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toHaveAccessibleName("Ops, Jan: no data");
    fireEvent.click(screen.getByRole("button", { name: "Eng, Feb: 10" }));
    expect(onSelect).toHaveBeenCalledWith({ row: "Eng", col: "Feb", value: 10 });
  });

  it("buckets negatives", () => {
    render(<Heatmap rows={["r"]} cols={["a", "b"]} cells={[{ row: "r", col: "a", value: -4 }, { row: "r", col: "b", value: 4 }]} caption="Delta" />);
    expect(screen.getByRole("button", { name: "r, a: -4" })).toHaveAttribute("data-bucket", "0");
  });

  it("has an empty state", () => {
    render(<Heatmap rows={[]} cols={["Jan"]} cells={[]} caption="x" />);
    expect(screen.getByText(/no data for this period yet/i)).toBeInTheDocument();
  });
});

describe("Funnel", () => {
  it("labels each stage with its share and conversion", () => {
    render(
      <Funnel
        caption="Hiring funnel"
        stages={[
          { label: "Applied", value: 200 },
          { label: "Interviewed", value: 50 },
          { label: "Hired", value: 5, hue: "mint" },
        ]}
      />,
    );
    expect(screen.getByText("25% of Applied")).toBeInTheDocument();
    expect(screen.getByText("10% of Interviewed")).toBeInTheDocument();
    const rows = within(srTable("Hiring funnel")).getAllByRole("row");
    expect(rows[3].textContent).toBe("Hired53%10%");
  });

  it("treats negatives as zero and survives an empty first stage", () => {
    render(<Funnel caption="F" stages={[{ label: "A", value: 0 }, { label: "B", value: -2 }]} />);
    expect(screen.getByText("None to convert from A")).toBeInTheDocument();
  });

  it("has an empty state", () => {
    render(<Funnel caption="F" stages={[]} />);
    expect(screen.getByText(/no data for this period yet/i)).toBeInTheDocument();
  });
});
