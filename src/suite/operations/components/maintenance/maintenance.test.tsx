import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption } from "@/test/selectOption";
import WorkOrderBoard from "./WorkOrderBoard";
import WorkOrderDetail from "./WorkOrderDetail";
import PlansDesk from "./PlansDesk";
import MaintenanceReports from "./MaintenanceReports";
import ClaimsDesk from "./ClaimsDesk";
import { resetMaintenancePickers } from "./parts";
import { OPTIONS, meta, plan, report, workOrder, workOrderFull } from "./fixtures";

/** The maintenance desk: the board, a work order and its warranty gate, plans, claims and the cost report. */

const api = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  start: vi.fn(),
  warranty: vi.fn(),
  cancel: vi.fn(),
  plans: vi.fn(),
  readings: vi.fn(),
  addReading: vi.fn(),
  reports: vi.fn(),
  claims: vi.fn(),
  createClaim: vi.fn(),
  options: vi.fn(),
  facilities: vi.fn(),
  pickers: vi.fn(),
  assetList: vi.fn(),
  push: vi.fn(),
  csv: vi.fn(),
  permissions: [] as string[],
}));
vi.mock("@/components/workspace/csv", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/components/workspace/csv")>()), downloadCsv: api.csv }));

vi.mock("@/lib/api/operations-maintenance-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-maintenance-client")>();
  return {
    ...actual,
    maintenance: {
      ...actual.maintenance,
      list: api.list,
      get: api.get,
      create: api.create,
      update: api.update,
      start: api.start,
      warranty: api.warranty,
      cancel: api.cancel,
      plans: api.plans,
      readings: api.readings,
      addReading: api.addReading,
      reports: api.reports,
      claims: api.claims,
      createClaim: api.createClaim,
      options: api.options,
      facilities: api.facilities,
      pickers: api.pickers,
    },
  };
});
vi.mock("@/lib/api/operations-assets-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-assets-client")>();
  return { ...actual, assets: { ...actual.assets, list: api.assetList } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-desk", role: "user", name: "Kemi Desk", organisationId: "o", permissions: api.permissions }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push, replace: vi.fn() }), usePathname: () => "/suite/operations/maintenance", useSearchParams: () => new URLSearchParams() }));

const ALL = ["view", "create", "update", "assign", "start", "warranty", "part", "purchase", "complete", "confirm", "cancel", "create_plan", "update_plan", "create_claim", "update_claim", "reading"].map((a) => `admin.maintenance.${a}`);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-06T10:00:00+01:00"));
  for (const f of Object.values(api)) if (typeof f === "function" && "mockReset" in f) f.mockReset();
  resetMaintenancePickers();
  api.options.mockResolvedValue(OPTIONS);
  api.facilities.mockResolvedValue([{ id: "f1", name: "Head office" }]);
  api.assetList.mockResolvedValue({ assets: [{ id: "a-gen", tagNo: "MPT/GEN/0002", name: "Perkins 60kVA generator", category: "Generators", status: "in_store" }], meta: {} });
  api.pickers.mockResolvedValue({ assets: [{ id: "a-gen", tagNo: "MPT/GEN/0002", name: "Perkins 60kVA generator", category: "Generators", status: "in_store" }], facilities: [{ id: "f1", name: "Head office" }] });
  api.permissions = ALL;
});
afterEach(() => vi.useRealTimers());

