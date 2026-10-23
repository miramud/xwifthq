import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/finance-spend-client";
import RequestEditor from "./RequestEditor";
import { OPTIONS, memoFull } from "./fixtures";

/** Raising a request: live funds, the checklist for the amount, saving before attaching, and the API's words next to the field. */

const api = vi.hoisted(() => ({
  options: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  submit: vi.fn(),
  upload: vi.fn(),
  funds: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  search: { value: "" },
}));

vi.mock("@/lib/api/finance-spend-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-spend-client")>();
  return {
    ...actual,
    spend: {
      ...actual.spend,
      me: { ...actual.spend.me, options: api.options, get: api.get, create: api.create, update: api.update, submit: api.submit, upload: api.upload, funds: api.funds },
    },
  };
});
vi.mock("@/lib/api/org-foundations-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/org-foundations-client")>();
  return {
    ...actual,
    orgFoundations: {
      ...actual.orgFoundations,
      lookups: {
        ...actual.orgFoundations.lookups,
        counterparties: vi.fn().mockResolvedValue([{ id: "c1", code: "V-001", name: "Swiftlink Networks", roles: ["vendor"] }]),
        costCentres: vi.fn().mockResolvedValue([{ id: "cc1", code: "ICT", name: "ICT unit", orgUnitId: null }]),
        people: vi.fn().mockResolvedValue([]),
      },
    },
  };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-tunde", role: "user", name: "Tunde Bello", organisationId: "o", permissions: [] }, loading: false }) }));
const router = vi.hoisted(() => ({ push: (...a: unknown[]) => api.push(...a), replace: (...a: unknown[]) => api.replace(...a), refresh: () => undefined, back: () => undefined, prefetch: () => undefined }));
vi.mock("next/navigation", () => ({
  // One router for the whole run, as Next gives: a new object per render would re-run effects.
  useRouter: () => router,
  usePathname: () => "/suite/finance/requests/new",
  useSearchParams: () => new URLSearchParams(api.search.value),
}));

beforeEach(() => {
  Object.values(api).forEach((f) => typeof f === "function" && f.mockReset());
  api.search.value = "";
  api.options.mockResolvedValue(OPTIONS);
  api.funds.mockResolvedValue({ controlled: true, hasBudget: true, hasRelease: true, available: 1_000_000_00 });
});

describe("RequestEditor", () => {
  it("shows the project's funds as the amount is typed, and the three-quote rule from its threshold", async () => {
    const user = userEvent.setup();
    api.search.value = "id=m1";
    api.get.mockResolvedValue(memoFull({ status: "draft", reference: null, amount: 500_000_00, approvedAmount: null, documents: [] }));
    render(<RequestEditor />);

    expect(await screen.findByText("Available on this project")).toBeInTheDocument();
    expect(screen.getByText("₦500,000.00 left after it")).toBeInTheDocument();
    expect(screen.getByText(/Required from ₦1,000,000.00/)).toBeInTheDocument();

    const amount = screen.getByLabelText("Amount (₦)");
    await user.clear(amount);
    await user.type(amount, "1,200,000");
    expect(screen.getByText("₦200,000.00 more than is available")).toBeInTheDocument();
    expect(screen.getByText(/Required because the amount is ₦1,000,000.00 or more/)).toBeInTheDocument();
    expect(screen.getByText(/2 required documents are still to attach/)).toBeInTheDocument();
  });

  it("sends the draft and shows the API's reason plainly when the funds refuse it", async () => {
    const user = userEvent.setup();
    api.search.value = "id=m1";
    const draft = memoFull({ status: "draft", reference: null, amount: 500_000_00, approvedAmount: null });
    api.get.mockResolvedValue(draft);
    api.update.mockResolvedValue(draft);
    api.submit.mockRejectedValue(
      new ApiError("The given data was invalid.", 422, {
        funds: ["INSUFFICIENT_PROJECT_FUNDS: the project has ₦1,000,000.00 available and this asks for ₦1,200,000.00."],
      }),
    );
    render(<RequestEditor />);
    const amount = await screen.findByLabelText("Amount (₦)");
    await user.clear(amount);
    await user.type(amount, "1200000");
    await user.click(screen.getByRole("button", { name: "Send to Finance" }));

    expect(api.update).toHaveBeenCalledWith("m1", expect.objectContaining({ amount: 1_200_000_00, projectId: "p1", costCentreId: null, payeeCounterpartyId: "c1" }));
    expect(api.update.mock.calls[0][1]).not.toHaveProperty("memoType");
    expect(api.submit).toHaveBeenCalledWith("m1", null);
    const messages = await screen.findAllByText(/the project has ₦1,000,000.00 available/);
    expect(messages.length).toBeGreaterThan(0);
    expect(screen.queryByText(/INSUFFICIENT_PROJECT_FUNDS/)).not.toBeInTheDocument();
    expect(api.push).not.toHaveBeenCalled();
  });

  it("checks the basics before saving anything", async () => {
    const user = userEvent.setup();
    render(<RequestEditor />);
    await user.click(await screen.findByRole("button", { name: "Send to Finance" }));
    expect(screen.getByText("Give the request a short title.")).toBeInTheDocument();
    expect(screen.getByText("Say how much is needed.")).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("pays an advance to the requester, and saves the draft before attaching a document", async () => {
    const user = userEvent.setup();
    api.create.mockResolvedValue(memoFull({ id: "new1", status: "draft", type: "advance", documents: [] }));
    api.upload.mockResolvedValue([{ id: "d9", itemCode: "breakdown", fileName: "budget.xlsx", mime: null, size: 2048, sha256: "x", uploadedBy: "Tunde Bello", uploadedAt: null }]);
    render(<RequestEditor />);

    await user.click(await screen.findByRole("radio", { name: /Advance or imprest/ }));
    expect(screen.getByText(/An advance is paid to you/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Vendor")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Title"), "Travel advance: Abuja site visit");
    await user.type(screen.getByLabelText("Justification"), "Two nights for the site survey.");
    await user.type(screen.getByLabelText("Amount (₦)"), "200000");
    const file = new File(["a,b"], "budget.xlsx");
    await user.upload(screen.getByLabelText("Attach purpose and budget breakdown", { selector: "input" }), file);

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ memoType: "advance", amount: 200_000_00, payeeUserId: null, payeeCounterpartyId: null }));
    expect(api.upload).toHaveBeenCalledWith("new1", file, "breakdown");
    expect(api.replace).toHaveBeenCalledWith("/suite/finance/requests/new?id=new1");
    expect(await screen.findByText("budget.xlsx")).toBeInTheDocument();
  }, 20_000);
});
