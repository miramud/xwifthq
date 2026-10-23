"use client";

import { Check, CirclePause, CornerUpLeft, History, Lock, Users, X } from "lucide-react";
import { EventStatusChip } from "@/components/workspace/Calendar";
import { Chip, cx } from "@/components/workspace/kit";
import { RichTextView } from "@/components/workspace/RichTextView";
import { FaceAvatar } from "@/suite/lms/components/ui/ws";
import type { StageView, TaskView } from "@/lib/api/approvals-client";
import { actionLabel, dueStatus, formatDateTime, STAGE_STATUS, STAGE_TYPE } from "../lib/labels";

/*
  The route, as a routing slip: one numbered step per stage, in the order the
  request travels. The numbers are real — stage two does not start until
  stage one is done — so they earn their place.

  Each step says what kind of stage it is, who decided or who it waits on
  (and on whose behalf), why the stage is on the route at all, when it is
  due, and — for a stage that needs several people — how many have signed.
  Steps not yet reached are hatched: "not yet", in the workspace's texture.
*/

const APPROVING = new Set(["approved", "approved_with_amendment", "recommended", "acknowledged", "done"]);

export function signedCount(stage: StageView): number {
  return stage.tasks.filter((t) => APPROVING.has(t.action ?? "")).length;
}

/** How many approvals the stage needs in all, for "2 of 3 approved". */
export function neededCount(stage: StageView): number | null {
  if (stage.completion === "quorum" && stage.quorum) return stage.quorum;
  if (stage.completion === "all" || stage.completion === "all_projects") {
    return stage.tasks.filter((t) => t.status !== "cancelled").length || null;
  }
  return null;
}

function Marker({ stage }: { stage: StageView }) {
  const base = "relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ring-4 ring-white";
  switch (stage.status) {
    case "completed":
      return (
        <span className={cx(base, "bg-mint-500 text-white")}>
          <Check size={15} aria-hidden />
        </span>
      );
    case "rejected":
      return (
        <span className={cx(base, "bg-rose-500 text-white")}>
          <X size={15} aria-hidden />
        </span>
      );
    case "returned":
      return (
        <span className={cx(base, "bg-sun-500 text-white")}>
          <CornerUpLeft size={14} aria-hidden />
        </span>
      );
    case "active":
      return <span className={cx(base, "bg-primary-600 text-white shadow-[0_0_0_6px] shadow-primary-100")}>{stage.sequence}</span>;
    default:
      return <span className={cx(base, "ws-hatch border border-neutral-200 text-neutral-500")}>{stage.sequence}</span>;
  }
}

function TaskLine({ task, stageType }: { task: TaskView; stageType: StageView["type"] }) {
  const name = task.assignee?.name ?? "Unassigned";
  let state: React.ReactNode;
  if (task.action && task.status === "done") {
    state = (
      <>
        <span className="font-semibold text-neutral-800">{actionLabel(task.action)}</span>
        {task.actedAt && <span className="text-neutral-500"> · {formatDateTime(task.actedAt)}</span>}
      </>
    );
  } else if (task.status === "on_hold") {
    state = (
      <span className="inline-flex items-center gap-1 text-sun-700">
        <CirclePause size={12} aria-hidden /> On hold{task.holdUntil ? ` until ${formatDateTime(task.holdUntil)}` : ""}
      </span>
    );
  } else if (task.status === "cancelled") {
    state = <span className="text-neutral-500">{task.action ? actionLabel(task.action) : "No longer needed"}</span>;
  } else {
    state = <span className="text-primary-700">{stageType === "acknowledge" ? "Waiting to acknowledge" : "Waiting for a decision"}</span>;
  }

  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <FaceAvatar name={name} size={26} />
      <div className="min-w-0 text-[13px] leading-snug">
        <p className="text-neutral-900">
          <span className="font-semibold">{name}</span>
          {task.onBehalfOf && <span className="text-neutral-600"> for {task.onBehalfOf}</span>}
          {task.scope && <span className="text-neutral-500"> · {task.scope}</span>}
          {task.source === "pool" && <span className="text-neutral-500"> · shared pool</span>}
          {task.source === "escalated" && <span className="text-coral-700"> · escalated</span>}
          {task.source === "delegated" && !task.onBehalfOf && <span className="text-neutral-500"> · covering</span>}
        </p>
        <p className="mt-0.5">{state}</p>
        {task.amendments && Object.keys(task.amendments).length > 0 && (
          <p className="mt-0.5 text-xs text-neutral-600">Lowered {Object.keys(task.amendments).join(", ")} while approving</p>
        )}
        {task.comment && task.status !== "on_hold" && (
          <RichTextView value={task.comment} size="sm" className="mt-1 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-700" />
        )}
      </div>
    </li>
  );
}