describe("WorkOrderBoard", () => {
  it("shows the figures, the cost by month and every work order in its lane with its SLA", async () => {
    api.list.mockResolvedValue({
      workOrders: [
        workOrder(),
        workOrder({ id: "w2", number: "WO-2026-0039", title: "Aircon leaking", priority: "critical", status: "in_progress", dueAt: "2026-10-06T08:00:00+01:00", overdue: true, assignee: "Tunde Bello" }),
        workOrder({ id: "w3", number: "WO-2026-0030", title: "Old job", status: "cancelled" }),
      ],
      meta: meta(),
    });
    render(<WorkOrderBoard />);
    expect(await screen.findByRole("table", { name: "Maintenance cost by month, preventive and corrective" })).toBeInTheDocument();
    expect(screen.getByText("87.5%")).toBeInTheDocument();
    const open = screen.getByRole("region", { name: "Open: 1" });
    expect(within(open).getByText("Generator won't start")).toBeInTheDocument();
    expect(within(open).getByText("23h left")).toBeInTheDocument();
    const working = screen.getByRole("region", { name: "In progress: 1" });
    expect(within(working).getByText("Overdue by 2h")).toBeInTheDocument();
    expect(within(working).getByRole("link", { name: /Aircon leaking/ })).toHaveAttribute("href", "/suite/operations/maintenance/w2");
    expect(screen.queryByText("Old job")).not.toBeInTheDocument();
  });

  it("filters to the breached ones", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue({ workOrders: [workOrder(), workOrder({ id: "w2", title: "Aircon leaking", overdue: true })], meta: meta() });
    render(<WorkOrderBoard />);
    await screen.findByText("Generator won't start");
    await user.click(screen.getByLabelText("SLA breached only"));
    expect(screen.queryByText("Generator won't start")).not.toBeInTheDocument();
    expect(screen.getByText("Aircon leaking")).toBeInTheDocument();
  });

  it("raises a work order on an asset and opens it", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue({ workOrders: [], meta: meta() });
    api.create.mockResolvedValue(workOrderFull({ id: "w9" }));
    render(<WorkOrderBoard />);
    await user.click(await screen.findByRole("button", { name: "Raise a work order" }));
    const dialog = screen.getByRole("dialog", { name: "Raise a work order" });
    await user.click(within(dialog).getByRole("button", { name: "Raise work order" }));
    expect(within(dialog).getByText("Choose the asset that needs the work.")).toBeInTheDocument();
    expect(within(dialog).getByText("Say what is wrong in a few words.")).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();

    await chooseOption(user, within(dialog).getByRole("combobox", { name: "Asset" }), "Perkins 60kVA generator");
    await user.type(within(dialog).getByLabelText("What is wrong"), "Generator won't start");
    await user.click(within(dialog).getByRole("radio", { name: /Critical/ }));
    await chooseOption(user, within(dialog).getByRole("combobox", { name: /Assign to/ }), "Tunde Bello");
    await user.click(within(dialog).getByRole("button", { name: "Raise work order" }));
    expect(api.create).toHaveBeenCalledWith({ assetId: "a-gen", facilityId: null, title: "Generator won't start", fault: null, priority: "critical", assigneeId: "u-tunde", vendorId: null });
    expect(api.push).toHaveBeenCalledWith("/suite/operations/maintenance/w9");
  }, 20_000);

  it("offers no raise button without the key", async () => {
    api.permissions = ["admin.maintenance.view"];
    api.list.mockResolvedValue({ workOrders: [], meta: meta() });
    render(<WorkOrderBoard />);
    await screen.findByText("Work orders", { selector: "h2" });
    expect(screen.queryByRole("button", { name: "Raise a work order" })).not.toBeInTheDocument();
  });
});

