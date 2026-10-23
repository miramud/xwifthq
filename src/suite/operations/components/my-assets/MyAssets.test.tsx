import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyAssets from "./MyAssets";
import { resetPickerOptions } from "@/suite/operations/components/assets/parts";
import { OPTIONS, assetRequest, mine } from "@/suite/operations/components/assets/fixtures";
import { ApiError } from "@/lib/api/operations-assets-client";

/** My assets: signing a handover, confirming by tag during a verification, and asking for things. */

const api = vi.hoisted(() => ({ get: vi.fn(), requests: vi.fn(), acknowledge: vi.fn(), verify: vi.fn(), request: vi.fn(), cancel: vi.fn(), options: vi.fn() }));

vi.mock("@/lib/api/operations-assets-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-assets-client")>();
  return {
    ...actual,
    assets: { ...actual.assets, options: api.options },
    myAssets: { ...actual.myAssets, get: api.get, requests: api.requests, acknowledge: api.acknowledge, verify: api.verify, request: api.request, cancel: api.cancel },
  };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-ada", role: "user", name: "Ada Obi", organisationId: "o", permissions: [] }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/suite/operations/my/assets", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset();
  resetPickerOptions();
  api.options.mockResolvedValue(OPTIONS);
  api.get.mockResolvedValue(mine());
  api.requests.mockResolvedValue({ requests: [assetRequest({ status: "in_approval", kind: "replacement", asset: { id: "a1", tagNo: "MPT/LAP/0001", name: "Dell Latitude 5440", status: "allocated" } })], kinds: {} });
});

describe("MyAssets", () => {
  it("opens each request on its own page", async () => {
    render(<MyAssets />);
    expect(await screen.findByRole("link", { name: "Open MPT/AR/2026/0003" })).toHaveAttribute("href", "/suite/operations/my/assets/requests/r1");
    expect(screen.getByRole("link", { name: "MPT/LAP/0001 Dell Latitude 5440" })).toHaveAttribute("href", "/suite/operations/my/assets/requests/r1");
  });

  it("signs for a handover after showing what came with it", async () => {
    const user = userEvent.setup();
    api.acknowledge.mockResolvedValue({});
    render(<MyAssets />);

    const band = await screen.findByRole("region", { name: "Waiting for your signature" });
    expect(band).toHaveTextContent("HP EliteBook");
    expect(band).toHaveTextContent("Charger, bag");
    await user.click(within(band).getByRole("button", { name: "Acknowledge receipt" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("with Charger, bag, in new condition");
    await user.click(within(dialog).getByRole("button", { name: "Sign for it" }));
    expect(api.acknowledge).toHaveBeenCalledWith("m9");
    expect(await screen.findByText(/You signed for MPT\/LAP\/0002/, { selector: "p:not(.sr-only)" })).toBeInTheDocument();
  });

  it("confirms an asset by its tag, and keeps the tag when the API refuses it", async () => {
    const user = userEvent.setup();
    api.verify.mockRejectedValueOnce(new ApiError("Invalid.", 422, { asset: ["That tag is not in this verification."] })).mockResolvedValueOnce({ assetId: "a1", result: "verified" });
    render(<MyAssets />);

    const box = await screen.findByLabelText("Asset tag");
    await user.type(box, "MPT/LAP/9999");
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(api.verify).toHaveBeenCalledWith("MPT/LAP/9999");
    expect(await screen.findByText("That tag is not in this verification.")).toBeInTheDocument();
    expect(box).toHaveValue("MPT/LAP/9999");

    await user.click(screen.getByRole("button", { name: "Confirm you have MPT/LAP/0001" }));
    expect(api.verify).toHaveBeenLastCalledWith("a1");
  });

  it("asks for a take-out only with a return date", async () => {
    const user = userEvent.setup();
    api.request.mockResolvedValue(assetRequest({ id: "r2", number: "MPT/AR/2026/0009", kind: "take_out", status: "in_approval" }));
    render(<MyAssets />);

    await user.click(await screen.findByRole("button", { name: "Report a problem or ask for something" }));
    const dialog = screen.getByRole("dialog", { name: "Report a problem or ask for something" });
    await user.click(within(dialog).getByRole("radio", { name: /Take something off-site/ }));
    await user.click(within(dialog).getByRole("button", { name: "Send the request" }));
    expect(within(dialog).getByText("Choose which of your assets.")).toBeInTheDocument();
    expect(within(dialog).getByText("Say when it comes back.")).toBeInTheDocument();
    expect(api.request).not.toHaveBeenCalled();
  });

  it("starts a fault report on the asset it was raised from", async () => {
    const user = userEvent.setup();
    api.request.mockResolvedValue(assetRequest({ id: "r3", number: "MPT/AR/2026/0010", kind: "replacement", status: "in_approval" }));
    render(<MyAssets />);
    await user.click(await screen.findByRole("button", { name: "Report a problem with MPT/LAP/0001" }));
    const dialog = screen.getByRole("dialog", { name: "Report a problem or ask for something" });
    await user.type(within(dialog).getByLabelText(/What is wrong with it/), "Battery lasts twenty minutes.");
    await user.click(within(dialog).getByRole("button", { name: "Send the request" }));
    expect(api.request).toHaveBeenCalledWith(expect.objectContaining({ kind: "replacement", assetId: "a1", reason: "Battery lasts twenty minutes." }));
    expect(await screen.findByText("MPT/AR/2026/0010 is sent for approval.", { selector: "p:not(.sr-only)" })).toBeInTheDocument();
  });
});
