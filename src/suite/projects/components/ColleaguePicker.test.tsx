import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import ColleaguePicker from "./ColleaguePicker";
import type { MemberCandidate } from "@/lib/api/projects-client";

const { memberCandidates } = vi.hoisted(() => ({ memberCandidates: vi.fn() }));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return { ...actual, projects: { ...actual.projects, memberCandidates } };
});

const ZAINAB: MemberCandidate = {
  userId: "u-zl",
  name: "Zainab Lawal",
  email: "zainab@acme.test",
  jobTitle: "Senior Frontend Engineer",
};
const RUTH: MemberCandidate = { userId: "u-ra", name: "Ruth Akande", email: "ruth@acme.test", jobTitle: "QA Engineer" };

function Harness({ onPick }: { onPick: (p: MemberCandidate | null) => void }) {
  const [value, setValue] = useState<MemberCandidate | null>(null);

  return (
    <ColleaguePicker
      slug="acme"
      value={value}
      onChange={(p) => {
        setValue(p);
        onPick(p);
      }}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  memberCandidates.mockResolvedValue([RUTH, ZAINAB]);
});

describe("ColleaguePicker", () => {
  it("searches colleagues by name and picks one with the keyboard, no user ids", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);

    const box = screen.getByRole("combobox", { name: "Person" });
    await user.click(box);
    memberCandidates.mockResolvedValue([ZAINAB]);
    await user.type(box, "zai");

    /* Wait for the filtered answer, not a stale unfiltered list still on screen. */
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    const option = screen.getByRole("option", { name: /Zainab Lawal/ });
    expect(option).toHaveTextContent("Senior Frontend Engineer");
    expect(memberCandidates).toHaveBeenLastCalledWith("acme", "zai");

    await user.keyboard("{Enter}");

    expect(onPick).toHaveBeenLastCalledWith(ZAINAB);
    /* The choice is shown as a person, and can be changed. */
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getAllByText("Zainab Lawal").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Choose somebody other than Zainab Lawal/ }));
    expect(onPick).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("combobox", { name: "Person" })).toBeInTheDocument();
  });

  it("says plainly when nobody matches", async () => {
    const user = userEvent.setup();
    memberCandidates.mockResolvedValue([]);
    render(<Harness onPick={vi.fn()} />);

    await user.type(screen.getByRole("combobox", { name: "Person" }), "nobody");

    expect(await screen.findByText(/Nobody matching “nobody” who isn't already on it/)).toBeInTheDocument();
  });
});
