import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobTitlePicker } from "./JobTitlePicker";
import { resetJobTitlesCache, type JobTitle } from "@/lib/api/job-titles-client";
import { chooseOption, comboboxValue, openCombobox } from "@/test/selectOption";

/** The organisation's job titles as a dropdown: pick by name or id, add from the list, share one request. */

const title = (id: string, name: string, position: number): JobTitle => ({
  id,
  key: name.toLowerCase().replace(/\s+/g, "-"),
  name,
  position,
  isActive: true,
  peopleCount: 0,
});

const TITLES = [title("t-2", "Engineer", 2), title("t-1", "Analyst", 1)];

let fetchMock: ReturnType<typeof vi.fn>;

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

beforeEach(() => {
  resetJobTitlesCache();
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if ((init?.method ?? "GET") === "GET") return respond(200, { data: TITLES });
    const { name } = JSON.parse(String(init?.body));
    return respond(201, { data: title("t-new", name, 3) });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Harness({ mode, initial = "", onChange }: { mode: "name" | "id"; initial?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="jt">Job title</label>
      <JobTitlePicker
        id="jt"
        mode={mode}
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
    </>
  );
}

describe("JobTitlePicker", () => {
  it("lists the organisation's titles in their order, and picks by name", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness mode="name" onChange={onChange} />);

    const listbox = await openCombobox(user, "Job title");
    await waitFor(() => expect(within(listbox).getAllByRole("option")).toHaveLength(2));
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual(["Analyst", "Engineer"]);

    await user.click(within(listbox).getByRole("option", { name: "Engineer" }));
    expect(onChange).toHaveBeenCalledWith("Engineer");
    expect(fetchMock).toHaveBeenCalledWith("/api/org/job-titles", expect.objectContaining({ method: "GET" }));
  });

  it("picks by id in id mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness mode="id" initial="t-1" onChange={onChange} />);

    await waitFor(() => expect(screen.getByRole("combobox", { name: "Job title" })).toHaveTextContent("Analyst"));
    await chooseOption(user, "Job title", "Engineer");
    expect(onChange).toHaveBeenCalledWith("t-2");
    expect(comboboxValue("Job title")).toBe("t-2");
  });

  it("keeps a name that isn't on the list", async () => {
    render(<Harness mode="name" initial="Chief Vibes Officer" />);
    const box = screen.getByRole("combobox", { name: "Job title" });
    expect(box).toHaveTextContent("Chief Vibes Officer");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(box).toHaveTextContent("Chief Vibes Officer");
  });

  it("shares one request between pickers", async () => {
    render(
      <>
        <Harness mode="name" />
        <Harness mode="id" />
      </>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("adds a new title from the dropdown and selects it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness mode="id" onChange={onChange} />);

    await chooseOption(user, "Job title", "Add “Staff Accountant” as a job title", { search: "Staff Accountant" });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("t-new"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/org/job-titles",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Staff Accountant" }) }),
    );
    expect(screen.getByRole("combobox", { name: "Job title" })).toHaveTextContent("Staff Accountant");

    // And it's on the list for the next picker to open.
    const listbox = await openCombobox(user, "Job title");
    expect(within(listbox).getByRole("option", { name: "Staff Accountant" })).toBeInTheDocument();
  });

  it("says to ask an admin when adding isn't allowed", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      (init?.method ?? "GET") === "GET"
        ? respond(200, { data: TITLES })
        : respond(403, { message: "This action is unauthorized." }),
    );
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness mode="name" onChange={onChange} />);

    await chooseOption(user, "Job title", /add “staff accountant”/i, { search: "Staff Accountant" });

    expect(await screen.findByRole("alert")).toHaveTextContent("Ask an admin to add this job title.");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("says when the list didn't load", async () => {
    fetchMock.mockImplementation(() => respond(500, { message: "Server error" }));
    const user = userEvent.setup();
    render(<Harness mode="name" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await openCombobox(user, "Job title");
    expect(await screen.findByText(/job titles didn't load/i)).toBeInTheDocument();
  });

  it("is named by a label that wraps it", () => {
    render(
      <label>
        <span>Job title</span>
        <JobTitlePicker mode="name" value="" onChange={() => {}} />
      </label>,
    );
    // The label's own text only — not the "Choose a job title" inside it.
    expect(screen.getByRole("combobox", { name: "Job title" })).toBeInTheDocument();
  });
});
