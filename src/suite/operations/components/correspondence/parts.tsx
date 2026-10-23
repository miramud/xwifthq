"use client";

import { useId, useRef, useState } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Download, FileText, Lock, Paperclip, PenLine, Timer, Trash2, Upload } from "lucide-react";
import { Button, Chip, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ErrorNote, FaceAvatar } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import type { Direction, FileKind, Letter, LetterAction, LetterFile } from "@/lib/api/operations-correspondence-client";
import { stampText } from "@/suite/operations/components/desk/labels";
import { actionText, dueText, letterStatus } from "./labels";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";

/** The status, in words on its wash. */
export function LetterStatusChip({ status }: { status: string }) {
  const m = letterStatus(status);
  return (
    <Chip hue={m.hue} dot>
      {m.label}
    </Chip>
  );
}

/** In or out, as an arrow tile: received letters come down and in, sent ones go up and out. */
export function DirectionMark({ direction, size = 36 }: { direction: Direction; size?: number }) {
  const incoming = direction === "incoming";
  const Icon = incoming ? ArrowDownLeft : ArrowUpRight;
  return (
    <span
      className={cx("flex shrink-0 items-center justify-center rounded-xl", incoming ? HUE.mint.soft : HUE.grape.soft)}
      style={{ width: size, height: size }}
      title={incoming ? "Received" : "Sent"}
    >
      <Icon size={Math.round(size * 0.5)} aria-hidden />
      <span className="sr-only">{incoming ? "Received" : "Sent"}</span>
    </span>
  );
}

/**
 * The reference number as a registry stamp: monospaced, ruled in, so a
 * number reads as a number and never as a word. A draft has none yet.
 */
export function RefStamp({ reference, className }: { reference: string | null; className?: string }) {
  return reference ? (
    <span className={cx("inline-flex items-center rounded-md border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-neutral-700 tabular-nums", className)}>
      {reference}
    </span>
  ) : (
    <span className={cx("inline-flex items-center rounded-md border border-dashed border-neutral-300 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500", className)}>Not numbered yet</span>
  );
}

export function ConfidentialChip() {
  return (
    <Chip hue="rose" icon={Lock}>
      Confidential
    </Chip>
  );
}

/** How long is left, or how late it is. Nothing when it is not waiting on anybody. */
export function DueChip({ letter, now }: { letter: Pick<Letter, "dueOn" | "status" | "direction" | "overdue">; now?: Date }) {
  const text = dueText(letter, now);
  if (!text) return null;
  return (
    <Chip hue={letter.overdue ? "rose" : text === "Due today" ? "sun" : "slate"} icon={Timer}>
      {text}
    </Chip>
  );
}

/**
 * The minute sheet: every hand the letter passed through, oldest first. A
 * routing shows who it went from and to; a minute shows its words.
 */
