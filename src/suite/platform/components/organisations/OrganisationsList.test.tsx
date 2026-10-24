import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrganisationsPage from "./OrganisationsList";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import type { Organisation } from "@/lib/api/saas-client";

/**
 * Tenant management. Two things here carry real consequence: the seat meter,
 * which is the commercial constraint, and the fact that removing a tenant
 * suspends rather than deletes it.
 */

const listOrgs = vi.fn<() => Promise<Organisation[]>>();
const suspendOrg = vi.fn();
const reactivateOrg = vi.fn();

// DataView reads the router to open rows; the test has no app router mounted.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/platform/organisations",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/saas-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/saas-client")>();

  return {
    ...actual,
    organisations: {
      list: () => listOrgs(),
      suspend: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
    },
  };
});

// Suspension moved to the platform API: POST …/suspend and …/reactivate.
// DELETE on an organisation now means "move it to the recycle bin".
vi.mock("@/lib/api/platform-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/platform-client")>();

  return {
    ...actual,
    platformOrganisations: {
      ...actual.platformOrganisations,
      suspend: (slug: string) => suspendOrg(slug),
      reactivate: (slug: string) => reactivateOrg(slug),
    },
    platformModules: { list: () => Promise.resolve([]), setEnabled: vi.fn() },
  };
});

let currentRole = "super_admin";

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { role: currentRole, name: "Owner" }, loading: false }),
}));

function org(overrides: Partial<Organisation> = {}): Organisation {
  return {
    id: "org-1",
    name: "Acme Institute",
    slug: "acme-institute",
    contactEmail: "ops@acme.test",
    contactPhone: null,
    whatsappNumber: null,
    description: null,
    logoUrl: null,
    accentColor: null,
    status: "active",
    seatLimit: null,
    seatPrice: null,
    billingPeriod: null,
    currentPeriodEnd: null,
    licenceStatus: "unbilled",
    graceDaysOverride: null,
    graceDays: 14,
    seatsUsed: 12,
    studentCount: 10,
    instructorCount: 2,
    courseCount: 5,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "super_admin";
});

describe("OrganisationsPage: access", () => {
  /** The API refuses them anyway; this stops the page pretending otherwise. */
  it("tells an institution admin this is not their console", () => {
    currentRole = "admin";

    render(<OrganisationsPage />, { wrapper: ConfirmProvider });

    expect(screen.getByText(/not available for your account/i)).toBeInTheDocument();
    expect(listOrgs).not.toHaveBeenCalled();
  });
});

