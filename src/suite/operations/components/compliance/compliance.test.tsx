import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption } from "@/test/selectOption";
import { ApiError } from "@/lib/api/operations-compliance-client";
import ComplianceDesk from "./ComplianceDesk";
import OccurrenceDetail from "./OccurrenceDetail";
import BidPack from "./BidPack";
import { resetPickerOptions } from "@/suite/operations/components/assets/parts";
import { bidPack, board, detail } from "./fixtures";

/** The compliance desk, an occurrence through to completion, and the bid pack. */

const api = vi.hoisted(() => ({
  board: vi.fn(),
  create: vi.fn(),
  occurrence: vi.fn(),
  start: vi.fn(),
  complete: vi.fn(),
  uploadEvidence: vi.fn(),
  removeEvidence: vi.fn(),
  raiseMemo: vi.fn(),
  bidPack: vi.fn(),
  options: vi.fn(),
  permissions: [] as string[],
}));

vi.mock("@/lib/api/operations-compliance-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-compliance-client")>();
  return {
    ...actual,
    compliance: {
      ...actual.compliance,
      board: api.board,
      create: api.create,
      occurrence: api.occurrence,
      start: api.start,
      complete: api.complete,
      uploadEvidence: api.uploadEvidence,
      removeEvidence: api.removeEvidence,
      raiseMemo: api.raiseMemo,
      bidPack: api.bidPack,
    },
  };
});
vi.mock("@/lib/api/operations-assets-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-assets-client")>();
  return { ...actual, assets: { ...actual.assets, options: api.options } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-desk", role: "user", name: "Kemi Desk", organisationId: "o", permissions: api.permissions }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/suite/operations/compliance", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-06T09:00:00"));
  for (const f of [api.board, api.create, api.occurrence, api.start, api.complete, api.uploadEvidence, api.removeEvidence, api.raiseMemo, api.bidPack, api.options]) f.mockReset();
  resetPickerOptions();
  api.options.mockResolvedValue({ staff: [{ id: "u1", name: "Ada Obi" }], projects: [] });
  api.permissions = ["view", "create", "update", "start", "submit", "complete", "evidence", "remove_evidence", "memo"].map((a) => `admin.compliance.${a}`);
});
afterEach(() => vi.useRealTimers());

describe("ComplianceDesk", () => {
  it("leads with what is late and the mandatory certificates that lapsed, and draws them on one axis", async () => {
    api.board.mockResolvedValue(board());
    render(<ComplianceDesk />);
    expect(await screen.findByRole("alert")).toHaveTextContent("PENCOM compliance certificate");
    expect(api.board).toHaveBeenCalledWith({ from: "2026-04-01", to: "2027-10-31" });
    expect(screen.getByRole("img", { name: /PENCOM compliance certificate: expired, issued 1 Aug 2025, expires 31 Jul 2026, 67 days ago/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "NITDA registration: no certificate on file" })).toBeInTheDocument();
    // The overdue CAC return from June stays on the deadlines rail.
    const rail = screen.getByRole("complementary", { name: "Deadlines, October 2026" });
    expect(within(rail).getByText("CAC annual returns (2026)")).toBeInTheDocument();
    expect(within(rail).getByText("PAYE remittance (September 2026)")).toBeInTheDocument();
  });

  it("filters the calendar and the register by who owns the deadline", async () => {
    const user = userEvent.setup();
    api.board.mockResolvedValue(board());
    render(<ComplianceDesk />);
    const chips = await screen.findByRole("radiogroup", { name: "Whose deadlines" });
    await user.click(within(chips).getByRole("radio", { name: /Company secretary/ }));
    const rail = screen.getByRole("complementary", { name: "Deadlines, October 2026" });
    expect(within(rail).getByText("CAC annual returns (2026)")).toBeInTheDocument();
    expect(within(rail).queryByText("PAYE remittance (September 2026)")).not.toBeInTheDocument();
    const table = screen.getByRole("table", { name: "The compliance register" });
    expect(within(table).queryByText("PAYE remittance")).not.toBeInTheDocument();
  });

  it("adds an obligation with its due rule and reminders", async () => {
    const user = userEvent.setup();
    api.board.mockResolvedValue(board());
    api.create.mockResolvedValue(board().obligations[0]);
    render(<ComplianceDesk />);
    await user.click(await screen.findByRole("button", { name: "Add obligation" }));
    const dialog = screen.getByRole("dialog", { name: "Add an obligation" });
    await user.type(within(dialog).getByLabelText("What has to be done"), "NITDA registration");
    await chooseOption(user, within(dialog).getByRole("combobox", { name: "Category" }), "Corporate");
    await user.click(within(dialog).getByRole("radio", { name: /On expiry/ }));
    await user.click(within(dialog).getByRole("button", { name: /^1 day/ }));
    await user.click(within(dialog).getByRole("switch", { name: "It is a certificate" }));
    await user.click(within(dialog).getByRole("button", { name: "Add to the register" }));
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "NITDA registration", category: "corporate", frequency: "annual", dueRule: { type: "expiry" }, reminderDays: [60, 30, 14, 7], isCertificate: true, mandatory: true }),
    );
  });

  it("refuses an obligation with no name or category", async () => {
    const user = userEvent.setup();
    api.board.mockResolvedValue(board());
    render(<ComplianceDesk />);
    await user.click(await screen.findByRole("button", { name: "Add obligation" }));
    const dialog = screen.getByRole("dialog", { name: "Add an obligation" });
    await user.click(within(dialog).getByRole("button", { name: "Add to the register" }));
    expect(within(dialog).getByText("Name the obligation.")).toBeInTheDocument();
    expect(within(dialog).getByText("Choose a category.")).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });
});

