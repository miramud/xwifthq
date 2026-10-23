import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyCertificatesPage from "./page";
import type { CertificateData } from "@/suite/lms/lib/certificate";

/**
 * What the learner has earned.
 *
 * `GET /me/certificates` had no caller: a learner could verify a serial
 * somebody handed them and had no way to see their own. The person who needs
 * the list is the holder, at the moment a registrar asks them to evidence
 * their training — so this page is built for revalidation, and what it has to
 * get right follows from that.
 *
 * **Order is by what needs doing, not by date earned.** Somebody with fourteen
 * certificates and one lapsing in a fortnight needs that one first. Sorting by
 * issue date buries it.
 *
 * **Expired is not revoked.** Expired means it was earned properly and has run
 * its term; revoked means the institution took it back. A single "invalid"
 * would accuse somebody of something.
 */

let currentUser: Record<string, unknown> | null = { role: "user", name: "Ada" };

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: currentUser, loading: false, refresh: vi.fn() }),
  AuthError: class extends Error {},
}));

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<unknown>>();

function cert(overrides: Partial<CertificateData> = {}): CertificateData {
  return {
    serial: "ELV-0001",
    recipientName: "Ada Lovelace",
    courseTitle: "Fire Safety",
    instructorName: "R. Hughes",
    issuedAt: "2026-01-15T10:00:00+00:00",
    expiresAt: null,
    expires: false,
    expired: false,
    daysUntilExpiry: null,
    valid: true,
    cycle: 1,
    revoked: false,
    revokedAt: null,
    courseSlug: "fire-safety",
    verifyUrl: "https://example.test/verify/ELV-0001",
    template: {
      orgName: "St Anne's Trust",
      signatoryName: "St Anne's Trust",
      signatoryTitle: "Director of Learning",
      accentColor: "#0c4f54",
      logoUrl: null,
    },
    ...overrides,
  };
}

function respond(certificates: CertificateData[]) {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ certificates }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { role: "user", name: "Ada" };
  respond([cert()]);
  vi.stubGlobal("fetch", fetchMock);
});

