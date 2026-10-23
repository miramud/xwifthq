import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: Record<string, unknown>) => <img {...(props as object)} alt={String(props.alt)} />,
}));

import { ModuleTour } from "./ModuleTour";
import {
  ExpectedActualFigure,
  TestingFigure,
} from "./ProjectsVisuals";

describe("ModuleTour", () => {
  it("renders one stop per screen, with its heading and the real screenshot", () => {
    render(
      <ModuleTour
        hue="info"
        stops={[
          { screen: "projectsBoard", area: "Story board", title: "Stories by epic", body: "Cards are stories." },
          { screen: "projectsFinance", area: "Finance tab", title: "Expected against actual", body: "Budget beside spend." },
        ]}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole("heading", { name: "Stories by epic" })).toBeInTheDocument();
    expect(within(items[1]).getByRole("img", { name: /Expected expense against actual/ })).toBeInTheDocument();
  });
});

describe("Projects drawn figures", () => {
  it("states budget use in words, not only in colour", () => {
    render(<ExpectedActualFigure />);
    expect(screen.getByRole("img", { name: /per cent of the approved budget spent/ })).toBeInTheDocument();
    expect(screen.getByText(/of budget used/)).toBeInTheDocument();
    expect(screen.getByText("Raised by T. Bello")).toBeInTheDocument();
  });

  it("shows a failed test case turning into a bug", () => {
    render(<TestingFigure />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText(/Finding → bug on the board/)).toBeInTheDocument();
  });
});
