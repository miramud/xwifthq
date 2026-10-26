import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProgrammeTerms from "./ProgrammeTerms";

/** The programme's terms: saved as numbers, refused fields shown beside themselves. */

const api = vi.hoisted(() => ({ settings: vi.fn(), updateSettings: vi.fn() }));

vi.mock("@/lib/api/affiliate-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/affiliate-client")>();
  return { ...actual, platformAffiliates: api };
});

let currentUser: Record<string, unknown> = { role: "super_admin", organisationId: null };

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: currentUser, loading: false }),
}));

const TERMS = { open: true, commissionPercent: 20, discountPercent: 10, cookieDays: 60, holdDays: 14 };

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { role: "super_admin", organisationId: null };
  api.settings.mockResolvedValue(TERMS);
  api.updateSettings.mockImplementation(async (body: typeof TERMS) => ({ ...TERMS, ...body }));
});

describe("ProgrammeTerms", () => {
  it("saves every term as a number", async () => {
    const user = userEvent.setup();
    render(<ProgrammeTerms />);

    const commission = await screen.findByLabelText(/commission \(%\)/i);
    expect(screen.getByRole("button", { name: "Save terms" })).toBeDisabled();
    expect(screen.getByText(/never rewrite commissions already earned/i)).toBeInTheDocument();

    await user.clear(commission);
    await user.type(commission, "25");
    await user.click(screen.getByRole("switch", { name: "Open for applications" }));
    await user.click(screen.getByRole("button", { name: "Save terms" }));

    await waitFor(() =>
      expect(api.updateSettings).toHaveBeenCalledWith({
        open: false,
        commissionPercent: 25,
        discountPercent: 10,
        cookieDays: 60,
        holdDays: 14,
      }),
    );
    expect(await screen.findByText(/saved\. the new terms apply from now on/i)).toBeInTheDocument();
  });

  it("shows a refused field beside itself", async () => {
    const { ApiError } = await import("@/lib/api/affiliate-client");
    api.updateSettings.mockRejectedValue(
      new ApiError("The given data was invalid.", 422, { holdDays: ["The hold period could not be saved."] }),
    );
    const user = userEvent.setup();
    render(<ProgrammeTerms />);

    const hold = await screen.findByLabelText(/hold period/i);
    await user.clear(hold);
    // Within the form's own limits; the server still refuses it here.
    await user.type(hold, "30");
    await user.click(screen.getByRole("button", { name: "Save terms" }));

    expect(await screen.findByText("The hold period could not be saved.")).toBeInTheDocument();
    expect(hold).toHaveAttribute("aria-invalid", "true");
  });

  it("is read only for staff who can only view", async () => {
    currentUser = { role: "platform_staff", permissions: ["platform.affiliates.view"] };
    render(<ProgrammeTerms />);

    expect(await screen.findByLabelText(/commission \(%\)/i)).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save terms" })).not.toBeInTheDocument();
  });
});
