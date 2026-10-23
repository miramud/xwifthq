import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WhtCertificates as Certs, WhtMonthDetail as Detail, WhtYear } from "@/lib/api/finance-wht-client";
import WhtBoard from "./WhtBoard";
import WhtMonthDetail from "./WhtMonthDetail";
import { WhtCertificates } from "./WhtCertificates";
import { owing, scheduleCsv, whtStatus } from "./meta";

/** Finance › WHT: the year strip, raising a month once (with a confirmation), the schedule CSV and certificate links. */

const api = vi.hoisted(() => ({ year: vi.fn(), month: vi.fn(), remit: vi.fn(), certificates: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: "u-1", role: "admin", name: "Adaeze", organisationId: "o", permissions: [] as string[] } }));
const csv = vi.hoisted(() => ({ downloadCsv: vi.fn() }));

vi.mock("@/lib/api/finance-wht-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-wht-client")>();
  return { ...actual, wht: { ...actual.wht, ...api } };
});
vi.mock("@/components/workspace/csv", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/workspace/csv")>();
  return { ...actual, downloadCsv: csv.downloadCsv };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/wht",
  useSearchParams: () => new URLSearchParams(),
}));

const year = new Date().getFullYear();

const yearData = (): WhtYear => ({
  year,
  currency: "NGN",
  months: [
    { period: `${year}-02`, label: `February ${year}`, status: "paid", dueOn: `${year}-03-21`, overdue: false, lineCount: 2, supplierCount: 1, gross: 900_000_00, wht: 45_000_00, remittanceId: "r-2", memoId: "m-2", memoReference: "MEMO/GEN/0002" },
    { period: `${year}-01`, label: `January ${year}`, status: "due", dueOn: `${year}-02-21`, overdue: true, lineCount: 3, supplierCount: 2, gross: 700_000_00, wht: 60_000_00, remittanceId: null, memoId: null, memoReference: null },
  ],
  totals: { gross: 1_600_000_00, wht: 105_000_00, remitted: 45_000_00, outstanding: 60_000_00 },
});

const detail = (over: Partial<Detail> = {}): Detail => ({
  period: "2026-09",
  label: "September 2026",
  currency: "NGN",
  status: "due",
  dueOn: "2099-10-21",
  monthEnded: true,
  totals: { gross: 700_000_00, wht: 60_000_00, lineCount: 2 },
  suppliers: [
    {
      key: "cp-1", counterpartyId: "cp-1", userId: null, name: "ECN Printing Ltd", tin: null, lineCount: 1, gross: 200_000_00, wht: 10_000_00,
      lines: [{ lineId: "l-2", pvId: "pv-2", pvNo: "PV/2026/09/0002", memoReference: "MEMO/GEN/0010", date: "2026-09-10", description: "Prospectus printing", whtCode: "supplies", rateBp: 500, currency: "NGN", gross: 200_000_00, wht: 10_000_00, counterpartyId: "cp-1", userId: null, supplier: "ECN Printing Ltd", tin: null }],
    },
    {
      key: "cp-2", counterpartyId: "cp-2", userId: null, name: "Lagos Advisory Partners Ltd", tin: "20000001-0001", lineCount: 1, gross: 500_000_00, wht: 50_000_00,
      lines: [{ lineId: "l-1", pvId: "pv-1", pvNo: "PV/2026/09/0001", memoReference: null, date: "2026-09-08", description: "Audit, advisory", whtCode: "consultancy", rateBp: 1000, currency: "NGN", gross: 500_000_00, wht: 50_000_00, counterpartyId: "cp-2", userId: null, supplier: "Lagos Advisory Partners Ltd", tin: "20000001-0001" }],
    },
  ],
  missingTin: 1,
  lateLines: [],
  remittance: null,
  authority: { id: "firs", name: "Federal Inland Revenue Service", tin: null, hasBankAccount: false },
  ...over,
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  csv.downloadCsv.mockReset();
  auth.user = { id: "u-1", role: "admin", name: "Adaeze", organisationId: "o", permissions: [] };
});
afterEach(() => {
  document.querySelectorAll("[data-confirm-host]").forEach((n) => n.remove());
});

describe("meta", () => {
  it("names an overdue month as overdue and lists what is owed oldest first", () => {
    expect(whtStatus("due", true).label).toBe("Overdue");
    expect(whtStatus("paid").label).toBe("Remitted");
    expect(owing(yearData().months).map((m) => m.period)).toEqual([`${year}-01`]);
  });

  it("writes the schedule CSV in major units with a total row", () => {
    const rows = scheduleCsv(detail());
    expect(rows[0]).toContain("Supplier TIN");
    expect(rows[1]).toEqual(["2026-09", "ECN Printing Ltd", "", "2026-09-10", "PV/2026/09/0002", "MEMO/GEN/0010", "Prospectus printing", "supplies", "5%", "NGN", "200000.00", "10000.00"]);
    expect(rows.at(-1)).toEqual(["2026-09", "Total", "", "", "", "", "", "", "", "NGN", "700000.00", "60000.00"]);
  });
});

