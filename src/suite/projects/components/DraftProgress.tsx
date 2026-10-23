"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CircleDashed,
  FileSearch,
  FileText,
  ListChecks,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button, cx } from "@/components/workspace/kit";
import type { GenerationProgress, GenerationProgressStep } from "@/lib/api/projects-client";

/*
  Drafting a plan, step by step, as it happens.

  Every step on this card is real: the upload is the browser's own byte
  count, the server reports reading, checking, drafting and arranging as it
  does them (`GenerationProgress` on the API), and the breakdown is the
  epic-by-epic loop the preview runs. Nothing advances on a timer except the
  one thing nobody can measure from inside: how far the AI is through writing
  its answer. That step shows the time it has taken against how long it
  usually takes, and says it is an estimate.

  Long-running-job practice: one card that stays put, a determinate overall
  bar, each step with its state as icon *and* words, what each step found,
  the failure on the step that failed with what to do next, and an
  announcement for screen readers whenever a step changes.
*/

export type DraftRunPhase = "drafting" | "breaking-down" | "ready" | "failed" | "attention";

export interface DraftRun {
  key: string;
  fileName: string | null;
  fileSize: number | null;
  startedAt: number;
  /** Bytes sent, 0 to 1; null for a typed brief. */
  upload: number | null;
  server: GenerationProgress | null;
  phase: DraftRunPhase;
  error: string | null;
  breakdown: { total: number; done: number; current: string | null; failed: number } | null;
  summary: { epics: number; stories: number; tasks: number; hours: number; people: number } | null;
  finishedAt: number | null;
  /** Said under the title while something unusual is being handled ("the connection dropped…"). */
  notice?: string | null;
}

type StepState = "pending" | "active" | "done" | "failed" | "attention";

interface Row {
  key: string;
  label: string;
  icon: LucideIcon;
  state: StepState;
  detail: string | null;
  /** 0..1 within the step, for the bar; null when indeterminate. */
  fraction: number | null;
  timing: string | null;
}

/* How much of the bar each step is worth. The AI's writing is most of the wait. */
const WEIGHTS = { upload: 10, read: 8, check: 2, plan: 45, arrange: 5, breakdown: 30 } as const;

const ICONS: Record<string, LucideIcon> = {
  upload: Upload,
  read: FileSearch,
  check: ShieldCheck,
  plan: Sparkles,
  arrange: Users,
  breakdown: ListChecks,
};

