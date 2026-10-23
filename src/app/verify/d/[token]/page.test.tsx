import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import VerifyDocumentPage from "./page";
import type { VerifiedDocument } from "@/lib/api/documents-server";

/**
 * The public page a document's QR code opens: genuine or revoked, what has
 * been decided since, the fingerprint, and a plain answer for a bad code.
 */

const api = vi.hoisted(() => ({ getVerifiedDocument: vi.fn() }));
vi.mock("@/lib/api/documents-server", () => api);

const TOKEN = "AbCdEfGhIjKlMnOpQrStUv12";

function doc(over: Partial<VerifiedDocument> = {}): VerifiedDocument {
  return {
    valid: true,
    revoked: null,
    kind: "approval_record",
    title: "Buy lab chairs",
    reference: "MEMO-2026-0004",
    issuer: { name: "Meridian Polytechnic", legalName: "Meridian Polytechnic Ltd" },
    issuedAt: "2026-10-05T09:00:00Z",
    issuedBy: "Ada Approver",
    sha256: "a".repeat(64),
    bytes: 18234,
    current: {
      status: "approved",
      completedAt: "2026-10-05T10:00:00Z",
      decisions: [
        { stage: "Head of unit", by: "Bola Bursar", action: "approved", at: "2026-10-05T09:30:00Z" },
        { stage: "Rector", by: "Remi Rector", action: "recommended", at: "2026-10-05T09:45:00Z" },
      ],
    },
    ...over,
  };
}

async function renderPage(token = TOKEN) {
  render(await VerifyDocumentPage({ params: Promise.resolve({ token }) }));
}

beforeEach(() => vi.clearAllMocks());

describe("the document verification page", () => {
  it("says a genuine document is genuine, with its decisions and fingerprint", async () => {
    api.getVerifiedDocument.mockResolvedValue(doc());
    await renderPage();

    expect(api.getVerifiedDocument).toHaveBeenCalledWith(TOKEN);
    expect(screen.getByRole("heading", { name: "This document is genuine" })).toBeInTheDocument();
    expect(screen.getByText("Approval record")).toBeInTheDocument();
    expect(screen.getByText("MEMO-2026-0004")).toBeInTheDocument();
    // "Approved" is both the status now and the first decision.
    expect(screen.getAllByText("Approved")).toHaveLength(2);
    expect(screen.getByText("Bola Bursar", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(screen.getByLabelText(`SHA-256 ${"a".repeat(64)}`)).toBeInTheDocument();
    expect(screen.getByText(/A copy whose fingerprint differs has been altered/)).toBeInTheDocument();
    // No money, ever.
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument();
  });

  it("warns plainly when the document was revoked", async () => {
    api.getVerifiedDocument.mockResolvedValue(doc({ valid: false, revoked: { at: "2026-10-06T09:00:00Z", reason: "Issued in error" } }));
    await renderPage();

    expect(screen.getByText("Revoked")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "This document was withdrawn" })).toBeInTheDocument();
    expect(screen.getByText(/Issued in error/)).toBeInTheDocument();
  });

  it("answers an unknown code with a clear not-found state", async () => {
    api.getVerifiedDocument.mockResolvedValue(null);
    await renderPage("nope");
    expect(screen.getByRole("heading", { name: "No document found for this code" })).toBeInTheDocument();
  });
});
