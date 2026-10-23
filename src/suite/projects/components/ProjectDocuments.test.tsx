import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectDocuments from "./ProjectDocuments";
import { chooseOption } from "@/test/selectOption";
import type { Project, ProjectDocument } from "@/lib/api/projects-client";

/**
 * The files a project keeps.
 *
 * **Sharing has to look like the deliberate act it is.** A project's files are
 * where a rate card and a frank note about the client's own staff end up, so a
 * shared document is visibly marked in the list rather than hidden behind a
 * checkbox, and the upload form says outright that nothing is shared until
 * somebody says so.
 */

const { forProject, upload, update, setShared, remove } = vi.hoisted(() => ({
  forProject: vi.fn(),
  upload: vi.fn(),
  update: vi.fn(),
  setShared: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return { ...actual, documents: { forProject, upload, update, setShared, remove } };
});

/* The documents are a DataView, which reads the router. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/projects/acme",
  useSearchParams: () => new URLSearchParams(),
}));

const PROJECT = { slug: "acme-rebuild", name: "Acme Rebuild" } as unknown as Project;

function doc(over: Partial<ProjectDocument> = {}): ProjectDocument {
  return {
    id: "d-1",
    title: "Signed contract",
    description: null,
    kind: "contract",
    kindLabel: "Contract",
    isShared: false,
    isReadable: true,
    sizeBytes: 40960,
    mime: "application/pdf",
    fileName: "contract.pdf",
    streamUrl: "/api/media/asset-1/stream",
    uploadedBy: "Ada Lead",
    addedOn: "2027-01-04",
    ...over,
  };
}

function listing(rows: ProjectDocument[] = [], canManage = true) {
  return {
    data: rows,
    meta: {
      canManage,
      kinds: [
        { value: "other" as const, label: "Other", hint: "Anything else", sharedByDefault: false },
        {
          value: "report" as const,
          label: "Status report",
          hint: "Written to be sent out",
          sharedByDefault: true,
        },
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProjectDocuments", () => {
  it("says outright when nothing is visible to the client", async () => {
    forProject.mockResolvedValue(listing([doc()]));

    render(<ProjectDocuments project={PROJECT} />);

    expect(
      await screen.findByText("Nothing here is visible to the client"),
    ).toBeInTheDocument();
  });

  it("counts what the client can see", async () => {
    forProject.mockResolvedValue(
      listing([doc({ id: "a", isShared: true }), doc({ id: "b" })]),
    );

    render(<ProjectDocuments project={PROJECT} />);

    expect(await screen.findByText("1 of 2 visible to the client")).toBeInTheDocument();
  });

  /** Visible in the list, not hidden behind a checkbox. */
  it("marks a shared document in the list itself", async () => {
    forProject.mockResolvedValue(listing([doc({ isShared: true })]));

    render(<ProjectDocuments project={PROJECT} />);

    expect(await screen.findByText("Client can see this")).toBeInTheDocument();
  });

  /** The expectation is set before the upload, not discovered after it. */
  it("says nothing uploaded is shared until somebody shares it", async () => {
    forProject.mockResolvedValue(listing());

    render(<ProjectDocuments project={PROJECT} />);

    expect(
      await screen.findByText(/Nothing you upload is visible to the client until you share it/),
    ).toBeInTheDocument();
  });

  it("uploads a file with its title and kind", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(listing());
    upload.mockResolvedValue(doc());

    render(<ProjectDocuments project={PROJECT} />);

    const file = new File(["x"], "contract.pdf", { type: "application/pdf" });

    await user.upload(await screen.findByLabelText("File"), file);
    await user.type(screen.getByLabelText("Title"), "Signed contract");
    await chooseOption(user, screen.getByLabelText("Kind"), "Status report");
    await user.click(screen.getByRole("button", { name: /Upload/ }));

    await waitFor(() =>
      expect(upload).toHaveBeenCalledWith("acme-rebuild", file, {
        title: "Signed contract",
        kind: "report",
        /* P14: a status report starts ticked to share. */
        isShared: true,
      }),
    );
  });

  /** P14: the box follows the kind until somebody touches it. */
  it("pre-ticks sharing for a status report, and the uploader's choice stands", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(listing());
    upload.mockResolvedValue(doc());

    render(<ProjectDocuments project={PROJECT} />);

    const box = await screen.findByRole("checkbox", { name: /Share on the client page/ });
    expect(box).not.toBeChecked();

    await chooseOption(user, screen.getByLabelText("Kind"), "Status report");
    expect(box).toBeChecked();
    expect(screen.getByText(/will see it as soon as it uploads/)).toBeInTheDocument();

    await user.click(box);
    await chooseOption(user, screen.getByLabelText("Kind"), "Other");
    await chooseOption(user, screen.getByLabelText("Kind"), "Status report");
    expect(box).not.toBeChecked();

    const file = new File(["x"], "draft.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("File"), file);
    await user.click(screen.getByRole("button", { name: /Upload/ }));

    await waitFor(() =>
      expect(upload).toHaveBeenCalledWith("acme-rebuild", file, { kind: "report", isShared: false, title: undefined }),
    );
  });

  it("offers no share box to somebody who may upload but not share", async () => {
    forProject.mockResolvedValue({ ...listing(), meta: { ...listing().meta, canShare: false } });

    render(<ProjectDocuments project={PROJECT} />);

    expect(await screen.findByText(/Nothing you upload is visible/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Share on the client page/ })).toBeNull();
  });

  it("will not upload without a file", async () => {
    forProject.mockResolvedValue(listing());

    render(<ProjectDocuments project={PROJECT} />);

    expect(await screen.findByRole("button", { name: /Upload/ })).toBeDisabled();
  });

  it("shares and unshares a document", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();

    forProject.mockResolvedValue(listing([doc()]));
    setShared.mockResolvedValue(doc({ isShared: true }));

    render(<ProjectDocuments project={PROJECT} onChanged={onChanged} />);

    await user.click(
      await screen.findByRole("button", { name: "Show Signed contract to the client" }),
    );

    await waitFor(() => expect(setShared).toHaveBeenCalledWith("acme-rebuild", "d-1", true));
    expect(onChanged).toHaveBeenCalled();
  });

  it("offers to withdraw a document that is already shared", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(listing([doc({ isShared: true })]));
    setShared.mockResolvedValue(doc());

    render(<ProjectDocuments project={PROJECT} />);

    await user.click(
      await screen.findByRole("button", {
        name: "Stop showing Signed contract to the client",
      }),
    );

    await waitFor(() => expect(setShared).toHaveBeenCalledWith("acme-rebuild", "d-1", false));
  });

  it("confirms before removing", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(listing([doc()]));
    remove.mockResolvedValue(undefined);

    render(<ProjectDocuments project={PROJECT} />);

    await user.click(await screen.findByRole("button", { name: "Remove Signed contract" }));

    expect(remove).not.toHaveBeenCalled();

    await user.click(await screen.findByRole("button", { name: "Remove document" }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith("acme-rebuild", "d-1"));
  });

  /**
   * Losing the record that a signed contract existed is worse than holding
   * one that no longer opens — so the row stays and explains itself.
   */
  it("keeps a document whose file has gone, and offers no download", async () => {
    forProject.mockResolvedValue(
      listing([doc({ isReadable: false, streamUrl: null, sizeBytes: null })]),
    );

    render(<ProjectDocuments project={PROJECT} />);

    expect(await screen.findByText("Signed contract")).toBeInTheDocument();
    expect(screen.getByText(/no longer in the library/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Signed contract" })).not.toBeInTheDocument();
  });

  /** And it cannot be shared, because there is nothing to open. */
  it("offers no sharing toggle on an unreadable document", async () => {
    forProject.mockResolvedValue(listing([doc({ isReadable: false, streamUrl: null })]));

    render(<ProjectDocuments project={PROJECT} />);

    await screen.findByText("Signed contract");

    expect(
      screen.queryByRole("button", { name: "Show Signed contract to the client" }),
    ).not.toBeInTheDocument();
  });

  it("gives somebody who cannot manage the board a read-only list", async () => {
    forProject.mockResolvedValue(listing([doc()], false));

    render(<ProjectDocuments project={PROJECT} />);

    expect(await screen.findByRole("link", { name: "Signed contract" })).toBeInTheDocument();
    expect(screen.queryByLabelText("File")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove Signed contract" }),
    ).not.toBeInTheDocument();
  });

  it("invites a first document rather than showing an empty table", async () => {
    forProject.mockResolvedValue(listing());

    render(<ProjectDocuments project={PROJECT} />);

    expect(await screen.findByText("No documents yet")).toBeInTheDocument();
  });
  /**
   * A mistyped title or a mis-picked kind is a two-second fix, so it is inline
   * rather than behind a dialog — three clicks of ceremony is what makes
   * people leave the mistake alone instead.
   */
  it("renames a document and changes what sort it is", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(listing([doc()]));
    update.mockResolvedValue(doc({ title: "Master services agreement" }));

    render(<ProjectDocuments project={PROJECT} />);

    await user.click(await screen.findByRole("button", { name: "Rename Signed contract" }));

    const title = screen.getByLabelText("Title of Signed contract");

    await user.clear(title);
    await user.type(title, "Master services agreement");
    await chooseOption(user, screen.getByLabelText("Kind of Signed contract"), "Status report");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("acme-rebuild", "d-1", {
        title: "Master services agreement",
        kind: "report",
        description: null,
      }),
    );
  });

  it("will not save a document with no title", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(listing([doc()]));

    render(<ProjectDocuments project={PROJECT} />);

    await user.click(await screen.findByRole("button", { name: "Rename Signed contract" }));
    await user.clear(screen.getByLabelText("Title of Signed contract"));

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("abandons a rename on cancel", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(listing([doc()]));

    render(<ProjectDocuments project={PROJECT} />);

    await user.click(await screen.findByRole("button", { name: "Rename Signed contract" }));
    await user.type(screen.getByLabelText("Title of Signed contract"), " and more");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(update).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Signed contract" })).toBeInTheDocument();
  });

  it("shows a description when one has been written", async () => {
    forProject.mockResolvedValue(
      listing([doc({ description: "Countersigned copy, 4 January." })]),
    );

    render(<ProjectDocuments project={PROJECT} />);

    expect(await screen.findByText("Countersigned copy, 4 January.")).toBeInTheDocument();
  });
});
