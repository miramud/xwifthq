import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/operations-procurement-client";
import SourcingDetail from "./SourcingDetail";
import { ME_OPTIONS, comparison, prFull } from "./fixtures";

/** Sourcing a request: the rule banner, the award picked in the sheet, and refusals said plainly. */

const api = vi.hoisted(() => ({ get: vi.fn(), award: vi.fn(), options: vi.fn(), rfq: vi.fn(), quote: vi.fn(), upload: vi.fn(), permissions: [] as string[] }));
vi.mock("@/lib/api/operations-procurement-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-procurement-client")>();
  return {
    ...actual,
    procurement: {
      ...actual.procurement,
      me: { ...actual.procurement.me, options: api.options },
      requests: { ...actual.procurement.requests, get: api.get, award: api.award, rfq: api.rfq, quote: api.quote },
      attachments: { ...actual.procurement.attachments, upload: api.upload },
    },
  };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-halima", role: "user", name: "Halima Yusuf", organisationId: "o", permissions: api.permissions }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/suite/operations/procurement/requests/pr-1", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  for (const f of [api.get, api.award, api.options, api.rfq, api.quote, api.upload]) f.mockReset();
  api.options.mockResolvedValue(ME_OPTIONS);
  api.permissions = ["admin.purchase_requests.rfq", "admin.purchase_requests.quote", "admin.purchase_requests.recommend", "admin.purchase_requests.view"];
});

