import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AssetRequestDetail from "./AssetRequestDetail";
import { assetRequest } from "./fixtures";

/** Fulfilling a request: from the pool in store first, a purchase request when nothing fits, and a disposal against Finance's book. */

const api = vi.hoisted(() => ({ get: vi.fn(), fulfil: vi.fn(), convert: vi.fn(), categories: vi.fn(), permissions: [] as string[] }));

vi.mock("@/lib/api/operations-assets-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-assets-client")>();
  return {
    ...actual,
    assets: { ...actual.assets, categories: api.categories },
    assetRequests: { ...actual.assetRequests, get: api.get, fulfil: api.fulfil, convert: api.convert },
  };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-desk", role: "user", name: "Kemi Desk", organisationId: "o", permissions: api.permissions }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/suite/operations/assets/requests/r1", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  for (const f of [api.get, api.fulfil, api.convert, api.categories]) f.mockReset();
  api.categories.mockResolvedValue([{ id: "c-lap", code: "LAP", name: "Laptops", kind: "capital", assetClass: "ict", active: true }]);
  api.permissions = ["view", "fulfil", "convert", "cancel", "submit", "check_in"].map((a) => `admin.asset_requests.${a}`);
});

describe("AssetRequestDetail", () => {
  it("hands over what is chosen from the pool in store", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(assetRequest());
    api.fulfil.mockResolvedValue(assetRequest({ status: "fulfilled" }));
    render(<AssetRequestDetail id="r1" />);

    await user.click(await screen.findByRole("button", { name: "Hand over the asset" }));
    expect(screen.getByText("Choose what to hand over from store.")).toBeInTheDocument();
    expect(api.fulfil).not.toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox", { name: "MPT/LAP/0002 Dell Latitude 5440" }));
    expect(screen.getByText("1 of 1 chosen")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Accessories"), "Charger");
    await user.click(screen.getByRole("button", { name: "Hand over the asset" }));
    expect(api.fulfil).toHaveBeenCalledWith("r1", { assetIds: ["a2"], condition: null, accessories: "Charger", note: null });
  });

  it("raises a purchase request when nothing suitable is in store, after confirming", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(assetRequest({ pool: [] }));
    api.convert.mockResolvedValue({ ...assetRequest({ status: "converted", prId: "pr9" }), purchaseRequest: { id: "pr9", number: "MPT/PR/2026/0044" } });
    render(<AssetRequestDetail id="r1" />);

    expect(await screen.findByText("Nothing suitable is in store")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hand over the asset" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Nothing suitable\? Raise a purchase request/ }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Raise the purchase request" }));
    expect(api.convert).toHaveBeenCalledWith("r1");
    expect(await screen.findByRole("link", { name: "Open the purchase request" })).toHaveAttribute("href", "/suite/operations/procurement/requests/pr9");
  });

  it("shows a disposal's expected loss against net book value, and confirms before disposing", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(
      assetRequest({
        kind: "disposal",
        kindLabel: "Disposal",
        categoryId: null,
        category: null,
        pool: [],
        asset: { id: "a1", tagNo: "MPT/LAP/0001", name: "Dell Latitude 5440", status: "in_store" },
        disposalMethod: "sale",
        proceeds: 5_000_000,
        book: { cost: 95_000_000, accumulated: 23_750_000, nbv: 71_250_000, rateBp: 2500, status: "active", capitalisedOn: "2026-01-01", class: "ICT equipment", gainLoss: null },
      }),
    );
    api.fulfil.mockResolvedValue(assetRequest({ status: "fulfilled" }));
    render(<AssetRequestDetail id="r1" />);

    expect(await screen.findByText("Expected loss")).toBeInTheDocument();
    expect(screen.getByText("₦662,500.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dispose of it" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("can't be undone");
    await user.click(within(dialog).getByRole("button", { name: "Dispose of it" }));
    expect(api.fulfil).toHaveBeenCalledWith("r1", expect.objectContaining({ on: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
  });

  it("shows no fulfil panel without the key", async () => {
    api.permissions = ["admin.asset_requests.view"];
    api.get.mockResolvedValue(assetRequest());
    render(<AssetRequestDetail id="r1" />);
    expect(await screen.findByText("New starter on the Kano rollout")).toBeInTheDocument();
    expect(screen.queryByText("Fulfil the request")).not.toBeInTheDocument();
  });
});
