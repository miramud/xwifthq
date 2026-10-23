import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExternalCompanies from "./ExternalCompanies";
import { ApiError, type ExternalCompany } from "@/lib/api/projects-client";

/**
 * The client list, and the people at each.
 *
 * **Reading is everybody's; writing is the delivery lead's.** `meta.canManage`
 * is the server's answer to that, and the screen shows no control it would
 * refuse — a button that 403s teaches a permission rule through an error
 * message.
 *
 * **A roster is fetched when a company is opened, not with the list.** Loading
 * every company's people up front is N requests, or one enormous response, to
 * answer a question about one company.
 *
 * **Nobody is deleted.** Somebody who left is marked and kept, because their
 * placements on closed projects are the record of who signed what off.
 *
 * **A refusal is shown, not swallowed.** Deleting a company with live work is
 * refused by the API with a message naming how many projects; that sentence is
 * the whole value of the refusal.
 */

const { list, get, create, update, remove, addPerson, updatePerson } = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  addPerson: vi.fn(),
  updatePerson: vi.fn(),
}));

/* The list is a DataView, which reads the app router for row links. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/projects/companies",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return {
    ...actual,
    companies: { ...actual.companies, list, get, create, update, remove, addPerson, updatePerson },
  };
});

function company(over: Partial<ExternalCompany> & { id: string; name: string }): ExternalCompany {
  return {
    slug: over.name.toLowerCase(),
    website: null,
    sector: "Manufacturing",
    notes: null,
    status: "active",
    isActive: true,
    stakeholderCount: 2,
    projectCount: 1,
    createdAt: null,
    ...over,
  } as ExternalCompany;
}

const ACME = company({ id: "c-1", name: "Acme" });
const GLOBEX = company({ id: "c-2", name: "Globex", status: "former", isActive: false });

function person(id: string, name: string, isActive = true, notes: string | null = null) {
  return {
    id,
    companyId: "c-1",
    name,
    initials: name.slice(0, 2).toUpperCase(),
    jobTitle: "Finance Director",
    email: `${id}@acme.test`,
    phone: null,
    notes,
    isActive,
    createdAt: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue({ data: [ACME, GLOBEX], meta: { canManage: true } });
  get.mockResolvedValue({
    ...ACME,
    stakeholders: [person("p-1", "Adaeze Okafor"), person("p-9", "Gone Already", false)],
  });
});

describe("ExternalCompanies", () => {
  it("shows a former client as such and offers no write control to a reader", async () => {
    list.mockResolvedValue({ data: [ACME, GLOBEX], meta: { canManage: false } });

    render(<ExternalCompanies />);

    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Former client")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /Add a company/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete Acme/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Mark former/i })).toBeNull();
  });

  it("fetches a roster only when a company is opened", async () => {
    render(<ExternalCompanies />);

    await screen.findByText("Acme");

    /* Two companies on the list; neither roster asked for. */
    expect(get).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText("Acme"));

    await waitFor(() => expect(get).toHaveBeenCalledWith("acme"));
    expect(get).toHaveBeenCalledTimes(1);

    expect(await screen.findByText("Adaeze Okafor")).toBeInTheDocument();
  });

  it("keeps a roster it already has when a company is reopened", async () => {
    render(<ExternalCompanies />);

    await screen.findByText("Acme");

    await userEvent.click(screen.getByText("Acme"));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));

    /* Collapse, expand. The people have not changed in between. */
    await userEvent.click(screen.getByText("Acme"));
    await userEvent.click(screen.getByText("Acme"));

    expect(get).toHaveBeenCalledTimes(1);
  });

  it("keeps somebody who left on the list, marked, and never deletes them", async () => {
    render(<ExternalCompanies />);

    await screen.findByText("Acme");
    await userEvent.click(screen.getByText("Acme"));

    expect(await screen.findByText("Gone Already")).toBeInTheDocument();
    expect(screen.getByText(/no longer there/i)).toBeInTheDocument();

    /* There is no delete anywhere on a person. */
    expect(screen.queryByRole("button", { name: /Delete Adaeze Okafor/i })).toBeNull();

    updatePerson.mockResolvedValue(person("p-1", "Adaeze Okafor", false));

    await userEvent.click(
      screen.getByRole("button", { name: /Mark Adaeze Okafor as no longer there/i }),
    );

    await waitFor(() => expect(updatePerson).toHaveBeenCalledTimes(1));

    expect(updatePerson).toHaveBeenCalledWith("acme", "p-1", { isActive: false });
  });

  it("shows the API's refusal when a company still has work", async () => {
    remove.mockRejectedValue(
      new ApiError("This company still has 1 project. Mark them former instead.", 422),
    );

    render(<ExternalCompanies />);

    await screen.findByText("Acme");

    await userEvent.click(screen.getByRole("button", { name: /Delete Acme/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Delete company" }));

    expect(
      await screen.findByText(/This company still has 1 project/i),
    ).toBeInTheDocument();
  });

  it("filters the list without a request per keystroke", async () => {
    render(<ExternalCompanies />);

    await screen.findByText("Acme");

    await userEvent.type(screen.getByPlaceholderText(/Search by name or sector/i), "glob");

    expect(screen.getByText("Globex")).toBeInTheDocument();
    expect(screen.queryByText("Acme")).toBeNull();

    /* One list call for the screen, whatever was typed into it. */
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("hides former clients behind a filter rather than dropping them", async () => {
    render(<ExternalCompanies />);

    await screen.findByText("Globex");

    await userEvent.click(screen.getByLabelText(/Current clients only/i));

    expect(screen.queryByText("Globex")).toBeNull();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("adds a company with only a name", async () => {
    create.mockResolvedValue(ACME);

    render(<ExternalCompanies />);

    await screen.findByText("Acme");

    await userEvent.click(screen.getByRole("button", { name: /Add a company/i }));
    await userEvent.type(screen.getByLabelText(/Company name/i), "Initech");
    await userEvent.click(screen.getByRole("button", { name: /^Add company$/i }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));

    /* Empty optional fields go as undefined, never as "". */
    expect(create).toHaveBeenCalledWith({
      name: "Initech",
      sector: undefined,
      website: undefined,
    });
  });

  /**
   * A typo in a client's name was permanent.
   *
   * Creating a company worked and editing one did not exist; deleting is
   * refused once it has projects, so there was no way out at all.
   */
  it("corrects a company's details", async () => {
    update.mockResolvedValue({ ...ACME, name: "Acme Industries" });

    render(<ExternalCompanies />);

    await screen.findByText("Acme");

    await userEvent.click(screen.getByRole("button", { name: /Edit Acme/i }));

    const name = screen.getByLabelText(/Company name/i);

    await userEvent.clear(name);
    await userEvent.type(name, "Acme Industries");
    await userEvent.type(screen.getByLabelText(/^Notes$/i), "Ring the FD");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));

    expect(update).toHaveBeenCalledWith("acme", {
      name: "Acme Industries",
      sector: "Manufacturing",
      website: null,
      notes: "Ring the FD",
    });
  });

  /**
   * The whole justification for one record per person: a number is fixed here
   * and is right everywhere they are mapped. It shipped with no way to do it.
   */
  it("corrects a person's stale phone number", async () => {
    updatePerson.mockResolvedValue(person("p-1", "Adaeze Okafor"));

    render(<ExternalCompanies />);

    await screen.findByText("Acme");
    await userEvent.click(screen.getByText("Acme"));
    await screen.findByText("Adaeze Okafor");

    await userEvent.click(screen.getByRole("button", { name: /Edit Adaeze Okafor/i }));

    await userEvent.type(screen.getByLabelText(/Phone of Adaeze Okafor/i), "0800 000 0000");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => expect(updatePerson).toHaveBeenCalledTimes(1));

    expect(updatePerson).toHaveBeenCalledWith("acme", "p-1", {
      name: "Adaeze Okafor",
      jobTitle: "Finance Director",
      email: "p-1@acme.test",
      phone: "0800 000 0000",
      notes: null,
    });
  });

  /** Accepted by the API since the first commit and displayed nowhere. */
  it("shows a note recorded against a person", async () => {
    get.mockResolvedValue({
      ...ACME,
      stakeholders: [person("p-1", "Adaeze Okafor", true, "Prefers a call to an email")],
    });

    render(<ExternalCompanies />);

    await screen.findByText("Acme");
    await userEvent.click(screen.getByText("Acme"));

    expect(await screen.findByText("Prefers a call to an email")).toBeInTheDocument();
  });

  /**
   * A number somebody can read and not follow sends them looking by hand.
   */
  it("links a company's project count to that company's projects", async () => {
    render(<ExternalCompanies />);

    await screen.findByText("Acme");

    /* Both fixtures have work, so the link is found by which company it is for. */
    const links = screen.getAllByRole("link", { name: /The project/i });

    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/suite/projects?companyId=c-1",
      "/suite/projects?companyId=c-2",
    ]);
  });

  it("offers no link when this viewer can see none of that client's work", async () => {
    list.mockResolvedValue({
      data: [company({ id: "c-9", name: "Quiet", projectCount: 0 })],
      meta: { canManage: true },
    });

    render(<ExternalCompanies />);

    await screen.findByText("Quiet");

    expect(screen.queryByRole("link", { name: /The project/i })).toBeNull();
  });

  it("counts the companies, the current ones, and the ones with live work", async () => {
    render(<ExternalCompanies />);

    await screen.findByText("Acme");

    /* Each figure sits in its own stat card, beside its label. */
    const card = (label: string) => screen.getByText(label).closest(".ws-card") as HTMLElement;

    expect(within(card("Companies")).getByText("2")).toBeInTheDocument();
    expect(within(card("Current clients")).getByText("1")).toBeInTheDocument();
    expect(within(card("With live work")).getByText("2")).toBeInTheDocument();
  });

  it("adds somebody to a company and shows them without refetching the roster", async () => {
    addPerson.mockResolvedValue(person("p-2", "Bello Musa"));

    render(<ExternalCompanies />);

    await screen.findByText("Acme");
    await userEvent.click(screen.getByText("Acme"));
    await screen.findByText("Adaeze Okafor");

    await userEvent.click(screen.getByRole("button", { name: /Add somebody/i }));
    await userEvent.type(screen.getByLabelText(/^Name$/i), "Bello Musa");
    await userEvent.type(screen.getByLabelText(/Job title/i), "CTO");
    await userEvent.click(screen.getByRole("button", { name: /^Add$/i }));

    await waitFor(() => expect(addPerson).toHaveBeenCalledTimes(1));

    expect(addPerson).toHaveBeenCalledWith("acme", {
      name: "Bello Musa",
      jobTitle: "CTO",
      email: undefined,
      phone: undefined,
    });

    expect(await screen.findByText("Bello Musa")).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
  });
});
