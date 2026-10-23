import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption } from "@/test/selectOption";
import RepositoryDesk from "./RepositoryDesk";
import DocumentDetail from "./DocumentDetail";
import ControlledList from "./ControlledList";
import ControlledDetail from "./ControlledDetail";
import { resetRepoPickers } from "./parts";
import { controlled, doc, docFull, meta, version } from "./fixtures";

/** The repository desk, a document's page, and controlled documents with their read report. */

const api = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  upload: vi.fn(),
  hold: vi.fn(),
  dispose: vi.fn(),
  cList: vi.fn(),
  cGet: vi.fn(),
  cSubmit: vi.fn(),
  cReview: vi.fn(),
  push: vi.fn(),
  user: { id: "u-desk", role: "admin", name: "Kemi Desk", organisationId: "o", permissions: [] as string[] },
}));

vi.mock("@/lib/api/repository-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/repository-client")>();
  return {
    ...actual,
    repository: {
      ...actual.repository,
      list: api.list,
      get: api.get,
      upload: api.upload,
      hold: api.hold,
      dispose: api.dispose,
      controlled: { ...actual.repository.controlled, list: api.cList, get: api.cGet, submit: api.cSubmit, review: api.cReview },
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
        people: async () => [
          { id: "u-ada", name: "Ada Obi", jobTitle: "Engineer", unit: "Engineering" },
          { id: "u-desk", name: "Kemi Desk", jobTitle: "Admin officer", unit: "People" },
        ],
        units: async () => [{ id: "unit-eng", parentId: null, code: "ENG", name: "Engineering", kind: "department", depth: 0, defaultCostCentreId: null }],
        costCentres: async () => [],
        counterparties: async () => [],
      },
    },
  };
});
vi.mock("@/lib/api/operations-procurement-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-procurement-client")>();
  return { ...actual, procurement: { ...actual.procurement, me: { ...actual.procurement.me, options: async () => ({ projects: [], costCentres: [], vendors: [], prCategories: {}, financeOn: true }) } } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: api.user, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }), usePathname: () => "/suite/operations/documents", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-06T09:00:00"));
  for (const f of [api.list, api.get, api.upload, api.hold, api.dispose, api.cList, api.cGet, api.cSubmit, api.cReview, api.push]) f.mockReset();
  resetRepoPickers();
  api.user = { ...api.user, id: "u-desk", role: "admin" };
});
afterEach(() => vi.useRealTimers());

describe("RepositoryDesk", () => {
  it("shows the repository at a glance and narrows to what expires soon", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue({ documents: [doc()], meta: meta() });
    render(<RepositoryDesk />);
    expect(await screen.findByText("Abuja office lease")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Contracts\s*3/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Expiring in 60 days/ }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ q: "", category: "", confidentiality: "", expiring: 60 }));
    await user.click(screen.getByRole("button", { name: /Contracts\s*3/ }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ category: "contracts" })));
  });

  it("asks for the people allowed to see a restricted upload", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue({ documents: [doc()], meta: meta() });
    api.upload.mockResolvedValue(docFull({ id: "d-new" }));
    render(<RepositoryDesk />);
    await user.click(await screen.findByRole("button", { name: "Upload document" }));
    const dialog = screen.getByRole("dialog", { name: "Upload a document" });
    await user.upload(within(dialog).getByLabelText("Choose a file"), new File(["%PDF"], "board-minutes.pdf", { type: "application/pdf" }));
    expect(within(dialog).getByLabelText("Title")).toHaveValue("board-minutes");
    await chooseOption(user, within(dialog).getByRole("combobox", { name: "Category" }), "Corporate & legal");
    await user.click(within(dialog).getByRole("radio", { name: /Restricted/ }));
    await user.click(within(dialog).getByRole("button", { name: "Upload document" }));
    expect(within(dialog).getByText("Name at least one person who may see it.")).toBeInTheDocument();
    await chooseOption(user, within(dialog).getByRole("combobox", { name: "People allowed to see it" }), "Ada Obi");
    await user.click(within(dialog).getByRole("button", { name: "Upload document" }));
    expect(api.upload).toHaveBeenCalledWith(expect.any(File), expect.objectContaining({ title: "board-minutes", category: "corporate", confidentiality: "restricted", allowedUserIds: ["u-ada"], retentionClass: "general" }));
    expect(api.push).toHaveBeenCalledWith("/suite/operations/documents/d-new");
  });
});

