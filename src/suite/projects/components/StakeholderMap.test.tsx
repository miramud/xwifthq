import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StakeholderMap from "./StakeholderMap";
import { chooseOption, openCombobox } from "@/test/selectOption";
import type {
  ExternalCompany,
  Project,
  ProjectStakeholder,
  StakeholderMapMeta,
} from "@/lib/api/projects-client";

/**
 * The per-project stakeholder map.
 *
 * Four things are worth defending, and none of them is that a list renders.
 *
 * **The strategy is never computed here.** It arrives derived from the two
 * axes, along with the sentence that explains it. A client that recomputed it
 * would be a second implementation of the grid, free to disagree with the
 * server's the day somebody changes what "medium" means.
 *
 * **An unmanaged risk is said in words.** Somebody who can hold delivery up
 * and is not being managed closely is a sign-off nobody has arranged; leaving
 * a reader to infer that from four boxes is leaving it unread.
 *
 * **An empty "manage closely" quadrant is the loudest thing on the screen.**
 * On a client project it almost always means the sponsor has not been
 * identified, which is exactly what a grid drawn only from present rows would
 * fail to show.
 *
 * **A reader who may not manage the map gets no controls.** `meta.canManage`
 * is the server's answer; the client never infers it.
 */

const { listMap, place, update, remove, getCompany } = vi.hoisted(() => ({
  listMap: vi.fn(),
  place: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  getCompany: vi.fn(),
}));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return {
    ...actual,
    stakeholders: { ...actual.stakeholders, list: listMap, place, update, remove },
    companies: { ...actual.companies, get: getCompany },
  };
});

