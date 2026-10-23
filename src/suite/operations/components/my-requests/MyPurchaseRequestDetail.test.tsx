import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption } from "@/test/selectOption";
import MyPurchaseRequestDetail from "./MyPurchaseRequestDetail";
import { ME_OPTIONS, prFull } from "@/suite/operations/components/procurement/fixtures";

/** My request: where it is, its sourcing read-only, and withdrawing it. */

const api = vi.hoisted(() => ({ get: vi.fn(), cancel: vi.fn(), options: vi.fn(), attach: vi.fn(), removeFile: vi.fn() }));
vi.mock("@/lib/api/operations-procurement-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-procurement-client")>();
  return { ...actual, procurement: { ...actual.procurement, me: { ...actual.procurement.me, get: api.get, cancel: api.cancel, options: api.options, attach: api.attach, removeFile: api.removeFile } } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-chinonso", role: "user", name: "Chinonso Okeke", organisationId: "o", permissions: [] }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/suite/operations/my/requests/pr-1", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset();
  api.options.mockResolvedValue(ME_OPTIONS);
});

describe("MyPurchaseRequestDetail", () => {
  it("shows the sourcing read-only, with the quotations behind a disclosure and no award ballot", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(prFull());
    render(<MyPurchaseRequestDetail id="pr-1" />);
    const road = await screen.findByRole("list", { name: "Where this request is" });
    expect(within(road).getByText("Sourcing").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Quotation rule met.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "See the 3 quotations" }));
    expect(screen.getByRole("table", { name: /Quotations compared/ })).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  }, 15_000);

  it("withdraws the request with a reason", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(prFull({ status: "in_approval", comparison: null }));
    api.cancel.mockResolvedValue(prFull({ status: "cancelled" }));
    render(<MyPurchaseRequestDetail id="pr-1" />);
    expect(await screen.findByRole("link", { name: /See who is deciding/ })).toHaveAttribute("href", "/suite/approvals/ap-pr-1");
    await user.click(screen.getByRole("button", { name: "Withdraw request" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Reason"), "Donated laptops arrived");
    await user.click(within(dialog).getByRole("button", { name: "Withdraw the request" }));
    expect(api.cancel).toHaveBeenCalledWith("pr-1", "Donated laptops arrived");
  }, 15_000);

  it("adds an optional file of the kind chosen, and opens it through the person's own route", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(prFull({ status: "in_approval", comparison: null, attachments: [] }));
    api.attach.mockResolvedValue(prFull({ status: "in_approval", comparison: null, attachments: [AGENDA] }));
    render(<MyPurchaseRequestDetail id="pr-1" />);
    expect(await screen.findByText(/No files\. Add one if it helps/)).toBeInTheDocument();
    await chooseOption(user, "What the file is", "Agenda");
    api.get.mockResolvedValue(prFull({ status: "in_approval", comparison: null, attachments: [AGENDA] }));
    const file = new File(["x"], "agenda.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("Add a specification, a sample design or an agenda (optional)"), file);
    expect(api.attach).toHaveBeenCalledWith("pr-1", file, "agenda");
    expect(await screen.findByRole("link", { name: "Open agenda.pdf" })).toHaveAttribute("href", "/api/operations/me/attachments/att-a");
    expect(screen.getByText(/Agenda ·/)).toBeInTheDocument();
  }, 15_000);

  it("removes a file the person added, after asking, but not somebody else's", async () => {
    const user = userEvent.setup();
    const theirs = { ...AGENDA, id: "att-b", name: "budget.xlsx", uploadedBy: "Halima Yusuf" };
    api.get.mockResolvedValue(prFull({ status: "draft", number: null, comparison: null, attachments: [AGENDA, theirs] }));
    api.removeFile.mockResolvedValue({});
    render(<MyPurchaseRequestDetail id="pr-1" />);
    expect(await screen.findByRole("link", { name: "Open budget.xlsx" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove budget.xlsx" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove agenda.pdf" }));
    await user.click(await screen.findByRole("button", { name: "Remove file" }));
    await waitFor(() => expect(api.removeFile).toHaveBeenCalledWith("att-a"));
  }, 15_000);

  it("lets nothing be removed once the request is past its approvers", async () => {
    api.get.mockResolvedValue(prFull({ attachments: [AGENDA] }));
    render(<MyPurchaseRequestDetail id="pr-1" />);
    expect(await screen.findByRole("link", { name: "Open agenda.pdf" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove agenda.pdf" })).not.toBeInTheDocument();
  }, 15_000);
});

const AGENDA = { id: "att-a", kind: "agenda", name: "agenda.pdf", mime: "application/pdf", size: 4096, uploadedBy: "Chinonso Okeke", uploadedAt: "2026-10-06T09:00:00+00:00" };
