import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StructureBoard from "./StructureBoard";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import { ApiError, type CostCentre, type OrgUnit } from "@/lib/api/org-foundations-client";

/** Structure: the unit tree from the flat list, a unit's panel, and the cost centres tab. */

const units = vi.hoisted(() => ({ tree: vi.fn(), create: vi.fn(), update: vi.fn(), move: vi.fn(), remove: vi.fn(), assignHead: vi.fn(), endHead: vi.fn(), addMembers: vi.fn() }));
const centres = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }));

vi.mock("@/lib/api/org-foundations-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/org-foundations-client")>();
  return {
    ...actual,
    orgFoundations: { ...actual.orgFoundations, units, costCentres: centres, lookups: { people: vi.fn().mockResolvedValue([]) } },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org/structure",
  useSearchParams: () => new URLSearchParams(),
}));

const unit = (id: string, name: string, parentId: string | null, over: Partial<OrgUnit> = {}): OrgUnit => ({
  id,
  parentId,
  code: id.toUpperCase(),
  name,
  kind: "department",
  description: null,
  status: "active",
  depth: 0,
  sortOrder: 0,
  memberCount: 3,
  defaultCostCentre: null,
  head: null,
  heads: [],
  ...over,
});

const acting = { id: "h-1", userId: "u-1", name: "Bola Ade", role: "acting" as const, startsOn: "2026-10-01", endsOn: "2026-10-31", isCurrent: true };

const UNITS = [
  unit("ops", "Operations", null, { kind: "division" }),
  unit("fin", "Finance", "ops", { head: acting, heads: [acting] }),
  unit("acc", "Accounts", "fin", { kind: "team" }),
];

const CC: CostCentre[] = [
  { id: "cc-1", code: "CC-FIN", name: "Finance running costs", description: null, status: "active", isOpen: true, orgUnit: { id: "fin", code: "FIN", name: "Finance" }, budgetHolder: { id: "u-1", name: "Bola Ade" }, validFrom: null, validTo: null },
  { id: "cc-2", code: "CC-OLD", name: "Old project", description: null, status: "closed", isOpen: false, orgUnit: null, budgetHolder: null, validFrom: "2025-01-01", validTo: "2025-12-31" },
];

function renderBoard() {
  return render(
    <ConfirmProvider>
      <StructureBoard />
    </ConfirmProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  Object.values(units).forEach((f) => f.mockReset());
  Object.values(centres).forEach((f) => f.mockReset());
  units.tree.mockResolvedValue(UNITS);
  centres.list.mockResolvedValue(CC);
});

describe("StructureBoard", () => {
  it("draws the tree from the flat list and collapses a branch", async () => {
    const user = userEvent.setup();
    renderBoard();

    const list = await screen.findByRole("list", { name: "Units" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Operations"),
      expect.stringContaining("Finance"),
      expect.stringContaining("Accounts"),
    ]);
    // The acting head is named and marked as acting, not by colour alone.
    expect(within(list).getByText("Bola Ade")).toBeInTheDocument();
    expect(within(list).getByText("Acting")).toBeInTheDocument();

    await user.click(within(list).getByRole("button", { name: "Collapse Finance" }));
    expect(within(list).queryByText("Accounts")).not.toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: "Expand Finance" }));
    expect(within(list).getByText("Accounts")).toBeInTheDocument();
  });

  it("opens a unit's panel and shows the API's refusal to delete one with people in it", async () => {
    const user = userEvent.setup();
    units.remove.mockRejectedValue(new ApiError("Finance still has 3 members. Move them first.", 422));
    renderBoard();

    await user.click(await screen.findByRole("button", { name: /FIN\s*Finance/ }));
    const panel = screen.getByRole("heading", { name: "Finance" }).closest("section")!;
    expect(within(panel).getByText("Operations")).toBeInTheDocument();
    expect(within(panel).getByText("Acting head")).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Delete unit" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete unit" }));
    await waitFor(() => expect(units.remove).toHaveBeenCalledWith("fin"));
    expect(await screen.findByText("Finance still has 3 members. Move them first.")).toBeInTheDocument();
  });

  it("ends a head's term from the panel", async () => {
    const user = userEvent.setup();
    units.endHead.mockResolvedValue({ ...UNITS[1], head: null, heads: [{ ...acting, isCurrent: false }] });
    renderBoard();

    await user.click(await screen.findByRole("button", { name: /FIN\s*Finance/ }));
    await user.click(screen.getByRole("button", { name: "End Bola Ade's term" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "End term" }));
    await waitFor(() => expect(units.endHead).toHaveBeenCalledWith("fin", "h-1", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)));
    expect(await screen.findByText("Bola Ade's term ended.", { selector: "p:not(.sr-only)" })).toBeInTheDocument();
  });

  it("lists cost centres with their state in words", async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.click(await screen.findByRole("tab", { name: /Cost centres/ }));
    const table = await screen.findByRole("table");
    expect(within(table).getByText("CC-FIN")).toBeInTheDocument();
    expect(within(table).getByText("Open")).toBeInTheDocument();
    expect(within(table).getByText("Closed")).toBeInTheDocument();
    expect(within(table).getByText("1 Jan 2025 – 31 Dec 2025")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New cost centre" })).toBeInTheDocument();
  });
});
