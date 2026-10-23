"use client";

import { Bug, CalendarDays, Clock, Layers, ListChecks } from "lucide-react";
import { AvatarStack, PersonAvatar, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import type { StoryRow, WorkItem } from "@/lib/api/projects-client";
import { ItemRef, TYPE_META, TypeChip, fmtDate, plural } from "./ui/pkit";

/* ------------------------------------------------------------------ */
/*  Plan facts: dates, points and hours, drawn one way everywhere      */
/* ------------------------------------------------------------------ */

export type Rollup = { hours: number | null; estimated: number; total: number };

/** `34` → `34h`, `6.5` → `6.5h`. Callers never pass 0: zero hours is "not estimated". */
export function fmtHours(hours: number): string {
  return `${Math.round(hours * 10) / 10}h`;
}

/**
 * A plan span as short as it can be read: `25 Sep – 1 Oct`, `Due 1 Oct`,
 * `From 25 Sep`, or null when neither date is set (older items have none).
 * The year appears only when the span crosses one — a board card is no place
 * for "2026" twice.
 */
export function shortSpan(start: string | null | undefined, due: string | null | undefined): string | null {
  if (!start && !due) return null;
  if (!start) return `Due ${fmtDate(due, false)}`;
  if (!due) return `From ${fmtDate(start, false)}`;
  if (start.slice(0, 10) === due.slice(0, 10)) return fmtDate(due, false);

  const crosses = start.slice(0, 4) !== due.slice(0, 4);

  return `${fmtDate(start, crosses)} – ${fmtDate(due, crosses)}`;
}

/**
 * A story's hours from its tasks. The server's `rollup` when it sent one;
 * otherwise worked out from the tasks already in hand, with the same rule —
 * null or zero hours is "not estimated" and is neither summed nor counted.
 */
export function storyRollup(story: Pick<StoryRow, "rollup"> & { tasks?: WorkItem[] }): Rollup | null {
  if (story.rollup != null) return story.rollup;
  if (story.tasks === undefined) return null;

  const estimated = story.tasks.filter((t) => (t.estimateHours ?? 0) > 0);

  return {
    hours: estimated.length === 0 ? null : estimated.reduce((sum, t) => sum + (t.estimateHours ?? 0), 0),
    estimated: estimated.length,
    total: story.tasks.length,
  };
}

/**
 * A story's points: its own when somebody sized the story, otherwise the sum
 * of its tasks' (D22) - an imported sheet puts "Story Points" on each task
 * row. The server sends that sum as `taskPoints`; a row without it (an older
 * payload, or one built client-side) is summed from `tasks` here.
 */
export function storyPoints(
  story: Pick<StoryRow, "estimatePoints"> & { taskPoints?: number | null; tasks?: WorkItem[] },
): { points: number | null; summed: boolean } {
  if (story.estimatePoints != null) return { points: story.estimatePoints, summed: false };

  if (story.taskPoints !== undefined) return { points: story.taskPoints ?? null, summed: story.taskPoints != null };

  const pointed = (story.tasks ?? []).filter((t) => t.estimatePoints != null);

  return pointed.length === 0
    ? { points: null, summed: false }
    : { points: pointed.reduce((sum, t) => sum + (t.estimatePoints ?? 0), 0), summed: true };
}

/** Story points as a small counter chip. Nothing at all when unpointed. */
export function PointsChip({
  points,
  summed = false,
  className,
}: {
  points: number | null | undefined;
  /** True when the figure is the sum of the tasks' points, not the story's own. */
  summed?: boolean;
  className?: string;
}) {
  if (points == null) return null;

  return (
    <span
      title={`${points} story point${points === 1 ? "" : "s"}${summed ? ", the sum of its tasks' points" : ""}`}
      className={cx(
        "inline-flex shrink-0 items-center rounded-full bg-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-neutral-700",
        className,
      )}
    >
      {points}
      <span className="ml-0.5 font-medium text-neutral-500">pt{points === 1 ? "" : "s"}</span>
    </span>
  );
}

/*
  A user story on the board, drawn as a summary and nothing more.

  The owner's ask was a card that says *how far along* and *who is on it*, and
  leaves the task list to the drawer: a card that listed its tasks would be
  five cards tall and the board would stop being a board. So the card carries
  the epic, the title, a progress line, the counts and the people — and a
  click (or Enter) opens the rest.
*/

/**
 * Done over all, as a line.
 *
 * **One segment per task while that is still readable** (up to twelve): a
 * story of three tasks with one done looks like a third of a bar *and* like
 * one of three things, which is what people actually count. Past twelve the
 * segments turn to hairlines, so it becomes one continuous bar. Either way the
 * part not yet done is the workspace's hatch — "not yet", never an empty
 * trough — and the fill turns mint when every task is done.
 */
export function StoryProgress({
  done,
  total,
  size = "sm",
  label,
  className,
}: {
  done: number;
  total: number;
  size?: "sm" | "lg";
  /** Accessible name for the bar; the visible figures say the same. */
  label?: string;
  className?: string;
}) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const complete = total > 0 && done >= total;
  const fill = complete ? HUE.mint.bar : HUE.blue.bar;
  const segmented = total > 0 && total <= 12;
  const height = size === "lg" ? "h-2.5" : "h-1.5";

  return (
    <div className={cx("w-full", className)}>
      <div
        className={cx(
          "mb-1.5 flex items-baseline justify-between gap-2 tabular-nums",
          size === "lg" ? "text-sm" : "text-[11.5px]",
        )}
      >
        <span className="text-neutral-600">
          {total === 0 ? (
            "No tasks yet"
          ) : (
            <>
              <span className="font-semibold text-neutral-900">{done}</span>
              <span className="text-neutral-500">/{total}</span> done
            </>
          )}
        </span>
        {total > 0 && (
          <span className={cx("font-semibold", complete ? "text-mint-700" : "text-neutral-900")}>{percent}%</span>
        )}
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={total === 0 ? "No tasks yet" : `${done} of ${total} tasks done`}
        aria-label={label ?? "Tasks done"}
        className={cx("flex w-full gap-[3px]", height)}
      >
        {segmented ? (
          Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className={cx(
                "h-full flex-1 rounded-full transition-colors duration-300",
                i < done ? fill : "ws-hatch",
              )}
            />
          ))
        ) : (
          <span aria-hidden className="ws-hatch h-full w-full overflow-hidden rounded-full">
            <span
              className={cx("block h-full rounded-full transition-[width] duration-500", fill)}
              style={{ width: `${percent}%` }}
            />
          </span>
        )}
      </div>
    </div>
  );
}

