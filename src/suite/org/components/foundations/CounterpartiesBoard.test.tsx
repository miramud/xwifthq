import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CounterpartiesBoard from "./CounterpartiesBoard";
import type { CounterpartySummary } from "@/lib/api/org-foundations-client";

/** Clients and vendors: role tabs, status filter, the pending-bank badge, and roles required on create. */

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn() }));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/org-foundations-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/org-foundations-client")>();
  return { ...actual, orgFoundations: { ...actual.orgFoundations, counterparties: { ...actual.orgFoundations.counterparties, ...api } } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org/counterparties",
  useSearchParams: () => new URLSearchParams(),
}));

const cp = (over: Partial<CounterpartySummary>): CounterpartySummary => ({
  id: "x",
  code: null,
  slug: "x",
  name: "X",
  legalName: null,
  kind: "organisation",
  roles: ["client"],
  status: "active",
  kycStatus: "verified",
  sector: null,
  defaultCurrency: null,
  activeAccounts: 1,
  pendingAccounts: 0,
  ...over,
});

const ROWS = [
  cp({ id: "c-1", name: "Lagos State Ministry", roles: ["client", "regulator"], kind: "government", shortCode: "LSM" }),
  cp({ id: "c-2", name: "Acme Supplies", roles: ["vendor"], pendingAccounts: 2, kycStatus: "pending" }),
  cp({ id: "c-3", name: "Old Builders", roles: ["subcontractor", "vendor"], status: "former" }),
];

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach((f) => f.mockReset());
  push.mockReset();
  api.list.mockResolvedValue(ROWS);
});

describe("CounterpartiesBoard", () => {
  it("filters by role tab and status, and flags bank details awaiting approval", async () => {
    const user = userEvent.setup();
    render(<CounterpartiesBoard />);

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Lagos State Ministry")).toBeInTheDocument();
    expect(within(table).queryByText("Old Builders")).not.toBeInTheDocument();
    expect(within(table).getByText("2 awaiting approval")).toBeInTheDocument();
    expect(within(table).getByText("KYC pending")).toBeInTheDocument();
    expect(within(table).getByText("LSM")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Vendors/ }));
    expect(within(screen.getByRole("table")).queryByText("Lagos State Ministry")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "All" }));
    expect(within(screen.getByRole("table")).getByText("Old Builders")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Acme Supplies")).toBeInTheDocument();
  });

  it("needs at least one role to add a client or vendor, then opens it", async () => {
    const user = userEvent.setup();
    api.create.mockResolvedValue({ id: "new-1" });
    render(<CounterpartiesBoard />);

    await user.click(await screen.findByRole("button", { name: "New client or vendor" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Brightway Ltd");
    await user.click(within(dialog).getByRole("button", { name: "Add and open" }));
    expect(await within(dialog).findByText("Pick at least one role.")).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Vendor" }));
    await user.click(within(dialog).getByRole("button", { name: "Partner" }));
    await user.click(within(dialog).getByRole("button", { name: "Add and open" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Brightway Ltd", roles: ["vendor", "partner"] })));
    expect(push).toHaveBeenCalledWith("/suite/org/counterparties/new-1");
  });

  it("takes an optional short code in capitals and shows who already holds it", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("@/lib/api/org-foundations-client");
    const taken = "Eastgate State Scholarship Board already uses the short code ESSB.";
    api.create.mockRejectedValueOnce(new ApiError(taken, 422, { shortCode: [taken] })).mockResolvedValueOnce({ id: "new-2" });
    render(<CounterpartiesBoard />);

    await user.click(await screen.findByRole("button", { name: "New client or vendor" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Client" }));
    await user.type(within(dialog).getByLabelText("Name"), "Eastgate Schools");
    const code = within(dialog).getByLabelText(/Short code/);
    expect(code).toHaveAccessibleDescription(/Printed in reference numbers as \{CLIENT\}/);
    await user.type(code, "essb");
    expect(code).toHaveValue("ESSB");
    await user.click(within(dialog).getByRole("button", { name: "Add and open" }));
    expect(await within(dialog).findAllByText(taken)).not.toHaveLength(0);
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ shortCode: "ESSB" }));

    await user.clear(code);
    await user.type(code, "egs");
    await user.click(within(dialog).getByRole("button", { name: "Add and open" }));
    await waitFor(() => expect(api.create).toHaveBeenLastCalledWith(expect.objectContaining({ shortCode: "EGS" })));
    expect(push).toHaveBeenCalledWith("/suite/org/counterparties/new-2");
  });
});
