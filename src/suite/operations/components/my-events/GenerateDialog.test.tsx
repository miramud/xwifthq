import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DashboardLine } from "@/lib/api/operations-travel-client";
import { chooseOption } from "@/test/selectOption";
import GenerateDialog from "./GenerateDialog";
import { OPTIONS, eventFull } from "../travel/fixtures";

/** Raising travel from an event's budget line: grades from the record, where from, and how they go. */

const api = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/api/operations-travel-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-travel-client")>();
  return { ...actual, events: { ...actual.events, me: { ...actual.events.me, generate: api.generate } } };
});

const line: DashboardLine = {
  id: "line-t",
  lineNo: 4,
  category: "travel",
  label: "Travel",
  description: "Trainers' travel to the board",
  channel: "travel",
  budget: 120_000_000,
  committed: 0,
  paid: 0,
  available: 120_000_000,
  vendorRating: null,
  requests: [],
  orders: [],
  trips: [],
};

const options = { ...OPTIONS, destinationClasses: { ...OPTIONS.destinationClasses, local_tier3: "Elsewhere in Nigeria" } };

beforeEach(() => {
  api.generate.mockReset();
  api.generate.mockResolvedValue({ kind: "travel", id: "trip-9" });
});

describe("GenerateDialog, travel", () => {
  it("takes each traveller's grade from the record, sends where from and how, and drives to Elsewhere in Nigeria by default", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<GenerateDialog event={eventFull()} line={line} options={options} onDone={onDone} onClose={vi.fn()} />);

    await chooseOption(user, "Traveller 1", "Efe Omoregie");
    expect(screen.getByRole("combobox", { name: "Grade of traveller 1" })).toHaveTextContent("Senior staff");

    expect(screen.getByRole("radio", { name: "Air" })).toHaveAttribute("aria-checked", "true");
    await chooseOption(user, "Destination class", "Elsewhere in Nigeria");
    expect(screen.getByRole("radio", { name: "Road" })).toHaveAttribute("aria-checked", "true");

    const dest = screen.getByLabelText("Destination");
    await user.clear(dest);
    await user.type(dest, "Ogbomosho");
    expect(screen.getByLabelText(/Travelling from/)).toHaveAttribute("placeholder", "The organisation's city, if left blank");
    await user.type(screen.getByLabelText(/Travelling from/), "Lagos");
    await user.click(screen.getByRole("button", { name: "Raise the travel request" }));

    expect(api.generate).toHaveBeenCalledWith(expect.any(String), "line-t", {
      what: "travel",
      travellers: [{ userId: "u-efe", grade: "senior" }],
      destinationClass: "local_tier3",
      destination: "Ogbomosho",
      origin: "Lagos",
      mode: "road",
    });
    expect(onDone).toHaveBeenCalledWith({ kind: "travel", id: "trip-9" });
  });

  it("keeps a mode somebody chose, leaves the origin to the API when blank, and keeps the grade editable", async () => {
    const user = userEvent.setup();
    render(<GenerateDialog event={eventFull()} line={line} options={options} onDone={vi.fn()} onClose={vi.fn()} />);
    await chooseOption(user, "Traveller 1", "Ngozi Eze");
    await chooseOption(user, "Grade of traveller 1", "Manager / HOD");
    await user.click(screen.getByRole("radio", { name: "Rail" }));
    await chooseOption(user, "Destination class", "Elsewhere in Nigeria");
    expect(screen.getByRole("radio", { name: "Rail" })).toHaveAttribute("aria-checked", "true");
    const dest = screen.getByLabelText("Destination");
    await user.clear(dest);
    await user.type(dest, "Ilorin");
    await user.click(screen.getByRole("button", { name: "Raise the travel request" }));
    expect(api.generate).toHaveBeenCalledWith(expect.any(String), "line-t", expect.objectContaining({ travellers: [{ userId: "u-ngozi", grade: "manager" }], origin: null, mode: "rail" }));
  });
});
