import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/operations-procurement-client";
import PurchaseRequestEditor from "./PurchaseRequestEditor";
import { estimate, fromRequest, toInput, BLANK, newLine } from "./form";
import { ME_OPTIONS, prFull } from "@/suite/operations/components/procurement/fixtures";

/** Raising a purchase request: the live estimate, what the API is sent, and a project that can't fund it. */

const api = vi.hoisted(() => ({
  options: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  submit: vi.fn(),
  attach: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  catalogue: vi.fn(),
  assetCategories: vi.fn(),
  search: { value: "" },
  permissions: [] as string[],
}));

vi.mock("@/lib/api/operations-procurement-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-procurement-client")>();
  return {
    ...actual,
    procurement: { ...actual.procurement, me: { ...actual.procurement.me, options: api.options, get: api.get, create: api.create, update: api.update, submit: api.submit, attach: api.attach } },
  };
});
vi.mock("@/lib/api/operations-stores-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-stores-client")>();
  return { ...actual, stores: { ...actual.stores, me: { ...actual.stores.me, catalogue: api.catalogue, assetCategories: api.assetCategories } } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-1", role: "user", name: "Chinonso Okeke", organisationId: "o", permissions: api.permissions }, loading: false }) }));
const router = vi.hoisted(() => ({ push: (...a: unknown[]) => api.push(...a), replace: (...a: unknown[]) => api.replace(...a), refresh: () => undefined, back: () => undefined, prefetch: () => undefined }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/suite/operations/my/requests/new",
  useSearchParams: () => new URLSearchParams(api.search.value),
}));

beforeEach(() => {
  for (const f of [api.options, api.get, api.create, api.update, api.submit, api.attach, api.push, api.replace]) f.mockReset();
  api.search.value = "";
  api.permissions = [];
  api.options.mockResolvedValue(ME_OPTIONS);
  // Nothing to put away into by default: the choice stays hidden, as before.
  api.catalogue.mockResolvedValue({ stores: [], items: [], categories: {} });
  api.assetCategories.mockResolvedValue([]);
});

describe("the request form's arithmetic", () => {
  it("adds goods and services separately, from what is typed", () => {
    const lines = [
      { ...newLine("goods"), quantity: "4", price: "950,000.00" },
      { ...newLine("service"), quantity: "1", price: "185,000" },
      { ...newLine("goods"), quantity: "x", price: "10" },
    ];
    expect(estimate(lines)).toEqual({ total: 3_985_000_00, goods: 3_800_000_00, services: 185_000_00 });
  });

  it("says what is missing before anything is sent", () => {
    const { input, errors } = toInput({ ...BLANK, lines: [{ ...newLine(), description: "" }] });
    expect(input).toBeNull();
    expect(errors.title).toBe("Give the request a short title.");
    expect(errors.category).toBe("Choose what kind of purchase it is.");
    expect(errors.funding).toBe("Choose the project that pays for it.");
    expect(Object.values(errors)).toContain("Describe the item.");
  });
});

