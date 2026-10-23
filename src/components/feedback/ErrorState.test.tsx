import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TriangleAlert } from "lucide-react";
import ErrorState from "./ErrorState";

/**
 * The shared body of every error boundary. Its contract is small but load-
 * bearing: a failure has to be announced to assistive tech and has to offer a
 * way out, because these screens are what a user sees when nothing else works.
 */
describe("ErrorState", () => {
  const base = {
    icon: TriangleAlert,
    title: "This page didn't load",
    body: "Something broke on our side.",
  };

  it("announces itself as an alert", () => {
    render(<ErrorState {...base} primaryAction={{ label: "Try again", href: "/" }} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows the title and body", () => {
    render(<ErrorState {...base} primaryAction={{ label: "Try again", href: "/" }} />);

    expect(screen.getByRole("heading", { name: "This page didn't load" })).toBeInTheDocument();
    expect(screen.getByText("Something broke on our side.")).toBeInTheDocument();
  });

  /** An error with no way forward is a dead end — this is the guard. */
  it("always renders a primary action", () => {
    render(<ErrorState {...base} primaryAction={{ label: "Browse courses", href: "/courses" }} />);

    expect(screen.getByRole("link", { name: "Browse courses" })).toHaveAttribute(
      "href",
      "/courses",
    );
  });

  it("calls the retry handler when the primary action is a button", async () => {
    const reset = vi.fn();
    render(<ErrorState {...base} primaryAction={{ label: "Try again", onClick: reset }} />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledOnce();
  });

  it("renders a secondary escape route when given one", () => {
    render(
      <ErrorState
        {...base}
        primaryAction={{ label: "Try again", href: "/" }}
        secondaryAction={{ label: "Go to courses", href: "/courses" }}
      />,
    );

    expect(screen.getByRole("link", { name: "Go to courses" })).toBeInTheDocument();
  });

  it("shows the failing route so the reader knows where they are", () => {
    render(
      <ErrorState {...base} route="/suite/org/revenue" primaryAction={{ label: "Retry", href: "/" }} />,
    );

    expect(screen.getByText(/\/suite\/org\/revenue/)).toBeInTheDocument();
  });

  it("surfaces the support reference when there is a digest", () => {
    render(
      <ErrorState {...base} reference="abc123" primaryAction={{ label: "Retry", href: "/" }} />,
    );

    expect(screen.getByText("abc123")).toBeInTheDocument();
  });

  it("omits the reference line entirely when there is no digest", () => {
    render(<ErrorState {...base} primaryAction={{ label: "Retry", href: "/" }} />);

    expect(screen.queryByText(/Quote reference/)).not.toBeInTheDocument();
  });

  /** A 404 is not a failure, so it must not wear the error colour. */
  it("uses the neutral tone when asked", () => {
    const { container } = render(
      <ErrorState {...base} tone="neutral" primaryAction={{ label: "Retry", href: "/" }} />,
    );

    expect(container.querySelector(".bg-primary-500\\/10")).toBeTruthy();
    expect(container.querySelector(".bg-error-500\\/10")).toBeNull();
  });
});
