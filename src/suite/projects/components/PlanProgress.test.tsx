import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlanProgress from "./PlanProgress";
import type { PlanEpic } from "@/lib/api/projects-client";

/** The breakdown rail: names the epic in hand, and is honest about Stop. */

const epic = (title: string, brokenDown: boolean): PlanEpic => ({ title, brokenDown, stories: [] });
const EPICS = [epic("Identity, access and roles", true), epic("Catalogue", false), epic("Search", false)];

describe("PlanProgress", () => {
  it("names the epic being broken down and counts it", async () => {
    const onStop = vi.fn();

    render(
      <PlanProgress epics={EPICS} runs={{ 1: { state: "running" } }} running stopping={false} onStop={onStop} onContinue={vi.fn()} />,
    );

    expect(screen.getByText("Breaking down 2 of 3")).toBeInTheDocument();
    expect(screen.getByText(/— Catalogue/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Epics broken down" })).toHaveAttribute("aria-valuenow", "1");

    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalled();
  });

  it("says Stop waits for the request in flight", () => {
    render(
      <PlanProgress epics={EPICS} runs={{ 1: { state: "running" } }} running stopping onStop={vi.fn()} onContinue={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: /Stopping after this epic/ })).toBeDisabled();
  });

  it("offers to continue when idle with epics left", async () => {
    const onContinue = vi.fn();

    render(<PlanProgress epics={EPICS} runs={{}} running={false} stopping={false} onStop={vi.fn()} onContinue={onContinue} />);

    expect(screen.getByText("2 of 3 epics not broken down yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue breaking down" }));
    expect(onContinue).toHaveBeenCalled();
  });

  it("mentions failures and settles when everything is done", () => {
    const { rerender } = render(
      <PlanProgress epics={EPICS} runs={{ 2: { state: "failed" } }} running={false} stopping={false} onStop={vi.fn()} onContinue={vi.fn()} />,
    );

    expect(screen.getByText(/1 did not come back/)).toBeInTheDocument();

    rerender(
      <PlanProgress
        epics={EPICS.map((e) => ({ ...e, brokenDown: true }))}
        runs={{}}
        running={false}
        stopping={false}
        onStop={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText("All 3 epics broken down into tasks")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
