import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ResolverInfo, StageSpec } from "@/lib/api/org-foundations-client";
import { StageEditor } from "./StageEditor";
import { chooseOption } from "@/test/selectOption";

/** A stage's resolver picker asks for exactly what the chosen kind needs. */

vi.mock("./lookups", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lookups")>();
  const OPTIONS: Record<string, { value: string; label: string }[]> = {
    approvalRoles: [{ value: "BURSAR", label: "Bursar" }],
    people: [{ value: "u-ada", label: "Ada Obi" }],
    units: [{ value: "u-eng", label: "Faculty of Engineering" }],
  };
  return { ...actual, useLookup: (key: string | null) => ({ status: "ready", options: key ? OPTIONS[key] ?? [] : [] }) };
});

const RESOLVERS: ResolverInfo[] = [
  { kind: "role", label: "Approval role", params: { role: "role" } },
  { kind: "user", label: "A named person", params: { userId: "user" } },
  { kind: "line_manager", label: "Line manager", params: {} },
];

const STAGE: StageSpec = {
  key: "stage-1",
  name: "Bursar",
  order: 10,
  type: "approval",
  completion: "one",
  quorum: null,
  resolver: { kind: "role", role: "" },
  fallback: null,
  slaHours: null,
  parallelGroup: null,
  distinctPerson: false,
  canAmend: [],
};

function Harness({ onStage, errors }: { onStage: (s: StageSpec) => void; errors?: Record<string, string[]> }) {
  const [stage, setStage] = useState(STAGE);
  return (
    <StageEditor
      stage={stage}
      onChange={(s) => {
        setStage(s);
        onStage(s);
      }}
      onRemove={vi.fn()}
      onMove={vi.fn()}
      index={0}
      count={1}
      resolvers={RESOLVERS}
      amendable={["amount"]}
      path="rules.0.stages.0"
      errors={errors}
    />
  );
}

describe("StageEditor", () => {
  it("picks a role by its code for a role resolver", async () => {
    const user = userEvent.setup();
    const onStage = vi.fn();
    render(<Harness onStage={onStage} />);

    await chooseOption(user, "Approval role", "Bursar");
    expect(onStage).toHaveBeenLastCalledWith(expect.objectContaining({ resolver: { kind: "role", role: "BURSAR" } }));
  });

  it("swaps the parameters when the kind changes", async () => {
    const user = userEvent.setup();
    const onStage = vi.fn();
    render(<Harness onStage={onStage} />);

    await chooseOption(user, "Who approves", "A named person");
    expect(onStage).toHaveBeenLastCalledWith(expect.objectContaining({ resolver: { kind: "user", userId: "" } }));
    expect(screen.queryByRole("combobox", { name: "Approval role" })).not.toBeInTheDocument();

    await chooseOption(user, "Person", "Ada Obi");
    expect(onStage).toHaveBeenLastCalledWith(expect.objectContaining({ resolver: { kind: "user", userId: "u-ada" } }));

    await chooseOption(user, "Who approves", "Line manager");
    expect(onStage).toHaveBeenLastCalledWith(expect.objectContaining({ resolver: { kind: "line_manager" } }));
    expect(screen.queryByRole("combobox", { name: "Person" })).not.toBeInTheDocument();
  });

  it("asks how many for a quorum, and records amendable fields and the different-person rule", async () => {
    const user = userEvent.setup();
    const onStage = vi.fn();
    render(<Harness onStage={onStage} />);

    await user.selectOptions(screen.getByLabelText("Who must answer"), "quorum");
    expect(onStage).toHaveBeenLastCalledWith(expect.objectContaining({ completion: "quorum", quorum: 2 }));
    expect(screen.getByLabelText("How many must approve")).toHaveValue(2);

    await user.click(screen.getByText("More options: fallback, time allowed, changes"));
    await user.click(screen.getByRole("switch", { name: "Different person required" }));
    await user.click(screen.getByRole("checkbox", { name: "amount" }));
    expect(onStage).toHaveBeenLastCalledWith(expect.objectContaining({ distinctPerson: true, canAmend: ["amount"] }));
  });

  it("shows the API's message under the resolver parameter it names", () => {
    render(<Harness onStage={vi.fn()} errors={{ "rules.0.stages.0.resolver.role": ['No role "DEAN" in this organisation.'] }} />);
    const box = screen.getByRole("combobox", { name: "Approval role" });
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box.parentElement?.parentElement).toHaveTextContent('No role "DEAN" in this organisation.');
  });
});
