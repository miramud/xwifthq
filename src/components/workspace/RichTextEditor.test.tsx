import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

/* The setup file swaps the editor for a textarea in screen tests; here we want the real one. */
vi.unmock("@/components/workspace/RichTextEditor");

const { RichTextEditor } = await import("./RichTextEditor");

function Harness({ initial = "", variant, onChange }: { initial?: string; variant?: "full" | "compact"; onChange?: (html: string) => void }) {
  const [value, setValue] = useState(initial);

  return (
    <div>
      <label htmlFor="memo-body">What you are asking for</label>
      <RichTextEditor
        id="memo-body"
        variant={variant}
        value={value}
        onChange={(html) => {
          setValue(html);
          onChange?.(html);
        }}
      />
      <button type="button" onClick={() => setValue("")}>
        Reset
      </button>
    </div>
  );
}

const editable = () => screen.findByRole("textbox", { name: "What you are asking for" });

describe("RichTextEditor", () => {
  it("is named by its label and opens with the text it was given", async () => {
    render(<Harness initial="<h2>Budget</h2><p>We need <strong>desks</strong>.</p>" variant="full" />);

    const box = await editable();
    expect(box.querySelector("h2")).toHaveTextContent("Budget");
    expect(box.querySelector("strong")).toHaveTextContent("desks");
  });

  it("opens plain text written before the editor as paragraphs, line breaks kept", async () => {
    render(<Harness initial={"First paragraph\nsame paragraph\n\nSecond <one>"} />);

    const box = await editable();
    const paragraphs = box.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].querySelector("br")).not.toBeNull();
    expect(paragraphs[1]).toHaveTextContent("Second <one>");
  });

  it("gives documents the Word ribbon and comments the short one", async () => {
    const { unmount } = render(<Harness variant="full" />);
    await editable();

    for (const name of ["Undo", "Redo", "Bold", "Italic", "Underline", "Strikethrough", "Text colour", "Highlight", "Bulleted list", "Numbered list", "Increase indent", "Align left", "Centre", "Justify", "Link", "Quote", "Horizontal line", "Insert table", "Clear formatting"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("combobox", { name: "Paragraph style" })).toHaveValue("p");
    expect(screen.getByText(/0 words/)).toBeInTheDocument();
    unmount();

    render(<Harness variant="compact" />);
    await editable();
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Numbered list" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Insert table" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Paragraph style" })).not.toBeInTheDocument();
  });

  it("formats the text and reports HTML", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial="<p>Buy desks</p>" variant="full" onChange={onChange} />);
    await editable();

    await user.click(screen.getByRole("button", { name: "Bulleted list" }));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith("<ul><li><p>Buy desks</p></li></ul>"));
    expect(screen.getByRole("button", { name: "Bulleted list" })).toHaveAttribute("aria-pressed", "true");

    await user.selectOptions(screen.getByRole("combobox", { name: "Paragraph style" }), "h2");
    await user.click(screen.getByRole("button", { name: "Insert table" }));
    await waitFor(() => expect(onChange.mock.lastCall?.[0]).toContain("<table"));
    expect(screen.getByRole("toolbar", { name: "Table" })).toBeInTheDocument();
  });

  it("adds a link from the link bar, and refuses something that is not an address", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial="<p>See </p>" onChange={onChange} />);
    await editable();

    await user.click(screen.getByRole("button", { name: "Link" }));
    const address = screen.getByLabelText("Link to");

    await user.type(address, "not an address");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a web address");

    await user.clear(address);
    await user.type(address, "example.com/policy{Enter}");
    await waitFor(() => expect(onChange.mock.lastCall?.[0]).toContain('href="https://example.com/policy"'));
    expect(screen.queryByLabelText("Link to")).not.toBeInTheDocument();
  });

  it("follows a parent that resets it, as after sending", async () => {
    const user = userEvent.setup();
    render(<Harness initial="<p>Sent already</p>" />);
    const box = await editable();

    await user.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(box).not.toHaveTextContent("Sent already"));
  });

  it("written inside a <label>, is named by it and a click on the words never presses Bold", async () => {
    const user = userEvent.setup();
    render(
      <label>
        <span>Strengths</span>
        <RichTextEditor value="<p>Clear writer</p>" onChange={() => {}} />
      </label>,
    );

    const box = await screen.findByRole("textbox", { name: "Strengths" });
    await user.click(screen.getByText("Strengths"));

    expect(screen.getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "false");
    expect(box).toHaveTextContent("Clear writer");
  });
});
