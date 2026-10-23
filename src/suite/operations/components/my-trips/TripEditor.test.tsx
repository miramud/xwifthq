import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption } from "@/test/selectOption";
import TripEditor from "./TripEditor";
import { OPTIONS, tripFull } from "../travel/fixtures";

/** Finishing a draft trip: it opens with what was saved, recosts as it changes, and saves the whole trip back. */

const api = vi.hoisted(() => ({ options: vi.fn(), get: vi.fn(), update: vi.fn(), create: vi.fn(), push: vi.fn() }));
const nav = vi.hoisted(() => ({ params: new URLSearchParams("id=trip-1") }));

vi.mock("@/lib/api/operations-travel-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-travel-client")>();
  return { ...actual, travel: { ...actual.travel, options: api.options, me: { ...actual.travel.me, get: api.get, update: api.update, create: api.create } } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-efe", role: "user", name: "Efe Omoregie", organisationId: "o", permissions: [] }, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: api.push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/operations/my/trips/new",
  useSearchParams: () => nav.params,
}));

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  nav.params = new URLSearchParams("id=trip-1");
  api.options.mockResolvedValue(OPTIONS);
  api.get.mockResolvedValue(tripFull({ status: "draft", number: null, departsOn: "2099-10-13", returnsOn: "2099-10-15" }));
  api.update.mockResolvedValue(tripFull({ id: "trip-1" }));
});

describe("TripEditor", () => {
  it("opens a draft costed as it was saved, and saves legs and travellers back", async () => {
    const user = userEvent.setup();
    render(<TripEditor />);

    expect(await screen.findByRole("heading", { name: "Finish your trip" })).toBeInTheDocument();
    expect(screen.getByLabelText("Purpose")).toHaveValue("Requirements sign-off with the Eastgate board in Abuja");
    // The preview recomputes the demo trip from the policy: ₦799,500.00.
    expect(screen.getAllByText("₦799,500.00").length).toBeGreaterThan(0);

    // A day longer: one more day of DTA and one more night for each traveller.
    await user.clear(screen.getByLabelText("Return"));
    await user.type(screen.getByLabelText("Return"), "2099-10-16");
    expect(screen.getByText("4 days · 3 nights")).toBeInTheDocument();
    expect(screen.getAllByText("₦960,500.00").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Save the draft" }));
    expect(api.update).toHaveBeenCalledTimes(1);
    const [id, body] = api.update.mock.calls[0];
    expect(id).toBe("trip-1");
    expect(body).toMatchObject({
      purpose: "Requirements sign-off with the Eastgate board in Abuja",
      projectId: "p-sbp",
      costCentreId: null,
      destinationClass: "local_tier1",
      departsOn: "2099-10-13",
      returnsOn: "2099-10-16",
      flightsEstimate: 36_000_000,
      legs: [
        { from: "Ibadan", to: "Abuja", travelOn: "2026-10-13", mode: "air" },
        { from: "Abuja", to: "Ibadan", travelOn: "2026-10-15", mode: "air" },
      ],
      travellers: [
        { userId: "u-efe", grade: "senior" },
        { userId: "u-yusuf", grade: "officer" },
      ],
    });
    expect(api.push).toHaveBeenCalledWith("/suite/operations/my/trips/trip-1");
  });

  it("flags a hotel set above policy and sends it as the whole trip's figure", async () => {
    const user = userEvent.setup();
    render(<TripEditor />);
    await screen.findByRole("heading", { name: "Finish your trip" });

    await user.click(screen.getByRole("switch", { name: "Set DTA or hotel by hand for traveller 2" }));
    const hotel = screen.getAllByLabelText("Hotel for the whole trip (₦)")[0];
    await user.clear(hotel);
    await user.type(hotel, "120000");
    expect(screen.getByText(/Above policy: needs justification and the MD/)).toBeInTheDocument();
    expect(screen.getByText("Needed: above policy")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save the draft" }));
    expect(api.update.mock.calls[0][1].travellers[1]).toEqual({ userId: "u-yusuf", grade: "officer", dta: 7_500_000, hotel: 12_000_000 });
  });

  it("refuses to save a return before the departure, and says where", async () => {
    const user = userEvent.setup();
    render(<TripEditor />);
    await screen.findByRole("heading", { name: "Finish your trip" });
    await user.clear(screen.getByLabelText("Return"));
    await user.type(screen.getByLabelText("Return"), "2099-10-01");
    await user.click(screen.getByRole("button", { name: "Save the draft" }));
    expect(screen.getByText("The return is after the departure.")).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
  });

  it("starts each traveller at their grade on record, and keeps the grade editable", async () => {
    const user = userEvent.setup();
    nav.params = new URLSearchParams();
    render(<TripEditor />);
    // The person raising it travels first, at their own grade on record.
    expect(await screen.findByRole("combobox", { name: "Grade" })).toHaveTextContent("Senior staff");
    expect(screen.getByText("Their grade on record.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add a traveller" }));
    await chooseOption(user, "Traveller 2", "Ngozi Eze");
    const grades = screen.getAllByRole("combobox", { name: "Grade" });
    expect(grades[1]).toHaveTextContent("Management");

    await chooseOption(user, grades[1], "Manager / HOD");
    expect(screen.getByText("Changed from their grade on record, Management.")).toBeInTheDocument();
  });
});
