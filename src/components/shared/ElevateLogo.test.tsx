import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ElevateMark, ElevateLockup } from "./ElevateLogo";

/**
 * The brand asset.
 *
 * Two things are worth pinning down. The gold cap must stay gold on every
 * surface except monochrome — it is the whole point of the mark, and a
 * recolouring pass that flattens it would be invisible in review. And a mark
 * with no title must be hidden from assistive technology: inside a lockup the
 * word "Elevate" is right there, and announcing it twice is worse than not
 * announcing it at all.
 */

const TEAL = "#0C4F54";
const GOLD = "#E6A532";

function rects(container: HTMLElement): SVGRectElement[] {
  return Array.from(container.querySelectorAll("rect"));
}

describe("ElevateMark", () => {
  it("draws three columns and a gold cap", () => {
    const { container } = render(<ElevateMark title="Elevate" />);
    const drawn = rects(container);

    expect(drawn).toHaveLength(4);
    expect(drawn.slice(0, 3).map((r) => r.getAttribute("fill"))).toEqual([TEAL, TEAL, TEAL]);
    expect(drawn[3].getAttribute("fill")).toBe(GOLD);
  });

  it("keeps the cap gold when reversed onto teal", () => {
    const { container } = render(<ElevateMark variant="reversed" title="Elevate" />);
    const drawn = rects(container);

    expect(drawn[0].getAttribute("fill")).toBe("#FFFFFF");
    expect(drawn[3].getAttribute("fill")).toBe(GOLD);
  });

  it("collapses to one colour only in the monochrome variant", () => {
    const { container } = render(<ElevateMark variant="mono" title="Elevate" />);

    expect(new Set(rects(container).map((r) => r.getAttribute("fill")))).toEqual(
      new Set(["currentColor"]),
    );
  });

  it("is announced when it stands alone", () => {
    render(<ElevateMark title="Elevate" />);

    expect(screen.getByRole("img", { name: "Elevate" })).toBeInTheDocument();
  });

  it("is hidden from assistive technology when it has no title", () => {
    const { container } = render(<ElevateMark />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("ElevateLockup", () => {
  it("does not announce the mark twice alongside the word", () => {
    const { container } = render(<ElevateLockup />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.textContent).toBe("Elevate.");
  });

  it("keeps the full stop gold, which is the one flourish the brand has", () => {
    const { container } = render(<ElevateLockup />);
    const stop = Array.from(container.querySelectorAll("span")).find(
      (el) => el.textContent === ".",
    );

    expect(stop).toHaveClass("text-accent-500");
  });
});