export function MinuteSheet({ actions }: { actions: LetterAction[] }) {
  if (actions.length === 0) return <p className="text-sm text-neutral-500">Nothing recorded yet.</p>;
  return (
    <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-neutral-200" aria-label="What happened to this letter">
      {actions.map((a) => {
        const handoff = (a.action === "assigned" || a.action === "reassigned" || a.action === "forwarded") && a.to;
        return (
          <li key={a.id} className="relative flex gap-3">
            <span className="relative z-[1] rounded-full ring-4 ring-white">
              <FaceAvatar name={a.by ?? "Approvals"} size={32} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm text-neutral-700">
                {a.by && <span className="font-semibold text-neutral-900">{a.by} </span>}
                {actionText(a)}
              </p>
              {handoff && (
                <p className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-xs text-neutral-600">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5">{a.from ?? "Registry"}</span>
                  <ArrowRight size={12} aria-label="to" />
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 font-medium text-primary-700">{a.to}</span>
                </p>
              )}
              {a.note && <RichTextView value={a.note} size="sm" className="mt-1.5 rounded-xl border-l-2 border-sun-400 bg-sun-50/60 px-3 py-2 text-neutral-800" />}
              <p className="mt-0.5 text-xs text-neutral-500">{stampText(a.at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const KIND_LABEL: Record<string, string> = { scan: "Scan", copy: "Copy sent", acknowledgement: "Acknowledgement", reply: "Reply", enclosure: "Enclosure" };

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * The letter's papers: download each, add one (choosing what it is when
 * the desk adds it), remove one. Files are kept once in the repository.
 */
export function FileList({
  files,
  hrefFor,
  kinds,
  defaultKind,
  onUpload,
  onRemove,
  uploadLabel = "Add a file",
}: {
  files: LetterFile[];
  hrefFor: (f: LetterFile) => string;
  /** The kinds the uploader may choose; none means the kind is fixed. */
  kinds?: FileKind[];
  defaultKind?: FileKind;
  onUpload?: (file: File, kind: FileKind) => Promise<void>;
  onRemove?: (f: LetterFile) => void;
  uploadLabel?: string;
}) {
  const uid = useId();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<FileKind>(defaultKind ?? kinds?.[0] ?? "scan");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const pick = async (file: File | undefined) => {
    if (!file || !onUpload) return;
    if (file.size > 25 * 1024 * 1024) {
      setError("Files up to 25 MB.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await onUpload(file, kind);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The file didn't upload.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      {files.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <Paperclip size={14} aria-hidden /> No papers filed yet.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
                <FileText size={16} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <a href={hrefFor(f)} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-neutral-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
                  {f.name}
                </a>
                <span className="block truncate text-xs text-neutral-500">
                  {KIND_LABEL[f.kind] ?? f.kind} · {size(f.size)} · {f.uploadedBy ?? "—"}
                </span>
              </span>
              <a href={hrefFor(f)} download className="flex h-11 w-11 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300" aria-label={`Download ${f.name}`}>
                <Download size={16} aria-hidden />
              </a>
              {onRemove && (
                <button type="button" onClick={() => onRemove(f)} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 hover:bg-error-500/10 hover:text-error-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300" aria-label={`Remove ${f.name}`}>
                  <Trash2 size={16} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {onUpload && (
        <div className="flex flex-col gap-2 border-t border-neutral-100 pt-3 sm:flex-row sm:items-end">
          {kinds && kinds.length > 1 && (
            <div className="sm:w-44">
              <label htmlFor={`${uid}-k`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                What it is
              </label>
              <SearchableSelect id={`${uid}-k`} value={kind} onChange={(v) => setKind(v as FileKind)} options={kinds.map((k) => ({ value: k, label: KIND_LABEL[k] ?? k }))} />
            </div>
          )}
          <input ref={input} id={`${uid}-f`} type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.eml,.msg,.txt" onChange={(e) => void pick(e.target.files?.[0])} aria-label={uploadLabel} />
          <Button icon={Upload} disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Uploading…" : uploadLabel}
          </Button>
        </div>
      )}
      <FieldError message={error} />
    </div>
  );
}

/** Add a minute to the file. */
export function NoteBox({ onAdd, placeholder = "Add a minute to the file" }: { onAdd: (body: string) => Promise<void>; placeholder?: string }) {
  const uid = useId();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      setError("Write the minute first.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await onAdd(body.trim());
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "It didn't save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-2xl border border-neutral-200 bg-white p-3">
      <label htmlFor={`${uid}-n`} className="sr-only">
        Minute
      </label>
      <RichTextEditor id={`${uid}-n`} minHeight={76} value={body} onChange={setBody} placeholder={placeholder} invalid={Boolean(error ? true : undefined)} />
      <FieldError message={error} />
      <div className="mt-2 flex justify-end">
        <Button type="submit" size="sm" icon={PenLine} disabled={busy}>
          {busy ? "Saving…" : "Add the minute"}
        </Button>
      </div>
    </form>
  );
}

/**
 * A small form in a dialog: a reason to cancel, a note to close with, a
 * dispatch's channel and tracking. `fields` are rendered inside; `onSubmit`
 * throws to show the error.
 */
export function ActionDialog({
  title,
  subtitle,
  confirmLabel,
  tone = "primary",
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  subtitle?: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  onClose: () => void;
  onSubmit: () => Promise<void>;
  children: React.ReactNode;
}) {
  const uid = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <DialogFrame
      as="form"
      titleId={`${uid}-t`}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        onSubmit().catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "That didn't work.");
          setBusy(false);
        });
      }}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Back</Button>
          <Button type="submit" variant={tone} disabled={busy}>
            {busy ? "Saving…" : confirmLabel}
          </Button>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      {children}
    </DialogFrame>
  );
}