describe("OccurrenceDetail", () => {
  it("shows an overdue item on its step, with the evidence it needs and the reminders sent", async () => {
    api.occurrence.mockResolvedValue(detail());
    render(<OccurrenceDetail id="oc-cac" />);
    expect(await screen.findByRole("heading", { name: "CAC annual returns" })).toBeInTheDocument();
    expect(screen.getByText("98 days late")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Where this item stands" })).getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText(/It cannot be completed without one/)).toBeInTheDocument();
    expect(screen.getByText("30 days before")).toBeInTheDocument();
    expect(screen.getByText("Overdue notice")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2025" })).toHaveAttribute("href", "/suite/operations/compliance/oc-cac-2025");
  });

  it("says evidence comes first when completing without it, and passes the server's refusal through", async () => {
    const user = userEvent.setup();
    api.occurrence.mockResolvedValue(detail());
    api.complete.mockRejectedValue(new ApiError("Invalid", 422, { evidence: ["Attach the evidence first: an obligation is not completed without it."] }));
    render(<OccurrenceDetail id="oc-cac" />);
    await user.click(await screen.findByRole("button", { name: "Mark completed" }));
    const dialog = screen.getByRole("dialog", { name: "Mark it completed" });
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Attach the evidence first");
    await user.click(within(dialog).getByRole("button", { name: "Mark completed" }));
    expect(api.complete).toHaveBeenCalledWith("oc-cac", { reference: null, issuedOn: null, expiresOn: null, notes: null });
    expect(within(dialog).getAllByRole("alert")).toHaveLength(1);
  });

  it("needs the expiry date of a certificate", async () => {
    const user = userEvent.setup();
    const d = detail();
    api.occurrence.mockResolvedValue({ ...d, obligation: { ...d.obligation, isCertificate: true }, evidence: [{ id: "att-1", kind: "evidence", name: "TCC.pdf", mime: "application/pdf", size: 1024, uploadedBy: "Kemi Desk", uploadedById: "u-desk", uploadedAt: "2026-10-01T10:00:00Z" }] });
    render(<OccurrenceDetail id="oc-cac" />);
    await user.click(await screen.findByRole("button", { name: "Record certificate" }));
    const dialog = screen.getByRole("dialog", { name: "Record the new certificate" });
    await user.click(within(dialog).getByRole("button", { name: "Record certificate" }));
    expect(within(dialog).getByText("Enter the certificate's expiry date.")).toBeInTheDocument();
    expect(api.complete).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Download TCC.pdf" })).toHaveAttribute("href", "/api/operations/attachments/att-1");
  });

  it("uploads evidence, and removes it only after asking", async () => {
    const user = userEvent.setup();
    const withFile = detail({ evidence: [{ id: "att-9", kind: "evidence", name: "receipt.pdf", mime: "application/pdf", size: 2048, uploadedBy: "Kemi Desk", uploadedById: "u-desk", uploadedAt: "2026-10-01T10:00:00Z" }] });
    api.occurrence.mockResolvedValue(withFile);
    api.uploadEvidence.mockResolvedValue({ id: "att-10", name: "ack.pdf" });
    api.removeEvidence.mockResolvedValue(undefined);
    const { container } = render(<OccurrenceDetail id="oc-cac" />);
    await screen.findByText("receipt.pdf");
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(["%PDF"], "ack.pdf", { type: "application/pdf" }));
    expect(api.uploadEvidence).toHaveBeenCalledWith("oc-cac", expect.any(File));
    await user.click(screen.getByRole("button", { name: "Remove receipt.pdf" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Remove" }));
    expect(api.removeEvidence).toHaveBeenCalledWith("oc-cac", "att-9");
  });

  it("raises the fee as a payment memo, and links the memo once raised", async () => {
    const user = userEvent.setup();
    api.occurrence.mockResolvedValueOnce(detail()).mockResolvedValue(detail({ memoId: "m-1", memo: { reference: "MEMO/2026/0042", status: "draft", amount: 1_500_000, paid: 0, type: "payment" } }));
    api.raiseMemo.mockResolvedValue({ memoId: "m-1" });
    render(<OccurrenceDetail id="oc-cac" />);
    await user.click(await screen.findByRole("button", { name: "Raise payment memo" }));
    const dialog = screen.getByRole("dialog", { name: "Raise a payment memo" });
    expect(within(dialog).getByLabelText(/Amount/)).toHaveValue("15000.00");
    await user.click(within(dialog).getByRole("button", { name: "Raise memo" }));
    expect(api.raiseMemo).toHaveBeenCalledWith("oc-cac", 1_500_000);
    expect(await screen.findByRole("link", { name: /MEMO\/2026\/0042/ })).toHaveAttribute("href", "/suite/finance/memos/m-1");
  });

  it("offers no actions to someone who may only look", async () => {
    api.permissions = ["admin.compliance.view"];
    api.occurrence.mockResolvedValue(detail());
    render(<OccurrenceDetail id="oc-cac" />);
    await screen.findByRole("heading", { name: "CAC annual returns" });
    expect(screen.queryByRole("button", { name: "Mark completed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Raise payment memo" })).not.toBeInTheDocument();
    expect(screen.queryByText("Upload evidence")).not.toBeInTheDocument();
  });
});

describe("BidPack", () => {
  it("lists what goes in and what is left out with why, and downloads the ZIP", async () => {
    api.bidPack.mockResolvedValue(bidPack());
    render(<BidPack />);
    expect(await screen.findByRole("link", { name: "Download pack (ZIP)" })).toHaveAttribute("href", "/api/operations/compliance/bid-pack/file");
    expect(screen.getByText("Tax Clearance Certificate")).toBeInTheDocument();
    expect(screen.getByText("Expired on 31 Jul 2026")).toBeInTheDocument();
    expect(screen.getByText("No certificate on file")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /PENCOM compliance certificate/ })).toHaveAttribute("href", "/suite/operations/compliance/oc-pen-2025");
  });

  it("offers no download when nothing is valid", async () => {
    api.bidPack.mockResolvedValue(bidPack({ included: [] }));
    render(<BidPack />);
    expect(await screen.findByText(/every certificate marked for bids is missing or expired/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Download pack (ZIP)" })).not.toBeInTheDocument();
  });
});
