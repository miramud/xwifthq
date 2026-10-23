import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VerificationDetail from "./VerificationDetail";
import ExitClearanceDetail from "./ExitClearanceDetail";
import { resetPickerOptions } from "./parts";
import { OPTIONS, clearance, verification } from "./fixtures";

/** Verification: exceptions first, recording a missing asset, and closing with a warning. Exit clearance: settling items and signing off. */

const api = vi.hoisted(() => ({
  vGet: vi.fn(),
  record: vi.fn(),
  close: vi.fn(),
  xGet: vi.fn(),
  decide: vi.fn(),
  sign: vi.fn(),
  options: vi.fn(),
  user: { id: "u-desk", permissions: [] as string[] },
}));

vi.mock("@/lib/api/operations-assets-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-assets-client")>();
  return {
    ...actual,
    assets: { ...actual.assets, options: api.options },
    verifications: { ...actual.verifications, get: api.vGet, record: api.record, close: api.close },
    exitClearances: { ...actual.exitClearances, get: api.xGet, decide: api.decide, sign: api.sign },
  };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: api.user.id, role: "user", name: "Kemi Desk", organisationId: "o", permissions: api.user.permissions }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/suite/operations/assets", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  for (const f of [api.vGet, api.record, api.close, api.xGet, api.decide, api.sign, api.options]) f.mockReset();
  resetPickerOptions();
  api.options.mockResolvedValue(OPTIONS);
  api.user.id = "u-desk";
  api.user.permissions = [
    ...["view", "record", "close"].map((a) => `admin.asset_verification.${a}`),
    ...["view", "decide", "sign_off"].map((a) => `admin.exit_clearances.${a}`),
  ];
});

describe("VerificationDetail", () => {
  it("records an asset as missing", async () => {
    const user = userEvent.setup();
    api.vGet.mockResolvedValue(verification());
    api.record.mockResolvedValue({ id: "i2", result: "missing" });
    render(<VerificationDetail id="v1" />);

    const rows = await screen.findAllByRole("listitem");
    expect(rows.find((r) => r.textContent?.includes("MPT/LAP/0003"))).toHaveTextContent("Found with Ada Obi at Abuja office");
    await user.click(screen.getByRole("button", { name: "Record" }));
    const dialog = screen.getByRole("dialog", { name: "Record what was found" });
    await user.click(within(dialog).getByRole("radio", { name: "Not found" }));
    await user.type(within(dialog).getByLabelText("Note"), "Not at the desk; custodian on leave");
    await user.click(within(dialog).getByRole("button", { name: "Record as missing" }));
    expect(api.record).toHaveBeenCalledWith("v1", "i2", { found: false, note: "Not at the desk; custodian on leave" });
  });

  it("keeps the expected custodian unless somebody else is chosen", async () => {
    const user = userEvent.setup();
    api.vGet.mockResolvedValue(verification());
    api.record.mockResolvedValue({ id: "i2", result: "verified" });
    render(<VerificationDetail id="v1" />);
    await user.click(await screen.findByRole("button", { name: "Record" }));
    const dialog = screen.getByRole("dialog", { name: "Record what was found" });
    await user.click(within(dialog).getByRole("button", { name: "Record as found" }));
    expect(api.record).toHaveBeenCalledWith("v1", "i2", { found: true, foundLocation: "Abuja office", condition: null, note: null });
  });

  it("warns that anything not seen becomes missing before closing", async () => {
    const user = userEvent.setup();
    api.vGet.mockResolvedValue(verification());
    api.close.mockResolvedValue({ ...verification(), status: "closed" });
    render(<VerificationDetail id="v1" />);
    await user.click(await screen.findByRole("button", { name: "Close the verification" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("2 assets not yet seen will be recorded as missing.");
    await user.click(within(dialog).getByRole("button", { name: "Close the verification" }));
    expect(api.close).toHaveBeenCalledWith("v1");
  });
});

describe("ExitClearanceDetail", () => {
  it("says final pay waits, and needs a value and a reason to deduct", async () => {
    const user = userEvent.setup();
    api.xGet.mockResolvedValue(clearance());
    api.decide.mockResolvedValue(clearance({ outstanding: 0, items: [{ ...clearance().items[0], status: "deduct", value: 45_000_000, note: "Lost on a trip" }] }));
    render(<ExitClearanceDetail id="x1" />);

    expect(await screen.findByText(/Final pay is on hold/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Deduct" }));
    const dialog = screen.getByRole("dialog", { name: "Deduct it from final pay" });
    const value = within(dialog).getByLabelText("Value to deduct (₦)");
    await user.clear(value);
    await user.click(within(dialog).getByRole("button", { name: "Deduct from final pay" }));
    expect(within(dialog).getByText("Value what is being deducted.")).toBeInTheDocument();
    expect(within(dialog).getByText("Say why it is not coming back.")).toBeInTheDocument();
    expect(api.decide).not.toHaveBeenCalled();

    await user.type(value, "450000");
    await user.type(within(dialog).getByLabelText(/Why it is not coming back/), "Lost on a trip");
    await user.click(within(dialog).getByRole("button", { name: "Deduct from final pay" }));
    expect(api.decide).toHaveBeenCalledWith("x1", "xi1", { status: "deduct", value: 45_000_000, note: "Lost on a trip" });
    expect(await screen.findByText(/Nothing is outstanding/)).toBeInTheDocument();
  });

  it("signs off an area after confirming, but never for the leaver", async () => {
    const user = userEvent.setup();
    api.xGet.mockResolvedValue(clearance());
    api.sign.mockResolvedValue(clearance({ signoffs: clearance().signoffs.map((s) => (s.key === "admin" ? { ...s, name: "Kemi Desk", at: "2026-10-06T10:00:00+01:00" } : s)) }));
    const { unmount } = render(<ExitClearanceDetail id="x1" />);
    await user.click(await screen.findByRole("button", { name: "Sign off for Admin" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Sign for Admin" }));
    expect(api.sign).toHaveBeenCalledWith("x1", "admin");
    expect(await screen.findByText(/Kemi Desk ·/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign off for IT" })).not.toBeInTheDocument();
    unmount();

    api.user.id = "u-efe";
    render(<ExitClearanceDetail id="x1" />);
    expect(await screen.findByText("You can’t sign your own clearance.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign off for Admin" })).not.toBeInTheDocument();
  });
});
