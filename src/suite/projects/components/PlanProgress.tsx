"use client";

import { CheckCircle2, Loader2, Play, Square } from "lucide-react";
import { Button, cx } from "@/components/workspace/kit";
import type { PlanEpic } from "@/lib/api/projects-client";
import type { EpicRun } from "./PlanTree";

/**
 * The breakdown loop, drawn as a rail of one segment per epic.
 *
 * A segment is done (mint), in hand (blue), failed (coral) or not yet —
 * and "not yet" is the workspace's hatch, never an empty trough. The
 * sentence beside it says which epic, by name, because "3 of 6" alone does
 * not tell a reader whether the one they care about is next.
 *
 * Stop is honest about what it does: the request in flight finishes (it is
 * already paid for), then nothing else starts.
 */
export default function PlanProgress({
  epics,
  runs,
  running,
  stopping,
  onStop,
  onContinue,
  disabled = false,
}: {
  epics: PlanEpic[];
  runs: Record<number, EpicRun | undefined>;
  running: boolean;
  stopping: boolean;
  onStop: () => void;
  onContinue: () => void;
  disabled?: boolean;
}) {
  const total = epics.length;
  const done = epics.filter((e) => e.brokenDown).length;
  const current = epics.findIndex((_, i) => runs[i]?.state === "running");
  const failed = epics.filter((_, i) => runs[i]?.state === "failed").length;
  const left = total - done;

  if (total === 0) return null;

  let sentence: React.ReactNode;

  if (running && current >= 0) {
    sentence = (
      <>
        <span className="font-semibold text-neutral-900">{`Breaking down ${current + 1} of ${total}`}</span>
        <span className="text-neutral-600">{`: ${epics[current].title}`}</span>
      </>
    );
  } else if (left === 0) {
    sentence = <span className="font-semibold text-neutral-900">{`All ${total} epics broken down into tasks`}</span>;
  } else {
    sentence = (
      <>
        <span className="font-semibold text-neutral-900">{`${left} of ${total} ${total === 1 ? "epic" : "epics"} not broken down yet`}</span>
        <span className="text-neutral-600">
          {failed > 0
            ? `. ${failed} did not come back; retry ${failed === 1 ? "it" : "them"} on the epic, or continue.`
            : ". Their stories have no tasks, hours or dates until they are."}
        </span>
      </>
    );
  }

  return (
    <section
      aria-label="Breaking the plan down"
      className={cx(
        "rounded-2xl border px-4 py-3.5",
        running ? "border-primary-100 bg-primary-50/50" : left === 0 ? "border-mint-100 bg-mint-50/50" : "border-neutral-200 bg-white",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {running ? (
            <Loader2 size={17} className="mt-0.5 shrink-0 animate-spin text-primary-600" aria-hidden />
          ) : left === 0 ? (
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-mint-600" aria-hidden />
          ) : null}
          <p aria-live="polite" className="min-w-0 text-sm leading-snug">
            {sentence}
          </p>
        </div>

        {running ? (
          <Button size="sm" icon={stopping ? Loader2 : Square} onClick={onStop} disabled={stopping}>
            {stopping ? "Stopping after this epic…" : "Stop"}
          </Button>
        ) : (
          left > 0 && (
            <Button size="sm" icon={Play} onClick={onContinue} disabled={disabled}>
              Continue breaking down
            </Button>
          )
        )}
      </div>

      <div
        role="progressbar"
        aria-label="Epics broken down"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total} epics broken down`}
        className="mt-3 flex gap-1"
      >
        {epics.map((epic, i) => {
          const state = runs[i]?.state;

          return (
            <span
              key={i}
              title={epic.title}
              className={cx(
                "h-2 flex-1 rounded-full transition-colors duration-300",
                epic.brokenDown
                  ? "bg-mint-500"
                  : state === "running"
                    ? "animate-pulse bg-primary-500"
                    : state === "failed"
                      ? "bg-coral-500"
                      : "ws-hatch",
              )}
            />
          );
        })}
      </div>
    </section>
  );
}
