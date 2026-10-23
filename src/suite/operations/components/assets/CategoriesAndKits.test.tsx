import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CategoriesAndKits from "./CategoriesAndKits";
import { primeJobTitlesCache, resetJobTitlesCache } from "@/lib/api/job-titles-client";

/** Categories and kits: a tag code is checked before it is sent, and a kit is removed only after confirming. */

const api = vi.hoisted(() => ({ categories: vi.fn(), kits: vi.fn(), createCategory: vi.fn(), deleteKit: vi.fn(), permissions: [] as string[] }));

vi.mock("@/lib/api/operations-assets-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-assets-client")>();
  return { ...actual, assets: { ...actual.assets, categories: api.categories, kits: api.kits, createCategory: api.createCategory, deleteKit: api.deleteKit } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-desk", role: "user", name: "Kemi Desk", organisationId: "o", permissions: api.permissions }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/suite/operations/assets/categories", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  for (const f of [api.categories, api.kits, api.createCategory, api.deleteKit]) f.mockReset();
  resetJobTitlesCache();
  primeJobTitlesCache([{ id: "jt1", key: "engineer", name: "Software engineer", position: 1, isActive: true, peopleCount: 3 }]);
  api.categories.mockResolvedValue([{ id: "c-lap", code: "LAP", name: "Laptops", kind: "capital", assetClass: "ict", active: true, assets: 5 }]);
  api.kits.mockResolvedValue([{ id: "k1", name: "Engineer kit", jobTitleIds: ["jt1"], items: [{ categoryId: "c-lap", quantity: 1 }] }]);
  api.permissions = ["view", "create_category", "update_category", "create_kit", "update_kit", "delete_kit"].map((a) => `admin.assets.${a}`);
});

describe("CategoriesAndKits", () => {
  it("lists a kit with its job titles and contents, and removes it only after confirming", async () => {
    const user = userEvent.setup();
    api.deleteKit.mockResolvedValue(undefined);
    render(<CategoriesAndKits />);
    expect(await screen.findByText("Engineer kit")).toBeInTheDocument();
    expect(screen.getByText("Software engineer")).toBeInTheDocument();
    expect(screen.getByText("× 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove the Engineer kit kit" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(api.deleteKit).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remove the Engineer kit kit" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove kit" }));
    expect(api.deleteKit).toHaveBeenCalledWith("k1");
    expect(screen.queryByText("Engineer kit")).not.toBeInTheDocument();
  });

  it("checks a tag code is 2 to 6 letters before adding a category", async () => {
    const user = userEvent.setup();
    api.createCategory.mockResolvedValue({ id: "c-hs", code: "HS", name: "Headsets", kind: "controlled", assetClass: null, active: true });
    render(<CategoriesAndKits />);
    await user.click(await screen.findByRole("button", { name: "Add category" }));
    const dialog = screen.getByRole("dialog", { name: "Add a category" });
    await user.type(within(dialog).getByLabelText("Tag code"), "H1");
    await user.type(within(dialog).getByLabelText("Name"), "Headsets");
    await user.click(within(dialog).getByRole("button", { name: "Add category" }));
    expect(within(dialog).getByText("A tag code is 2 to 6 letters, like LAP.")).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("Tag code"));
    await user.type(within(dialog).getByLabelText("Tag code"), "hs");
    await user.click(within(dialog).getByRole("radio", { name: "Controlled item" }));
    await user.click(within(dialog).getByRole("button", { name: "Add category" }));
    expect(api.createCategory).toHaveBeenCalledWith({ code: "HS", name: "Headsets", kind: "controlled", assetClass: null, active: true });
    expect(await screen.findAllByText("Headsets")).not.toHaveLength(0);
  });
});
