import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RichTextView } from "./RichTextView";

describe("RichTextView", () => {
  it("shows editor text the way it was written", () => {
    const { container } = render(
      <RichTextView value='<h2>The ask</h2><p>Open until <strong>22:00</strong>.</p><ol><li>Four weeks</li></ol><p><a href="https://x.test">costs</a></p>' />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "The ask" })).toBeInTheDocument();
    expect(container.querySelector("strong")).toHaveTextContent("22:00");
    expect(screen.getByRole("listitem")).toHaveTextContent("Four weeks");
    expect(screen.getByRole("link", { name: "costs" })).toHaveAttribute("rel", "noopener noreferrer nofollow");
  });

  it("cleans markup that reached the database some other way", () => {
    const { container } = render(<RichTextView value={'<p onmouseover="steal()">Hi</p><img src=x onerror="alert(1)"><script>alert(1)</script>'} />);

    expect(container.innerHTML).not.toMatch(/onmouseover|onerror|<img|<script/);
    expect(container).toHaveTextContent("Hi");
  });

  it("keeps plain text from before the editor as text, line breaks and all", () => {
    const { container } = render(<RichTextView value={"Line one\nLine two <3"} />);

    expect(container.firstChild).toHaveClass("whitespace-pre-line");
    expect(container).toHaveTextContent("Line one Line two <3");
  });

  it("renders nothing for nothing", () => {
    const { container } = render(<RichTextView value={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
