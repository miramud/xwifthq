"use client";

import { useId, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  Clock,
  Layers,
  ListChecks,
  OctagonAlert,
  PanelRightOpen,
  Pencil,
  Plus,
  Target,
} from "lucide-react";
import { Button, Chip, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import type { BoardSetup, Project, Sprint, StoryRow, WorkItem } from "@/lib/api/projects-client";
import { StoryProgress, fmtHours, shortSpan, storyPoints, storyRollup } from "./StoryCard";
import {
  Drawer,
  ItemRef,
  NameAvatar,
  Notice,
  StatusChip,
  TypeChip,
  inputCls,
  fmtRange,
  labelCls,
} from "./ui/pkit";
import { RichTextView } from "@/components/workspace/RichTextView";

/*
  One user story, all of it: what it is for, how far along it is, and every
  task inside it, ticked off by the people doing them.

  The drawer holds no copy of the story. It draws whatever the board or the
  list currently holds and hands every change back up (see `useStories`), so a
  tick here moves the card's progress line behind it in the same frame, and a
  refusal puts both back together.
*/

/** Whom this viewer may hand a task to. The API has the last word (422). */
function assignable(
  setup: BoardSetup,
  project: Project,
  viewerId: string | undefined,
  current: WorkItem["assignee"],
): { id: string; name: string }[] {
  const everybody = project.can?.manageBoard !== false || viewerId === undefined;
  const people = everybody
    ? setup.assignees.map((a) => ({ id: a.id, name: a.name }))
    : setup.assignees.filter((a) => a.id === viewerId).map((a) => ({ id: a.id, name: a.name }));

  if (current != null && !people.some((p) => p.id === current.id)) {
    people.push({ id: current.id, name: current.name ?? "Unnamed" });
  }

  return people;
}

/**
 * The task checklist. Used by the drawer and by the expanded rows of the
 * backlog list, so ticking reads the same wherever it happens.
 */
export function StoryTaskList({
  story,
  project,
  setup,
  viewerId,
  onTick,
  onAssign,
  onOpenTask,
  compact = false,
}: {
  story: StoryRow;
  project: Project;
  setup: BoardSetup;
  viewerId?: string;
  onTick: (task: WorkItem, done: boolean) => void;
  onAssign?: (task: WorkItem, assigneeId: string | null) => void;
  onOpenTask?: (task: WorkItem) => void;
  /** The backlog's inline version: no assign control. */
  compact?: boolean;
}) {
  if (story.tasks.length === 0) {
    return (
      <p className="ws-hatch rounded-xl px-4 py-5 text-center text-sm font-medium text-neutral-600">
        No tasks in this story yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
      {story.tasks.map((task) => {
        const done = task.isComplete;
        const checkId = `tick-${story.id}-${task.id}`;
        /* Zero hours is "not estimated", so it is not drawn as 0h. */
        const hours = (task.estimateHours ?? 0) > 0 ? task.estimateHours : null;
        const span = shortSpan(task.startsOn, task.dueOn);

        return (
          <li
            key={task.id}
            className={cx(
              "flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 transition-colors sm:flex-nowrap",
              done && "bg-neutral-50/70",
            )}
          >
            {/* A 44px tap target around a 20px box. */}
            <label
              htmlFor={checkId}
              className={cx(
                "-m-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                task.can.move ? "cursor-pointer hover:bg-neutral-100" : "cursor-not-allowed",
              )}
              title={
                task.can.move ? undefined : "Only whoever it is assigned to, or a board manager, can tick this"
              }
            >
              <input
                id={checkId}
                type="checkbox"
                checked={done}
                disabled={!task.can.move}
                onChange={(e) => onTick(task, e.target.checked)}
                aria-label={done ? `Mark “${task.title}” not done` : `Mark “${task.title}” done`}
                className="h-5 w-5 cursor-[inherit] rounded accent-mint-600 disabled:opacity-50"
              />
            </label>

            <div className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-auto">
              <p
                className={cx(
                  "text-sm leading-snug transition-colors",
                  done ? "text-neutral-500 line-through decoration-neutral-400" : "font-medium text-neutral-900",
                )}
              >
                {task.title}
              </p>
              {(task.type !== "task" || task.externalRef !== null || hours !== null || span !== null) && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {task.type !== "task" && <TypeChip type={task.type} label={task.typeLabel} />}
                  <ItemRef value={task.externalRef} />
                  {hours !== null && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium tabular-nums text-neutral-500">
                      <Clock size={11} aria-hidden />
                      {fmtHours(hours)}
                    </span>
                  )}
                  {span !== null && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium tabular-nums text-neutral-500">
                      <CalendarDays size={11} aria-hidden />
                      {span}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="ml-11 flex min-w-0 items-center gap-2 sm:ml-0">
              {compact || onAssign === undefined || !task.can.update ? (
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-neutral-600">
                  <NameAvatar name={task.assignee?.name ?? null} size={24} />
                  <span className="truncate">{task.assignee?.name ?? "Unassigned"}</span>
                </span>
              ) : (
                <>
                  <NameAvatar name={task.assignee?.name ?? null} size={24} />
                  <SearchableSelect
                    value={task.assignee?.id ?? ""}
                    onChange={(value) => onAssign(task, value === "" ? null : value)}
                    aria-label={`Assign “${task.title}”`}
                    size="sm"
                    className="w-36 sm:w-40"
                    searchPlaceholder="Search people"
                    options={[
                      { value: "", label: "Unassigned" },
                      ...assignable(setup, project, viewerId, task.assignee).map((p) => ({
                        value: p.id,
                        label: p.id === viewerId ? `${p.name} (you)` : p.name,
                      })),
                    ]}
                  />
                </>
              )}

              {onOpenTask !== undefined && (
                <button
                  type="button"
                  onClick={() => onOpenTask(task)}
                  aria-label={`Open “${task.title}”`}
                  title="Open the full item"
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                >
                  <PanelRightOpen size={16} aria-hidden />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** "Add task" at the foot of the checklist: a title, and optionally who. */
function AddTask({
  story,
  project,
  setup,
  viewerId,
  onAdd,
  onMore,
}: {
  story: StoryRow;
  project: Project;
  setup: BoardSetup;
  viewerId?: string;
  onAdd: (input: { title: string; assigneeId: string | null }) => Promise<boolean>;
  /** The full item form, with this story already chosen. */
  onMore?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [saving, setSaving] = useState(false);
  const id = useId();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (saving || title.trim() === "") return;

    setSaving(true);
    const ok = await onAdd({ title: title.trim(), assigneeId: assigneeId === "" ? null : assigneeId });
    setSaving(false);

    if (ok) setTitle("");
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-2xl border border-dashed border-neutral-300 p-3">
      <label htmlFor={`${id}-t`} className={labelCls}>
        Add a task to this story
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`${id}-t`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing"
          maxLength={240}
          className={cx(inputCls, "sm:flex-1")}
        />
        <SearchableSelect
          value={assigneeId}
          onChange={setAssigneeId}
          aria-label="Assign the new task"
          className="w-full sm:w-44"
          searchPlaceholder="Search people"
          options={[
            { value: "", label: "Nobody yet" },
            ...assignable(setup, project, viewerId, null).map((p) => ({
              value: p.id,
              label: p.id === viewerId ? `${p.name} (you)` : p.name,
            })),
          ]}
        />
        <Button type="submit" variant="primary" icon={Plus} disabled={saving || title.trim() === ""}>
          {saving ? "Adding…" : "Add task"}
        </Button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        <span>{story.sprintId !== null ? "It joins the story’s sprint." : "It stays with the story in the backlog."}</span>
        {onMore !== undefined && (
          <button
            type="button"
            onClick={onMore}
            className="cursor-pointer rounded-lg px-1.5 py-1 font-semibold text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            Add with more detail
          </button>
        )}
      </div>
    </form>
  );
}

export default function StoryDrawer({
  story,
  project,
  setup,
  sprints = [],
  viewerId,
  error,
  onDismissError,
  onTick,
  onAssign,
  onAddTask,
  onOpenTask,
  onNewTask,
  onEditStory,
  onClose,
  closeOnEscape = true,
}: {
  story: StoryRow;
  project: Project;
  setup: BoardSetup;
  sprints?: Sprint[];
  viewerId?: string;
  error: string | null;
  onDismissError?: () => void;
  onTick: (task: WorkItem, done: boolean) => void;
  onAssign: (task: WorkItem, assigneeId: string | null) => void;
  onAddTask: (input: { title: string; assigneeId: string | null }) => Promise<boolean>;
  onOpenTask?: (task: WorkItem) => void;
  /** Open the full item form for a new task under this story. */
  onNewTask?: () => void;
  onEditStory?: () => void;
  onClose: () => void;
  /** False while the item panel is open over this drawer, so Escape closes only that. */
  closeOnEscape?: boolean;
}) {
  const sprint = story.sprintId === null ? null : (sprints.find((s) => s.id === story.sprintId) ?? null);
  const { progress } = story;
  const rollup = storyRollup(story);
  const points = storyPoints(story);
  const hasDates = story.startsOn != null || story.dueOn != null;

  return (
    <Drawer
      title={story.title}
      subtitle={story.epic != null ? `Epic · ${story.epic.title}` : "User story"}
      icon={ListChecks}
      hue={progress.total > 0 && progress.done === progress.total ? "mint" : "blue"}
      width="lg"
      onClose={onClose}
      closeOnEscape={closeOnEscape}
      bodyClassName="space-y-6 px-5 py-5 sm:px-6"
      footer={
        <>
          {onEditStory !== undefined && story.can.update && (
            <Button icon={Pencil} onClick={onEditStory}>
              Edit story
            </Button>
          )}
          <Button className="ml-auto" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {error !== null && (
        <Notice
          tone="error"
          action={
            onDismissError ? (
              <button
                type="button"
                onClick={onDismissError}
                className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold underline-offset-2 hover:underline"
              >
                Dismiss
              </button>
            ) : undefined
          }
        >
          {error}
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={story.status} />
        {story.epic != null && (
          <Chip hue="grape" icon={Layers} className="!px-2 !py-0.5 text-[11px]">
            {story.epic.title}
          </Chip>
        )}
        <Chip hue={sprint ? "sky" : "slate"} icon={CalendarRange} className="!px-2 !py-0.5 text-[11px]">
          {sprint ? sprint.name : story.sprintId === null ? "Product backlog" : "In a sprint"}
        </Chip>
        <ItemRef value={story.externalRef} />
      </div>

      {/*
        The plan in one line: when it runs, how big it was judged, and what its
        tasks add up to. Each fact only when it exists, older stories have
        none of them, and "-" three times says nothing.
      */}
      {(hasDates || points.points != null || rollup?.hours != null) && (
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-neutral-600">
          {hasDates && (
            <div className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} className="text-neutral-400" aria-hidden />
              <dt className="sr-only">Planned dates</dt>
              <dd className="font-semibold tabular-nums text-neutral-800">{fmtRange(story.startsOn, story.dueOn)}</dd>
            </div>
          )}
          {points.points != null && (
            <div className="inline-flex items-center gap-1.5">
              <dt className="sr-only">Story points</dt>
              <dd>
                <span className="font-semibold tabular-nums text-neutral-800">{points.points}</span>{" "}
                {points.points === 1 ? "point" : "points"}
                {points.summed && <span className="text-neutral-500"> (sum of its tasks)</span>}
              </dd>
            </div>
          )}
          {rollup?.hours != null && (
            <div className="inline-flex items-center gap-1.5">
              <Clock size={14} className="text-neutral-400" aria-hidden />
              <dt className="sr-only">Estimated hours</dt>
              <dd>
                <span className="font-semibold tabular-nums text-neutral-800">{fmtHours(rollup.hours)}</span> from tasks
                {rollup.estimated < rollup.total && (
                  <span className="text-neutral-500">
                    {" "}
                    ({rollup.estimated} of {rollup.total} estimated)
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>
      )}

      <section aria-labelledby={`sd-progress-${story.id}`} className="rounded-2xl bg-neutral-50 p-4">
        <h3 id={`sd-progress-${story.id}`} className="sr-only">
          Progress
        </h3>
        <StoryProgress done={progress.done} total={progress.total} size="lg" label="Story progress" />
      </section>

      {(story.description ?? "") !== "" && (
        <section>
          <h3 className="mb-1.5 text-[13px] font-semibold text-neutral-700">The story</h3>
          {/* Written in the editor: headings, lists and tables as the author laid them out. */}
          <RichTextView value={story.description} size="sm" />
        </section>
      )}

      {(story.expectedOutcome ?? "") !== "" && (
        <section className="rounded-2xl border-l-4 border-mint-500 bg-mint-50/60 px-4 py-3">
          <h3 className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-mint-700">
            <Target size={14} aria-hidden />
            Done when
          </h3>
          <RichTextView value={story.expectedOutcome} size="sm" />
        </section>
      )}

      {/*
        Blocked now and possibly blocked later are different facts and are
        drawn differently: a solid coral edge for what has stopped the work, a
        dashed sun one for risks the plan should route around.
      */}
      {(story.blockedReason ?? "") !== "" && (
        <section className="rounded-2xl border-l-4 border-coral-500 bg-coral-50/70 px-4 py-3">
          <h3 className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-coral-700">
            <OctagonAlert size={14} aria-hidden />
            Blocked now
          </h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-800">{story.blockedReason}</p>
        </section>
      )}

      {(story.possibleBlockers ?? "") !== "" && (
        <section className="rounded-2xl border border-dashed border-sun-400 bg-sun-50/60 px-4 py-3">
          <h3 className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-sun-700">
            <AlertTriangle size={14} aria-hidden />
            Possible blockers
          </h3>
          <RichTextView value={story.possibleBlockers} size="sm" />
        </section>
      )}

      <section aria-labelledby={`sd-tasks-${story.id}`} className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id={`sd-tasks-${story.id}`} className="text-[15px] font-bold text-neutral-900">
            Tasks
          </h3>
          <span className="text-xs tabular-nums text-neutral-500">
            {progress.done} of {progress.total} done
          </span>
        </div>

        <StoryTaskList
          story={story}
          project={project}
          setup={setup}
          viewerId={viewerId}
          onTick={onTick}
          onAssign={onAssign}
          onOpenTask={onOpenTask}
        />

        <AddTask story={story} project={project} setup={setup} viewerId={viewerId} onAdd={onAddTask} onMore={onNewTask} />
      </section>
    </Drawer>
  );
}
