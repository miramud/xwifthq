"use client";

import { useId, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CircleDashed,
  Download,
  FileText,
  Loader2,
  MessageSquareReply,
  Paperclip,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { Button, Chip, cx } from "@/components/workspace/kit";
import { HUE, type Hue } from "@/components/workspace/modules";
import { ErrorNote, FaceAvatar } from "@/suite/lms/components/ui/ws";
import { Money } from "@/suite/finance/components/banking/ui";
import { day } from "@/suite/finance/lib/format";
import {
  documentHref,
  spendError,
  type ChecklistState,
  type FundsSnapshot,
  type HistoryEntry,
  type SpendDocument,
  type SpendQuery,
  type SpendReview,
} from "@/lib/api/finance-spend-client";
import { CHECKPOINTS, MARKS, OUTCOMES, QUERY_STATUS, memoStatus, type Stage } from "./labels";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";
import { richExcerpt } from "@/lib/richText";

/* The pieces every request, register and FCU screen shares. */

/** A status word with its icon on its own wash. */
export function MemoStatusChip({ status }: { status: string }) {
  const s = memoStatus(status);
  return (
    <Chip hue={s.hue} icon={s.icon}>
      {s.label}
    </Chip>
  );
}

/** A date and time the way a person says it: `5 Sep 2026, 14:20`. */
export function when(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return day(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)}, ${hh}:${mm}`;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */
/*  The road                                                           */
/* ------------------------------------------------------------------ */

/**
 * Where a request is on its road: done steps in mint with a tick, the
 * current one in blue (amber when it waits on the requester), a stopped one
 * in rose with a cross, and the rest dashed - each with words for screen
 * readers, never colour alone.
 */
export function RequestRoad({ stage, compact = false }: { stage: Stage; compact?: boolean }) {
  const { steps, done, stopped, flagged } = stage;
  if (compact) {
    return (
      <div className="flex items-center gap-1" role="img" aria-label={`Step ${Math.min(done + 1, steps.length)} of ${steps.length}: ${steps[Math.min(done, steps.length - 1)]}${stopped ? ", stopped" : ""}`}>
        {steps.map((s, i) => (
          <span
            key={s}
            className={cx(
              "h-1.5 flex-1 rounded-full",
              i < done ? "bg-mint-500" : i === done && stopped ? "bg-rose-500" : i === done && flagged ? "bg-sun-500" : i === done && done < steps.length ? "bg-primary-500" : "ws-hatch",
            )}
          />
        ))}
      </div>
    );
  }
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="Where this request is">
      {steps.map((step, i) => {
        const complete = i < done;
        const halted = stopped && i === done;
        const current = !stopped && i === done;
        return (
          <li key={step} className="flex items-center gap-1" aria-current={current ? "step" : undefined}>
            <span
              className={cx(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold",
                complete
                  ? HUE.mint.soft
                  : halted
                    ? HUE.rose.soft
                    : current
                      ? flagged
                        ? "bg-sun-100 text-sun-700 ring-1 ring-sun-500/40"
                        : "bg-primary-600 text-white"
                      : "border border-dashed border-neutral-300 text-neutral-500",
              )}
            >
              {complete ? <Check size={13} aria-hidden /> : halted ? <X size={13} aria-hidden /> : current && flagged ? <AlertTriangle size={13} aria-hidden /> : <span className="tabular-nums" aria-hidden>{i + 1}</span>}
              {step}
              <span className="sr-only">{complete ? " (done)" : halted ? " (stopped here)" : current ? (flagged ? " (waiting on you)" : " (next)") : " (not yet)"}</span>
            </span>
            {i < steps.length - 1 && <span aria-hidden className={cx("h-px w-3 sm:w-5", complete ? "bg-mint-500" : "bg-neutral-200")} />}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/*  Documents                                                          */
/* ------------------------------------------------------------------ */

/** Files on a record, each downloadable; removable ones get a labelled remove button. */
export function DocumentList({
  documents,
  onRemove,
  empty = "No documents yet.",
}: {
  documents: SpendDocument[];
  onRemove?: (d: SpendDocument) => void;
  empty?: string;
}) {
  if (documents.length === 0) return <p className="text-sm text-neutral-500">{empty}</p>;
  return (
    <ul className="space-y-2">
      {documents.map((d) => (
        <li key={d.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white px-3 py-2.5 transition-colors hover:border-primary-200">
          <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", HUE.sky.soft)}>
            <FileText size={16} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-neutral-900" title={d.fileName}>
              {d.fileName}
            </span>
            <span className="block truncate text-xs text-neutral-500">
              {fileSize(d.size)}
              {d.uploadedBy ? ` · ${d.uploadedBy}` : ""}
              {d.uploadedAt ? ` · ${day(d.uploadedAt)}` : ""}
            </span>
          </span>
          <a
            href={documentHref(d.id)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 outline-none transition hover:bg-neutral-100 hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
            aria-label={`Download ${d.fileName}`}
            title="Download"
          >
            <Download size={16} aria-hidden />
          </a>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(d)}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none transition hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-error-400"
              aria-label={`Remove ${d.fileName}`}
              title="Remove"
            >
              <Trash2 size={16} aria-hidden />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * A drop target with a real button inside: drag a file onto it, or press it
 * and choose one. The keyboard path is the button; the drop is a shortcut.
 */
export function UploadZone({
  label,
  hint = "Drag a file here, or choose one. Up to 20 MB.",
  onFile,
  busy = false,
  disabled = false,
  compact = false,
  accept,
}: {
  label: string;
  hint?: string;
  onFile: (file: File) => void;
  busy?: boolean;
  disabled?: boolean;
  compact?: boolean;
  accept?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const hintId = useId();
  const pick = (f: File | undefined) => {
    if (f && !busy && !disabled) onFile(f);
  };
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files?.[0]);
      }}
      className={cx(
        "rounded-2xl border-2 border-dashed p-0.5 transition-colors",
        dragging ? "border-primary-500 bg-primary-50/70" : "border-primary-200/70 bg-primary-50/30 hover:border-primary-300",
        disabled && "opacity-60",
      )}
    >
      <button
        type="button"
        disabled={busy || disabled}
        onClick={() => input.current?.click()}
        aria-describedby={hintId}
        className={cx(
          "flex w-full cursor-pointer items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed",
          compact ? "min-h-11 px-3 py-2" : "flex-col px-4 py-6 text-center",
        )}
      >
        <span className={cx("flex shrink-0 items-center justify-center bg-white text-primary-600 shadow-sm ring-1 ring-primary-100", compact ? "h-9 w-9 rounded-xl" : "h-12 w-12 rounded-2xl")}>
          {busy ? <Loader2 size={compact ? 15 : 20} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <UploadCloud size={compact ? 15 : 20} aria-hidden />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-neutral-900">{busy ? "Uploading…" : dragging ? "Drop it to upload" : label}</span>
          <span id={hintId} className="block text-xs text-neutral-500">
            {hint}
          </span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-label={label}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/**
 * The document checklist: each item with whether it is required at this
 * amount, what is attached, and - while documents can still be added - its
 * own drop zone.
 */
export function ChecklistDocuments({
  items,
  documents,
  onUpload,
  onRemove,
  busyCode = null,
  errors = {},
}: {
  items: (Pick<ChecklistState, "code" | "label" | "hint" | "required"> & { requiredNote?: string })[];
  documents: SpendDocument[];
  onUpload?: (code: string, file: File) => void;
  onRemove?: (d: SpendDocument) => void;
  busyCode?: string | null;
  errors?: Record<string, string>;
}) {
  const others = documents.filter((d) => !items.some((i) => i.code === d.itemCode));
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const files = documents.filter((d) => d.itemCode === item.code);
        const has = files.length > 0;
        const missing = item.required && !has;
        return (
          <li
            key={item.code}
            className={cx(
              "rounded-[1.25rem] border p-4 transition-colors",
              missing ? "border-sun-500/40 bg-sun-50/40" : has ? "border-mint-500/30 bg-mint-50/30" : "border-neutral-200/80 bg-white",
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cx(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  has ? "bg-mint-500 text-white" : missing ? "bg-sun-100 text-sun-700" : "bg-neutral-100 text-neutral-500",
                )}
              >
                {has ? <Check size={14} aria-hidden /> : missing ? <AlertTriangle size={14} aria-hidden /> : <CircleDashed size={14} aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-900">
                  {item.label}
                  {item.required ? (
                    <Chip hue={has ? "mint" : "sun"} className="!px-2 !py-0.5 !text-[11px]">
                      {has ? "Required · attached" : "Required"}
                    </Chip>
                  ) : (
                    <Chip hue="slate" className="!px-2 !py-0.5 !text-[11px]">
                      {has ? "Optional · attached" : "Optional"}
                    </Chip>
                  )}
                </p>
                {(item.hint || item.requiredNote) && (
                  <p className="mt-0.5 text-xs text-neutral-500">{[item.hint, item.requiredNote].filter(Boolean).join(" ")}</p>
                )}
                {has && (
                  <div className="mt-3">
                    <DocumentList documents={files} onRemove={onRemove} />
                  </div>
                )}
                {onUpload && (
                  <div className="mt-3">
                    <UploadZone compact label={has ? `Add another to ${item.label.toLowerCase()}` : `Attach ${item.label.toLowerCase()}`} busy={busyCode === item.code} onFile={(f) => onUpload(item.code, f)} />
                  </div>
                )}
                {errors[item.code] && (
                  <p role="alert" className="mt-2 text-xs font-medium text-error-700">
                    {errors[item.code]}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
      {others.length > 0 && (
        <li className="rounded-[1.25rem] border border-neutral-200/80 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-neutral-900">Other documents</p>
          <DocumentList documents={others} onRemove={onRemove} />
        </li>
      )}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/*  Query threads                                                      */
/* ------------------------------------------------------------------ */

/**
 * The FCU's questions and the answers, kept on the document for good. A
 * thread that can be answered shows a reply box; the FCU can also close one
 * it is satisfied with.
 */
export function QueryThreads({
  queries,
  canReply,
  replyLabel = "Send the answer",
  replyHint,
  onReply,
  onClose,
}: {
  queries: SpendQuery[];
  canReply: (q: SpendQuery) => boolean;
  replyLabel?: string;
  replyHint?: string;
  onReply: (q: SpendQuery, body: string) => Promise<void>;
  onClose?: (q: SpendQuery) => Promise<void>;
}) {
  if (queries.length === 0) return <p className="text-sm text-neutral-500">No queries. The FCU asks here when something needs explaining.</p>;
  return (
    <div className="space-y-4">
      {queries.map((q) => (
        <QueryThread key={q.id} query={q} canReply={canReply(q)} replyLabel={replyLabel} replyHint={replyHint} onReply={onReply} onClose={onClose} />
      ))}
    </div>
  );
}

function QueryThread({
  query: q,
  canReply,
  replyLabel,
  replyHint,
  onReply,
  onClose,
}: {
  query: SpendQuery;
  canReply: boolean;
  replyLabel: string;
  replyHint?: string;
  onReply: (q: SpendQuery, body: string) => Promise<void>;
  onClose?: (q: SpendQuery) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxId = useId();
  const status = QUERY_STATUS[q.status] ?? { label: q.status, hue: "slate" as Hue };

  const send = async () => {
    if (!body.trim()) {
      setError("Write your answer first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onReply(q, body.trim());
      setBody("");
    } catch (e) {
      setError(spendError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-[1.25rem] border border-neutral-200/80 bg-neutral-50/40" aria-label={`Query from ${q.raisedBy ?? "the FCU"}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/70 bg-white px-4 py-3">
        <p className="text-sm font-semibold text-neutral-900">
          {CHECKPOINTS[q.checkpoint] ?? "FCU"} query
          <span className="font-normal text-neutral-500"> · raised {when(q.raisedAt)}</span>
        </p>
        <Chip hue={status.hue} dot>
          {status.label}
        </Chip>
      </header>
      <ol className="space-y-3 px-4 py-4">
        {q.messages.map((m) => (
          <li key={m.id} className="flex gap-3">
            <FaceAvatar name={m.author} size={30} />
            <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 shadow-sm ring-1 ring-neutral-200/70">
              <p className="text-xs text-neutral-500">
                <span className="font-semibold text-neutral-800">{m.author ?? "Someone"}</span> · {when(m.at)}
              </p>
              <RichTextView value={m.body} size="sm" className="mt-1 text-neutral-800" />
            </div>
          </li>
        ))}
      </ol>
      {(canReply || (onClose && q.status !== "closed")) && (
        <div className="border-t border-neutral-200/70 px-4 py-3">
          {canReply && (
            <>
              <label htmlFor={boxId} className="mb-1.5 block text-sm font-medium text-neutral-700">
                Your answer
              </label>
              <RichTextEditor id={boxId} value={body} onChange={setBody} describedBy={replyHint ? `${boxId}-hint` : undefined} />
              {replyHint && (
                <p id={`${boxId}-hint`} className="mt-1.5 text-xs text-neutral-500">
                  {replyHint}
                </p>
              )}
            </>
          )}
          {error && <ErrorNote className="mt-2">{error}</ErrorNote>}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {onClose && q.status !== "closed" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await onClose(q);
                  } catch (e) {
                    setError(spendError(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Close the query
              </Button>
            )}
            {canReply && (
              <Button size="sm" variant="primary" icon={MessageSquareReply} disabled={busy} onClick={() => void send()}>
                {busy ? "Sending…" : replyLabel}
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Funds, history, reviews                                            */
/* ------------------------------------------------------------------ */

/**
 * The project's funds when the request was sent, and what the request left:
 * released, committed and spent as a bar, the request on top, the rest
 * hatched.
 */
export function FundsSnapshotView({ snapshot, currency = "NGN" }: { snapshot: FundsSnapshot; currency?: string }) {
  const s = snapshot;
  const total = Math.max(1, s.released);
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / total) * 100))}%`;
  const over = s.afterRequest < 0;
  const uncontrolled = s.controlled === false;
  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">Checked {when(s.at)}</p>
      {uncontrolled ? (
        <p className="text-sm text-neutral-600">Project funds were not being controlled when this was sent, so nothing was held back.</p>
      ) : (
        <>
          <div className="ws-hatch flex h-3 overflow-hidden rounded-full" aria-hidden>
            <span className="h-full bg-gradient-to-r from-neutral-500 to-neutral-400" style={{ width: pct(s.actual) }} />
            <span className="h-full bg-gradient-to-r from-grape-500 to-grape-400" style={{ width: pct(s.committed) }} />
            <span className={cx("h-full bg-gradient-to-r", over ? "from-rose-500 to-rose-400" : "from-primary-500 to-primary-400")} style={{ width: pct(Math.min(s.request, Math.max(0, s.available))) }} />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <SnapRow label="Released" value={s.released} currency={currency} />
            <SnapRow label="Spent" value={s.actual} currency={currency} dot="bg-neutral-400" />
            <SnapRow label="Committed" value={s.committed} currency={currency} dot="bg-grape-500" />
            <SnapRow label="Available" value={s.available} currency={currency} />
            <SnapRow label="This request" value={s.request} currency={currency} dot={over ? "bg-rose-500" : "bg-primary-500"} />
            <SnapRow label="Left after it" value={s.afterRequest} currency={currency} strong />
          </dl>
        </>
      )}
      {s.overridden && (
        <div className="rounded-2xl bg-sun-50 px-4 py-3 text-sm text-sun-700 ring-1 ring-sun-500/30">
          <p className="font-semibold">Sent beyond the funds, with the MD&apos;s reason</p>
          {s.overrideReason && <p className="mt-0.5">&ldquo;{s.overrideReason}&rdquo;</p>}
        </div>
      )}
    </div>
  );
}

function SnapRow({ label, value, currency, dot, strong }: { label: string; value: number; currency: string; dot?: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs text-neutral-500">
        {dot && <span aria-hidden className={cx("h-2 w-2 rounded-full", dot)} />}
        {label}
      </dt>
      <dd className={cx("mt-0.5 font-semibold", strong ? "text-neutral-900" : "text-neutral-800")}>
        <Money value={value} currency={currency} />
      </dd>
    </div>
  );
}

/** Status changes, oldest first, joined by a rule. */
export function HistoryTimeline({ history, label }: { history: HistoryEntry[]; label: (status: string) => string }) {
  if (history.length === 0) return <p className="text-sm text-neutral-500">Nothing has happened to it yet.</p>;
  return (
    <div className="relative">
      <span className="absolute bottom-2 left-[15px] top-2 w-px bg-neutral-200" aria-hidden />
      <ol className="relative space-y-4">
        {history.map((h, i) => (
          <li key={`${h.to}-${h.at}-${i}`} className="relative flex gap-3">
            <span className="relative z-[1] rounded-full ring-4 ring-white">
              <FaceAvatar name={h.by ?? "System"} size={32} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm text-neutral-700">
                <span className="font-semibold text-neutral-900">{h.by ?? "The system"}</span> moved it to <span className="font-semibold text-neutral-900">{label(h.to).toLowerCase()}</span>
              </p>
              {h.comment && <p className="mt-0.5 text-sm text-neutral-600">&ldquo;{richExcerpt(h.comment, 300)}&rdquo;</p>}
              <p className="mt-0.5 text-xs text-neutral-500">{when(h.at)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Earlier FCU reviews, each with how every item was marked. */
export function ReviewList({ reviews }: { reviews: SpendReview[] }) {
  if (reviews.length === 0) return <p className="text-sm text-neutral-500">Not reviewed by the FCU yet.</p>;
  return (
    <ul className="space-y-4">
      {reviews.map((r) => {
        const o = OUTCOMES[r.outcome] ?? { label: r.outcome, hue: "slate" as Hue };
        return (
          <li key={r.id} className="rounded-[1.25rem] border border-neutral-200/80 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-neutral-900">
                {CHECKPOINTS[r.checkpoint] ?? "Review"}
                <span className="font-normal text-neutral-500">
                  {" "}
                  · {r.reviewer ?? "FCU"} · {when(r.at)}
                </span>
              </p>
              <Chip hue={o.hue} dot>
                {o.label}
              </Chip>
            </div>
            {r.comment && <RichTextView value={r.comment} size="sm" className="mt-2 border-l-2 border-primary-200 pl-3 text-neutral-700" />}
            <ul className="mt-3 divide-y divide-neutral-100">
              {(r.items ?? []).map((it) => {
                const m = MARKS[it.result] ?? MARKS.na;
                return (
                  <li key={it.code} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 text-neutral-700">
                      {it.label}
                      {it.comment && <span className="mt-0.5 block text-xs text-sun-700">{it.comment}</span>}
                    </span>
                    <Chip hue={m.hue} className="!px-2 !py-0.5 !text-[11px]">
                      {m.short}
                    </Chip>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

/** A small "n attached" count for a document list heading. */
export function AttachedCount({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
      <Paperclip size={12} aria-hidden />
      {n} {n === 1 ? "file" : "files"}
    </span>
  );
}