describe("SourcingDetail", () => {
  it("shows a system-drafted request without a number, marked as a draft", async () => {
    api.get.mockResolvedValue(prFull({ status: "draft", number: null, origin: "shortfall", comparison: null, rfqs: [], awards: [], orders: [], funds: null, approvalId: null }));
    render(<SourcingDetail id="pr-1" />);
    expect(await screen.findByText("Shortfall draft")).toBeInTheDocument();
    expect(screen.getAllByText("Not numbered yet").length).toBeGreaterThan(0);
    expect(screen.getByText(/Drafted for what the store couldn.t issue/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite quotations" })).not.toBeInTheDocument();
  });

  it("recommends the lowest on each line to start with, and sends the picks with the reason", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(prFull());
    api.award.mockResolvedValue({ id: "aw-1", status: "in_approval" });
    render(<SourcingDetail id="pr-1" />);

    expect(await screen.findByText("Quotation rule met.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Recommend the award" }));
    expect(screen.getByRole("radio", { name: "Award line 1 to Konga Business" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Award line 2 to Zenith Office Supplies Ltd" })).toBeChecked();
    expect(screen.getByText("2 lines to 2 vendors")).toBeInTheDocument();

    // Split differently: line 1 to Swiftlink, which costs more than the lowest.
    await user.click(screen.getByRole("radio", { name: "Award line 1 to Swiftlink Networks Ltd" }));
    expect(screen.getByText(/more than the lowest on each line/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send the award for approval" }));
    expect(screen.getByText("Say why these vendors are recommended.")).toBeInTheDocument();
    expect(api.award).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Why these vendors"), "Swiftlink's laptops carry on-site warranty.");
    await user.click(screen.getByRole("button", { name: "Send the award for approval" }));
    expect(api.award).toHaveBeenCalledWith("pr-1", {
      reason: "Swiftlink's laptops carry on-site warranty.",
      picks: [
        { prLineId: "l-1", quotationId: "q-swift" },
        { prLineId: "l-2", quotationId: "q-zenith" },
      ],
    });
    expect((await screen.findAllByText(/Award recommended and sent for approval/)).length).toBeGreaterThan(0);
  }, 30_000);

  it("shows a separation-of-duties refusal as it is given", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(prFull());
    api.award.mockRejectedValue(new ApiError("Invalid.", 422, { duties: ["SOD_VIOLATION: you are the requester, so you cannot also recommend the award."] }));
    render(<SourcingDetail id="pr-1" />);
    await user.click(await screen.findByRole("button", { name: "Recommend the award" }));
    await user.type(screen.getByLabelText("Why these vendors"), "Lowest");
    await user.click(screen.getByRole("button", { name: "Send the award for approval" }));
    expect(await screen.findByText("You are the requester, so you cannot also recommend the award.")).toBeInTheDocument();
  }, 30_000);

  it("says how many more quotations are needed, and offers no award until there are any", async () => {
    api.get.mockResolvedValue(
      prFull({
        comparison: comparison({
          vendors: [],
          lines: [],
          rule: { needed: 3, have: 0, met: false, singleSource: false, tender: false, message: "This request needs 3 quotations (it has 0)." },
        }),
      }),
    );
    render(<SourcingDetail id="pr-1" />);
    expect(await screen.findByText("More quotations needed")).toBeInTheDocument();
    expect(screen.getByText("0 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recommend the award" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite quotations" })).toBeInTheDocument();
  }, 30_000);

  it("hides the desk's actions from somebody who only reads", async () => {
    api.permissions = ["admin.purchase_requests.view"];
    api.get.mockResolvedValue(prFull());
    render(<SourcingDetail id="pr-1" />);
    expect(await screen.findByText("Quotation rule met.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recommend the award" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enter a quotation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel request" })).not.toBeInTheDocument();
  }, 30_000);

  it("shows who each RFQ went to, who replied and who is still awaited", async () => {
    api.get.mockResolvedValue(prFull({ rfqs: [OPEN_RFQ] }));
    render(<SourcingDetail id="pr-1" />);
    const list = await screen.findByRole("list", { name: "Vendors invited on MPT/RFQ/2026/0002" });
    expect(screen.getByText("1 of 2 replied")).toBeInTheDocument();
    expect(within(list).getByText("Konga Business").closest("li")).toHaveTextContent("Replied 18 Sep 2026");
    expect(within(list).getByText("Swiftlink Networks Ltd").closest("li")).toHaveTextContent("Awaiting");
    expect(screen.getByText(/Open · due 30 Dec 2099/)).toBeInTheDocument();
    expect(screen.getByText(/Quote by Friday/)).toBeInTheDocument();
  }, 30_000);

  it("enters a quotation for the RFQ's vendor still to reply, and attaches the document to the quotation", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(prFull({ rfqs: [OPEN_RFQ] }));
    api.quote.mockResolvedValue({ id: "q-new", total: 4_000_000_00 });
    api.upload.mockResolvedValue({ id: "att-9", name: "swift.pdf" });
    render(<SourcingDetail id="pr-1" />);
    await user.click(await screen.findByRole("button", { name: "Enter a quotation" }));
    const dialog = await screen.findByRole("dialog");
    // The only vendor still to reply on the only open RFQ is picked already.
    expect(within(dialog).getByRole("combobox", { name: "Vendor" })).toHaveTextContent("Swiftlink Networks Ltd");
    await user.type(within(dialog).getByLabelText("Unit price (₦), line 1"), "1000000");
    const file = new File(["%PDF"], "swift.pdf", { type: "application/pdf" });
    await user.upload(within(dialog).getByLabelText(/attached to this quotation/), file);
    await user.click(within(dialog).getByRole("button", { name: "Save quotation" }));

    expect(api.quote).toHaveBeenCalledWith("pr-1", expect.objectContaining({ vendorId: "v-swift", rfqId: "rfq-2" }));
    expect(api.upload).toHaveBeenCalledWith("quotation", "q-new", file, "quotation");
    expect((await screen.findAllByText(/Quotation from Swiftlink Networks Ltd saved/)).length).toBeGreaterThan(0);
  }, 30_000);

  it("says so when the quotation saved but its file didn't attach", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(prFull({ rfqs: [OPEN_RFQ] }));
    api.quote.mockResolvedValue({ id: "q-new", total: 4_000_000_00 });
    api.upload.mockRejectedValue(new ApiError("The file is too large.", 422));
    render(<SourcingDetail id="pr-1" />);
    await user.click(await screen.findByRole("button", { name: "Enter a quotation" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Unit price (₦), line 1"), "1000000");
    await user.upload(within(dialog).getByLabelText(/attached to this quotation/), new File(["x"], "big.pdf"));
    await user.click(within(dialog).getByRole("button", { name: "Save quotation" }));
    expect((await screen.findAllByText(/big\.pdf wasn't attached to it\. The file is too large\./)).length).toBeGreaterThan(0);
  }, 30_000);
});

/** An RFQ still open: Konga replied, Swiftlink not yet. */
const OPEN_RFQ = {
  id: "rfq-2",
  number: "MPT/RFQ/2026/0002",
  deadline: "2099-12-30",
  vendors: ["Konga Business", "Swiftlink Networks Ltd"],
  invited: [
    { vendorId: "v-konga", vendor: "Konga Business", replied: true, quotationId: "q-konga", repliedAt: "2026-09-18 11:20:00" },
    { vendorId: "v-swift", vendor: "Swiftlink Networks Ltd", replied: false, quotationId: null, repliedAt: null },
  ],
  replied: 1,
  awaiting: 1,
  status: "open",
  message: "Quote by Friday, delivered to the ICT Centre.",
};