describe("DocumentDetail", () => {
  it("shows retention, who opened it, and lets an admin place a hold with a reason", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(docFull());
    api.hold.mockResolvedValue(docFull({ legalHold: true, legalHoldReason: "Suit 114 of 2026" }));
    render(<DocumentDetail id="d-lease" />);
    expect(await screen.findByRole("heading", { name: "Abuja office lease" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute("href", "/api/org/repository/d-lease/download");
    expect(screen.getByText("It is kept until 30 Nov 2033 (Contracts).")).toBeInTheDocument();
    expect(screen.getByText("Ada Obi")).toBeInTheDocument();
    expect(screen.getByText(/aren.t listed here yet/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Place a legal hold" }));
    const dialog = screen.getByRole("dialog", { name: "Place a legal hold" });
    await user.click(within(dialog).getByRole("button", { name: "Place hold" }));
    expect(within(dialog).getByText("Say why.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("The case or matter"), "Suit 114 of 2026");
    await user.click(within(dialog).getByRole("button", { name: "Place hold" }));
    expect(api.hold).toHaveBeenCalledWith("d-lease", true, "Suit 114 of 2026");
    expect(await screen.findByText("Suit 114 of 2026")).toBeInTheDocument();
  });

  it("keeps legal hold to admins, and asks the controller to approve a disposal", async () => {
    const user = userEvent.setup();
    api.user = { ...api.user, role: "user", permissions: ["core.repository.view"] };
    api.get.mockResolvedValueOnce(docFull()).mockResolvedValue(docFull({ disposal: { status: "requested", reason: "Retention ended", approvalId: "ap-1" } }));
    api.dispose.mockResolvedValue({ status: "requested", approvalId: "ap-1" });
    render(<DocumentDetail id="d-lease" />);
    await screen.findByRole("heading", { name: "Abuja office lease" });
    expect(screen.queryByRole("button", { name: "Place a legal hold" })).not.toBeInTheDocument();
    expect(screen.getByText("Only an admin places or lifts a legal hold.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ask to dispose" }));
    const dialog = screen.getByRole("dialog", { name: "Ask to dispose of this document?" });
    expect(dialog).toHaveTextContent("The document controller approves it first.");
    await user.type(within(dialog).getByLabelText("Why it can go"), "Retention ended");
    await user.click(within(dialog).getByRole("button", { name: "Ask to dispose" }));
    expect(api.dispose).toHaveBeenCalledWith("d-lease", "Retention ended");
    expect(await screen.findByText("Disposal asked for: waiting for the document controller")).toBeInTheDocument();
  });
});

describe("Controlled documents", () => {
  it("lists them with the version in force, reviews due and how many have read", async () => {
    const c = controlled();
    api.cList.mockResolvedValue({ documents: [{ ...c, inProgress: { id: "v-2-1", version: "2.1", status: "in_review" } }], kinds: { policy: "Policy" } });
    render(<ControlledList />);
    expect(await screen.findByText("Leave policy")).toBeInTheDocument();
    expect(screen.getAllByText("Review due").length).toBeGreaterThan(0);
    expect(screen.getByRole("progressbar", { name: "Leave policy: 70% read" })).toBeInTheDocument();
    expect(screen.getByText("7 of 10 · 70%")).toBeInTheDocument();
  });

  it("draws the read report by department, with who is still to read", async () => {
    api.cGet.mockResolvedValue(controlled());
    render(<ControlledDetail id="c-leave" />);
    expect(await screen.findByText("70%")).toBeInTheDocument();
    expect(screen.getByText("2 still to read")).toBeInTheDocument();
    expect(screen.getAllByText("Bola Ade, Chidi Eze")).toHaveLength(2);
    expect(screen.getByRole("table", { name: "Who has read the version in force, by department" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Draft new version" })).toBeInTheDocument();
  });

  it("offers the review only to the named reviewer", async () => {
    const user = userEvent.setup();
    const working = version({ id: "v-2-1", version: "2.1", status: "in_review", reviewerId: "u-ada", reviewer: "Ada Obi", approvedAt: null, assigned: 0, acknowledged: 0 });
    const c = controlled();
    api.cGet.mockResolvedValue({ ...c, versions: [working, ...c.versions] });
    api.cReview.mockResolvedValue({ ...working, status: "draft" });
    const { unmount } = render(<ControlledDetail id="c-leave" />);
    expect(await screen.findByText("With Ada Obi for review.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review it" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Draft new version" })).not.toBeInTheDocument();
    unmount();

    api.user = { ...api.user, id: "u-ada" };
    render(<ControlledDetail id="c-leave" />);
    await user.click(await screen.findByRole("button", { name: "Review it" }));
    const dialog = screen.getByRole("dialog", { name: "Review version 2.1" });
    await user.click(within(dialog).getByRole("radio", { name: "Return it" }));
    await user.click(within(dialog).getByRole("button", { name: "Return to the author" }));
    expect(within(dialog).getByText("Say what needs changing.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("What needs changing"), "Clause 4 contradicts the handbook.");
    await user.click(within(dialog).getByRole("button", { name: "Return to the author" }));
    expect(api.cReview).toHaveBeenCalledWith("v-2-1", false, "Clause 4 contradicts the handbook.");
  });

  it("lets the author send a draft on, after asking", async () => {
    const user = userEvent.setup();
    const draft = version({ id: "v-2-1", version: "2.1", status: "draft", reviewerId: null, reviewer: null, approvedAt: null });
    const c = controlled();
    api.cGet.mockResolvedValue({ ...c, versions: [draft, ...c.versions] });
    api.cSubmit.mockResolvedValue({ ...draft, status: "in_approval" });
    render(<ControlledDetail id="c-leave" />);
    await user.click(await screen.findByRole("button", { name: "Send for approval" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Send for approval" }));
    expect(api.cSubmit).toHaveBeenCalledWith("v-2-1");
  });
});
