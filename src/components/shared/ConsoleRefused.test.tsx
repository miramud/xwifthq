import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ConsoleRefused from "./ConsoleRefused";

/** A member who opens /suite/org is told why, and sent to their own landing page. */
describe("ConsoleRefused", () => {
  it("explains the refusal and links to the person's workspace", () => {
    render(<ConsoleRefused console="Organisation console" who="your organisation's admins" home="/suite/hrm/me" />);

    expect(screen.getByRole("heading", { name: "The Organisation console is for your organisation's admins" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to my workspace" })).toHaveAttribute("href", "/suite/hrm/me");
  });
});
