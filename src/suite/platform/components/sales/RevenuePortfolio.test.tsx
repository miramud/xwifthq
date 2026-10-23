import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import PlatformInsightsPage from "./RevenuePortfolio";

/**
 * The platform owner's portfolio.
 *
 * Three things carry their weight here. The page must refuse an institution
 * admin rather than render an empty shell — this is the one report that adds
 * every tenant together. "Unlimited seats" and "no seats used" must not read
 * alike. And the concentration bar has to state the leader's share in words,
 * because a coloured bar alone is unreadable to anyone using a screen reader
 * and ambiguous to everyone else.
 */

let currentUser: Record<string, unknown> | null = { role: "super_admin", organisationId: null };

// DataView reads the router to open rows; the test has no app router mounted.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/platform/portfolio",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: currentUser, loading: false }),
  AuthError: class extends Error {},
}));

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<unknown>>();

function row(over: Record<string, unknown> = {}) {
  return {
    id: "org-1",
    name: "Acme Institute",
    slug: "acme-institute",
    status: "active",
    isMarketplace: false,
    seatLimit: 100,
    seatsUsed: 40,
    seatUtilisation: 40,
    students: 35,
    instructors: 4,
    admins: 1,
    publishedCourses: 8,
    totalCourses: 11,
    activeEnrollments: 120,
    completions: 30,
    completionRate: 20,
    grossRevenue: 900_000,
    netRevenue: 850_000,
    refunds: 50_000,
    lastActiveAt: "2026-08-09T09:00:00+00:00",
    ...over,
  };
}

const PORTFOLIO = {
  data: {
    totals: {
      organisations: 2,
      activeOrganisations: 2,
      suspendedOrganisations: 0,
      seatsSold: 100,
      seatsUsed: 40,
      unlimitedOrganisations: 1,
      grossRevenue: 1_000_000,
      netRevenue: 950_000,
      marketplaceRevenue: 100_000,
      institutionRevenue: 900_000,
      topTenantShare: 90,
      learners: 35,
      instructors: 4,
      publishedCourses: 8,
      platformFeePercent: 30,
    },
    organisations: [
      row(),
      row({
        id: null,
        name: "Public marketplace",
        slug: null,
        isMarketplace: true,
        seatLimit: null,
        seatUtilisation: null,
        seatsUsed: 0,
        grossRevenue: 100_000,
        netRevenue: 100_000,
      }),
    ],
    monthly: Array.from({ length: 12 }, (_, i) => ({
      key: `2026-${String(i + 1).padStart(2, "0")}`,
      month: "Jan",
      marketplace: 1000,
      institutions: 9000,
    })),
    attention: [
      {
        id: "org-2",
        name: "Globex Academy",
        slug: "globex-academy",
        reasons: [
          { kind: "seats", detail: "Using 49 of 50 seats" },
          { kind: "quiet", detail: "No enrollment activity since Jul 1, 2026" },
        ],
      },
    ],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { role: "super_admin", organisationId: null };
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => PORTFOLIO });
  vi.stubGlobal("fetch", fetchMock);
});

describe("PlatformInsightsPage — access", () => {
  it("refuses an institution admin instead of rendering an empty report", () => {
    currentUser = { role: "admin", organisationId: "org-1" };

    render(<PlatformInsightsPage />);

    expect(screen.getByText(/this report is the platform owner's/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("PlatformInsightsPage — concentration", () => {
  /** The one number no per-tenant dashboard can produce. */
  it("says in words how much of the platform rests on one customer", async () => {
    render(<PlatformInsightsPage />);

    // The name also appears in the legend and the table, and the sentence is
    // split across spans — so it is matched on the paragraph's whole text.
    const sentence = await screen.findByText(
      (_, el) =>
        el?.tagName === "P" &&
        /Acme Institute is 90% of platform revenue/.test(el.textContent ?? ""),
    );

    expect(sentence).toBeInTheDocument();
  });

  it("describes the split for a screen reader, not only in colour", async () => {
    render(<PlatformInsightsPage />);

    expect(
      await screen.findByRole("img", { name: /acme institute: 90 percent/i }),
    ).toBeInTheDocument();
  });
});

describe("PlatformInsightsPage — the portfolio table", () => {
  /** "Unlimited" and "using none of them" are different facts. */
  it("shows an uncapped row as unlimited rather than as zero percent", async () => {
    render(<PlatformInsightsPage />);

    const table = await screen.findByRole("table", { name: "Portfolio" });
    const marketplace = within(table).getByText("Public marketplace").closest("tr");

    expect(marketplace).not.toBeNull();
    expect(within(marketplace as HTMLElement).getByText("—")).toBeInTheDocument();
  });

  it("links an institution through to its own console page", async () => {
    render(<PlatformInsightsPage />);

    const table = await screen.findByRole("table", { name: "Portfolio" });
    const link = within(table).getByRole("link", { name: "Acme Institute" });

    expect(link).toHaveAttribute("href", "/suite/platform/organisations/acme-institute");
  });
});

describe("PlatformInsightsPage — what needs a look", () => {
  it("lists each reason verbatim rather than rolling them into a score", async () => {
    render(<PlatformInsightsPage />);

    expect(await screen.findByText("Using 49 of 50 seats")).toBeInTheDocument();
    expect(screen.getByText(/no enrollment activity since jul 1, 2026/i)).toBeInTheDocument();
  });

  it("says so plainly when nothing needs the owner", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { ...PORTFOLIO.data, attention: [] } }),
    });

    render(<PlatformInsightsPage />);

    expect(await screen.findByText(/nothing needs you/i)).toBeInTheDocument();
  });
});

describe("PlatformInsightsPage — failure", () => {
  it("offers a retry rather than an empty report", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "Insights are unavailable." }),
    });

    render(<PlatformInsightsPage />);

    expect(await screen.findByText("Insights are unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});

describe("PlatformInsightsPage — a brand-new platform", () => {
  it("explains an empty concentration bar instead of drawing nothing", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          ...PORTFOLIO.data,
          organisations: [row({ grossRevenue: 0, netRevenue: 0 })],
          totals: { ...PORTFOLIO.data.totals, topTenantShare: 0 },
        },
      }),
    });

    render(<PlatformInsightsPage />);

    expect(await screen.findByText(/no revenue yet/i)).toBeInTheDocument();
  });
});