describe("access", () => {
  it("asks a signed-out visitor to sign in rather than loading anything", () => {
    currentUser = null;

    render(<MyCertificatesPage />);

    expect(screen.getByText(/Log in to see the certificates/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the list", () => {
  it("reads the learner's own certificates", async () => {
    render(<MyCertificatesPage />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/me/certificates",
        expect.anything(),
      ),
    );

    expect(await screen.findByText("Fire Safety")).toBeInTheDocument();
  });

  /* The serial is the thing a registrar asks for. */
  it("shows the serial", async () => {
    render(<MyCertificatesPage />);

    expect(await screen.findByText("ELV-0001")).toBeInTheDocument();
  });

  it("tells a learner with none what would put one here", async () => {
    respond([]);

    render(<MyCertificatesPage />);

    expect(await screen.findByText("No certificates yet")).toBeInTheDocument();
    expect(screen.getByText(/Finishing a course that awards one/)).toBeInTheDocument();
  });
});

describe("what needs attention comes first", () => {
  /*
    The ordering is the whole design. A list sorted by date earned puts the
    one certificate somebody has to act on wherever it happens to fall.
  */
  it("puts a lapsed certificate above an in-date one, whatever the dates", async () => {
    respond([
      cert({ serial: "NEW", courseTitle: "In date", issuedAt: "2026-09-01T00:00:00+00:00" }),
      cert({
        serial: "OLD",
        courseTitle: "Lapsed one",
        issuedAt: "2024-01-01T00:00:00+00:00",
        expires: true,
        expired: true,
        valid: false,
        expiresAt: "2025-01-01T00:00:00+00:00",
        daysUntilExpiry: -600,
      }),
    ]);

    render(<MyCertificatesPage />);

    const headings = await screen.findAllByRole("heading", { level: 2 });

    expect(headings[0]).toHaveTextContent("Lapsed one");
    expect(headings[1]).toHaveTextContent("In date");
  });

  it("orders two expiring certificates by which goes first", async () => {
    respond([
      cert({
        serial: "LATER",
        courseTitle: "Later",
        expires: true,
        expiresAt: "2026-11-20T00:00:00+00:00",
        daysUntilExpiry: 50,
      }),
      cert({
        serial: "SOONER",
        courseTitle: "Sooner",
        expires: true,
        expiresAt: "2026-10-05T00:00:00+00:00",
        daysUntilExpiry: 4,
      }),
    ]);

    render(<MyCertificatesPage />);

    const headings = await screen.findAllByRole("heading", { level: 2 });

    expect(headings[0]).toHaveTextContent("Sooner");
    expect(headings[1]).toHaveTextContent("Later");
  });

  it("counts what is lapsing once at the top", async () => {
    respond([
      cert({ serial: "A", expires: true, expiresAt: "2026-10-05T00:00:00+00:00", daysUntilExpiry: 4 }),
      cert({
        serial: "B",
        expires: true,
        expired: true,
        valid: false,
        expiresAt: "2025-10-05T00:00:00+00:00",
        daysUntilExpiry: -350,
      }),
      cert({ serial: "C" }),
    ]);

    render(<MyCertificatesPage />);

    expect(
      await screen.findByText(/2 certificates have lapsed or are close to it/),
    ).toBeInTheDocument();
  });

  it("says nothing at the top when everything is in date", async () => {
    render(<MyCertificatesPage />);

    await screen.findByText("Fire Safety");

    expect(screen.queryByText(/lapsed or is close to it/)).not.toBeInTheDocument();
  });
});

describe("expired is not revoked", () => {
  it("says an expired certificate ran out, and how to get another", async () => {
    respond([
      cert({
        expires: true,
        expired: true,
        valid: false,
        expiresAt: "2026-03-01T00:00:00+00:00",
        daysUntilExpiry: -204,
      }),
    ]);

    render(<MyCertificatesPage />);

    expect(await screen.findByText("Out of date")).toBeInTheDocument();
    expect(screen.getByText(/Take the course again/)).toBeInTheDocument();
    expect(screen.queryByText("Withdrawn")).not.toBeInTheDocument();
  });

  /*
    Revoked is the institution's act, not the holder's lapse. The wording has
    to leave room for it being a mistake.
  */
  it("says a revoked certificate was withdrawn, and by whom", async () => {
    respond([
      cert({
        valid: false,
        revoked: true,
        revokedAt: "2026-06-01T00:00:00+00:00",
      }),
    ]);

    render(<MyCertificatesPage />);

    expect(await screen.findByText("Withdrawn")).toBeInTheDocument();
    expect(screen.getByText(/Withdrawn by the institution/)).toBeInTheDocument();
    expect(screen.getByText(/if you think that is wrong/)).toBeInTheDocument();
  });

  it("says plainly when a certificate never expires", async () => {
    render(<MyCertificatesPage />);

    expect(await screen.findByText("Does not expire.")).toBeInTheDocument();
  });

  it("prints both the date and the countdown for one still in date", async () => {
    respond([
      cert({
        expires: true,
        expiresAt: "2027-03-14T00:00:00+00:00",
        daysUntilExpiry: 174,
      }),
    ]);

    render(<MyCertificatesPage />);

    expect(await screen.findByText(/March 14, 2027/)).toBeInTheDocument();
    expect(screen.getByText(/174 days left/)).toBeInTheDocument();
  });
});

describe("showing it to somebody", () => {
  it("links to the verification page rather than offering a screenshot", async () => {
    render(<MyCertificatesPage />);

    expect(
      await screen.findByRole("link", { name: /Verification page/ }),
    ).toHaveAttribute("href", "/verify/ELV-0001");
  });

  it("opens the document itself", async () => {
    render(<MyCertificatesPage />);

    await userEvent.click(await screen.findByRole("button", { name: "View" }));

    expect(screen.getByLabelText("Close certificate")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  /*
    A withdrawn certificate still renders. Hiding it would leave somebody
    unable to see the thing they are being told about.
  */
  it("shows a withdrawn certificate, and says so under it", async () => {
    respond([cert({ valid: false, revoked: true })]);

    render(<MyCertificatesPage />);

    await userEvent.click(await screen.findByRole("button", { name: "View" }));

    expect(screen.getByText(/has been withdrawn/)).toBeInTheDocument();
  });

  /* A third annual renewal is a better record than a first, and only the
     certificate carries that fact. */
  it("names which round of recurring training a renewal is", async () => {
    respond([cert({ cycle: 3 })]);

    render(<MyCertificatesPage />);

    expect(await screen.findByText("3rd issue")).toBeInTheDocument();
  });

  it("says nothing about the round on a first issue", async () => {
    render(<MyCertificatesPage />);

    await screen.findByText("Fire Safety");

    expect(screen.queryByText(/issue$/)).not.toBeInTheDocument();
  });
});