/** Shared by both cards: open on click or Enter/Space, move on Alt+←/→. */
function cardKeys(onOpen: () => void, onStep?: (dir: -1 | 1) => void) {
  return (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    } else if (onStep !== undefined && e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      e.preventDefault();
      onStep(e.key === "ArrowRight" ? 1 : -1);
    }
  };
}

type DragProps = {
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  /** Keyboard move to the neighbouring column; absent when the viewer may not move it. */
  onStep?: (dir: -1 | 1) => void;
};

export function StoryCard({
  story,
  onOpen,
  onDragStart,
  onDragEnd,
  onStep,
}: { story: StoryRow; onOpen: () => void } & DragProps) {
  const { progress } = story;
  const tasks = progress.total - story.bugCount;
  const rollup = storyRollup(story);
  const span = shortSpan(story.startsOn, story.dueOn);

  return (
    <article
      /*
        role=button on the article rather than a nested button, for the same
        reason the old task board gave: the whole card is the way in, and dragging a
        real button is unreliable across browsers.
      */
      role="button"
      tabIndex={0}
      aria-label={`${story.title}. ${progress.total === 0 ? "No tasks yet" : `${progress.done} of ${progress.total} done`}. Open the story`}
      aria-keyshortcuts={onStep ? "Alt+ArrowLeft Alt+ArrowRight" : undefined}
      onClick={onOpen}
      onKeyDown={cardKeys(onOpen, onStep)}
      draggable={story.can.move}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cx(
        "ws-card group relative overflow-hidden p-4 text-left outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-300",
        story.can.move ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
      )}
    >
      {/* The story hue as a thin edge, like every other card on a board. */}
      <span className={cx("absolute inset-y-0 left-0 w-1", HUE.blue.bar)} aria-hidden />

      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {story.epic != null ? (
            <span
              className={cx(
                "inline-flex min-w-0 max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                HUE.grape.soft,
              )}
              title={`Epic: ${story.epic.title}`}
            >
              <Layers size={11} className="shrink-0" aria-hidden />
              <span className="sr-only">Epic: </span>
              <span className="truncate">{story.epic.title}</span>
            </span>
          ) : (
            <TypeChip type="story" label="Story" />
          )}
          <ItemRef value={story.externalRef} />
          <PointsChip {...storyPoints(story)} />
        </div>

        {story.assignees.length > 0 && (
          <span className="shrink-0" title={story.assignees.map((a) => a.name ?? "Unnamed").join(", ")}>
            <AvatarStack people={story.assignees.map((a) => ({ name: a.name ?? "Unnamed" }))} max={3} size={24} />
          </span>
        )}
      </div>

      <p className="mt-2.5 line-clamp-2 text-sm font-semibold leading-snug text-neutral-900">{story.title}</p>

      <StoryProgress done={progress.done} total={progress.total} className="mt-3" label={`Progress of ${story.title}`} />

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-neutral-100 pt-2.5 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-1">
          <ListChecks size={12} aria-hidden />
          {plural(tasks, "task")}
        </span>
        {story.bugCount > 0 && (
          <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
            <Bug size={12} aria-hidden />
            {plural(story.bugCount, "bug")}
          </span>
        )}
        {/* Summary only: the hours the tasks add up to, and when it runs. */}
        {rollup?.hours != null && (
          <span
            className="inline-flex items-center gap-1 tabular-nums"
            title={`${fmtHours(rollup.hours)} from tasks, ${rollup.estimated} of ${rollup.total} estimated`}
          >
            <Clock size={12} aria-hidden />
            {fmtHours(rollup.hours)}
          </span>
        )}
        {span !== null && (
          <span className="ml-auto inline-flex items-center gap-1 tabular-nums" title="Planned dates">
            <CalendarDays size={12} aria-hidden />
            {span}
          </span>
        )}
      </div>
    </article>
  );
}

