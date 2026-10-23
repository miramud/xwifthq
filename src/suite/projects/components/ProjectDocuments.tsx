"use client";

import { useEffect, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  FileText,
  FileWarning,
  FolderOpen,
  Lock,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { Button, Chip, Empty, Panel, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { DataView, type Column } from "@/components/workspace/DataView";
import { hueFor } from "@/components/workspace/modules";
import {
  ApiError,
  documents as documentsApi,
  type DocumentKindKey,
  type DocumentKindOption,
  type Project,
  type ProjectDocument,
} from "@/lib/api/projects-client";
import {
  IconTile,
  NameAvatar,
  Notice,
  Skeleton,
  inputCls,
  labelCls,
  smallInputCls,
} from "./ui/pkit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

/**
 * The files a project keeps.
 *
 * **Sharing is a separate, deliberate act, and the screen makes it look like
 * one.** A project's files are exactly where a rate card, a margin model and a
 * frank note about the client's own staff end up, so a new upload is never
 * shared, the toggle is its own control with its own confirmation wording, and
 * a shared document is visibly marked in the list rather than distinguishable
 * only by a checkbox somebody has to go looking for.
 *
 * **A document whose file has gone keeps its row.** Losing the record that a
 * signed contract existed is worse than holding one that no longer opens, so
 * the row stays, says so, and offers no download rather than a link that 404s.
 */
export default function ProjectDocuments({
  project,
  onChanged,
}: {
  project: Project;
  /** A shared document changed what a client can see. */
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<ProjectDocument[]>([]);
  const [kinds, setKinds] = useState<DocumentKindOption[]>([]);
  const [canManage, setCanManage] = useState(false);
  /* Sharing with the client is its own permission (a client manager may share and not upload). */
  const [canShare, setCanShare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<DocumentKindKey>("other");
  /*
    "Share on the client page" at upload (P14). Follows the kind's suggestion
    - ticked for a status report - until the uploader touches it; after that
    their choice stands whatever kind they pick.
  */
  const [share, setShare] = useState(false);
  const [shareTouched, setShareTouched] = useState(false);
  const confirm = useConfirm();
  /**
   * The document being renamed, and what it is being renamed to.
   *
   * Inline rather than a dialog: correcting a title or a mis-picked kind is
   * a two-second job, and a modal for it is three clicks of ceremony that
   * make people leave the mistake alone instead.
   */
  const [editing, setEditing] = useState<{
    id: string;
    title: string;
    kind: DocumentKindKey;
    description: string;
  } | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;

    documentsApi
      .forProject(project.slug)
      .then((response) => {
        if (!live) return;

        setRows(response.data);
        setKinds(response.meta.kinds);
        setCanManage(response.meta.canManage);
        setCanShare(response.meta.canShare ?? response.meta.canManage);
        setError(null);
        setLoaded(true);
      })
      .catch((e: unknown) => {
        if (!live) return;

        setError(e instanceof ApiError ? e.message : "Could not load the documents.");
        setLoaded(true);
      });

    return () => {
      live = false;
    };
  }, [project.slug, reloadKey]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (pending === null || busy) return;

    setBusy(true);
    setError(null);

    try {
      await documentsApi.upload(project.slug, pending, {
        title: title.trim() === "" ? undefined : title.trim(),
        kind,
        ...(canShare ? { isShared: share } : {}),
      });

      setPending(null);
      setTitle("");
      setKind("other");
      setShare(false);
      setShareTouched(false);

      if (fileInput.current !== null) fileInput.current.value = "";

      setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "That file could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  async function setShared(document: ProjectDocument, isShared: boolean) {
    try {
      await documentsApi.setShared(project.slug, document.id, isShared);

      setReloadKey((k) => k + 1);
      onChanged?.();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "That could not be changed.");
    }
  }

  async function saveEdit() {
    if (editing === null || editing.title.trim() === "") return;

    try {
      await documentsApi.update(project.slug, editing.id, {
        title: editing.title.trim(),
        kind: editing.kind,
        /* A deliberate null clears it, rather than storing an empty string. */
        description: editing.description.trim() === "" ? null : editing.description.trim(),
      });

      setEditing(null);
      setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "That could not be saved.");
    }
  }

  async function remove(id: string) {
    const document = rows.find((d) => d.id === id);
    const ok = await confirm({
      title: document ? `Remove “${document.title}”?` : "Remove this document?",
      body: document?.isShared
        ? "It's shared with the client, so it disappears from their view too. It moves to the organisation's recycle bin, where an admin can restore it."
        : "It moves to the organisation's recycle bin, where an admin can restore it.",
      confirmLabel: "Remove document",
      recoverable: true,
    });
    if (!ok) return;

    try {
      await documentsApi.remove(project.slug, id);

      setReloadKey((k) => k + 1);
      onChanged?.();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "That could not be removed.");
    }
  }

  const sharedCount = rows.filter((r) => r.isShared).length;

  const columns: Column<ProjectDocument>[] = [
    {
      key: "title",
      header: "Document",
      primary: true,
      value: (d) => d.title,
      sortable: true,
      render: (d) => documentCell(d),
    },
    {
      key: "kind",
      header: "Kind",
      value: (d) => d.kindLabel,
      sortable: true,
      render: (d) => <Chip hue={hueFor(d.kind)}>{d.kindLabel}</Chip>,
    },
    {
      key: "shared",
      header: "Visibility",
      value: (d) => (d.isShared ? "Shared" : "Internal"),
      sortable: true,
      render: (d) => <VisibilityChip document={d} />,
    },
    {
      key: "added",
      header: "Added",
      value: (d) => d.addedOn,
      sortable: true,
      hideOnMobile: true,
      render: (d) => <AddedLine document={d} />,
    },
    ...(canManage || canShare
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            render: (d: ProjectDocument) => actions(d),
          },
        ]
      : []),
  ];

  /* ------------------------------------------------------------------ */

  function documentCell(document: ProjectDocument) {
    if (editing?.id === document.id) {
      return (
        <div className="min-w-[16rem] space-y-2">
          <input
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            aria-label={`Title of ${document.title}`}
            className={smallInputCls + " w-full"}
          />
          <div className="flex flex-wrap items-center gap-2">
            <SearchableSelect
              value={editing.kind}
              onChange={(value) => setEditing({ ...editing, kind: value as DocumentKindKey })}
              aria-label={`Kind of ${document.title}`}
              size="sm"
              className="w-40"
              options={kinds.map((option) => ({ value: option.value, label: option.label }))}
            />
            <input
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              placeholder="A note, if it needs one"
              aria-label={`Description of ${document.title}`}
              className={cx(smallInputCls, "min-w-40 flex-1")}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={editing.title.trim() === ""}
              onClick={() => void saveEdit()}
            >
              Save
            </Button>
            <Button size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-w-0 items-start gap-3">
        {document.isReadable ? (
          <IconTile icon={FileText} hue={hueFor(document.kind)} size={36} />
        ) : (
          <IconTile icon={FileWarning} hue="sun" size={36} />
        )}
        <div className="min-w-0">
          {document.isReadable && document.streamUrl !== null ? (
            <a
              href={document.streamUrl}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-sm font-semibold text-neutral-900 underline-offset-2 outline-none hover:text-primary-700 hover:underline focus-visible:underline"
            >
              {document.title}
            </a>
          ) : (
            <span className="block truncate text-sm font-semibold text-neutral-500">
              {document.title}
            </span>
          )}

          {!document.isReadable && (
            <p className="mt-0.5 text-xs text-sun-700">
              The file is no longer in the library. The record is kept so
              you know it existed.
            </p>
          )}

          {document.description !== null && (
            <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">{document.description}</p>
          )}
        </div>
      </div>
    );
  }

  function actions(document: ProjectDocument) {
    if (!(canManage || canShare) || editing !== null) return null;

    return (
      <div className="flex shrink-0 items-center justify-end gap-1">
        {canManage && (
          <button
            type="button"
            onClick={() =>
              setEditing({
                id: document.id,
                title: document.title,
                kind: document.kind,
                description: document.description ?? "",
              })
            }
            aria-label={`Rename ${document.title}`}
            title="Rename, or change what sort of document it is"
            className={ICON_BUTTON}
          >
            <Pencil size={16} aria-hidden />
          </button>
        )}

        {canShare && document.isReadable && (
          <button
            type="button"
            onClick={() => void setShared(document, !document.isShared)}
            aria-label={
              document.isShared
                ? `Stop showing ${document.title} to the client`
                : `Show ${document.title} to the client`
            }
            title={document.isShared ? "Stop showing this to the client" : "Show this to the client"}
            className={cx(
              ICON_BUTTON,
              document.isShared && "!text-sun-700 hover:!bg-sun-50",
            )}
          >
            {document.isShared ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}
          </button>
        )}

        {canManage && (
          <button
            type="button"
            onClick={() => void remove(document.id)}
            aria-label={`Remove ${document.title}`}
            className={cx(ICON_BUTTON, "hover:!bg-error-50 hover:!text-error-700")}
          >
            <Trash2 size={16} aria-hidden />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <IconTile icon={FolderOpen} hue="sun" size={40} />
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold tracking-tight text-neutral-900">Documents</h2>
          <p className="text-sm text-neutral-500">
            {sharedCount === 0
              ? "Nothing here is visible to the client"
              : `${sharedCount} of ${rows.length} visible to the client`}
          </p>
        </div>
      </div>

      {error !== null && <Notice tone="error">{error}</Notice>}

      {canManage && (
        <Panel title="Add a document" icon={Upload} hue="blue">
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.2fr_1fr_auto] lg:items-end">
              <div>
                <label htmlFor="doc-file" className={labelCls}>
                  File
                </label>
                <input
                  id="doc-file"
                  ref={fileInput}
                  type="file"
                  onChange={(e) => setPending(e.target.files?.[0] ?? null)}
                  className="block h-11 w-full cursor-pointer rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 px-2 py-2 text-xs text-neutral-600 file:mr-3 file:h-7 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:text-xs file:font-semibold file:text-primary-700"
                />
              </div>

              <div>
                <label htmlFor="doc-title" className={labelCls}>
                  Title
                </label>
                <input
                  id="doc-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={pending?.name ?? "The file name, unless you say otherwise"}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="doc-kind" className={labelCls}>
                  Kind
                </label>
                <SearchableSelect
                  id="doc-kind"
                  value={kind}
                  onChange={(value) => {
                    setKind(value as DocumentKindKey);
                    if (!shareTouched) setShare(kinds.find((k) => k.value === value)?.sharedByDefault === true);
                  }}
                  options={kinds.map((option) => ({ value: option.value, label: option.label }))}
                />
              </div>

              <Button type="submit" variant="primary" icon={Upload} disabled={pending === null || busy}>
                {busy ? "Uploading…" : "Upload"}
              </Button>
            </div>

            {/*
              Said before the upload rather than discovered after it. A file is
              internal until somebody decides otherwise, and this is where that
              expectation gets set.
            */}
            {canShare && (
              <label
                className={cx(
                  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[13px] font-semibold transition-colors",
                  share
                    ? "border-primary-200 bg-primary-50 text-primary-700"
                    : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
                )}
              >
                <input
                  type="checkbox"
                  checked={share}
                  onChange={(e) => {
                    setShare(e.target.checked);
                    setShareTouched(true);
                  }}
                  className="h-4 w-4 rounded border-neutral-300 accent-primary-600"
                />
                <Eye size={14} aria-hidden />
                Share on the client page
              </label>
            )}

            <p className="flex items-start gap-1.5 text-xs text-neutral-500">
              {share ? (
                <Eye size={13} className="mt-px shrink-0 text-primary-500" aria-hidden />
              ) : (
                <EyeOff size={13} className="mt-px shrink-0 text-neutral-400" aria-hidden />
              )}
              <span>
                {kinds.find((k) => k.value === kind)?.hint}.{" "}
                {share
                  ? "Anyone with this project's client link will see it as soon as it uploads."
                  : "Nothing you upload is visible to the client until you share it."}
              </span>
            </p>
          </form>
        </Panel>
      )}

      {!loaded ? (
        <Skeleton className="h-64" />
      ) : (
        <DataView
          rows={rows}
          columns={columns}
          rowKey={(d) => d.id}
          storageKey="projects.documents"
          caption="Project documents"
          searchPlaceholder="Search documents"
          empty={
            <Empty
              icon={FileText}
              hue="sun"
              title="No documents yet"
              hint="Contracts, specifications, status reports — anything the project accumulates."
            />
          }
          renderCard={(d) => (
            <div className="flex h-full flex-col gap-3 p-5">
              {documentCell(d)}
              <div className="flex flex-wrap items-center gap-2">
                <Chip hue={hueFor(d.kind)}>{d.kindLabel}</Chip>
                <VisibilityChip document={d} />
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                <AddedLine document={d} />
                {actions(d)}
              </div>
            </div>
          )}
          renderListItem={(d) => (
            <div className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                {documentCell(d)}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Chip hue={hueFor(d.kind)}>{d.kindLabel}</Chip>
                <VisibilityChip document={d} />
              </div>
              {actions(d)}
            </div>
          )}
        />
      )}
    </div>
  );
}

const ICON_BUTTON =
  "flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-primary-300";

/* Visible in the list, not hidden behind a checkbox. */
function VisibilityChip({ document }: { document: ProjectDocument }) {
  return document.isShared ? (
    <Chip hue="sun" dot>
      Client can see this
    </Chip>
  ) : (
    <Chip hue="slate" icon={Lock}>
      Internal
    </Chip>
  );
}

function AddedLine({ document }: { document: ProjectDocument }) {
  if (!document.isReadable) return <span className="text-xs text-neutral-500">—</span>;

  return (
    <span className="flex min-w-0 items-center gap-2 text-xs text-neutral-500">
      {document.uploadedBy !== null && <NameAvatar name={document.uploadedBy} size={22} />}
      <span className="min-w-0">
        {document.uploadedBy ?? "Somebody"} · {document.addedOn}
        {document.sizeBytes !== null && ` · ${size(document.sizeBytes)}`}
      </span>
    </span>
  );
}

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
