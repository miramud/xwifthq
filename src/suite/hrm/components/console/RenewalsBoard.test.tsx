import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RenewalsBoard from "./RenewalsBoard";
import type { ExpiringDocument } from "@/lib/api/hrm-client";

// DataView reads the router to open rows; there is no app router in jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/hrm",
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * Registrations and visas coming up for renewal.
 *
 * One distinction carries this screen and the tests are mostly about it:
 * **expired and blocking is not the same as expiring**. A lapsed nursing
 * registration on somebody rostered tomorrow is a shift the institution cannot
 * defend. A visa with eleven weeks left is ordinary administration. A board
 * that merges them puts the urgent row ninth in a table nobody finishes.
 *
 * The other thing pinned here is what the empty state says. "Nothing to renew"
 * on its own reads as "nobody has documents", and the difference matters when
 * the true answer is that nothing on file carries an expiry date at all.
 */

const { expiringDocuments } = vi.hoisted(() => ({
  expiringDocuments: vi.fn(),
}));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return { ...actual, hrm: { employees: { expiringDocuments } } };
});

const DOC: ExpiringDocument = {
  id: "d-1",
  employeeId: "e-1",
  name: "Ada Lovelace",
  jobTitle: "Ward Sister",
  kind: "certification",
  kindLabel: "Certification",
  title: "NMC registration",
  reference: "NMC-88117",
  issuer: "NMC",
  issuedOn: "2023-10-01",
  expiresOn: "2026-10-20",
  expires: true,
  hasExpired: false,
  daysUntilExpiry: 30,
  needsRenewing: true,
  blocksWork: false,
  isVerified: true,
  verifiedAt: "2023-10-05",
  fileName: null,
  note: null,
};

function give(rows: ExpiringDocument[], blockingWork = 0) {
  expiringDocuments.mockResolvedValue({ data: rows, meta: { blockingWork } });
}

beforeEach(() => {
  vi.clearAllMocks();
  give([]);
});

describe("the lapsed ones", () => {
  /*
    The header exists so that the one row that cannot wait is read before
    anybody starts scrolling. It is a rostering problem, not a filing one.
  */
  it("says people cannot be rostered rather than reporting a count", async () => {
    give([{ ...DOC, hasExpired: true, blocksWork: true, daysUntilExpiry: -6 }], 1);

    render(<RenewalsBoard />);

    expect(
      await screen.findByText("1 person cannot be rostered"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/cannot defend/),
    ).toBeInTheDocument();
  });

  it("keeps no header at all when nothing has lapsed", async () => {
    give([DOC], 0);

    render(<RenewalsBoard />);

    await screen.findByText("Ada Lovelace");

    expect(screen.queryByText(/cannot be rostered/)).not.toBeInTheDocument();
  });

  /*
    "Expired" and "cannot work" are different answers. A lapsed first-aid
    certificate is a chase; a lapsed registration is somebody off the rota
    today, and only `blocksWork` tells them apart.
  */
  it("distinguishes expired from expired-and-blocking", async () => {
    give(
      [
        { ...DOC, id: "d-1", hasExpired: true, blocksWork: true, daysUntilExpiry: -6 },
        {
          ...DOC,
          id: "d-2",
          title: "First aid certificate",
          hasExpired: true,
          blocksWork: false,
          daysUntilExpiry: -2,
        },
      ],
      1,
    );

    render(<RenewalsBoard />);

    expect(await screen.findByText("Cannot work")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("puts a blocking document above one that is merely expiring", async () => {
    give(
      [
        { ...DOC, id: "d-2", title: "Right to work", name: "Grace Hopper" },
        {
          ...DOC,
          id: "d-1",
          name: "Ada Lovelace",
          hasExpired: true,
          blocksWork: true,
          daysUntilExpiry: -6,
        },
      ],
      1,
    );

    render(<RenewalsBoard />);

    await screen.findByText("Ada Lovelace");

    const names = screen.getAllByRole("link").map((el) => el.textContent);

    expect(names).toEqual(["Ada Lovelace", "Grace Hopper"]);
  });
});

describe("the window", () => {
  it("asks for 60 days unless told otherwise", async () => {
    render(<RenewalsBoard />);

    await waitFor(() => expect(expiringDocuments).toHaveBeenCalledWith(60));
  });

  it("refetches rather than filtering what it already has", async () => {
    render(<RenewalsBoard />);

    await screen.findByText("Nothing to renew");
    await userEvent.click(screen.getByRole("button", { name: "90d" }));

    await waitFor(() => expect(expiringDocuments).toHaveBeenCalledWith(90));
  });
});

describe("when there is nothing to renew", () => {
  /*
    "Nothing to renew" alone reads as "nobody has documents". The hint is what
    distinguishes a clean register from a register full of things that simply
    never expire.
  */
  it("explains that documents without an expiry never appear", async () => {
    render(<RenewalsBoard />);

    expect(await screen.findByText("Nothing to renew")).toBeInTheDocument();
    expect(
      screen.getByText(/Documents with no expiry/),
    ).toBeInTheDocument();
  });
});

describe("a row", () => {
  it("links to the person, because the next step is on their record", async () => {
    give([DOC]);

    render(<RenewalsBoard />);

    expect(await screen.findByRole("link", { name: "Ada Lovelace" })).toHaveAttribute(
      "href",
      "/suite/hrm/people/e-1",
    );
  });

  /* Chasing a renewal for a document nobody checked is chasing a claim. */
  it("marks a document nobody has verified", async () => {
    give([{ ...DOC, isVerified: false, verifiedAt: null }]);

    render(<RenewalsBoard />);

    expect(await screen.findByText("Unverified")).toBeInTheDocument();
  });
});
