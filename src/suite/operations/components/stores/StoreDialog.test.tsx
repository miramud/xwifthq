import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoreDialog } from "./StockDialogs";

/** A store's count-variance threshold: empty keeps the default, an amount is sent in kobo. */

const api = vi.hoisted(() => ({ updateStore: vi.fn(), createStore: vi.fn() }));

vi.mock("@/lib/api/operations-stores-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-stores-client")>();
  return { ...actual, stores: { ...actual.stores, updateStore: api.updateStore, createStore: api.createStore } };
});
vi.mock("@/suite/org/components/foundations/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/suite/org/components/foundations/shared")>()),
  PersonSelect: () => <div />,
}));

const store = { id: "st-1", name: "Main store", location: null, officerId: null, officer: null, active: true, varianceAlertValue: null, varianceAlertDefault: 5_000_000 };

beforeEach(() => {
  api.updateStore.mockReset().mockResolvedValue({ id: "st-1" });
  api.createStore.mockReset().mockResolvedValue({ id: "st-2" });
});

describe("StoreDialog", () => {
  it("shows the default threshold and sends a typed one in kobo", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<StoreDialog store={store} onDone={onDone} onClose={vi.fn()} />);

    const field = screen.getByLabelText(/Count variance to report to Finance/);
    expect(field).toHaveValue("");
    expect(field).toHaveAttribute("placeholder", "50000.00");
    expect(screen.getByText(/default ₦50,000/)).toBeInTheDocument();

    await user.type(field, "20,000");
    await user.click(screen.getByRole("button", { name: "Save store" }));

    expect(api.updateStore).toHaveBeenCalledWith("st-1", expect.objectContaining({ varianceAlertValue: 2_000_000 }));
    expect(onDone).toHaveBeenCalledWith("Main store saved.");
  });

  it("keeps the default when left empty and refuses what is not an amount", async () => {
    const user = userEvent.setup();
    render(<StoreDialog store={null} onDone={vi.fn()} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("Name"), "Annex store");
    await user.type(screen.getByLabelText(/Count variance to report to Finance/), "lots");
    await user.click(screen.getByRole("button", { name: "Add store" }));
    expect(api.createStore).not.toHaveBeenCalled();
    expect(screen.getByText(/Type an amount/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Count variance to report to Finance/));
    await user.click(screen.getByRole("button", { name: "Add store" }));
    expect(api.createStore).toHaveBeenCalledWith(expect.objectContaining({ name: "Annex store", varianceAlertValue: null }));
  });
});
