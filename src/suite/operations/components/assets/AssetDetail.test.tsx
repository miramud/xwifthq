import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption } from "@/test/selectOption";
import AssetDetail from "./AssetDetail";
import { resetPickerOptions } from "./parts";
import { OPTIONS, assetFull, movement } from "./fixtures";

/** An asset's card: the actions follow its status and the keys held; Finance's side is read-only. */

const api = vi.hoisted(() => ({ get: vi.fn(), allocate: vi.fn(), tag: vi.fn(), setStatus: vi.fn(), options: vi.fn(), categories: vi.fn(), raise: vi.fn(), permissions: [] as string[] }));

vi.mock("@/lib/api/operations-maintenance-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-maintenance-client")>();
  return { ...actual, maintenance: { ...actual.maintenance, create: api.raise, options: vi.fn().mockResolvedValue({ staff: [], vendors: [] }), facilities: vi.fn().mockResolvedValue([]) } };
});

vi.mock("@/lib/api/operations-assets-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-assets-client")>();
  return {
    ...actual,
    assets: { ...actual.assets, get: api.get, allocate: api.allocate, tag: api.tag, setStatus: api.setStatus, options: api.options, categories: api.categories },
  };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-desk", role: "user", name: "Kemi Desk", organisationId: "o", permissions: api.permissions }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/suite/operations/assets/a1", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  for (const f of [api.get, api.allocate, api.tag, api.setStatus, api.options, api.categories, api.raise]) f.mockReset();
  resetPickerOptions();
  api.options.mockResolvedValue(OPTIONS);
  api.categories.mockResolvedValue([]);
  api.permissions = ["view", "update", "tag", "allocate", "transfer", "return_asset", "set_status"].map((a) => `admin.assets.${a}`);
});

describe("AssetDetail", () => {
  it("hands an asset in store to somebody, with its accessories", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(assetFull());
    api.allocate.mockResolvedValue(assetFull({ status: "in_transit", pendingHandover: movement() }));
    render(<AssetDetail id="a1" />);

    await user.click(await screen.findByRole("button", { name: "Hand over" }));
    const dialog = screen.getByRole("dialog", { name: "Hand over this asset" });
    await user.click(within(dialog).getByRole("button", { name: "Hand it over" }));
    expect(within(dialog).getByText("Choose who receives it.")).toBeInTheDocument();
    expect(api.allocate).not.toHaveBeenCalled();

    await chooseOption(user, within(dialog).getByRole("combobox", { name: "Who receives it" }), "Ada Obi");
    await user.type(within(dialog).getByLabelText("Accessories"), "Charger, bag");
    await user.click(within(dialog).getByRole("button", { name: "Hand it over" }));
    expect(api.allocate).toHaveBeenCalledWith("a1", { toUserId: "u-ada", projectId: null, location: null, accessories: "Charger, bag", condition: "new", note: null });
    expect(await screen.findByText(/Waiting for Ada Obi to sign handover/)).toBeInTheDocument();
  });

  it("links each handover in its history to the printable note", async () => {
    api.get.mockResolvedValue(assetFull({ history: [movement({ acknowledgedAt: "2026-10-05T10:00:00+01:00", acknowledgedBy: "Ada Obi" }), ...assetFull().history] }));
    render(<AssetDetail id="a1" />);
    const note = await screen.findByRole("link", { name: "Handover note MPT/HO/2026/0007 (PDF)" });
    expect(note).toHaveAttribute("href", "/api/operations/assets/movements/m1/pdf");
    // Tagging is not a handover: one note only.
    expect(screen.getAllByRole("link", { name: /Handover note/ })).toHaveLength(1);
  });

  it("shows Finance's book read-only, and says so when the asset is not on it", async () => {
    api.get.mockResolvedValue(assetFull());
    const { unmount } = render(<AssetDetail id="a1" />);
    expect(await screen.findByText("₦712,500.00")).toBeInTheDocument();
    expect(screen.getByText("25% depreciated")).toBeInTheDocument();
    unmount();

    api.get.mockResolvedValue(assetFull({ book: null }));
    render(<AssetDetail id="a1" />);
    expect(await screen.findByText("Not on Finance’s books")).toBeInTheDocument();
  });

  it("offers Tag only for a received asset", async () => {
    api.get.mockResolvedValue(assetFull({ status: "received", tagNo: null }));
    render(<AssetDetail id="a1" />);
    expect(await screen.findByRole("button", { name: "Tag it" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hand over" })).not.toBeInTheDocument();
    expect(screen.getByText("Not tagged")).toBeInTheDocument();
  });

  it("will not report a theft without the incident", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(assetFull({ status: "allocated", custodianId: "u-ada", custodian: "Ada Obi" }));
    api.setStatus.mockResolvedValue(assetFull({ status: "stolen" }));
    render(<AssetDetail id="a1" />);
    await user.click(await screen.findByRole("button", { name: "Report it stolen" }));
    const dialog = screen.getByRole("dialog", { name: "Report it stolen" });
    await user.click(within(dialog).getByRole("button", { name: "Report it stolen" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Write the incident report");
    expect(api.setStatus).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText(/Incident report/), "Taken from a car in Wuse on 4 Oct; police report 1182.");
    await user.click(within(dialog).getByRole("button", { name: "Report it stolen" }));
    expect(api.setStatus).toHaveBeenCalledWith("a1", "stolen", "Taken from a car in Wuse on 4 Oct; police report 1182.");
  });

  it("lists its work orders and reports a fault on it", async () => {
    const user = userEvent.setup();
    api.permissions = [...api.permissions, "admin.maintenance.create"];
    api.get.mockResolvedValue(
      assetFull({
        workOrders: [{ id: "w1", number: "WO-2026-0041", kind: "corrective", title: "Screen flickers", status: "completed", createdAt: "2026-09-20 10:00:00", cost: 2_500_000, prId: null }],
      }),
    );
    api.raise.mockResolvedValue({ id: "w2", number: "WO-2026-0042" });
    render(<AssetDetail id="a1" />);
    expect(await screen.findByRole("link", { name: /Screen flickers/ })).toHaveAttribute("href", "/suite/operations/maintenance/w1");
    expect(screen.getByText(/WO-2026-0041/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Report a fault" }));
    const dialog = screen.getByRole("dialog", { name: "Report a fault" });
    await user.type(within(dialog).getByLabelText("What is wrong"), "Keyboard keys stick");
    await user.click(within(dialog).getByRole("button", { name: "Raise work order" }));
    expect(api.raise).toHaveBeenCalledWith(expect.objectContaining({ assetId: "a1", facilityId: null, title: "Keyboard keys stick", priority: "normal" }));
    expect(await screen.findByText(/Work order WO-2026-0042 raised/)).toBeInTheDocument();
  }, 20_000);

  it("offers nothing to somebody with only the view key", async () => {
    api.permissions = ["admin.assets.view"];
    api.get.mockResolvedValue(assetFull());
    render(<AssetDetail id="a1" />);
    expect(await screen.findByText("Dell Latitude 5440", { selector: "h1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hand over" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Report it lost" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Report a fault" })).not.toBeInTheDocument();
  });
});

describe("AssetDetail, the supplier", () => {
  it("links the supplier to its counterparty page for somebody with the key", async () => {
    api.permissions = [...api.permissions, "core.counterparties.view"];
    api.get.mockResolvedValue(assetFull({ supplierId: "v-konga", supplier: "Konga Business" }));
    render(<AssetDetail id="a1" />);
    expect(await screen.findByRole("link", { name: "Konga Business" })).toHaveAttribute("href", "/suite/org/counterparties/v-konga");
  }, 15_000);
});
