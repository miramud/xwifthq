import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LectureContentEditor from "./LectureContentEditor";
import type { MediaAsset } from "@/lib/api/media-client";
import type { LectureContent } from "@/suite/lms/lib/curriculum";

/**
 * Attaching a file to a lesson.
 *
 * This editor used to take a pasted URL and upload straight to Cloudinary,
 * which is why the media library was unreachable: an institution could
 * connect S3, verify it worked, and then find no way to put a file anywhere
 * near a lesson. What matters here is the *reference* it now writes,
 * `mediaAssetId`, not a URL, because that is what lets the API resolve a
 * platform-only file to a streaming path at render time rather than baking a
 * provider location into a lecture row forever.
 *
 * The other half is that lectures recorded before the library still work. A
 * stored URL with no asset behind it is a normal, supported state, and it is
 * distinguished from the state where somebody deleted the file underneath it.
 */

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/api/media-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/media-client")>();

  return { ...actual, media: { ...actual.media, get } };
});

/* A stand-in for the picker: this file is about what gets written, not about
   how the library renders. The picker has its own tests. */
const PICKED: MediaAsset = {
  id: "ma-9",
  name: "Ward handbook.pdf",
  kind: "document",
  kindLabel: "Document",
  source: "upload",
  provider: "s3",
  providerLabel: "Amazon S3",
  visibility: "platform_only",
  isPlatformOnly: true,
  isExternal: false,
  externalHost: null,
  url: "/api/media/ma-9/stream",
  embedUrl: null,
  mime: "application/pdf",
  sizeBytes: 2_400_000,
  durationSeconds: null,
  width: null,
  height: null,
  uploadedAt: "2026-09-01T09:00:00Z",
};

vi.mock("./MediaPicker", () => ({
  default: ({
    kind,
    allowLink,
    onPick,
  }: {
    kind: string;
    allowLink?: boolean;
    onPick: (asset: MediaAsset) => void;
  }) => (
    <div>
      <span>{`picker:${kind}:${allowLink === false ? "no-link" : "link"}`}</span>
      <button type="button" onClick={() => onPick({ ...PICKED, kind: kind as never })}>
        pick
      </button>
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue(PICKED);
});

describe("a video lecture", () => {
  it("offers the library rather than a URL box", () => {
    render(
      <LectureContentEditor
        type="video"
        content={{ source: "link", url: "", provider: null }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Choose a video/ })).toBeInTheDocument();
  });

  /*
    The point of the whole change. A URL alone cannot be resolved to a
    streaming path later, so platform-only media would never work.
  */
  it("writes a media reference, not just a URL", async () => {
    const onChange = vi.fn();

    render(
      <LectureContentEditor
        type="video"
        content={{ source: "link", url: "", provider: null }}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Choose a video/ }));
    await userEvent.click(screen.getByRole("button", { name: "pick" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaAssetId: "ma-9",
        source: "upload",
        provider: "s3",
        url: "/api/media/ma-9/stream",
      }),
    );
  });

  it("names the file once one is attached", async () => {
    render(
      <LectureContentEditor
        type="video"
        content={{ mediaAssetId: "ma-9", url: "", source: "upload" }}
        onChange={vi.fn()}
      />,
    );

    expect(await screen.findByText("Ward handbook.pdf")).toBeInTheDocument();
    expect(screen.getByText("On the platform only")).toBeInTheDocument();
  });

  /*
    Courses recorded before the library. Breaking them to tidy a data model
    would be the wrong trade, so the stored URL still shows and still plays.
  */
  it("keeps a lecture authored before the library working", () => {
    render(
      <LectureContentEditor
        type="video"
        content={{ source: "link", url: "https://youtu.be/abc123", provider: null }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("https://youtu.be/abc123")).toBeInTheDocument();
    expect(screen.getByText(/Added before the media library/)).toBeInTheDocument();
  });

  /*
    A file forgotten from the library after the lesson was written. An empty
    slot would leave the author with no idea the lesson was broken.
  */
  it("says so when the attached file has been deleted", async () => {
    get.mockRejectedValue(new Error("gone"));

    render(
      <LectureContentEditor
        type="video"
        content={{ mediaAssetId: "ma-gone", url: "", source: "upload" }}
        onChange={vi.fn()}
      />,
    );

    expect(
      await screen.findByText("This file has been deleted"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Learners are being told the media is missing/),
    ).toBeInTheDocument();
  });

  it("looks up the reference once, not once per render", async () => {
    render(
      <LectureContentEditor
        type="video"
        content={{ mediaAssetId: "ma-9", url: "", source: "upload" }}
        onChange={vi.fn()}
      />,
    );

    await screen.findByText("Ward handbook.pdf");

    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe("a document lecture", () => {
  it("does not offer a pasted link", async () => {
    render(
      <LectureContentEditor
        type="document"
        content={{ mediaAssetId: null, url: "", note: "" }}
        onChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Choose a document/ }));

    expect(screen.getByText("picker:document:no-link")).toBeInTheDocument();
  });

  /*
    A 40 MB download on a phone on a ward deserves a warning, and nothing else
    on the learner's screen can supply one.
  */
  it("carries a note for the learner", async () => {
    const onChange = vi.fn();

    render(
      <LectureContentEditor
        type="document"
        content={{ mediaAssetId: null, url: "", note: "" }}
        onChange={onChange}
      />,
    );

    await userEvent.type(
      screen.getByLabelText("Tell them what it is"),
      "2",
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ note: "2" }),
    );
  });

  it("gives each document field its own label association", () => {
    const content: LectureContent = { mediaAssetId: null, url: "", note: "" };

    render(
      <>
        <LectureContentEditor type="document" content={content} onChange={vi.fn()} />
        <LectureContentEditor type="document" content={content} onChange={vi.fn()} />
      </>,
    );

    /* Two open lectures must not share one id, or a click on the second
       label focuses the first field. */
    expect(screen.getAllByLabelText("Tell them what it is")).toHaveLength(2);
  });
});