export default function DraftProgress({
  run,
  onRetry,
  onDismiss,
}: {
  run: DraftRun;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  const live = run.phase === "drafting" || run.phase === "breaking-down";
  const now = useNow(live);
  const rows = buildRows(run, now);
  const percent = overall(rows, run);
  const elapsed = Math.max(0, Math.round(((run.finishedAt ?? now) - run.startedAt) / 1000));
  const current = rows.find((r) => r.state === "active" || r.state === "failed" || r.state === "attention");

  const tone =
    run.phase === "failed"
      ? { ring: "border-error-200", bar: "bg-error-500", chip: "bg-error-50 text-error-700", word: "Stopped" }
      : run.phase === "attention"
        ? { ring: "border-sun-300", bar: "bg-sun-500", chip: "bg-sun-50 text-sun-700", word: "Needs more detail" }
        : run.phase === "ready"
          ? { ring: "border-mint-200", bar: "bg-mint-500", chip: "bg-mint-50 text-mint-700", word: "Ready" }
          : { ring: "border-primary-200", bar: "bg-primary-600", chip: "bg-primary-50 text-primary-700", word: "Working" };

  return (
    <section aria-labelledby={`${run.key}-title`} className={cx("ws-card overflow-hidden border", tone.ring)}>
      {/* ---------------------------------------------------- header */}
      <div className="flex flex-wrap items-start gap-3 px-5 pt-5">
        <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone.chip)}>
          {run.phase === "ready" ? (
            <Check size={20} aria-hidden />
          ) : run.phase === "failed" ? (
            <X size={20} aria-hidden />
          ) : run.phase === "attention" ? (
            <AlertTriangle size={20} aria-hidden />
          ) : (
            <Loader2 size={20} className="animate-spin" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`${run.key}-title`} className="text-[15px] font-semibold text-neutral-900">
            {run.phase === "ready"
              ? "Your plan is ready to review"
              : run.phase === "failed"
                ? "The plan was not drafted"
                : run.phase === "attention"
                  ? "The brief needs a little more"
                  : (run.server?.title ?? (run.fileName ? `Drafting a plan from ${run.fileName}` : "Drafting a plan from your brief"))}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
            {run.fileName && (
              <span className="inline-flex items-center gap-1">
                <FileText size={12} aria-hidden /> {run.fileName}
                {run.fileSize !== null && ` · ${fileSize(run.fileSize)}`}
              </span>
            )}
            <span className="tabular-nums">{duration(elapsed)} elapsed</span>
          </p>
        </div>
        <span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold", tone.chip)}>{tone.word}</span>
        {!live && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close the progress report"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <X size={16} aria-hidden />
          </button>
        )}
      </div>

      {run.notice && (
        <p className="mx-5 mt-3 rounded-xl border border-sun-200 bg-sun-50 px-3 py-2 text-xs text-sun-800">{run.notice}</p>
      )}

      {/* --------------------------------------------------- overall bar */}
      <div className="px-5 pt-4">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium text-neutral-700">{current ? current.label : run.phase === "ready" ? "All steps done" : "Starting"}</span>
          <span className="tabular-nums font-semibold text-neutral-900">{percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Plan drafting progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`${percent}% · ${current?.label ?? tone.word}`}
          className="ws-hatch mt-1.5 h-2.5 overflow-hidden rounded-full"
        >
          <div className={cx("h-full rounded-full transition-[width] duration-500 ease-out", tone.bar)} style={{ width: `${percent}%` }} />
        </div>
      </div>

      {/* ------------------------------------------------------- steps */}
      <ol className="mt-4 space-y-0 px-5 pb-5">
        {rows.map((row, i) => (
          <StepRow key={row.key} row={row} last={i === rows.length - 1} />
        ))}
      </ol>

      {/* -------------------------------------------------- outcomes */}
      {run.phase === "failed" && (
        <div role="alert" className="border-t border-error-100 bg-error-50/60 px-5 py-4">
          <p className="text-sm font-semibold text-error-800">Why it stopped</p>
          <p className="mt-1 text-sm text-error-700">{run.error ?? "Something went wrong."}</p>
          <p className="mt-1 text-xs text-error-700/80">Nothing was added to the board. Fix the brief or the file below if the reason points to it, then try again.</p>
          {onRetry && (
            <Button size="sm" icon={RotateCcw} className="mt-3" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      )}

      {run.phase === "attention" && (
        <div className="border-t border-sun-200 bg-sun-50/60 px-5 py-4 text-sm text-sun-800">
          Nothing failed: the brief does not say enough to plan without guessing. Answer the questions below in the brief, then draft again.
        </div>
      )}

      {run.phase === "ready" && run.summary && (
        <div className="border-t border-mint-100 bg-mint-50/60 px-5 py-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Epics", run.summary.epics],
              ["Stories", run.summary.stories],
              ["Tasks", run.summary.tasks],
              ["Hours", run.summary.hours],
              ["People", run.summary.people],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-mint-700">{label}</dt>
                <dd className="text-lg font-bold tabular-nums text-neutral-900">{Number(value).toLocaleString()}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-mint-800">Nothing is on the board yet. Read the plan below, change what is wrong, then add it.</p>
        </div>
      )}

      {/* One sentence for screen readers whenever the step changes. */}
      <p className="sr-only" aria-live="polite" role="status">
        {run.phase === "ready"
          ? "The plan is ready to review."
          : run.phase === "failed"
            ? "" /* the reason box is an alert of its own */
            : current
              ? `${current.label}${current.detail ? `: ${current.detail}` : ""}`
              : ""}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function StepRow({ row, last }: { row: Row; last: boolean }) {
  const Icon = row.icon;

  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last && (
        <span aria-hidden className={cx("absolute left-[15px] top-8 h-[calc(100%-1.75rem)] w-px", row.state === "done" ? "bg-mint-300" : "bg-neutral-200")} />
      )}
      <span
        className={cx(
          "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
          row.state === "done" && "border-mint-300 bg-mint-50 text-mint-700",
          row.state === "active" && "border-primary-300 bg-primary-50 text-primary-700",
          row.state === "failed" && "border-error-300 bg-error-50 text-error-700",
          row.state === "attention" && "border-sun-300 bg-sun-50 text-sun-700",
          row.state === "pending" && "border-neutral-200 bg-white text-neutral-400",
        )}
      >
        {row.state === "done" ? (
          <Check size={15} aria-hidden />
        ) : row.state === "active" ? (
          <Loader2 size={15} className="animate-spin" aria-hidden />
        ) : row.state === "failed" ? (
          <X size={15} aria-hidden />
        ) : row.state === "attention" ? (
          <AlertTriangle size={14} aria-hidden />
        ) : (
          <Icon size={14} aria-hidden />
        )}
      </span>

      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className={cx("text-sm font-medium", row.state === "pending" ? "text-neutral-500" : "text-neutral-900")}>
            {row.label}
            <span className="sr-only">
              {" "}
              ({row.state === "done" ? "done" : row.state === "active" ? "in progress" : row.state === "failed" ? "failed" : row.state === "attention" ? "needs attention" : "not started"})
            </span>
          </p>
          {row.timing && <span className="text-xs tabular-nums text-neutral-500">{row.timing}</span>}
        </div>
        {row.detail && (
          <p className={cx("mt-0.5 text-xs", row.state === "failed" ? "text-error-700" : row.state === "attention" ? "text-sun-700" : "text-neutral-600")}>
            {row.detail}
          </p>
        )}
        {row.state === "active" && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100" aria-hidden>
            {row.fraction === null ? (
              <div className="rt-indeterminate h-full w-1/3 rounded-full bg-primary-400" />
            ) : (
              <div className="h-full rounded-full bg-primary-500 transition-[width] duration-300" style={{ width: `${Math.round(row.fraction * 100)}%` }} />
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */

function buildRows(run: DraftRun, now: number): Row[] {
  const rows: Row[] = [];
  const failedHere = (key: string) => run.phase === "failed" && run.server === null && key === (run.upload !== null && run.upload < 1 ? "upload" : "read");

  if (run.fileName !== null) {
    const fraction = run.upload ?? 0;
    const uploaded = fraction >= 1;

    rows.push({
      key: "upload",
      label: uploaded ? "Uploaded the document" : "Uploading the document",
      icon: ICONS.upload,
      state: failedHere("upload") ? "failed" : uploaded ? "done" : "active",
      detail: failedHere("upload") ? "Stopped here — the reason is below" : run.fileSize !== null ? `${fileSize(Math.round(run.fileSize * Math.min(1, fraction)))} of ${fileSize(run.fileSize)}` : null,
      fraction,
      timing: uploaded ? null : `${Math.round(fraction * 100)}%`,
    });
  }

  const uploaded = run.upload === null || run.upload >= 1;
  const serverSteps: GenerationProgressStep[] =
    run.server?.steps ??
    ([
      ["read", run.fileName ? "Reading the document" : "Reading your brief"],
      ["check", "Checking it can be planned"],
      ["plan", "Drafting epics and user stories"],
      ["arrange", "Arranging the plan for your team"],
    ] as const).map(([key, label]) => ({
      key,
      label,
      /* Once the bytes are in, the server is reading, whether or not it has said so yet. */
      status: key === "read" && uploaded && run.phase === "drafting" ? "active" : "pending",
      detail: null,
      startedAt: null,
      endedAt: null,
      expectedSeconds: null,
    }));

  for (const s of serverSteps) {
    const state: StepState = failedHere(s.key) ? "failed" : s.status;
    let fraction: number | null = null;
    let timing: string | null = null;

    if (s.startedAt && s.endedAt) {
      timing = duration((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 1000, true);
    } else if (s.startedAt && state === "active") {
      const seconds = Math.max(0, (now - Date.parse(s.startedAt)) / 1000);
      if (s.expectedSeconds) {
        fraction = Math.min(0.92, seconds / s.expectedSeconds);
        timing = `${duration(seconds)} · usually about ${duration(s.expectedSeconds)}`;
      } else {
        timing = duration(seconds);
      }
    }

    rows.push({
      key: s.key,
      label: s.label,
      icon: ICONS[s.key] ?? CircleDashed,
      state,
      detail: failedHere(s.key) || state === "failed" ? "Stopped here — the reason is below" : s.status === "active" && s.key === "plan" && s.detail ? `${s.detail}. This step is the AI writing; its length is an estimate.` : s.detail,
      fraction,
      timing,
    });
  }

  /* The epics into tasks: the preview's own loop, one epic per request. */
  const b = run.breakdown;
  const breakdownState: StepState =
    run.phase === "ready"
      ? b && b.failed > 0
        ? "attention"
        : "done"
      : run.phase === "breaking-down"
        ? "active"
        : "pending";

  rows.push({
    key: "breakdown",
    label: "Breaking each epic into tasks and estimates",
    icon: ICONS.breakdown,
    state: breakdownState,
    detail:
      b === null
        ? null
        : breakdownState === "active"
          ? `Epic ${Math.min(b.done + 1, b.total)} of ${b.total}${b.current ? ` · ${b.current}` : ""}`
          : b.failed > 0
            ? `${b.failed} ${b.failed === 1 ? "epic needs" : "epics need"} a retry — use Retry on the epic below`
            : run.summary
              ? `${run.summary.tasks.toLocaleString()} tasks · ${run.summary.hours.toLocaleString()} hours estimated`
              : null,
    fraction: b && b.total > 0 ? b.done / b.total : null,
    timing: b && b.total > 0 && breakdownState === "active" ? `${b.done} of ${b.total}` : null,
  });

  return rows;
}

function overall(rows: Row[], run: DraftRun): number {
  if (run.phase === "ready") return 100;

  let total = 0;
  let done = 0;

  for (const r of rows) {
    const w = WEIGHTS[r.key as keyof typeof WEIGHTS] ?? 0;
    total += w;
    done += r.state === "done" || r.state === "attention" ? w : r.state === "active" ? w * (r.fraction ?? 0.1) : 0;
  }

  return total === 0 ? 0 : Math.min(99, Math.round((done / total) * 100));
}

/** Ticks once a second while something is running, so elapsed times move. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  return now;
}

function duration(seconds: number, precise = false): string {
  if (precise && seconds < 10) return `${Math.max(0.1, Math.round(seconds * 10) / 10)} s`;
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${s % 60} s`;
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
