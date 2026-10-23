import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { XwiftMark, XwiftLockup } from "./BrandLogo";

/**
 * The brand asset.
 *
 * Worth pinning down: the tile is the brand purple wherever colour is
 * allowed, the monochrome variant collapses to one colour with no tile, and a
 * mark with no title is hidden from assistive technology (inside a lockup the
 * word is right there, and announcing it twice is worse than not at all).
 */

const PURPLE = "#9638CD";

describe("XwiftMark", () => {
  it("draws a purple tile with a woven X", () => {
    const { container } = render(<XwiftMark title="XwiftHQ" />);

    expect(container.querySelector('[data-part="tile"]')).toHaveAttribute("fill", PURPLE);
    expect(container.querySelectorAll('[data-part="front"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-part="back"]')).toHaveLength(2);
  });

  it("turns the tile white and the strokes purple when reversed", () => {
    const { container } = render(<XwiftMark variant="reversed" title="XwiftHQ" />);

    expect(container.querySelector('[data-part="tile"]')).toHaveAttribute("fill", "#FFFFFF");
    expect(container.querySelector('[data-part="front"]')).toHaveAttribute("stroke", PURPLE);
  });

  it("collapses to one colour with no tile in the monochrome variant", () => {
    const { container } = render(<XwiftMark variant="mono" title="XwiftHQ" />);

    expect(container.querySelector('[data-part="tile"]')).toBeNull();
    const strokes = Array.from(container.querySelectorAll("path")).map((p) => p.getAttribute("stroke"));
    expect(new Set(strokes)).toEqual(new Set(["currentColor"]));
  });

  it("is announced when it stands alone", () => {
    render(<XwiftMark title="XwiftHQ" />);

    expect(screen.getByRole("img", { name: "XwiftHQ" })).toBeInTheDocument();
  });

  it("is hidden from assistive technology when it has no title", () => {
    const { container } = render(<XwiftMark />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("XwiftLockup", () => {
  it("does not announce the mark twice alongside the word", () => {
    const { container } = render(<XwiftLockup />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.textContent).toBe("XwiftHQ");
  });

  it("sets HQ in the brand purple", () => {
    const { container } = render(<XwiftLockup />);
    const hq = Array.from(container.querySelectorAll("span")).find((el) => el.textContent === "HQ");

    expect(hq).toHaveClass("text-primary-600");
  });
});
