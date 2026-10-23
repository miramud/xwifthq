import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ProjectAssistant, { Markdown } from "./ProjectAssistant";
import { ApiError } from "@/lib/api/admin-client";

/**
 * The project assistant.
 *
 * - the conversation goes to the API as history (role + content only) and the
 *   answer comes back with its referenced items as chips that open the item
 * - a suggestion is a one-tap question
 * - "no provider" is a set-up notice, not an error
 * - a failed call can be retried without retyping
 * - model output is text, never markup
 */

const { ask } = vi.hoisted(() => ({ ask: vi.fn() }));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();
  return { ...actual, assistant: { ask } };
});

const PROJECT = { slug: "acme-rebuild", name: "Acme Rebuild" };

function reply(over: Record<string, unknown> = {}) {
  return {
    answer: "**Two items** are at risk:\n- Checkout flow\n- Payments `v2`",
    references: [
      { id: "wi-1", title: "Checkout flow", type: "story" },
      { id: "wi-2", title: "Payments v2", type: "task" },
    ],
    provider: "anthropic",
    model: "claude-test",
    tokens: 420,
    ...over,
  };
}

function mount(onOpenItem = vi.fn()) {
  render(<ProjectAssistant project={PROJECT} onOpenItem={onOpenItem} />);
  return onOpenItem;
}

function openFromHeader() {
  fireEvent.click(screen.getAllByRole("button", { name: "Ask about this project" })[0]);
}

beforeEach(() => {
  ask.mockReset();
  window.sessionStorage.clear();
});