describe("WhtBoard", () => {
  it("shows the year's totals, the month strip and the months table", async () => {
    api.year.mockResolvedValue(yearData());
    render(<WhtBoard />);

    expect(await screen.findByText("Withholding tax")).toBeInTheDocument();
    const strip = screen.getByRole("list", { name: `WHT by month, ${year}` });
    expect(within(strip).getByRole("link", { name: new RegExp(`January ${year}: .*Overdue`) })).toHaveAttribute("href", `/suite/finance/wht/${year}-01`);
    expect(within(strip).getByRole("link", { name: new RegExp(`February ${year}: .*Remitted`) })).toBeInTheDocument();
    expect(screen.getByText("1 past the 21st")).toBeInTheDocument();
    expect(api.year).toHaveBeenCalledWith(year);
  });
});

describe("WhtMonthDetail", () => {
  it("lists suppliers with their TIN and certificate links, and downloads the CSV", async () => {
    api.month.mockResolvedValue(detail());
    render(<WhtMonthDetail period="2026-09" />);

    expect(await screen.findByText("Lagos Advisory Partners Ltd")).toBeInTheDocument();
    expect(screen.getByText("20000001-0001")).toBeInTheDocument();
    expect(screen.getByText(/1 supplier has no TIN on record/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Certificate PDF for ECN Printing Ltd" })).toHaveAttribute("href", "/api/finance/wht/certificates/cp-1?year=2026&month=9");
    expect(screen.getByText(/no approved bank account yet/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Download CSV/ }));
    expect(csv.downloadCsv).toHaveBeenCalledWith("wht-schedule-2026-09.csv", expect.any(Array));
  });

  it("raises the remittance only after confirming, then links the memo", async () => {
    api.month.mockResolvedValue(detail());
    api.remit.mockResolvedValue(
      detail({
        status: "memo_raised",
        remittance: { id: "r-1", status: "memo_raised", memoId: "m-9", memoReference: "MEMO/GEN/0042", memoStatus: "awaiting_fcu", raisedAt: "2026-10-05T10:00:00+01:00", raisedBy: "Adaeze", paidAt: null, pvId: null, pvNo: null, bankReference: null, wht: 60_000_00 },
      }),
    );
    render(<WhtMonthDetail period="2026-09" />);

    await userEvent.click(await screen.findByRole("button", { name: "Raise remittance" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Raise the WHT remittance for September 2026/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(api.remit).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Raise remittance" }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Raise remittance" }));
    expect(api.remit).toHaveBeenCalledWith("2026-09");
    expect(await screen.findByRole("link", { name: "MEMO/GEN/0042" })).toHaveAttribute("href", "/suite/finance/memos/m-9");
    expect(screen.queryByRole("button", { name: "Raise remittance" })).not.toBeInTheDocument();
  });

  it("offers no raise button without the remit key", async () => {
    auth.user = { id: "u-2", role: "user", name: "Viewer", organisationId: "o", permissions: ["finance.wht.view"] };
    api.month.mockResolvedValue(detail());
    render(<WhtMonthDetail period="2026-09" />);
    expect(await screen.findByText("ECN Printing Ltd")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Raise remittance" })).not.toBeInTheDocument();
  });
});

describe("WhtCertificates", () => {
  it("links each supplier's year and month certificates", async () => {
    const certs: Certs = {
      year: 2026,
      currency: "NGN",
      suppliers: [{ counterpartyId: "cp-2", name: "Lagos Advisory Partners Ltd", tin: "20000001-0001", gross: 500_000_00, wht: 50_000_00, lineCount: 1, months: [{ period: "2026-09", wht: 50_000_00, remitted: false, raised: true }] }],
    };
    api.certificates.mockResolvedValue(certs);
    render(<WhtCertificates year={2026} />);

    expect(await screen.findByRole("link", { name: "Lagos Advisory Partners Ltd: certificate PDF for 2026" })).toHaveAttribute("href", "/api/finance/wht/certificates/cp-2?year=2026");
    expect(screen.getByRole("link", { name: /certificate for September 2026 \(not yet remitted\)/ })).toHaveAttribute("href", "/api/finance/wht/certificates/cp-2?year=2026&month=9");
    expect(screen.getByText(/Some months are not yet remitted/)).toBeInTheDocument();
  });
});
