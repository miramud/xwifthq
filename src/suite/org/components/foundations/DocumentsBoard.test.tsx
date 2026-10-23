import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DocumentsBoard from "./DocumentsBoard";
import { ApiError, type IssuedDocument } from "@/lib/api/org-foundations-client";

/** Issued documents: listed with their fingerprint, revoked only with a reason. */

const api = vi.hoisted(() => ({ list: vi.fn(), revoke: vi.fn() }));

vi.mock("@/lib/api/org-foundations-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/org-foundations-client")>();
  return { ...actual, orgFoundations: { ...actual.orgFoundations, documents: api } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org/documents",
  useSearchParams: () => new URLSearchParams(),
}));

const SHA = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

const DOCS: IssuedDocument[] = [
  { id: "d-1", kind: "offer_letter", title: "Offer letter — Ada Obi", reference: "HR/MPT/2026/0007", issuedAt: "2026-10-02T09:00:00Z", issuedBy: "Kemi Bello", revokedAt: null, revokeReason: null, sha256: SHA, token: "tok-1" },
  { id: "d-2", kind: "certificate", title: "Certificate — Tunde", reference: null, issuedAt: "2026-08-02T09:00:00Z", issuedBy: null, revokedAt: "2026-09-01T09:00:00Z", revokeReason: "Issued in error", sha256: null, token: "tok-2" },
];

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach((f) => f.mockReset());
  api.list.mockResolvedValue(DOCS);
});

describe("DocumentsBoard", () => {
  it("lists documents with a short fingerprint and their revoked state", async () => {
    render(<DocumentsBoard />);
    const table = await screen.findByRole("table");
    expect(within(table).getByText("HR/MPT/2026/0007")).toBeInTheDocument();
    expect(within(table).getByText(`${SHA.slice(0, 12)}…`)).toBeInTheDocument();
    expect(within(table).getByText(/Revoked 1 Sept? 2026/)).toBeInTheDocument();
    expect(within(table).getByText("Issued in error")).toBeInTheDocument();
    // Nothing to revoke on a revoked document.
    expect(within(table).queryByRole("button", { name: "Actions for Certificate — Tunde" })).not.toBeInTheDocument();
  });

  it("revokes only with a reason, then marks the row revoked", async () => {
    const user = userEvent.setup();
    api.revoke.mockResolvedValue({ id: "d-1", revokedAt: "2026-10-05T09:00:00Z" });
    render(<DocumentsBoard />);

    await user.click(await screen.findByRole("button", { name: "Actions for Offer letter — Ada Obi" }));
    await user.click(await screen.findByRole("menuitem", { name: "Revoke" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(SHA)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Revoke document" }));
    expect(await within(dialog).findByText(/Say why it's being revoked/)).toBeInTheDocument();
    expect(api.revoke).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText("Reason"), "Wrong salary figure");
    await user.click(within(dialog).getByRole("button", { name: "Revoke document" }));
    await waitFor(() => expect(api.revoke).toHaveBeenCalledWith("d-1", "Wrong salary figure"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const table = screen.getByRole("table");
    expect(within(table).getByText("Wrong salary figure")).toBeInTheDocument();
    expect(within(table).getByText(/Revoked 5 Oct 2026/)).toBeInTheDocument();
  });

  it("keeps the dialog open with the API's message when revoking fails", async () => {
    const user = userEvent.setup();
    api.revoke.mockRejectedValue(new ApiError("This document was already revoked.", 422));
    render(<DocumentsBoard />);

    await user.click(await screen.findByRole("button", { name: "Actions for Offer letter — Ada Obi" }));
    await user.click(await screen.findByRole("menuitem", { name: "Revoke" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Reason"), "Duplicate");
    await user.click(within(dialog).getByRole("button", { name: "Revoke document" }));
    expect(await within(dialog).findByText("This document was already revoked.")).toBeInTheDocument();
  });

  it("filters to revoked documents", async () => {
    const user = userEvent.setup();
    render(<DocumentsBoard />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("radio", { name: "Revoked" }));
    const table = screen.getByRole("table");
    expect(within(table).queryByText("Offer letter — Ada Obi")).not.toBeInTheDocument();
    expect(within(table).getByText("Certificate — Tunde")).toBeInTheDocument();
  });
});