describe("WorkOrderDetail", () => {
  it("locks a paid repair behind the warranty, and records the claim's outcome", async () => {
    const user = userEvent.setup();
    const block = "MPT/GEN/0002 is under warranty until 1 Jan 2027 (Perkins West Africa). Raise a warranty claim first; a paid repair needs it rejected, or marked not applicable.";
    api.get.mockResolvedValue(workOrderFull({ status: "in_progress", warrantyUntil: "2027-01-01", warrantyBlock: block }));
    api.warranty.mockResolvedValue(workOrderFull({ status: "in_progress", warrantyUntil: "2027-01-01", warrantyClaim: "rejected", warrantyNote: "Case 4411" }));
    render(<WorkOrderDetail id="w1" />);
    expect(await screen.findByText("Paid repair locked")).toBeInTheDocument();
    expect(screen.getByText(block)).toBeInTheDocument();
    expect(screen.getByText("Locked until the warranty claim is settled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Raise purchase request" })).not.toBeInTheDocument();
    expect(screen.getByText("87 days left")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Record outcome" }));
    expect(screen.getByText("Choose where the claim stands.")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Claim rejected/ }));
    await user.type(screen.getByLabelText("Claim reference or note"), "Case 4411");
    await user.click(screen.getByRole("button", { name: "Record outcome" }));
    expect(api.warranty).toHaveBeenCalledWith("w1", "rejected", "Case 4411");
    expect(await screen.findByText("Warranty outcome recorded.")).toBeInTheDocument();
    expect(screen.queryByText("Paid repair locked")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Raise purchase request" })).toBeInTheDocument();
  }, 20_000);

  it("starts the work once confirmed, and shows its SLA clock", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(workOrderFull({ status: "assigned", assignee: "Tunde Bello", assigneeId: "u-tunde" }));
    api.start.mockResolvedValue(workOrderFull({ status: "in_progress", startedAt: "2026-10-06T10:00:00+01:00", downtimeFrom: "2026-10-06T10:00:00+01:00" }));
    render(<WorkOrderDetail id="w1" />);
    expect(await screen.findByRole("img", { name: "SLA: 23h left" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start work" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Start work" }));
    expect(api.start).toHaveBeenCalledWith("w1");
    expect(await screen.findByText("Work started. Downtime is running.")).toBeInTheDocument();
    expect(screen.getByText("hours and counting")).toBeInTheDocument();
  });

  it("will not cancel without a reason", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(workOrderFull());
    api.cancel.mockResolvedValue(workOrderFull({ status: "cancelled", resolution: "Cancelled: Raised twice" }));
    render(<WorkOrderDetail id="w1" />);
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    const dialog = screen.getByRole("dialog", { name: /Cancel WO-2026-0041/ });
    await user.click(within(dialog).getByRole("button", { name: "Cancel work order" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Say why it is cancelled.");
    expect(api.cancel).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText("Why"), "Raised twice");
    await user.click(within(dialog).getByRole("button", { name: "Cancel work order" }));
    expect(api.cancel).toHaveBeenCalledWith("w1", "Raised twice");
    expect(await screen.findByText("Work order cancelled.")).toBeInTheDocument();
  });

  it("offers nothing but the view to somebody with only the view key", async () => {
    api.permissions = ["admin.maintenance.view"];
    api.get.mockResolvedValue(workOrderFull({ status: "assigned" }));
    render(<WorkOrderDetail id="w1" />);
    expect(await screen.findByText("Generator won't start", { selector: "h1" })).toBeInTheDocument();
    for (const name of ["Start work", "Assign", "Cancel", "Add a part", "Save diagnosis", "Save costs"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });
});

describe("PlansDesk", () => {
  it("lays the next due date on the 12-week timeline and the meter against its limit", async () => {
    const user = userEvent.setup();
    api.plans.mockResolvedValue([plan()]);
    api.readings.mockResolvedValue([{ reading: 1200, unit: "hours", readOn: "2026-10-01", by: "Tunde Bello" }]);
    api.addReading.mockResolvedValue({ id: "r1", reading: 1300 });
    render(<PlansDesk />);
    expect(await screen.findByRole("img", { name: "Generator 250-hour service, MPT/GEN/0002: due 1 Nov 2026, in 26 days" })).toBeInTheDocument();
    expect(await screen.findByText("200 of 250 hours since the last service")).toBeInTheDocument();
    expect(screen.getByText("50 hours to go")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Record reading" }));
    const dialog = screen.getByRole("dialog", { name: "Record a reading" });
    await user.type(within(dialog).getByLabelText("Hour meter (hours)"), "1100");
    await user.click(within(dialog).getByRole("button", { name: "Record reading" }));
    expect(within(dialog).getByText("The last reading was 1200 hours; a reading can't go backwards.")).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText("Hour meter (hours)"));
    await user.type(within(dialog).getByLabelText("Hour meter (hours)"), "1300");
    await user.click(within(dialog).getByRole("button", { name: "Record reading" }));
    expect(api.addReading).toHaveBeenCalledWith("a-gen", { reading: 1300, unit: "hours", readOn: "2026-10-06" });
  }, 20_000);

  it("will not save a plan that says neither how often nor on what", async () => {
    const user = userEvent.setup();
    api.plans.mockResolvedValue([]);
    render(<PlansDesk />);
    await user.click(await screen.findByRole("button", { name: "Add a plan" }));
    const dialog = screen.getByRole("dialog", { name: "Add a maintenance plan" });
    await user.type(within(dialog).getByLabelText("Name"), "Aircon quarterly clean");
    await user.click(within(dialog).getByRole("button", { name: "Add plan" }));
    expect(within(dialog).getByText("Choose the asset.")).toBeInTheDocument();
    expect(within(dialog).getByText("Say how often: every so many months, hours or km, or both.")).toBeInTheDocument();
  });
});

describe("MaintenanceReports", () => {
  it("flags assets past the replacement threshold, and moves the flag with the slider", async () => {
    api.reports.mockResolvedValue(report());
    render(<MaintenanceReports />);
    expect(await screen.findByRole("img", { name: /LG split unit: .* 70% of its cost, past the threshold/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Perkins 60kVA generator: .* 30% of its cost$/ })).toBeInTheDocument();
    const slider = screen.getByLabelText("Threshold");
    // Lowering the threshold to 25% flags the generator too.
    fireEvent.change(slider, { target: { value: "25" } });
    expect(screen.getByRole("img", { name: /Perkins 60kVA generator: .* past the threshold/ })).toBeInTheDocument();
  });
});

describe("ClaimsDesk", () => {
  it("records a claim with its incident report", async () => {
    const user = userEvent.setup();
    api.claims.mockResolvedValue([]);
    api.createClaim.mockResolvedValue({});
    render(<ClaimsDesk />);
    await user.click(await screen.findByRole("button", { name: "Record a claim" }));
    const dialog = screen.getByRole("dialog", { name: "Record an insurance claim" });
    await user.click(within(dialog).getByRole("button", { name: "Record claim" }));
    expect(within(dialog).getByText(/Write what happened/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("radio", { name: "Accident" }));
    await user.type(within(dialog).getByLabelText("Incident report"), "Rear-ended at Berger");
    await user.type(within(dialog).getByLabelText("Insurer"), "AXA Mansard");
    await user.click(within(dialog).getByRole("button", { name: "Record claim" }));
    expect(api.createClaim).toHaveBeenCalledWith(expect.objectContaining({ kind: "accident", incidentOn: "2026-10-06", incidentReport: "Rear-ended at Berger", insurer: "AXA Mansard", assetId: null }));
  }, 20_000);
});

describe("CSV and detail drawers", () => {
  it("downloads the work orders listed under the filters", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue({ workOrders: [workOrder(), workOrder({ id: "w2", number: "WO-2026-0039", title: "Aircon leaking", overdue: true, cost: 25_000_00 })], meta: meta() });
    render(<WorkOrderBoard />);
    await screen.findByText("Generator won't start");
    await user.click(screen.getByLabelText("SLA breached only"));
    await user.click(screen.getByRole("button", { name: "Download CSV" }));
    const [name, rows] = api.csv.mock.calls[0];
    expect(name).toBe("work-orders_sla-breached.csv");
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe("WO-2026-0039");
    expect(rows[1][11]).toBe("Yes");
    expect(rows[1].slice(12, 14)).toEqual(["NGN", "25000.00"]);
  });

  it("opens a plan in a drawer, edits it from there, and downloads the plans", async () => {
    const user = userEvent.setup();
    api.plans.mockResolvedValue([plan()]);
    api.readings.mockResolvedValue([]);
    render(<PlansDesk />);
    const table = await screen.findByRole("table", { name: "Maintenance plans" });
    await user.click(within(table).getByText("Generator 250-hour service"));
    const drawer = screen.getByRole("dialog", { name: "Generator 250-hour service" });
    expect(within(drawer).getByText("Change oil and filter")).toBeInTheDocument();
    expect(within(drawer).getByText("Due 1 Nov 2026")).toBeInTheDocument();
    await user.click(within(drawer).getByRole("button", { name: "Edit the plan" }));
    expect(screen.getByRole("dialog", { name: "Edit Generator 250-hour service" })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Download CSV" })[0]);
    const [, rows] = api.csv.mock.calls[0];
    expect(rows[1].slice(0, 3)).toEqual(["Generator 250-hour service", "Asset", "MPT/GEN/0002"]);
    expect(rows[1][11]).toBe("2026-11-01");
  }, 20_000);

  it("opens a claim read-only for somebody without the update key", async () => {
    const user = userEvent.setup();
    api.permissions = ["admin.maintenance.view"];
    api.claims.mockResolvedValue([
      { id: "c1", kind: "accident", incidentOn: "2026-10-01", incidentReport: "Rear-ended at Berger", insurer: "AXA Mansard", policyNo: "P-77", claimNo: "CL-1", amountClaimed: 500_000_00, amountSettled: null, status: "submitted", assetId: "a-car", asset: "MPT/VEH/0001", workOrderId: "w1", reportedBy: "Kemi Desk" },
    ]);
    render(<ClaimsDesk />);
    const table = await screen.findByRole("table", { name: "Insurance claims" });
    await user.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(api.csv.mock.calls[0][1][1]).toEqual(["Accident", "2026-10-01", "Rear-ended at Berger", "MPT/VEH/0001", "AXA Mansard", "P-77", "CL-1", "With the insurer", "NGN", "500000.00", "", "Kemi Desk"]);
    await user.click(within(table).getByText("Rear-ended at Berger"));
    const drawer = screen.getByRole("dialog", { name: "Accident claim" });
    expect(within(drawer).getByText("P-77")).toBeInTheDocument();
    expect(within(drawer).getByRole("link", { name: "Open the work order" })).toHaveAttribute("href", "/suite/operations/maintenance/w1");
    expect(within(drawer).queryByRole("button", { name: "Update the claim" })).not.toBeInTheDocument();
  }, 20_000);
});
