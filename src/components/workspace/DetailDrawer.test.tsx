import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetailDrawer, DetailList } from "./DetailDrawer";
import { DataView } from "./DataView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

describe("DetailDrawer", () => {
  it("lists every fact, marks the missing ones, and hands over to the edit dialog", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onEdit = vi.fn();
    render(
      <DetailDrawer
        title="Lease LS-001"
        facts={[
          { label: "Landlord", value: "Adeola Estates" },
          { label: "Notice", value: null },
        ]}
        sections={[
          { title: "Payments", children: <DetailList rows={[{ key: "p1", main: "1 Oct 2026", aside: "₦1,000.00" }]} /> },
          { title: "History", empty: "No changes yet." },
        ]}
        onClose={onClose}
        onEdit={onEdit}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Lease LS-001" })).toBeInTheDocument();
    expect(screen.getByText("Adeola Estates")).toBeInTheDocument();
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Payments" })).toHaveTextContent("₦1,000.00");
    expect(screen.getByText("No changes yet.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(onClose).toHaveBeenCalled();
    expect(onEdit).toHaveBeenCalled();
  });

  it("offers no edit when the person may not edit", () => {
    render(<DetailDrawer title="Visitor" facts={[]} onClose={() => undefined} />);
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});

describe("DataView download", () => {
  it("hands over the rows left by the search", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    render(
      <DataView
        rows={[{ id: "1", name: "Apples" }, { id: "2", name: "Pears" }]}
        columns={[{ key: "name", header: "Name", primary: true, value: (r) => r.name }]}
        rowKey={(r) => r.id}
        caption="Fruit"
        onDownload={onDownload}
      />,
    );
    await user.type(screen.getByRole("searchbox"), "pea");
    await user.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(onDownload).toHaveBeenCalledWith([{ id: "2", name: "Pears" }]);
  });
});