export function RouteTimeline({ stages, notes = {} }: { stages: StageView[]; notes?: Record<string, string[]> }) {
  const ordered = [...stages].sort((a, b) => a.sequence - b.sequence);

  if (ordered.length === 0) {
    return <p className="text-sm text-neutral-500">This request has no route yet. An admin will route it.</p>;
  }

  return (
    <ol className="relative" aria-label="Route">
      <span className="absolute bottom-4 left-[15px] top-4 w-px bg-neutral-200" aria-hidden />
      {ordered.map((s) => {
        const signed = signedCount(s);
        const needed = neededCount(s);
        const due = s.status === "active" ? dueStatus(s.dueAt) : null;
        const st = STAGE_STATUS[s.status] ?? { label: s.status, hue: "slate" as const };
        const extra = notes[s.key] ?? [];
        return (
          <li key={s.id} className="relative flex gap-3 pb-6 last:pb-0">
            <Marker stage={s} />
            <div className={cx("min-w-0 flex-1", s.status === "skipped" && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h4 className="text-sm font-semibold text-neutral-900">
                  <span className="sr-only">Stage {s.sequence}: </span>
                  {s.name}
                </h4>
                <span className="text-xs text-neutral-500">{STAGE_TYPE[s.type] ?? s.type}</span>
                {s.isControl && (
                  <Chip hue="grape" icon={Lock}>
                    Control
                  </Chip>
                )}
                <Chip hue={st.hue} dot>
                  {st.label}
                </Chip>
                {due && <EventStatusChip status={due} />}
              </div>

              {(needed != null && needed > 1) && (
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700">
                  <Users size={12} aria-hidden />
                  {signed} of {needed} {s.type === "review" ? "recommended" : "approved"}
                  <span className="ml-1 inline-flex gap-0.5" aria-hidden>
                    {Array.from({ length: needed }, (_, i) => (
                      <span key={i} className={cx("h-1.5 w-4 rounded-full", i < signed ? "bg-mint-500" : "ws-hatch")} />
                    ))}
                  </span>
                </p>
              )}

              {s.carried && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-neutral-600">
                  <History size={12} aria-hidden /> Approval carried over from the earlier round
                </p>
              )}

              {s.tasks.length > 0 && (
                <ul className="mt-1.5">
                  {s.tasks.map((t) => (
                    <TaskLine key={t.id} task={t} stageType={s.type} />
                  ))}
                </ul>
              )}

              {(s.reasons.length > 0 || extra.length > 0) && (
                <details className="mt-1 text-xs text-neutral-600">
                  <summary className="cursor-pointer select-none font-medium text-neutral-600 hover:text-neutral-900">
                    Why this stage is on the route
                  </summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {[...s.reasons, ...extra].map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </details>
              )}

              {s.dueAt && s.status === "active" && (
                <p className="mt-1 text-xs text-neutral-500">Due {formatDateTime(s.dueAt)}</p>
              )}
              {s.completedAt && s.status !== "active" && s.status !== "waiting" && (
                <p className="mt-1 text-xs text-neutral-500">Finished {formatDateTime(s.completedAt)}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
