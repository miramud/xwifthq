import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MediaPicker from "./MediaPicker";
import { ApiError, type MediaAsset } from "@/lib/api/media-client";

/**
 * Choosing a file for a lesson.
 *
 * The media library had been built for a while, three storage providers,
 * per-institution credentials, files that stream through the API and never
 * hand out a provider URL, and none of it was reachable, because nothing in
 * the product ever called it. This is the thing that calls it, so what it has
 * to get right is less the layout than the defaults.
 *
 * **Re-use is offered before upload.** An institution's induction video
 * appears in nine courses. An editor whose first offer is "upload" gets nine
 * copies of it, and eight of them are missed when somebody re-records it.
 *
 * **Public is opt-in.** The cost of that default being wrong the safe way is
 * an inconvenience. The other way round it is a leaked exam paper.
 *
 * **Deleting says what it costs first.** It removes the file from the
 * provider too, so a lesson still pointing at it reports the media as
 * missing, which is worth knowing before, not after.
 */

const { list, upload, link, remove } = vi.hoisted(() => ({
  list: vi.fn(),
  upload: vi.fn(),
  link: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/api/media-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/media-client")>();

  return {
    ...actual,
    media: { list, upload, link, remove, get: vi.fn() },
  };
});

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "ma-1",
    name: "Induction 2026.mp4",
    kind: "video",
    kindLabel: "Video",
    source: "upload",
    provider: "s3",
    providerLabel: "Amazon S3",
    visibility: "platform_only",
    isPlatformOnly: true,
    isExternal: false,
    externalHost: null,
    url: "/api/media/ma-1/stream",
    embedUrl: null,
    mime: "video/mp4",
    sizeBytes: 52_428_800,
    durationSeconds: 754,
    width: 1920,
    height: 1080,
    uploadedAt: "2026-09-01T09:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue({ data: [asset()], meta: null });
  remove.mockResolvedValue(undefined);
});

describe("re-using what is already there", () => {
  /*
    The default tab, and the reason this component exists at all rather than a
    file input on the lecture editor.
  */
  it("opens on the library, not on upload", async () => {
    render(<MediaPicker kind="video" onPick={vi.fn()} onClose={vi.fn()} />);

    expect(await screen.findByText("Induction 2026.mp4")).toBeInTheDocument();
  });

  it("asks the API only for files of the kind being picked", async () => {
    render(<MediaPicker kind="document" onPick={vi.fn()} onClose={vi.fn()} />);

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "document" }),
      ),
    );
  });

  it("hands the chosen asset back whole", async () => {
    const onPick = vi.fn();

    render(<MediaPicker kind="video" onPick={onPick} onClose={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "Use this" }));

    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ma-1", isPlatformOnly: true }),
    );
  });

  it("says which files cannot be shared by copying a link", async () => {
    render(<MediaPicker kind="video" onPick={vi.fn()} onClose={vi.fn()} />);

    expect(
      await screen.findByText("On the platform only"),
    ).toBeInTheDocument();
  });

  /*
    An empty library is the first thing a new institution sees. "Nothing here"
    on its own reads like a fault.
  */
  it("tells a new institution what to do with an empty library", async () => {
    list.mockResolvedValue({ data: [], meta: null });

    render(<MediaPicker kind="video" onPick={vi.fn()} onClose={vi.fn()} />);

    expect(await screen.findByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.getByText(/ready to re-use in any course/)).toBeInTheDocument();
  });

  it("distinguishes an empty search from an empty library", async () => {
    list.mockResolvedValue({ data: [], meta: null });

    render(<MediaPicker kind="video" onPick={vi.fn()} onClose={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText("Search by name…"), "ward");

    expect(await screen.findByText("Nothing matches that")).toBeInTheDocument();
  });
});