describe("ProjectAssistant", () => {
  it("sends the conversation and renders the answer with reference chips", async () => {
    ask.mockResolvedValueOnce(reply());
    ask.mockResolvedValueOnce(reply({ answer: "Ada has the most.", references: [] }));
    const onOpenItem = mount();

    /* The floating launcher; the header button became "Generate With AI". */
    fireEvent.click(screen.getAllByRole("button", { name: "Ask about this project" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Acme Rebuild" });
    expect(within(dialog).getByText("Answers from this project's live data")).toBeInTheDocument();

    const input = within(dialog).getByLabelText("Your question");
    fireEvent.change(input, { target: { value: "What is at risk?" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await within(dialog).findByText("Two items")).toBeInTheDocument();
    expect(ask).toHaveBeenCalledWith("acme-rebuild", [{ role: "user", content: "What is at risk?" }]);
    expect(within(dialog).getByText("Anthropic · claude-test")).toBeInTheDocument();

    /* Bold rendered as an element, list items as items. */
    expect(within(dialog).getByText("Two items").tagName).toBe("STRONG");
    expect(within(dialog).getByText("v2").tagName).toBe("CODE");

    fireEvent.click(within(dialog).getByRole("button", { name: /Checkout flow/ }));
    expect(onOpenItem).toHaveBeenCalledWith("wi-1");

    /* The second question carries the first exchange with it — content and role only. */
    fireEvent.change(input, { target: { value: "Who has the most open tasks?" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send question" }));

    expect(await within(dialog).findByText("Ada has the most.")).toBeInTheDocument();
    expect(ask).toHaveBeenLastCalledWith("acme-rebuild", [
      { role: "user", content: "What is at risk?" },
      { role: "assistant", content: reply().answer },
      { role: "user", content: "Who has the most open tasks?" },
    ]);

    /* Persisted for this project. */
    const stored = JSON.parse(window.sessionStorage.getItem("projects.assistant.acme-rebuild") ?? "{}");
    expect(stored.messages).toHaveLength(4);
  });

  it("Shift+Enter does not send", () => {
    mount();
    openFromHeader();
    const input = screen.getByLabelText("Your question");
    fireEvent.change(input, { target: { value: "Line one" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(ask).not.toHaveBeenCalled();
  });

  it("sends a suggestion chip as the question", async () => {
    ask.mockResolvedValueOnce(reply({ answer: "Nothing is at risk.", references: [] }));
    mount();
    openFromHeader();

    fireEvent.click(screen.getByRole("button", { name: /What's at risk in this sprint\?/ }));

    expect(await screen.findByText("Nothing is at risk.")).toBeInTheDocument();
    expect(ask).toHaveBeenCalledWith("acme-rebuild", [{ role: "user", content: "What's at risk in this sprint?" }]);
  });

  it("explains a missing provider and links to AI settings", async () => {
    ask.mockRejectedValueOnce(
      new ApiError("Set one up under Projects → AI settings.", 422, { provider: ["No provider."] }),
    );
    mount();
    openFromHeader();

    fireEvent.click(screen.getByRole("button", { name: /Who has the most open tasks\?/ }));

    expect(await screen.findByText("The assistant isn't set up yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Projects → AI settings" })).toHaveAttribute("href", "/suite/projects/ai");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("shows an error with Retry, and retrying resends the same question", async () => {
    ask.mockRejectedValueOnce(new ApiError("The provider timed out.", 502));
    ask.mockResolvedValueOnce(reply({ answer: "Here it is.", references: [] }));
    mount();
    openFromHeader();

    fireEvent.click(screen.getByRole("button", { name: /Which items are blocked and why\?/ }));

    expect(await screen.findByText("The provider timed out.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Here it is.")).toBeInTheDocument();
    expect(ask).toHaveBeenCalledTimes(2);
    expect(ask.mock.calls[1][1]).toEqual([{ role: "user", content: "Which items are blocked and why?" }]);
    expect(screen.queryByText("The provider timed out.")).not.toBeInTheDocument();
  });

  it("clears the conversation", async () => {
    ask.mockResolvedValueOnce(reply({ answer: "Answer.", references: [] }));
    mount();
    openFromHeader();
    fireEvent.click(screen.getByRole("button", { name: /Summarise progress on each story/ }));
    await screen.findByText("Answer.");

    fireEvent.click(screen.getByRole("button", { name: "Clear conversation" }));

    expect(screen.queryByText("Answer.")).not.toBeInTheDocument();
    await waitFor(() => expect(window.sessionStorage.getItem("projects.assistant.acme-rebuild")).toBeNull());
  });

  it("renders model HTML as text, not markup", () => {
    const { container } = render(<Markdown text={'<img src=x onerror="alert(1)"> **ok**'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it("draws a markdown table as a table, with ratings as chips", () => {
    render(
      <Markdown
        text={[
          "Overall: on target.",
          "",
          "| Area | Rating | Detail |",
          "|---|---|---|",
          "| Estimates | Bad | Only **48%** of open work is estimated. |",
          "| Delivery date | Good | Forecast ~2026-10-23. |",
          "| Carry-over | Watch | 24% carried over. |",
          "| Rework | Watch | 5 moves backwards. | extra |",
          "",
          "Also worth noting: 7 items are overdue.",
        ].join("\n")}
      />,
    );

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Area", "Rating", "Detail"]);
    /* The first column labels its row; a ragged row is clipped to the header. */
    expect(within(table).getAllByRole("rowheader").map((h) => h.textContent)).toEqual([
      "Estimates",
      "Delivery date",
      "Carry-over",
      "Rework",
    ]);
    expect(within(table).queryByText("extra")).not.toBeInTheDocument();
    /* Inline markdown still works inside a cell. */
    expect(within(table).getByText("48%").tagName).toBe("STRONG");
    /* Ratings are chips with an icon, not bare words. */
    expect(within(table).getByText("Bad").querySelector("svg")).not.toBeNull();
    expect(within(table).getByText("Good").querySelector("svg")).not.toBeNull();
    /* The prose either side is untouched. */
    expect(screen.getByText("Overall: on target.")).toBeInTheDocument();
    expect(screen.getByText("Also worth noting: 7 items are overdue.")).toBeInTheDocument();
  });

  it("stacks a narrow table whose last column is prose, and never chips the row name", () => {
    render(
      <Markdown
        text={[
          "| Area | Rating | Detail |",
          "|---|---|---|",
          "| Estimates | Bad | Only 48% of open work is estimated, so neither the forecast nor the cost means much. |",
          "| Blocked | Watch | The health summary flags 1 blocked item, though the blocked section says nothing is blocked. |",
        ].join("\n")}
      />,
    );

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Table" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    /* "Blocked" names the second row: plain text, not a red chip. */
    expect(within(rows[1]).getByText("Blocked").querySelector("svg")).toBeNull();
    expect(within(rows[1]).getByText("Watch").querySelector("svg")).not.toBeNull();
    /* Column names survive for screen readers. */
    expect(rows[0].textContent).toContain("Detail: Only 48% of open work");
  });

  it("leaves a sentence with a pipe in it alone when no rule row follows", () => {
    render(<Markdown text={"Choose A | B, then carry on."} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("Choose A | B, then carry on.")).toBeInTheDocument();
  });
});