describe("PurchaseRequestEditor", () => {
  it("totals the lines as they are typed, and sends the request as the API takes it", async () => {
    const user = userEvent.setup();
    api.create.mockResolvedValue(prFull({ id: "pr-9", status: "draft", number: null }));
    api.submit.mockResolvedValue(prFull({ id: "pr-9", status: "in_approval" }));
    render(<PurchaseRequestEditor />);

    await user.type(await screen.findByLabelText("Title"), "Laptops for the portal developers");
    await user.click(screen.getByLabelText("Category"));
    await user.click(await screen.findByRole("option", { name: "Goods: assets" }));
    await user.click(screen.getByLabelText("Project"));
    await user.click(await screen.findByRole("option", { name: /Student Portal Rebuild/ }));

    await user.type(screen.getByLabelText("The item, line 1"), "Laptop, 14-inch");
    const q1 = screen.getByLabelText("Quantity, line 1");
    await user.clear(q1);
    await user.type(q1, "4");
    await user.type(screen.getByLabelText("Estimated unit price (₦), line 1"), "950000");

    await user.click(screen.getByRole("button", { name: "Add a service" }));
    await user.type(screen.getByLabelText("The service, line 2"), "Imaging and set-up");
    await user.type(screen.getByLabelText("Estimated unit price (₦), line 2"), "25,000.50");

    const summary = screen.getByRole("complementary", { name: "Estimate" });
    expect(within(summary).getByText("₦3,825,000.50")).toBeInTheDocument();
    expect(within(summary).getByText("₦3,800,000.00")).toBeInTheDocument();
    expect(within(summary).getByText("₦25,000.50")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send for approval" }));
    expect(api.create).toHaveBeenCalledWith({
      title: "Laptops for the portal developers",
      category: "goods_assets",
      justification: null,
      neededBy: null,
      location: null,
      projectId: "p-spr",
      costCentreId: null,
      singleSourceReason: null,
      lines: [
        { kind: "goods", description: "Laptop, 14-inch", quantity: 4, unit: "each", estUnitPrice: 950_000_00 },
        { kind: "service", description: "Imaging and set-up", quantity: 1, unit: "job", estUnitPrice: 25_000_50 },
      ],
    });
    expect(api.submit).toHaveBeenCalledWith("pr-9", null);
    expect(api.push).toHaveBeenCalledWith("/suite/operations/my/requests/pr-9?sent=1");
  }, 30_000);

  it("says when the project can't fund it, and lets the MD send it beyond the funds with a reason", async () => {
    const user = userEvent.setup();
    api.permissions = ["finance.memos.override"];
    api.search.value = "id=pr-1";
    api.get.mockResolvedValue(prFull({ status: "draft", number: null }));
    api.update.mockResolvedValue(prFull({ status: "draft", number: null }));
    api.submit
      .mockRejectedValueOnce(new ApiError("Invalid.", 422, { funds: ["INSUFFICIENT_PROJECT_FUNDS: the project has 1,000,000.00 available and this asks for 3,860,000.00."] }))
      .mockResolvedValueOnce(prFull({ status: "in_approval" }));
    render(<PurchaseRequestEditor />);

    await user.click(await screen.findByRole("button", { name: "Send for approval" }));
    expect(await screen.findByText("More than the project has available")).toBeInTheDocument();
    expect(screen.getByText("the project has 1,000,000.00 available and this asks for 3,860,000.00.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send beyond the funds" }));
    expect(screen.getByText("Give the reason; approvers see it beside the funds position.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Your reason for sending it beyond the funds"), "Board approved the top-up on Monday");
    await user.click(screen.getByRole("button", { name: "Send beyond the funds" }));
    expect(api.submit).toHaveBeenLastCalledWith("pr-1", "Board approved the top-up on Monday");
    expect(api.push).toHaveBeenCalledWith("/suite/operations/my/requests/pr-1?sent=1");
  }, 30_000);

  it("tells somebody who can't override who to ask", async () => {
    const user = userEvent.setup();
    api.search.value = "id=pr-1";
    api.get.mockResolvedValue(prFull({ status: "draft", number: null }));
    api.update.mockResolvedValue(prFull({ status: "draft", number: null }));
    api.submit.mockRejectedValue(new ApiError("Invalid.", 422, { funds: ["NO_FUNDS_RELEASED: no funds have been released to this project yet."] }));
    render(<PurchaseRequestEditor />);
    await user.click(await screen.findByRole("button", { name: "Send for approval" }));
    expect(await screen.findByText("No funds released to this project yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send beyond the funds" })).not.toBeInTheDocument();
    expect(screen.getByText(/Ask Finance for a release/)).toBeInTheDocument();
  }, 30_000);

  it("offers files only once the draft is saved, says they are optional, and keeps what is typed when one is added", async () => {
    const user = userEvent.setup();
    api.search.value = "id=pr-1";
    const draft = prFull({ status: "draft", number: null, attachments: [] });
    api.get.mockResolvedValue(draft);
    api.attach.mockResolvedValue({ ...draft, attachments: [{ id: "att-1", kind: "specification", name: "spec.pdf", mime: "application/pdf", size: 2048, uploadedBy: "Chinonso Okeke", uploadedAt: "2026-10-06T09:00:00+00:00" }] });
    render(<PurchaseRequestEditor />);

    const title = await screen.findByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Laptops, revised");
    expect(screen.getByText("Optional. Nothing waits on them.")).toBeInTheDocument();
    api.get.mockResolvedValue({ ...draft, attachments: [{ id: "att-1", kind: "specification", name: "spec.pdf", mime: "application/pdf", size: 2048, uploadedBy: "Chinonso Okeke", uploadedAt: "2026-10-06T09:00:00+00:00" }] });
    const file = new File(["%PDF"], "spec.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("Add a specification, a sample design or an agenda (optional)"), file);

    expect(api.attach).toHaveBeenCalledWith("pr-1", file, "specification");
    expect(await screen.findByRole("link", { name: "Open spec.pdf" })).toHaveAttribute("href", "/api/operations/me/attachments/att-1");
    expect(screen.getByLabelText("Title")).toHaveValue("Laptops, revised");
  }, 30_000);

  it("asks for a draft to be saved before a file can go on a new request", async () => {
    render(<PurchaseRequestEditor />);
    expect(await screen.findByText(/Save the draft first to add a specification/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Add a specification, a sample design or an agenda (optional)")).not.toBeInTheDocument();
  }, 30_000);
});

describe("putting goods away on arrival", () => {
  it("sends the stock item or asset category chosen for a goods line, and nothing for a line not tracked", async () => {
    const user = userEvent.setup();
    api.catalogue.mockResolvedValue({ stores: [], items: [{ id: "i-toner", code: "TON-002", name: "HP 410A toner, black", category: "toner", unit: "cartridge" }], categories: {} });
    api.assetCategories.mockResolvedValue([{ id: "ac-lap", code: "LAP", name: "Laptops", kind: "it", assetClass: "ict", active: true }]);
    api.create.mockResolvedValue(prFull({ id: "pr-9", status: "draft", number: null }));
    api.submit.mockResolvedValue(prFull({ id: "pr-9", status: "in_approval" }));
    render(<PurchaseRequestEditor />);

    await user.type(await screen.findByLabelText("Title"), "Toner and laptops");
    await user.click(screen.getByLabelText("Category"));
    await user.click(await screen.findByRole("option", { name: "Goods: assets" }));
    await user.click(screen.getByLabelText("Project"));
    await user.click(await screen.findByRole("option", { name: /Student Portal Rebuild/ }));

    // Line 1: stock. Choosing the item fills an empty description and the unit.
    const arrival1 = await screen.findByRole("radiogroup", { name: "On arrival, line 1 is" });
    await user.click(within(arrival1).getByRole("radio", { name: "Stock" }));
    await user.type(screen.getByLabelText("Estimated unit price (₦), line 1"), "95000");
    await user.type(screen.getByLabelText("The item, line 1"), "Toner");
    await user.click(screen.getByRole("button", { name: "Send for approval" }));
    expect(screen.getByText("Choose the stock item, or say it isn't tracked.")).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("The item, line 1"));
    await user.click(screen.getByLabelText("Stock item, line 1"));
    await user.click(await screen.findByRole("option", { name: /HP 410A toner/ }));
    expect(screen.getByLabelText("The item, line 1")).toHaveValue("HP 410A toner, black");
    expect(screen.getByLabelText("Unit, line 1")).toHaveValue("cartridge");

    // Line 2: an asset.
    await user.click(screen.getByRole("button", { name: "Add goods" }));
    await user.type(screen.getByLabelText("The item, line 2"), "Laptop, 14-inch");
    await user.type(screen.getByLabelText("Estimated unit price (₦), line 2"), "950000");
    await user.click(within(screen.getByRole("radiogroup", { name: "On arrival, line 2 is" })).getByRole("radio", { name: "An asset" }));
    await user.click(screen.getByLabelText("Asset category, line 2"));
    await user.click(await screen.findByRole("option", { name: /Laptops/ }));

    // Line 3: a service, never put away.
    await user.click(screen.getByRole("button", { name: "Add a service" }));
    await user.type(screen.getByLabelText("The service, line 3"), "Imaging");
    await user.type(screen.getByLabelText("Estimated unit price (₦), line 3"), "25000");
    expect(screen.queryByRole("radiogroup", { name: "On arrival, line 3 is" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send for approval" }));
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          { kind: "goods", description: "HP 410A toner, black", quantity: 1, unit: "cartridge", estUnitPrice: 95_000_00, itemId: "i-toner" },
          { kind: "goods", description: "Laptop, 14-inch", quantity: 1, unit: "each", estUnitPrice: 950_000_00, assetCategoryId: "ac-lap" },
          { kind: "service", description: "Imaging", quantity: 1, unit: "job", estUnitPrice: 25_000_00 },
        ],
      }),
    );
  }, 40_000);

  it("reads a saved line's choice back from the request", () => {
    const line = { id: "l", lineNo: 1, kind: "goods" as const, description: "Toner", specification: null, quantity: 2, unit: "cartridge", estUnitPrice: 95_000_00, estimate: 190_000_00, suggestedVendorId: null, itemId: "i-toner", assetCategoryId: null };
    const { input } = toInput({ ...BLANK, title: "T", category: "goods_consumables", projectId: "p", lines: fromRequestLines([line]) });
    expect(input?.lines[0]).toEqual({ kind: "goods", description: "Toner", quantity: 2, unit: "cartridge", estUnitPrice: 95_000_00, itemId: "i-toner" });
  });
});

function fromRequestLines(lines: Parameters<typeof fromRequest>[0]["lines"]) {
  return fromRequest(prFull({ lines })).lines;
}