describe("deleting a file", () => {
  it("states the cost before it happens, not after", async () => {
    render(<MediaPicker kind="video" onPick={vi.fn()} onClose={vi.fn()} />);

    expect(
      await screen.findByText(/Deleted files go to the recycle bin/),
    ).toBeInTheDocument();
    expect(screen.getByText(/say the file is missing/)).toBeInTheDocument();
  });

  it("asks before removing, and does nothing until confirmed", async () => {
    render(<MediaPicker kind="video" onPick={vi.fn()} onClose={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Delete Induction 2026.mp4" }),
    );

    expect(
      await screen.findByRole("alertdialog", { name: "Delete “Induction 2026.mp4”?" }),
    ).toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(remove).not.toHaveBeenCalled();
  });

  it("removes and reloads once confirmed", async () => {
    render(<MediaPicker kind="video" onPick={vi.fn()} onClose={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Delete Induction 2026.mp4" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Delete file" }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith("ma-1"));
    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(1));
  });

  it("reports a refusal in the provider's own words", async () => {
    remove.mockRejectedValue(
      new ApiError("That file is still used by 3 lessons.", 422),
    );

    render(<MediaPicker kind="video" onPick={vi.fn()} onClose={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Delete Induction 2026.mp4" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Delete file" }));

    expect(
      await screen.findByText("That file is still used by 3 lessons."),
    ).toBeInTheDocument();
  });
});

describe("uploading", () => {
  /*
    The whole reason media has a default of platform-only. If this checkbox
    ever starts out ticked, every upload an institution makes is public.
  */
  it("keeps a new file off the public internet unless asked", async () => {
    upload.mockResolvedValue(asset({ id: "ma-2" }));

    render(<MediaPicker kind="video" onPick={vi.fn()} onClose={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "Upload" }));

    const opt = screen.getByRole("checkbox");

    expect(opt).not.toBeChecked();

    await userEvent.upload(
      screen.getByLabelText(/Choose a video to upload/),
      new File(["x"], "lecture.mp4", { type: "video/mp4" }),
    );

    await waitFor(() =>
      expect(upload).toHaveBeenCalledWith(
        expect.any(File),
        expect.objectContaining({ isPublic: false, kind: "video" }),
      ),
    );
  });

  it("passes the opt-in through when it is ticked", async () => {
    upload.mockResolvedValue(asset({ id: "ma-2" }));

    render(<MediaPicker kind="video" onPick={vi.fn()} onClose={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "Upload" }));
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.upload(
      screen.getByLabelText(/Choose a video to upload/),
      new File(["x"], "lecture.mp4", { type: "video/mp4" }),
    );

    await waitFor(() =>
      expect(upload).toHaveBeenCalledWith(
        expect.any(File),
        expect.objectContaining({ isPublic: true }),
      ),
    );
  });

  it("chooses the uploaded file straight away", async () => {
    const onPick = vi.fn();

    upload.mockResolvedValue(asset({ id: "ma-2", name: "lecture.mp4" }));

    render(<MediaPicker kind="video" onPick={onPick} onClose={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "Upload" }));
    await userEvent.upload(
      screen.getByLabelText(/Choose a video to upload/),
      new File(["x"], "lecture.mp4", { type: "video/mp4" }),
    );

    await waitFor(() =>
      expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "ma-2" })),
    );
  });
});

describe("pasting a link", () => {
  /*
    A document lecture exists so the institution holds the file. Offering
    "paste a link" there would put it back on somebody else's Drive, which is
    the thing the lecture type replaces.
  */
  it("is not offered for a document", async () => {
    render(
      <MediaPicker
        kind="document"
        onPick={vi.fn()}
        onClose={vi.fn()}
        allowLink={false}
      />,
    );

    await screen.findByPlaceholderText("Search by name…");

    expect(
      screen.queryByRole("button", { name: "Paste a link" }),
    ).not.toBeInTheDocument();
  });

  it("is offered for a video", async () => {
    render(<MediaPicker kind="video" onPick={vi.fn()} onClose={vi.fn()} />);

    expect(
      await screen.findByRole("button", { name: "Paste a link" }),
    ).toBeInTheDocument();
  });
});

describe("getting out", () => {
  it("closes on Escape", async () => {
    const onClose = vi.fn();

    render(<MediaPicker kind="video" onPick={vi.fn()} onClose={onClose} />);

    await screen.findByPlaceholderText("Search by name…");
    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });
});
