import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DeskTripDetail from "./DeskTripDetail";
import { SubmitForApproval } from "./shared";
import { OPTIONS, tripFull } from "./fixtures";
import { ApiError } from "@/lib/api/operations-travel-client";

/** The desk records bookings and carries out approved changes - only with the keys for each. */

const api = vi.hoisted(() => ({ get: vi.fn(), execute: vi.fn(), book: vi.fn(), options: vi.fn() }));
const auth = vi.hoisted(() => ({ permissions: [] as string[] }));

vi.mock("@/lib/api/operations-travel-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-travel-client")>();
  return {
    ...actual,
    travel: { ...actual.travel, options: api.options, desk: { ...actual.travel.desk, get: api.get, executeChange: api.execute, book: api.book } },
  };
});
vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { id: "u-desk", role: "user", name: "Travel desk", organisationId: "o", permissions: auth.permissions }, loading: false }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/suite/operations/travel/trip-1", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.options.mockResolvedValue(OPTIONS);
  api.get.mockResolvedValue(tripFull());
  auth.permissions = ["admin.travel_desk.view", "admin.travel_desk.book", "admin.travel_desk.execute_change"];
});

describe("DeskTripDetail", () => {
  it("marks an approved change as done after confirming what it does", async () => {
    const user = userEvent.setup();
    api.execute.mockResolvedValue(tripFull({ changes: [{ ...tripFull().changes[0], status: "executed", executedAt: "2026-10-02T09:00:00+00:00" }] }));
    render(<DeskTripDetail id="trip-1" />);

    await user.click(await screen.findByRole("button", { name: "Mark as done" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("The booking PNR K7XQ2M is marked changed.");
    expect(dialog).toHaveTextContent("₦38,500.00");
    await user.click(within(dialog).getByRole("button", { name: "Mark as done" }));
    expect(api.execute).toHaveBeenCalledWith("c1");
    expect((await screen.findAllByText("Done")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Mark as done" })).not.toBeInTheDocument();
  });

  it("records a booking with its PNR and amount", async () => {
    const user = userEvent.setup();
    api.book.mockResolvedValue(tripFull());
    render(<DeskTripDetail id="trip-1" />);
    await user.click(await screen.findByRole("button", { name: "Record a booking" }));
    await user.type(screen.getByLabelText("PNR or ticket number"), "PNR K7XQ2N");
    await user.type(screen.getByLabelText("Amount (₦)"), "172000");
    await user.click(screen.getByRole("button", { name: "Record the booking" }));
    expect(api.book).toHaveBeenCalledWith("trip-1", { kind: "flight", travellerId: null, agencyId: null, reference: "PNR K7XQ2N", details: null, amount: 17_200_000 });
  });

  it("offers neither action without the desk's keys", async () => {
    auth.permissions = ["admin.travel_desk.view"];
    render(<DeskTripDetail id="trip-1" />);
    expect(await screen.findByText("Approved, to carry out")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark as done" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record a booking" })).not.toBeInTheDocument();
  });
});

describe("SubmitForApproval", () => {
  it("after a funds refusal, asks for the MD's reason and sends it with that", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("Invalid.", 422, { funds: ["INSUFFICIENT_PROJECT_FUNDS: the project has 10.00 available and this asks for 20.00."] }))
      .mockResolvedValueOnce(undefined);
    render(<SubmitForApproval label="Send for approval" onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Send for approval" }));
    expect(onSubmit).toHaveBeenLastCalledWith(null);
    expect(await screen.findByText("the project has 10.00 available and this asks for 20.00.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send for approval with this reason" }));
    expect(screen.getByText(/Give the reason for going beyond/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Reason for going beyond the funds"), "Client deadline");
    await user.click(screen.getByRole("button", { name: "Send for approval with this reason" }));
    expect(onSubmit).toHaveBeenLastCalledWith("Client deadline");
  });

  it("stays disabled with the reason it can't be sent", () => {
    render(<SubmitForApproval label="Send for approval" blocked="Add who is travelling before you send it." onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Send for approval" })).toBeDisabled();
    expect(screen.getByText("Add who is travelling before you send it.")).toBeInTheDocument();
  });
});
