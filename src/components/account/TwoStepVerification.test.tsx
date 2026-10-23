import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/admin-client";
import { TwoStepVerification } from "./TwoStepVerification";

/** My account › Security: setting up an authenticator, the one-time backup codes, turning it off. */

const api = vi.hoisted(() => ({ status: vi.fn(), start: vi.fn(), confirm: vi.fn(), disable: vi.fn(), regenerate: vi.fn() }));

vi.mock("@/lib/api/account-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/account-client")>();
  return { ...actual, mfa: api };
});

const off = { enabled: false, pending: false, confirmedAt: null, backupCodesLeft: 0, lastVerifiedAt: null };
const on = { enabled: true, pending: false, confirmedAt: "2026-10-07T10:00:00Z", backupCodesLeft: 10, lastVerifiedAt: null };
const CODES = ["aaaa-bbbb", "cccc-dddd", "eeee-ffff", "gggg-hhhh", "jjjj-kkkk", "mmmm-nnnn", "pppp-qqqq", "rrrr-ssss", "tttt-uuuu", "vvvv-wwww"];

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));

describe("TwoStepVerification", () => {
  it("sets up with a QR code and key, then shows the backup codes once", async () => {
    const user = userEvent.setup();
    api.status.mockResolvedValue(off);
    api.start.mockResolvedValue({ secret: "ABCD EFGH IJKL MNOP", otpauthUri: "otpauth://totp/x", qr: "data:image/svg+xml;base64,AAA" });
    api.confirm.mockRejectedValueOnce(new ApiError("That code is not right.", 422, { mfaCode: ["That code is not right."] }, "MFA_INVALID"));
    api.confirm.mockResolvedValueOnce({ ...on, backupCodes: CODES });
    render(<TwoStepVerification />);

    await user.click(await screen.findByRole("button", { name: "Set up two-step verification" }));
    expect(await screen.findByRole("img", { name: "QR code to scan with your authenticator app" })).toHaveAttribute("src", "data:image/svg+xml;base64,AAA");
    expect(screen.getByText("ABCD EFGH IJKL MNOP")).toBeInTheDocument();

    const input = screen.getByLabelText("6-digit code from the app");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    const turnOn = screen.getByRole("button", { name: "Turn on" });
    expect(turnOn).toBeDisabled();

    await user.type(input, "111111");
    await user.click(turnOn);
    expect(await screen.findByRole("alert")).toHaveTextContent("That code is not right.");

    await user.clear(input);
    await user.type(input, "222222");
    await user.click(turnOn);
    await waitFor(() => expect(api.confirm).toHaveBeenLastCalledWith("222222"));

    const list = await screen.findByRole("list", { name: "Backup codes" });
    expect(list.querySelectorAll("li")).toHaveLength(10);
    const done = screen.getByRole("button", { name: "Done" });
    expect(done).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "I have saved these codes somewhere safe" }));
    await user.click(done);

    expect(await screen.findByText("10 of 10")).toBeInTheDocument();
    expect(screen.queryByText("aaaa-bbbb")).not.toBeInTheDocument();
  });

  it("turns off with a backup code", async () => {
    const user = userEvent.setup();
    api.status.mockResolvedValue(on);
    api.disable.mockResolvedValue(off);
    render(<TwoStepVerification />);

    await user.click(await screen.findByRole("button", { name: "Turn off" }));
    await user.click(screen.getByRole("button", { name: "Use a backup code" }));
    await user.type(screen.getByLabelText("Backup code"), "aaaa-bbbb");
    await user.click(screen.getByRole("button", { name: "Turn off" }));

    await waitFor(() => expect(api.disable).toHaveBeenCalledWith("aaaa-bbbb"));
    expect(await screen.findByRole("button", { name: "Set up two-step verification" })).toBeInTheDocument();
  });

  it("makes new backup codes with a code from the app", async () => {
    const user = userEvent.setup();
    api.status.mockResolvedValue({ ...on, backupCodesLeft: 1 });
    api.regenerate.mockResolvedValue({ ...on, backupCodes: CODES });
    render(<TwoStepVerification />);

    expect(await screen.findByText(/make new ones/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Make new backup codes" }));
    await user.type(screen.getByLabelText("6-digit code"), "135790");
    await user.click(screen.getByRole("button", { name: "Make new codes" }));

    await waitFor(() => expect(api.regenerate).toHaveBeenCalledWith("135790"));
    expect(await screen.findByText("New backup codes made. The old ones no longer work.")).toBeInTheDocument();
  });
});
