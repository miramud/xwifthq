import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import HomePage from "./page";

/**
 * The landing page is about the suite (the owner's ruling of 26 September
 * 2026): no course listings, no single-module spotlight, no partner names, and
 * no call to the course API. Since 9 October 2026 it is a company suite with
 * all five modules live, so nothing on it may say a module is coming.
 */
describe("home page", () => {
  it("renders the suite and none of the course or partner content", () => {
    const { container } = render(<HomePage />);
    const text = container.textContent ?? "";

    for (const gone of [
      "Popular courses",
      "New releases",
      "Browse courses",
      "Aptech",
      "CPMS",
      "Microsoft",
      "Google",
      "in production today",
      "Coming soon",
      "coming soon",
      "on the way",
      "Preview",
    ]) {
      expect(text, gone).not.toContain(gone);
    }

    expect(container.querySelector('a[href="/courses"]')).toBeNull();
    for (const module of ["Finance", "Operations", "HRM", "Projects", "LMS"]) {
      expect(text, module).toContain(module);
    }

    // The real-screens showcase: one tab per module, the first selected.
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(5);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
  });
});
