import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { AgendaList, ComplianceCalendar, MonthCalendar, type CalendarEvent } from "./Calendar";

// October 2026 starts on a Thursday: weeks run 28 Sep–4 Oct, 5–11, 12–18, 19–25, 26 Oct–1 Nov.
const leave: CalendarEvent = { id: "lv", date: "2026-10-08", endDate: "2026-10-13", title: "Annual leave", hue: "grape" };

describe("MonthCalendar", () => {
  it("keeps per-day chips by default", () => {
    render(<MonthCalendar year={2026} month={9} events={[leave]} />);
    expect(screen.getAllByText("Annual leave")).toHaveLength(6);
  });

  it("draws a spanning event as one bar per week row, continued across the break", () => {
    render(<MonthCalendar year={2026} month={9} events={[leave]} spanning />);
    const bars = screen.getAllByText("Annual leave");
    expect(bars).toHaveLength(2); // Thu 8–Sun 11, then Mon 12–Tue 13
    expect(screen.getByText(/continues into the next week/)).toBeInTheDocument();
    expect(screen.getByText(/continues from the previous week/)).toBeInTheDocument();
  });

  it("clips bars to the month and says when an event started earlier", () => {
    render(
      <MonthCalendar
        year={2026}
        month={9}
        spanning
        events={[{ id: "x", date: "2026-09-29", endDate: "2026-10-02", title: "Audit", hue: "sky" }]}
      />,
    );
    expect(screen.getAllByText("Audit")).toHaveLength(1);
    expect(screen.getByText(/continues from the previous week/)).toBeInTheDocument();
  });

  it("caps lanes and counts the rest per day", () => {
    const many: CalendarEvent[] = Array.from({ length: 5 }, (_, i) => ({
      id: `e${i}`,
      date: "2026-10-14",
      title: `Item ${i}`,
      hue: "blue",
    }));
    render(<MonthCalendar year={2026} month={9} events={many} spanning maxLanes={2} />);
    expect(screen.getAllByText(/^Item \d$/)).toHaveLength(2);
    expect(screen.getByText("+3 more")).toBeInTheDocument();
  });

  it("names status on a bar in words and makes clickable bars buttons", () => {
    const onClick = vi.fn();
    render(
      <MonthCalendar
        year={2026}
        month={9}
        spanning
        events={[{ id: "f", date: "2026-10-20", title: "VAT return", hue: "rose", status: "overdue", onClick }]}
      />,
    );
    const bar = screen.getByRole("button", { name: /VAT return.*Overdue/ });
    fireEvent.click(bar);
    expect(onClick).toHaveBeenCalled();
  });
});

describe("AgendaList", () => {
  const events: CalendarEvent[] = [
    { id: "a", date: "2026-10-06", title: "Payroll run", hue: "blue", status: "due", start: "09:00", end: "10:00" },
    { id: "b", date: "2026-10-06", title: "Board pack", hue: "sun", allDay: true, status: "done" },
    { id: "c", date: "2026-10-01", endDate: "2026-10-09", title: "Open enrolment", hue: "mint", status: "upcoming" },
    { id: "d", date: "2026-11-20", title: "Out of range", hue: "slate" },
  ];

  it("groups by day under date leaves, with worded status chips", () => {
    render(<AgendaList events={events} from="2026-10-05" to="2026-10-11" />);
    expect(screen.getByText("Monday 5 October 2026")).toBeInTheDocument(); // enrolment, clamped to the first visible day
    expect(screen.getByText("Tuesday 6 October 2026")).toBeInTheDocument();
    expect(screen.queryByText("Out of range")).toBeNull();
    expect(screen.getByText("09:00 to 10:00")).toBeInTheDocument();
    expect(screen.getByText("All day")).toBeInTheDocument();
    expect(screen.getByText("Due")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
  });

  it("groups by week", () => {
    render(<AgendaList events={events} from="2026-10-01" to="2026-10-31" groupBy="week" />);
    expect(screen.getByText("Week of Monday 28 September 2026")).toBeInTheDocument();
    expect(screen.getByText("Week of Monday 5 October 2026")).toBeInTheDocument();
  });

  it("selects, hides chips on request, and has an empty state", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<AgendaList events={events} from="2026-10-06" to="2026-10-06" statusChips={false} onSelect={onSelect} />);
    expect(screen.queryByText("Due")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Payroll run/ }));
    expect(onSelect).toHaveBeenCalledWith(events[0]);
    rerender(<AgendaList events={[]} from="2026-10-06" to="2026-10-06" emptyLabel="Nothing due this week." />);
    expect(screen.getByText("Nothing due this week.")).toBeInTheDocument();
  });
});

describe("ComplianceCalendar", () => {
  const events: CalendarEvent[] = [
    { id: "1", date: "2026-10-20", title: "Pension filing", hue: "blue", status: "upcoming" },
    { id: "2", date: "2026-10-03", title: "Tax remittance", hue: "blue", status: "done" },
    { id: "3", date: "2026-09-15", title: "Annual return", hue: "blue", status: "overdue" },
    { id: "4", date: "2026-10-09", title: "Insurance renewal", hue: "blue", status: "due" },
    { id: "5", date: "2026-12-01", title: "Next quarter", hue: "blue", status: "upcoming" },
  ];

  it("lists deadlines overdue first, keeps earlier overdue items, and keys the statuses", () => {
    render(<ComplianceCalendar year={2026} month={9} events={events} onPrev={() => {}} onNext={() => {}} />);
    const rail = screen.getByRole("complementary", { name: "Deadlines, October 2026" });
    const titles = within(rail)
      .getAllByRole("listitem")
      .map((li) => li.textContent ?? "");
    const order = ["Annual return", "Insurance renewal", "Pension filing", "Tax remittance"];
    expect(titles.map((t) => order.find((o) => t.startsWith(o)))).toEqual(order);
    expect(within(rail).queryByText("Next quarter")).toBeNull();
    const key = screen.getByRole("list", { name: "Status key" });
    expect(within(key).getByText("Overdue").parentElement).toHaveTextContent("Overdue1");
  });

  it("selects from the grid and from the rail, and pages months", () => {
    const onSelect = vi.fn();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(<ComplianceCalendar year={2026} month={9} events={events} onSelect={onSelect} onPrev={onPrev} onNext={onNext} />);
    const [gridBar, railItem] = screen.getAllByRole("button", { name: /Pension filing/ });
    fireEvent.click(gridBar);
    fireEvent.click(railItem);
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenLastCalledWith(events[0]);
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPrev).toHaveBeenCalled();
    expect(onNext).toHaveBeenCalled();
  });

  it("says when the month is clear", () => {
    render(<ComplianceCalendar year={2026} month={9} events={[]} onPrev={() => {}} onNext={() => {}} />);
    expect(screen.getByText("No deadlines this month.")).toBeInTheDocument();
  });
});
