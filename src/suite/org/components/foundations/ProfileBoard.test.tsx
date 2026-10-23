import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfileBoard from "./ProfileBoard";
import { ApiError, type OrgProfile } from "@/lib/api/org-foundations-client";

/** The organisation profile: one form, saved as only what changed, beside a live letterhead. */

const api = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), fxList: vi.fn(), fxCreate: vi.fn(), fxRemove: vi.fn() }));

vi.mock("@/lib/api/org-foundations-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/org-foundations-client")>();
  return {
    ...actual,
    orgFoundations: {
      ...actual.orgFoundations,
      profile: { get: api.get, update: api.update },
      fxRates: { list: api.fxList, create: api.fxCreate, remove: api.fxRemove },
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org/profile",
  useSearchParams: () => new URLSearchParams(),
}));

const PROFILE: OrgProfile = {
  legalName: "Meridian Polytechnic Ltd",
  tradingName: null,
  shortCode: "MPT",
  rcNumber: "1234567",
  tin: "TIN-99",
  vatNumber: null,
  addressLine1: "1 Marina",
  addressLine2: null,
  city: "Lagos",
  state: "Lagos",
  postalCode: null,
  country: "NG",
  address: "1 Marina, Lagos",
  displayName: "Meridian Polytechnic Ltd",
  baseCurrency: "NGN",
  fiscalYearStartMonth: 1,
  fiscalYearStartDay: 1,
  timezone: "Africa/Lagos",
  workingDays: [1, 2, 3, 4, 5],
  workStartsAt: "08:00",
  workEndsAt: "17:00",
  documentFooter: "Registered in Nigeria",
  updatedAt: "2026-10-01T10:00:00Z",
};

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.get.mockResolvedValue(PROFILE);
  api.fxList.mockResolvedValue({
    data: [
      { id: "r1", currency: "USD", baseCurrency: "NGN", rate: "1545.25", asOf: "2026-09-01", source: null },
      { id: "r2", currency: "USD", baseCurrency: "NGN", rate: "1601.5", asOf: "2026-10-01", source: "CBN" },
    ],
    meta: { baseCurrency: "NGN" },
  });
});

describe("ProfileBoard", () => {
  it("saves a working-day change as just the working days", async () => {
    const user = userEvent.setup();
    api.update.mockImplementation(async (patch: Partial<OrgProfile>) => ({ ...PROFILE, ...patch }));
    render(<ProfileBoard />);

    const saturday = await screen.findByRole("button", { name: "Saturday" });
    expect(saturday).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Monday" })).toHaveAttribute("aria-pressed", "true");

    await user.click(saturday);
    expect(saturday).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/6 working days/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith({ workingDays: [1, 2, 3, 4, 5, 6] }));
    expect(await screen.findByText("Profile saved.", { selector: "p:not(.sr-only)" })).toBeInTheDocument();
  });

  it("won't save a week with no working days", async () => {
    const user = userEvent.setup();
    render(<ProfileBoard />);
    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]) {
      await user.click(await screen.findByRole("button", { name: day }));
    }
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText("Pick at least one working day.")).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
  });

  it("shows the API's refusal, like a base currency already used for postings", async () => {
    const user = userEvent.setup();
    const msg = "The base currency can't change: money has already been posted in NGN.";
    api.update.mockRejectedValue(new ApiError(msg, 422, { baseCurrency: [msg] }));
    render(<ProfileBoard />);

    const trading = await screen.findByLabelText("Trading name");
    await user.type(trading, "Meridian Poly");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(api.update).toHaveBeenCalledWith({ tradingName: "Meridian Poly" });
    expect((await screen.findAllByText(msg)).length).toBeGreaterThan(0);
  });

  it("previews the letterhead as you type", async () => {
    const user = userEvent.setup();
    render(<ProfileBoard />);

    const preview = (await screen.findByRole("heading", { name: "Letterhead preview" })).closest("section")!;
    expect(preview).toHaveTextContent("Meridian Polytechnic Ltd");
    expect(preview).toHaveTextContent("RC 1234567 · TIN TIN-99");
    expect(preview).toHaveTextContent(/INV\/MPT\/\d{4}\/0042/);
    expect(preview).toHaveTextContent("Registered in Nigeria");

    const code = screen.getByLabelText("Short code");
    await user.clear(code);
    await user.type(code, "mx");
    expect(preview).toHaveTextContent(/INV\/MX\/\d{4}\/0042/);
  });

  it("lists exchange rates exactly as entered", async () => {
    render(<ProfileBoard />);
    expect(await screen.findByText("1601.5")).toBeInTheDocument();
    expect(screen.getByText("1545.25")).toBeInTheDocument();
    expect(screen.getByText("CBN")).toBeInTheDocument();
  });
});