describe("OrganisationsPage: the roster", () => {
  it("lists tenants with their member counts", async () => {
    listOrgs.mockResolvedValue([org()]);

    render(<OrganisationsPage />, { wrapper: ConfirmProvider });

    expect(await screen.findByText("Acme Institute")).toBeInTheDocument();
    expect(screen.getByText("10 learners")).toBeInTheDocument();
    expect(screen.getByText("2 instructors")).toBeInTheDocument();
  });

  it("totals learners and courses across every tenant", async () => {
    listOrgs.mockResolvedValue([
      org({ id: "a", slug: "a", name: "Acme", studentCount: 10, courseCount: 5 }),
      org({ id: "b", slug: "b", name: "Globex", studentCount: 7, courseCount: 3 }),
    ]);

    render(<OrganisationsPage />, { wrapper: ConfirmProvider });

    await screen.findByText("Acme");

    // 10 + 7 learners, 5 + 3 courses.
    expect(screen.getByText("17")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("filters by name", async () => {
    listOrgs.mockResolvedValue([
      org({ id: "a", slug: "a", name: "Acme Institute" }),
      org({ id: "b", slug: "b", name: "Globex Academy" }),
    ]);

    render(<OrganisationsPage />, { wrapper: ConfirmProvider });

    await screen.findByText("Acme Institute");
    await userEvent.type(screen.getByRole("searchbox"), "globex");

    expect(screen.getByText("Globex Academy")).toBeInTheDocument();
    expect(screen.queryByText("Acme Institute")).not.toBeInTheDocument();
  });

  it("explains the empty state", async () => {
    listOrgs.mockResolvedValue([]);

    render(<OrganisationsPage />, { wrapper: ConfirmProvider });

    expect(await screen.findByText(/no organisations yet/i)).toBeInTheDocument();
  });
});

describe("OrganisationsPage: seats", () => {
  /**
   * Seats are the commercial constraint, so the meter has to be readable by
   * anyone, including through a screen reader, which cannot see the bar.
   */
  it("exposes usage against the limit as an accessible progress value", async () => {
    listOrgs.mockResolvedValue([org({ seatsUsed: 198, seatLimit: 200 })]);

    render(<OrganisationsPage />, { wrapper: ConfirmProvider });

    const meter = await screen.findByRole("progressbar");

    expect(meter).toHaveAttribute("aria-valuenow", "198");
    expect(meter).toHaveAttribute("aria-valuemax", "200");
    expect(meter).toHaveAccessibleName("198 of 200 seats used");
  });

  it("shows a plain count when there is no limit", async () => {
    listOrgs.mockResolvedValue([org({ seatsUsed: 12, seatLimit: null })]);

    render(<OrganisationsPage />, { wrapper: ConfirmProvider });

    expect(await screen.findByText("seats used")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

describe("OrganisationsPage: suspending", () => {
  /**
   * The list suspends; deleting a tenant (to the recycle bin) lives on its
   * own page. The row control must call suspend and say "Suspend".
   */
  it("suspends rather than deletes", async () => {
    listOrgs.mockResolvedValue([org()]);
    suspendOrg.mockResolvedValue(org({ status: "suspended" }));

    render(<OrganisationsPage />, { wrapper: ConfirmProvider });

    await screen.findByText("Acme Institute");

    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /suspend/i }));
    expect(suspendOrg).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("alertdialog", { name: "Suspend Acme Institute?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Suspend organisation" }));

    expect(suspendOrg).toHaveBeenCalledWith("acme-institute");
    // The row now offers the way back, which only a suspended tenant has.
    expect(await screen.findByRole("button", { name: /reactivate/i })).toBeInTheDocument();
  });

  it("reactivates a suspended tenant", async () => {
    listOrgs.mockResolvedValue([org({ status: "suspended" })]);
    reactivateOrg.mockResolvedValue(org({ status: "active" }));

    render(<OrganisationsPage />, { wrapper: ConfirmProvider });

    await userEvent.click(await screen.findByRole("button", { name: /reactivate/i }));

    expect(reactivateOrg).toHaveBeenCalledWith("acme-institute");
  });
});

describe("OrganisationsPage: creating a tenant", () => {
  /** An institution nobody can sign into is not usable. */
  it("offers to provision the first admin in the same step", async () => {
    listOrgs.mockResolvedValue([]);

    render(<OrganisationsPage />, { wrapper: ConfirmProvider });

    await userEvent.click(await screen.findByRole("button", { name: /new organisation/i }));

    expect(screen.getByLabelText(/admin email/i)).toBeInTheDocument();
    expect(screen.getByText(/nobody at this institution can sign in yet/i)).toBeInTheDocument();
  });

  it("will not submit until the admin fields are complete", async () => {
    listOrgs.mockResolvedValue([]);

    render(<OrganisationsPage />, { wrapper: ConfirmProvider });

    await userEvent.click(await screen.findByRole("button", { name: /new organisation/i }));

    const submit = screen.getByRole("button", { name: /create organisation/i });

    await userEvent.type(screen.getByLabelText(/institution name/i), "Acme Institute");
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/admin name/i), "Acme Admin");
    await userEvent.type(screen.getByLabelText(/admin email/i), "admin@acme.test");
    await userEvent.type(screen.getByLabelText(/temporary password/i), "first-admin-1");

    expect(submit).toBeEnabled();
  });

  it("can create a tenant without an admin once that is unticked", async () => {
    listOrgs.mockResolvedValue([]);

    render(<OrganisationsPage />, { wrapper: ConfirmProvider });

    await userEvent.click(await screen.findByRole("button", { name: /new organisation/i }));
    await userEvent.type(screen.getByLabelText(/institution name/i), "Later Admin Ltd");
    await userEvent.click(screen.getByRole("checkbox", { name: /create their first admin/i }));

    expect(screen.queryByLabelText(/admin email/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create organisation/i })).toBeEnabled();
  });
});