/* The people are a DataView, which reads the router. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/projects/acme-rebuild",
  useSearchParams: () => new URLSearchParams(),
}));

const CLIENT_PROJECT = {
  slug: "acme-rebuild",
  name: "Acme Rebuild",
  type: "client",
  externalCompanyId: "c-1",
  externalCompany: { id: "c-1", slug: "acme", name: "Acme" },
  can: { update: true, manageMembers: true, manageBoard: true, delete: false },
} as unknown as Project;

const INTERNAL_PROJECT = {
  slug: "internal-tools",
  name: "Internal Tools",
  type: "internal",
  externalCompanyId: null,
  externalCompany: null,
  can: { update: true, manageMembers: true, manageBoard: true, delete: false },
} as unknown as Project;

function person(id: string, name: string) {
  return {
    id,
    companyId: "c-1",
    name,
    initials: name.slice(0, 2).toUpperCase(),
    jobTitle: "Finance Director",
    email: `${id}@acme.test`,
    phone: null,
    notes: null,
    isActive: true,
    createdAt: null,
  };
}

function placement(
  over: Partial<ProjectStakeholder> & { id: string; person: ReturnType<typeof person> },
): ProjectStakeholder {
  return {
    projectId: "p-1",
    role: "sponsor",
    roleLabel: "Sponsor",
    roleDescription: "Pays for it.",
    canBlockDelivery: true,
    influence: "high",
    influenceLabel: "High",
    interest: "high",
    interestLabel: "High",
    strategy: "manage_closely",
    strategyLabel: "Manage closely",
    guidance: "Bring them in early and keep them in.",
    isUnmanagedRisk: false,
    isPrimary: false,
    notes: null,
    addedBy: null,
    addedAt: null,
    ...over,
  } as ProjectStakeholder;
}

const EMPTY_GRID = {
  manage_closely: 0,
  keep_satisfied: 0,
  keep_informed: 0,
  monitor: 0,
} as const;

function meta(over: Partial<StakeholderMapMeta> = {}): StakeholderMapMeta {
  return {
    canManage: true,
    company: { id: "c-1", slug: "acme", name: "Acme" },
    grid: { ...EMPTY_GRID },
    unmanagedRisks: 0,
    hasPrimary: false,
    ...over,
  };
}

const COMPANY: ExternalCompany = {
  id: "c-1",
  slug: "acme",
  name: "Acme",
  website: null,
  sector: null,
  notes: null,
  status: "active",
  isActive: true,
  stakeholders: [person("p-1", "Adaeze Okafor"), person("p-2", "Bello Musa")],
  createdAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  getCompany.mockResolvedValue(COMPANY);
});

describe("StakeholderMap", () => {
  it("says why there is nobody to map on an internal project, and asks for no data", async () => {
    render(<StakeholderMap project={INTERNAL_PROJECT} />);

    expect(
      await screen.findByText(/No external company on this project/i),
    ).toBeInTheDocument();

    /*
      The point of the guard: an internal project must not fire a request whose
      only possible answer is an empty map.
    */
    expect(listMap).not.toHaveBeenCalled();
  });

  it("shows the strategy and its guidance exactly as the server derived them", async () => {
    listMap.mockResolvedValue({
      data: [
        placement({
          id: "m-1",
          person: person("p-1", "Adaeze Okafor"),
          interest: "low",
          interestLabel: "Low",
          strategy: "keep_satisfied",
          strategyLabel: "Keep satisfied",
          guidance: "They can stop this and are not watching. Brief them before they need to ask.",
          isUnmanagedRisk: true,
        }),
      ],
      meta: meta({ grid: { ...EMPTY_GRID, keep_satisfied: 1 }, unmanagedRisks: 1 }),
    });

    render(<StakeholderMap project={CLIENT_PROJECT} />);

    expect((await screen.findAllByText("Adaeze Okafor")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Keep satisfied").length).toBeGreaterThan(0);
    /* The sentence somebody can act on, not just the label. */
    expect(
      screen.getByText(/Brief them before they need to ask/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Influence high · interest low/i)).toBeInTheDocument();
  });

  it("states an unmanaged risk in words rather than leaving it in the grid", async () => {
    listMap.mockResolvedValue({
      data: [
        placement({
          id: "m-1",
          person: person("p-1", "Adaeze Okafor"),
          isUnmanagedRisk: true,
        }),
      ],
      meta: meta({ unmanagedRisks: 1, grid: { ...EMPTY_GRID, manage_closely: 1 } }),
    });

    render(<StakeholderMap project={CLIENT_PROJECT} />);

    expect(
      await screen.findByText(/One person can hold this up and is not being managed closely/i),
    ).toBeInTheDocument();
  });

  it("calls out an empty manage-closely quadrant", async () => {
    listMap.mockResolvedValue({
      data: [
        placement({
          id: "m-1",
          person: person("p-1", "Quiet Observer"),
          role: "observer",
          roleLabel: "Observer",
          canBlockDelivery: false,
          influence: "low",
          influenceLabel: "Low",
          interest: "low",
          interestLabel: "Low",
          strategy: "monitor",
          strategyLabel: "Monitor",
          guidance: "No action beyond keeping them on the list.",
        }),
      ],
      meta: meta({ grid: { ...EMPTY_GRID, monitor: 1 } }),
    });

    render(<StakeholderMap project={CLIENT_PROJECT} />);

    expect(
      await screen.findByText(/the sponsor has not been identified/i),
    ).toBeInTheDocument();
  });

  it("nudges for a primary contact when nobody is starred", async () => {
    listMap.mockResolvedValue({
      data: [placement({ id: "m-1", person: person("p-1", "Adaeze Okafor") })],
      meta: meta({ hasPrimary: false, grid: { ...EMPTY_GRID, manage_closely: 1 } }),
    });

    render(<StakeholderMap project={CLIENT_PROJECT} />);

    expect(
      await screen.findByText(/Nobody is marked as the person to ring/i),
    ).toBeInTheDocument();
  });

  it("gives a reader who may not manage the map no controls at all", async () => {
    listMap.mockResolvedValue({
      data: [placement({ id: "m-1", person: person("p-1", "Adaeze Okafor") })],
      meta: meta({ canManage: false, grid: { ...EMPTY_GRID, manage_closely: 1 } }),
    });

    render(<StakeholderMap project={CLIENT_PROJECT} />);

    expect((await screen.findAllByText("Adaeze Okafor")).length).toBeGreaterThan(0);

    expect(screen.queryByRole("button", { name: /Map somebody/i })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Take Adaeze Okafor off this map/i }),
    ).toBeNull();
  });

  it("offers only people not already on the map, and places the chosen one", async () => {
    listMap.mockResolvedValue({
      data: [placement({ id: "m-1", person: person("p-1", "Adaeze Okafor") })],
      meta: meta({ grid: { ...EMPTY_GRID, manage_closely: 1 } }),
    });
    place.mockResolvedValue({});

    render(<StakeholderMap project={CLIENT_PROJECT} />);

    await userEvent.click(await screen.findByRole("button", { name: /Map somebody/i }));

    const picker = screen.getByLabelText(/^Person$/i);
    const list = await openCombobox(userEvent.setup(), picker);

    /* Adaeze is already placed; offering her again would be a silent upsert. */
    expect(within(list).queryByRole("option", { name: /Adaeze Okafor/ })).toBeNull();

    await userEvent.click(within(list).getByRole("option", { name: /Bello Musa/ }));
    await chooseOption(userEvent.setup(), screen.getByLabelText(/What they are/i), "Decision maker");
    await chooseOption(userEvent.setup(), screen.getByLabelText(/Influence here/i), "High");
    await chooseOption(userEvent.setup(), screen.getByLabelText(/How much they care/i), "Low");

    await userEvent.click(screen.getByRole("button", { name: /Add to map/i }));

    await waitFor(() => expect(place).toHaveBeenCalledTimes(1));

    expect(place).toHaveBeenCalledWith("acme-rebuild", {
      externalStakeholderId: "p-2",
      role: "decision_maker",
      influence: "high",
      interest: "low",
    });
  });

  it("sends only the axis that changed, and never a strategy", async () => {
    listMap.mockResolvedValue({
      data: [placement({ id: "m-1", person: person("p-1", "Adaeze Okafor") })],
      meta: meta({ grid: { ...EMPTY_GRID, manage_closely: 1 } }),
    });
    update.mockResolvedValue({});

    render(<StakeholderMap project={CLIENT_PROJECT} />);

    await chooseOption(userEvent.setup(), await screen.findByLabelText(/Interest of Adaeze Okafor/i), "Interest: Low");

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));

    expect(update).toHaveBeenCalledWith("acme-rebuild", "m-1", { interest: "low" });
  });

  it("moves the primary contact by naming the new one, and offers no way to clear it", async () => {
    listMap.mockResolvedValue({
      data: [
        placement({ id: "m-1", person: person("p-1", "Adaeze Okafor"), isPrimary: true }),
        placement({ id: "m-2", person: person("p-2", "Bello Musa") }),
      ],
      meta: meta({ hasPrimary: true, grid: { ...EMPTY_GRID, manage_closely: 2 } }),
    });
    update.mockResolvedValue({});

    render(<StakeholderMap project={CLIENT_PROJECT} />);

    /* The one who already holds it has no star button to press. */
    expect(
      screen.queryByRole("button", { name: /Make Adaeze Okafor the main contact/i }),
    ).toBeNull();

    await userEvent.click(
      await screen.findByRole("button", { name: /Make Bello Musa the main contact/i }),
    );

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));

    expect(update).toHaveBeenCalledWith("acme-rebuild", "m-2", { isPrimary: true });
  });

  /**
   * Why somebody was judged high influence.
   *
   * Accepted by the API from the first commit and shown nowhere, so the
   * judgement the entire grid rests on had no room for its reasoning.
   */
  it("shows the note recorded against a placement", async () => {
    listMap.mockResolvedValue({
      data: [
        placement({
          id: "m-1",
          person: person("p-1", "Adaeze Okafor"),
          notes: "Signs off the budget, delegates the rest.",
        }),
      ],
      meta: meta({ grid: { ...EMPTY_GRID, manage_closely: 1 } }),
    });

    render(<StakeholderMap project={CLIENT_PROJECT} />);

    expect(
      await screen.findByText("Signs off the budget, delegates the rest."),
    ).toBeInTheDocument();
  });

  it("writes a note, and clears it as a deliberate null", async () => {
    listMap.mockResolvedValue({
      data: [placement({ id: "m-1", person: person("p-1", "Adaeze Okafor"), notes: "Old" })],
      meta: meta({ grid: { ...EMPTY_GRID, manage_closely: 1 } }),
    });
    update.mockResolvedValue({});

    render(<StakeholderMap project={CLIENT_PROJECT} />);

    await userEvent.click(
      await screen.findByRole("button", { name: /Note on Adaeze Okafor/i }),
    );

    const box = screen.getByLabelText(/Stakeholder note/i);

    expect(box).toHaveValue("Old");

    await userEvent.clear(box);
    await userEvent.type(box, "Delegates everything but the budget");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));

    expect(update).toHaveBeenCalledWith("acme-rebuild", "m-1", {
      notes: "Delegates everything but the budget",
    });

    /* Emptied means deleted, which the API tells apart from "I sent nothing". */
    await userEvent.click(
      await screen.findByRole("button", { name: /Note on Adaeze Okafor/i }),
    );
    await userEvent.clear(screen.getByLabelText(/Stakeholder note/i));
    await userEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));

    expect(update).toHaveBeenLastCalledWith("acme-rebuild", "m-1", { notes: null });
  });

  it("carries a note when somebody is first put on the map", async () => {
    listMap.mockResolvedValue({ data: [], meta: meta() });
    place.mockResolvedValue({});

    render(<StakeholderMap project={CLIENT_PROJECT} />);

    await userEvent.click(await screen.findByRole("button", { name: /Map somebody/i }));

    await chooseOption(userEvent.setup(), screen.getByLabelText(/^Person$/i), "Adaeze Okafor");
    await userEvent.type(
      screen.getByLabelText(/Why \(optional\)/i),
      "Signs off the budget",
    );
    await userEvent.click(screen.getByRole("button", { name: /Add to map/i }));

    await waitFor(() => expect(place).toHaveBeenCalledTimes(1));

    expect(place).toHaveBeenCalledWith("acme-rebuild", {
      externalStakeholderId: "p-1",
      role: "contact",
      influence: "medium",
      interest: "medium",
      notes: "Signs off the budget",
    });
  });

  it("sends people to the company page when there is nobody left to map", async () => {
    getCompany.mockResolvedValue({ ...COMPANY, stakeholders: [] });
    listMap.mockResolvedValue({ data: [], meta: meta() });

    render(<StakeholderMap project={CLIENT_PROJECT} />);

    expect(await screen.findByText(/Nobody mapped yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Add people at Acme first/i })).toHaveAttribute(
      "href",
      "/suite/projects/companies",
    );
  });

  it("does not offer somebody who has left the company", async () => {
    getCompany.mockResolvedValue({
      ...COMPANY,
      stakeholders: [
        person("p-1", "Adaeze Okafor"),
        { ...person("p-9", "Gone Already"), isActive: false },
      ],
    });
    listMap.mockResolvedValue({ data: [], meta: meta() });

    render(<StakeholderMap project={CLIENT_PROJECT} />);

    await userEvent.click(await screen.findByRole("button", { name: /Map somebody/i }));

    const list = await openCombobox(userEvent.setup(), screen.getByLabelText(/^Person$/i));
    expect(within(list).getByRole("option", { name: /Adaeze Okafor/ })).toBeInTheDocument();
    expect(within(list).queryByRole("option", { name: /Gone Already/ })).toBeNull();
  });
});