/**
 * Work under no story — a bug raised on its own, a spike, a stray task. Still
 * real work, so it sits in its column; smaller, and labelled for what it is,
 * so it never reads as a story with nothing in it.
 */
export function LooseCard({
  item,
  onOpen,
  onDragStart,
  onDragEnd,
  onStep,
}: { item: WorkItem; onOpen: () => void } & DragProps) {
  const hue = TYPE_META[item.type]?.hue ?? "slate";

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${item.typeLabel}, not in a story: ${item.title}`}
      aria-keyshortcuts={onStep ? "Alt+ArrowLeft Alt+ArrowRight" : undefined}
      onClick={onOpen}
      onKeyDown={cardKeys(onOpen, onStep)}
      draggable={item.can.move}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cx(
        "relative overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-white/80 px-3 py-2.5 text-left outline-none transition hover:border-neutral-400 hover:bg-white focus-visible:ring-2 focus-visible:ring-primary-300",
        item.can.move ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
      )}
    >
      <span className={cx("absolute inset-y-0 left-0 w-0.5", HUE[hue].bar)} aria-hidden />
      <div className="flex items-center gap-1.5">
        <TypeChip type={item.type} label={item.typeLabel} />
        <span className="truncate text-[11px] font-medium text-neutral-500">Not in a story</span>
        {item.assignee != null && (
          <span className="ml-auto shrink-0">
            <PersonAvatar name={item.assignee.name ?? "Unnamed"} size={22} />
          </span>
        )}
      </div>
      <p
        className={cx(
          "mt-1.5 line-clamp-2 text-[13px] font-medium leading-snug",
          item.isComplete ? "text-neutral-500 line-through" : "text-neutral-800",
        )}
      >
        {item.title}
      </p>
    </article>
  );
}
