import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption } from "@/test/selectOption";
import AssetRegister from "./AssetRegister";
import { resetPickerOptions } from "./parts";
import { OPTIONS, assetSummary, registerMeta } from "./fixtures";

/** The register: its figures, value by category, filters sent to the API, and adding an asset only with the key. */

const api = vi.hoisted(() => ({ list: vi.fn(), categories: vi.fn(), options: vi.fn(), create: vi.fn(), permissions: [] as string[] }));

vi.mock("@/lib/api/operations-assets-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-assets-client")>();
  return { ...actual, assets: { ...actual.assets, list: api.list, categories: api.categories, options: api.options, create: api.create } };
});
const csv = vi.hoisted(() => vi.fn());
vi.mock("@/components/workspace/csv", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/components/workspace/csv")>()), downloadCsv: csv }));
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-desk", role: "user", name: "Kemi Desk", organisationId: "o", permissions: api.permissions }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/suite/operations/assets", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  for (const f of [api.list, api.categories, api.options, api.create, csv]) f.mockReset();
  resetPickerOptions();
  api.options.mockResolvedValue(OPTIONS);
  api.categories.mockResolvedValue([
    { id: "c-lap", code: "LAP", name: "Laptops", kind: "capital", assetClass: "ict", active: true, assets: 5 },
    { id: "c-phn", code: "PHN", name: "Phones", kind: "controlled", assetClass: null, active: true, assets: 2 },
  ]);
  api.list.mockResolvedValue({ assets: [assetSummary(), assetSummary({ id: "a9", tagNo: "MPT/PHN/0001", name: "iPhone 13", categoryCode: "PHN", category: "Phones", status: "allocated", custodian: "Ada Obi" })], meta: registerMeta() });
  api.permissions = ["admin.assets.view", "admin.assets.create"];
});

describe("AssetRegister", () => {
  it("shows the register's figures and what each category is worth", async () => {
    render(<AssetRegister />);
    const stats = await screen.findByText("Assets on the register");
    expect(stats.closest("div")?.parentElement).toHaveTextContent("7");
    expect(screen.getByText("Waiting to be tagged")).toBeInTheDocument();
    expect(screen.getByText("Warranty ending in 60 days")).toBeInTheDocument();
    expect((await screen.findAllByText("Laptops (LAP)")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("iPhone 13").length).toBeGreaterThan(0);
  });

  it("sends the status filter to the API", async () => {
    const user = userEvent.setup();
    render(<AssetRegister />);
    await screen.findByText("Assets on the register");
    await chooseOption(user, screen.getByRole("combobox", { name: "Status" }), "Allocated");
    expect(api.list).toHaveBeenLastCalledWith({ status: "allocated", categoryId: "", custodianId: "" });
  });

  it("adds an asset only with the create key, and checks the form first", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<AssetRegister />);
    await user.click(await screen.findByRole("button", { name: "Add asset" }));
    const dialog = screen.getByRole("dialog", { name: "Add an asset" });
    await user.click(within(dialog).getByRole("button", { name: "Add and tag the asset" }));
    expect(within(dialog).getByText("Choose the category.")).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
    unmount();

    api.permissions = ["admin.assets.view"];
    render(<AssetRegister />);
    await screen.findByText("Assets on the register");
    expect(screen.queryByRole("button", { name: "Add asset" })).not.toBeInTheDocument();
  });
});

describe("AssetRegister, CSV", () => {
  it("downloads the assets as listed, after the search", async () => {
    const user = userEvent.setup();
    render(<AssetRegister />);
    await screen.findByText("Assets on the register");
    await user.type(screen.getByPlaceholderText("Search by tag, name, serial or make"), "iPhone");
    await user.click(screen.getByRole("button", { name: "Download CSV" }));
    const [name, rows] = csv.mock.calls[0];
    expect(name).toMatch(/^asset-register.*\.csv$/);
    expect(rows[0]).toContain("Cost");
    expect(rows[0]).toContain("Currency");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(expect.arrayContaining(["MPT/PHN/0001", "iPhone 13", "Phones", "Ada Obi", "NGN"]));
  });
});
