import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DraftProgress, { type DraftRun } from "./DraftProgress";
import type { GenerationProgress } from "@/lib/api/projects-client";

const NOW = Date.now();
const iso = (secondsAgo: number) => new Date(NOW - secondsAgo * 1000).toISOString();

function run(over: Partial<DraftRun> = {}): DraftRun {
  return {
    key: "k-1",
    fileName: "prd.docx",
    fileSize: 2 * 1024 * 1024,
    startedAt: NOW - 20_000,
    upload: 1,
    server: null,
    phase: "drafting",
    error: null,
    breakdown: null,
    summary: null,
    finishedAt: null,
    ...over,
  };
}

function server(over: Partial<GenerationProgress> = {}, plan: Partial<GenerationProgress["steps"][number]> = {}): GenerationProgress {
  return {
    status: "running",
    title: "Drafting a plan from prd.docx",
    error: null,
    startedAt: iso(20),
    steps: [
      { key: "read", label: "Reading the document", status: "done", detail: "2,140 words · 9 headings · 2 table rows", startedAt: iso(19), endedAt: iso(18.6), expectedSeconds: null },
      { key: "check", label: "Checking it can be planned", status: "done", detail: "Within limits · Anthropic claude", startedAt: iso(18.6), endedAt: iso(18.5), expectedSeconds: null },
      { key: "plan", label: "Drafting epics and user stories", status: "active", detail: "The AI is reading it and writing the plan", startedAt: iso(18), endedAt: null, expectedSeconds: 45, ...plan },
      { key: "arrange", label: "Arranging the plan for your team", status: "pending", detail: null, startedAt: null, endedAt: null, expectedSeconds: null },
    ],
    ...over,
  };
}

const steps = () => within(screen.getByRole("list")).getAllByRole("listitem");

describe("DraftProgress", () => {
  it("shows the upload as the browser's own byte count", () => {
    render(<DraftProgress run={run({ upload: 0.4 })} />);

    expect(steps()[0]).toHaveTextContent("Uploading the document");
    expect(steps()[0]).toHaveTextContent("819 KB of 2.0 MB");
    expect(steps()[0]).toHaveTextContent("40%");
    /* The server has not started reading: the bytes are not all there yet. */
    expect(steps()[1]).toHaveTextContent("(not started)");
  });

  it("shows each server step as it happened, what it found, and the AI step against an estimate", () => {
    render(<DraftProgress run={run({ server: server() })} />);

    expect(screen.getByRole("heading", { name: "Drafting a plan from prd.docx" })).toBeInTheDocument();
    expect(steps()[1]).toHaveTextContent("Reading the document (done)");
    expect(steps()[1]).toHaveTextContent("2,140 words · 9 headings · 2 table rows");
    expect(steps()[3]).toHaveTextContent("Drafting epics and user stories (in progress)");
    expect(steps()[3]).toHaveTextContent(/usually about 45 s/);
    expect(steps()[3]).toHaveTextContent(/its length is an estimate/);
    expect(steps()[4]).toHaveTextContent("(not started)");

    const bar = screen.getByRole("progressbar", { name: "Plan drafting progress" });
    const value = Number(bar.getAttribute("aria-valuenow"));
    expect(value).toBeGreaterThan(20);
    expect(value).toBeLessThan(90);
  });

  it("follows the epic-by-epic breakdown", () => {
    render(
      <DraftProgress
        run={run({
          phase: "breaking-down",
          server: server({ status: "done" }, { status: "done", endedAt: iso(2), detail: "4 epics · 19 stories" }),
          breakdown: { total: 4, done: 1, current: "Payments", failed: 0 },
        })}
      />,
    );

    const breakdown = steps().at(-1) as HTMLElement;
    expect(breakdown).toHaveTextContent("Breaking each epic into tasks and estimates (in progress)");
    expect(breakdown).toHaveTextContent("Epic 2 of 4 · Payments");
    expect(breakdown).toHaveTextContent("1 of 4");
  });

  it("says which step stopped and why, once, with a way to try again", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <DraftProgress
        run={run({
          phase: "failed",
          error: "Anthropic returned 401: invalid x-api-key",
          finishedAt: NOW,
          server: server({ status: "failed", error: "Anthropic returned 401: invalid x-api-key" }, { status: "failed", detail: "Anthropic returned 401: invalid x-api-key", endedAt: iso(0) }),
        })}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("heading", { name: "The plan was not drafted" })).toBeInTheDocument();
    expect(steps()[3]).toHaveTextContent("Drafting epics and user stories (failed)");
    expect(steps()[3]).toHaveTextContent("Stopped here — the reason is below");
    expect(screen.getByRole("alert")).toHaveTextContent("Anthropic returned 401: invalid x-api-key");
    expect(screen.getByRole("alert")).toHaveTextContent("Nothing was added to the board");

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("a brief too thin is not a failure: it asks for more", () => {
    render(<DraftProgress run={run({ phase: "attention", finishedAt: NOW, server: server({ status: "attention" }, { status: "attention", detail: "The brief is too short" }) })} />);

    expect(screen.getByRole("heading", { name: "The brief needs a little more" })).toBeInTheDocument();
    expect(screen.getByText(/Nothing failed/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ends with a success message and what was planned", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(
      <DraftProgress
        run={run({
          phase: "ready",
          finishedAt: NOW,
          server: server({ status: "done" }, { status: "done", endedAt: iso(2) }),
          breakdown: { total: 4, done: 4, current: null, failed: 0 },
          summary: { epics: 4, stories: 19, tasks: 61, hours: 412, people: 5 },
        })}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByRole("heading", { name: "Your plan is ready to review" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("61")).toBeInTheDocument();
    expect(screen.getByText("412")).toBeInTheDocument();
    expect(steps().at(-1)).toHaveTextContent("61 tasks · 412 hours estimated");
    expect(screen.getByText(/Nothing is on the board yet/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close the progress report" }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
