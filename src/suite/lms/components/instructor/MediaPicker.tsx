"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  FileText,
  Film,
  Image as ImageIcon,
  Link2,
  Loader2,
  Music,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  media as api,
  ApiError,
  type MediaAsset,
  type MediaKind,
} from "@/lib/api/media-client";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

/**
 * Choosing a file from the institution's own library.
 *
 * The library itself has been built for a while, three storage providers,
 * encrypted per-institution credentials, files that stream through the API
 * and never hand out a provider URL. None of it was reachable: the settings
 * screen could connect S3 and verify it worked, and then there was no way to
 * put a file anywhere near a lesson.
 *
 * Three things this screen is careful about.
 *
 * **Re-use is the default tab.** An institution's induction video appears in
 * nine courses, and an editor whose first offer is "upload" gets nine copies
 * of it, nine times the storage, and eight of them missed when somebody
 * re-records it.
 *
 * **Platform-only is stated, not assumed.** A file that streams through the
 * API cannot be shared by copying a link, which is the whole point and also
 * the thing that surprises people. The badge says which files those are.
 *
 * **Deleting says what it costs.** Forgetting a file removes it from the
 * provider too, so a lesson still pointing at it reports the media as missing.
 * That is recoverable and worth knowing before, not after.
 */
export default function MediaPicker({
  kind,
  onPick,
  onClose,
  allowLink = true,
}: {
  /** Filters the library and labels the upload control. */
  kind: MediaKind;
  onPick: (asset: MediaAsset) => void;
  onClose: () => void;
  /** Off for a document: a pasted link is not a file we can serve. */
  allowLink?: boolean;
}) {
  const [tab, setTab] = useState<"library" | "upload" | "link">("library");
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const page = await api.list({ kind, q: query || undefined, perPage: 60 });

      setAssets(page.data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Your library didn't load. Try again.");
    }
  }, [kind, query]);

  useEffect(() => {
    let cancelled = false;

    /* Debounced: this searches every file the institution holds. */
    const timer = window.setTimeout(() => {
      api
        .list({ kind, q: query || undefined, perPage: 60 })
        .then((page) => {
          if (!cancelled) setAssets(page.data);
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [kind, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "library", label: "Your library" },
    { key: "upload", label: "Upload" },
    ...(allowLink ? [{ key: "link" as const, label: "Paste a link" }] : []),
  ];

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto overscroll-contain bg-neutral-900/50 p-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a file"
        className="mt-auto w-full max-w-3xl rounded-[1.5rem] bg-white p-5 shadow-2xl shadow-primary-900/20 sm:mb-auto sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-neutral-900">
              Choose a file
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Files go to the storage your institution has set up, and you can
              re-use them in every course.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <nav className="mt-4 inline-flex flex-wrap gap-1 rounded-xl bg-neutral-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`min-h-11 cursor-pointer rounded-lg px-3.5 text-xs font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${
                tab === t.key
                  ? "bg-white text-primary-700 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {error !== null && (
          <p role="alert" className="mt-3 flex items-center gap-2 rounded-xl bg-error-500/10 px-3 py-2.5 text-sm text-error-700">
            <AlertCircle size={15} className="shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <div className="mt-4">
          {tab === "library" && (
            <Library
              assets={assets}
              query={query}
              onQuery={setQuery}
              onPick={onPick}
              onRemoved={() => void load()}
              onError={setError}
            />
          )}

          {tab === "upload" && (
            <UploadPane kind={kind} onUploaded={onPick} onError={setError} />
          )}

          {tab === "link" && <LinkPane kind={kind} onLinked={onPick} onError={setError} />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Library({
  assets,
  query,
  onQuery,
  onPick,
  onRemoved,
  onError,
}: {
  assets: MediaAsset[] | null;
  query: string;
  onQuery: (q: string) => void;
  onPick: (asset: MediaAsset) => void;
  onRemoved: () => void;
  onError: (message: string) => void;
}) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);

  const remove = async (asset: MediaAsset) => {
    const ok = await confirm({
      title: `Delete “${asset.name}”?`,
      body: "Lessons using it will say the file is missing. It moves to the organisation's recycle bin, where an admin can restore it; the file leaves your storage only when it's deleted permanently from there.",
      confirmLabel: "Delete file",
      recoverable: true,
    });
    if (!ok) return;

    setBusy(asset.id);

    try {
      await api.remove(asset.id);
      onRemoved();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "That file wasn't deleted. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <label className="relative block">
        <Search
          size={14}
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <span className="sr-only">Search your files</span>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search by name…"
          className="h-11 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
        />
      </label>

      {assets === null ? (
        <div className="h-48 animate-pulse rounded-2xl bg-neutral-100 motion-reduce:animate-none" aria-hidden />
      ) : assets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 p-8 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <Film size={22} aria-hidden />
          </span>
          <p className="text-sm font-semibold text-neutral-900">
            {query === "" ? "Nothing here yet" : "Nothing matches that"}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {query === ""
              ? "Upload a file and it appears here, ready to re-use in any course."
              : "Try part of the file name."}
          </p>
        </div>
      ) : (
        <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {assets.map((asset) => (
            <li
              key={asset.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white px-3 py-2.5 transition-colors hover:border-primary-200"
            >
              <KindIcon kind={asset.kind} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {asset.name}
                </p>
                <p className="truncate text-[11px] text-neutral-500">
                  {asset.isExternal
                    ? (asset.externalHost ?? "External link")
                    : asset.providerLabel}
                  {asset.sizeBytes !== null && ` · ${formatBytes(asset.sizeBytes)}`}
                  {asset.durationSeconds !== null &&
                    ` · ${formatDuration(asset.durationSeconds)}`}
                </p>
              </div>

              {/*
                Said out loud. A file that streams through the API cannot be
                shared by copying a link, which is the point of it, and also
                the thing that surprises people when they try.
              */}
              {asset.isPlatformOnly && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-mint-50 px-2 py-0.5 text-[11px] font-semibold text-mint-700"
                  title="Streams through the platform. Copying the link gets nobody in."
                >
                  <ShieldCheck size={11} aria-hidden />
                  On the platform only
                </span>
              )}

              <button
                type="button"
                onClick={() => onPick(asset)}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 px-3.5 text-xs font-semibold text-white shadow-sm shadow-primary-600/25 transition hover:from-primary-700 hover:to-primary-600 outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                Use this
              </button>
              <button
                type="button"
                disabled={busy === asset.id}
                onClick={() => void remove(asset)}
                aria-label={`Delete ${asset.name}`}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-error-50 hover:text-error-700 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/*
        Before anybody presses it, not after. A lesson still pointing at a
        deleted file reports the media as missing; the file itself stays in
        storage until it is deleted permanently from the recycle bin.
      */}
      {assets !== null && assets.length > 0 && (
        <p className="text-[11px] text-neutral-500">
          Deleted files go to the recycle bin. Any lesson still using one will
          say the file is missing rather than play nothing.
        </p>
      )}
    </div>
  );
}

function UploadPane({
  kind,
  onUploaded,
  onError,
}: {
  kind: MediaKind;
  onUploaded: (asset: MediaAsset) => void;
  onError: (message: string) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];

    if (!file) return;

    setName(file.name);
    setProgress(0);
    abortRef.current = new AbortController();

    try {
      const asset = await api.upload(file, {
        kind,
        isPublic,
        onProgress: setProgress,
        signal: abortRef.current.signal,
      });

      onUploaded(asset);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "That file didn't upload. Try again.");
      setName(null);
    } finally {
      setProgress(null);
      abortRef.current = null;
      // So the same file can be picked again after a failure.
      input.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-primary-200 bg-primary-50/30 px-6 py-10 text-center transition-colors focus-within:ring-2 focus-within:ring-primary-300 hover:border-primary-300 hover:bg-primary-50">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-sm">
          <Upload size={22} aria-hidden />
        </span>
        <span className="text-sm font-semibold text-neutral-900">
          Choose a {kind} to upload
        </span>
        <span className="mt-1 text-xs text-neutral-500">
          It goes to the storage your institution has set up.
        </span>
        <input
          type="file"
          className="sr-only"
          disabled={progress !== null}
          onChange={handleFile}
        />
      </label>

      {/*
        Opt-in, and the consequence stated rather than the setting named. The
        cost of this default being wrong the safe way is an inconvenience; the
        other way round it is a leaked exam paper.
      */}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 px-4 py-3">
        <input
          type="checkbox"
          checked={isPublic}
          disabled={progress !== null}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="mt-0.5 accent-primary-600"
        />
        <span className="text-xs text-neutral-700">
          Anyone with the link can open this
          <span className="mt-0.5 block text-[11px] text-neutral-500">
            Leave it off and the file only plays inside the platform, for people
            who are signed in. That is the right answer for anything you would
            not publish.
          </span>
        </span>
      </label>

      {progress !== null && (
        <div>
          <div className="flex items-center justify-between gap-3 text-xs text-neutral-600">
            <span className="min-w-0 truncate">{name}</span>
            <span className="shrink-0 tabular-nums">{progress}%</span>
          </div>
          <div className="ws-hatch mt-1.5 h-2 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="mt-1 inline-flex min-h-11 cursor-pointer items-center rounded-xl px-2 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function LinkPane({
  kind,
  onLinked,
  onError,
}: {
  kind: MediaKind;
  onLinked: (asset: MediaAsset) => void;
  onError: (message: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      onLinked(await api.link(url, { kind, name: label || undefined }));
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "That link wasn't saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="media-url" className="mb-1.5 block text-xs font-medium text-neutral-700">
          Address
        </label>
        <div className="relative">
          <Link2
            size={14}
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            id="media-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder="https://youtube.com/watch?v=…"
            className="h-11 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
          />
        </div>
        {/*
          The trade, said plainly. A pasted link is somebody else's file on
          somebody else's terms, which is fine, and is why the retention
          reporting cannot see it either.
        */}
        <p className="mt-1.5 text-[11px] text-neutral-500">
          A link stays with whoever hosts it. It plays in their player, so
          it cannot be kept to signed-in learners and we cannot tell you where
          people stop watching.
        </p>
      </div>

      <div>
        <label htmlFor="media-label" className="mb-1.5 block text-xs font-medium text-neutral-700">
          Call it
        </label>
        <input
          id="media-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Optional: how it appears in your library"
          className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || url.trim() === ""}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 px-4 text-sm font-semibold text-white shadow-md shadow-primary-600/25 transition hover:from-primary-700 hover:to-primary-600 disabled:cursor-not-allowed disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          {saving && <Loader2 size={13} className="animate-spin" aria-hidden />}
          Use this link
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function KindIcon({ kind }: { kind: MediaKind }) {
  const Icon =
    kind === "video"
      ? Film
      : kind === "image"
        ? ImageIcon
        : kind === "audio"
          ? Music
          : FileText;

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
      <Icon size={15} aria-hidden />
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);

  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
