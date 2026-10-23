import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import VerifiedResult from "./VerifiedResult";
import type { CertificateData } from "@/suite/lms/lib/certificate";

/**
 * What a stranger is told when they type a serial into the verify page.
 *
 * There are three answers and the middle one is why this file exists. A
 * **revoked** certificate was taken back by the institution — something went
 * wrong, and the red banner is correct. An **expired** one was earned properly
 * and has run its term, which is the ordinary end of every annual
 * qualification.
 *
 * Showing the revocation banner for an expired certificate would tell an
 * employer, in as many words, that this person had their credential withdrawn.
 * That is a false statement about somebody, made to the one audience most
 * likely to act on it, so the tests here are mostly about keeping those two
 * words apart.
 */

vi.mock("./Confetti", () => ({ default: () => <div data-testid="confetti" /> }));

vi.mock("./CertificateCard", () => ({
  default: () => <div data-testid="certificate-card" />,
}));

const BASE: CertificateData = {
  serial: "TT-2026-AB12CD",
  recipientName: "Ada Lovelace",
  courseTitle: "Fire Safety",
  instructorName: "Trainer",
  issuedAt: "2025-01-10T09:00:00+00:00",
  expiresAt: "2026-01-10T09:00:00+00:00",
  expires: true,
  expired: false,
  daysUntilExpiry: 120,
  valid: true,
  cycle: 1,
  revoked: false,
  revokedAt: null,
  courseSlug: "fire-safety",
  verifyUrl: "https://example.test/verify/TT-2026-AB12CD",
  template: {
    orgName: "Northgate Health Trust",
    signatoryName: "Northgate Health Trust",
    signatoryTitle: "Director of Learning",
    accentColor: "#0ea5e9",
    logoUrl: null,
  },
};

function give(overrides: Partial<CertificateData> = {}) {
  return { ...BASE, ...overrides };
}

describe("a certificate that is still good", () => {
  it("says it is verified and celebrates", () => {
    render(<VerifiedResult cert={give()} />);

    expect(screen.getByText("Certificate verified")).toBeInTheDocument();
    expect(screen.getByTestId("confetti")).toBeInTheDocument();
  });

  /* Worth saying on a live one too: it tells the verifier when to look again. */
  it("says how long it remains valid when it has a term", () => {
    render(<VerifiedResult cert={give()} />);

    expect(
      screen.getByText(/It is valid until January 10, 2026\./),
    ).toBeInTheDocument();
  });

  it("says nothing about expiry when it never expires", () => {
    render(
      <VerifiedResult
        cert={give({ expiresAt: null, expires: false, daysUntilExpiry: null })}
      />,
    );

    expect(screen.getByText("Certificate verified")).toBeInTheDocument();
    expect(screen.queryByText(/valid until/)).not.toBeInTheDocument();
  });
});

describe("a certificate that has expired", () => {
  const expired = give({ expired: true, valid: false, daysUntilExpiry: -256 });

  /* The whole point. */
  it("is never described as revoked", () => {
    render(<VerifiedResult cert={expired} />);

    expect(screen.getByText("This certificate has expired")).toBeInTheDocument();
    expect(
      screen.queryByText("This certificate was revoked"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/has since been revoked/)).not.toBeInTheDocument();
  });

  /*
    Order matters in the sentence. Somebody checking this needs to know the
    credential was real before they are told it lapsed, because the first
    clause is the one that gets read.
  */
  it("says the credential is genuine before saying it lapsed", () => {
    render(<VerifiedResult cert={expired} />);

    expect(
      screen.getByText(/This is a genuine Northgate Health Trust credential/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/It has since expired and would need renewing\./),
    ).toBeInTheDocument();
  });

  it("names the date it was good until", () => {
    render(<VerifiedResult cert={expired} />);

    expect(
      screen.getByText(/valid until January 10, 2026/),
    ).toBeInTheDocument();
  });

  /* Lapsing is not an achievement. */
  it("does not celebrate", () => {
    render(<VerifiedResult cert={expired} />);

    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument();
  });
});

describe("a certificate that was revoked", () => {
  it("still says revoked, and says it plainly", () => {
    render(
      <VerifiedResult
        cert={give({
          revoked: true,
          revokedAt: "2026-02-01T09:00:00+00:00",
          valid: false,
        })}
      />,
    );

    expect(screen.getByText("This certificate was revoked")).toBeInTheDocument();
    expect(screen.getByText(/no longer valid/)).toBeInTheDocument();
  });

  /*
    A certificate can be both revoked and past its date. Revocation is the more
    serious fact and the one a verifier has to be told, so it wins.
  */
  it("outranks expiry when it is both", () => {
    render(
      <VerifiedResult
        cert={give({
          revoked: true,
          revokedAt: "2026-02-01T09:00:00+00:00",
          expired: true,
          valid: false,
        })}
      />,
    );

    expect(screen.getByText("This certificate was revoked")).toBeInTheDocument();
    expect(
      screen.queryByText("This certificate has expired"),
    ).not.toBeInTheDocument();
  });

  it("does not celebrate", () => {
    render(<VerifiedResult cert={give({ revoked: true, valid: false })} />);

    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument();
  });
});
