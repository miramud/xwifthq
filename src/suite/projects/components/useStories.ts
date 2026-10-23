"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ApiError,
  stories as storiesApi,
  workItems as itemsApi,
  type BoardSetup,
  type StoryRow,
  type WorkItem,
  type WorkItemStatus,
} from "@/lib/api/projects-client";

/**
 * The stories of one scope (a sprint, or the product backlog) and the loose
 * work beside them, with every change the story views make to them.
 *
 * One hook for the board and the backlog list because they are the same data
 * drawn two ways, and the rules for changing it must not drift apart:
 *
 * **Every change is optimistic, and every failure puts the old value back.**
 * Same promise the board has always made: the tick lands at
 * once, and a refusal restores exactly what was there *and* says why. The
 * rollback is per item, not a snapshot of the whole list, so two ticks in
 * flight cannot undo each other.
 *
 * **Progress is recounted from the tasks, never nudged.** Done over all
 * children, the same definition the API uses, so what the card shows after a
 * tick is what the server will say on the next load.
 */

type Scope = { sprintId?: string };

export interface StoryData {
  stories: StoryRow[] | null;
  loose: WorkItem[];
  /** More stories exist than one page held. */
  hasMore: boolean;
  loadingMore: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  loadMore: () => void;
  tick: (task: WorkItem, done: boolean) => Promise<void>;
  assign: (task: WorkItem, assigneeId: string | null) => Promise<void>;
  addTask: (story: StoryRow, input: { title: string; assigneeId: string | null }) => Promise<boolean>;
  moveStatus: (id: string, statusId: string) => Promise<void>;
  moveToSprint: (story: StoryRow, sprintId: string | null) => Promise<void>;
}

const PER_PAGE = 250;

/** Done over all children, rounded the way the API rounds it. */
export function recount(story: StoryRow, tasks: WorkItem[] = story.tasks): StoryRow {
  const done = tasks.filter((t) => t.isComplete).length;
  const total = tasks.length;

  /* Everybody working inside the story, then its own owner. */
  const seen = new Set<string>();
  const assignees: StoryRow["assignees"] = [];

  for (const person of [...tasks.map((t) => t.assignee), story.assignee]) {
    if (person != null && !seen.has(person.id)) {
      seen.add(person.id);
      assignees.push({ id: person.id, name: person.name });
    }
  }

  return {
    ...story,
    tasks,
    assignees,
    bugCount: tasks.filter((t) => t.type === "bug").length,
    progress: { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) },
  };
}

/** The column "done" lands in: the first one that counts as complete. */
export function completionStatus(statuses: WorkItemStatus[]): WorkItemStatus | undefined {
  return [...statuses].sort((a, b) => a.position - b.position).find((s) => s.countsAsComplete);
}

/** The column "not done" goes back to: the default, else the first. */
export function defaultStatus(statuses: WorkItemStatus[]): WorkItemStatus | undefined {
  return statuses.find((s) => s.isDefault) ?? [...statuses].sort((a, b) => a.position - b.position)[0];
}

function message(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

export function useStories({
  slug,
  scope,
  setup,
  refreshKey = 0,
  onChanged,
}: {
  slug: string;
  scope: Scope;
  setup: BoardSetup;
  refreshKey?: number;
  /** Something the rest of the page counts (sprint totals) moved. */
  onChanged?: () => void;
}): StoryData {
  const [stories, setStories] = useState<StoryRow[] | null>(null);
  const [loose, setLoose] = useState<WorkItem[]>([]);
  const [page, setPage] = useState({ current: 1, last: 1 });
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Read from the latest state inside async handlers without re-creating them. */
  const storiesRef = useRef<StoryRow[] | null>(null);
  const looseRef = useRef<WorkItem[]>([]);
  const onChangedRef = useRef(onChanged);

  /* Layout, not passive: a drop right after a render must see that render's rows. */
  useLayoutEffect(() => {
    storiesRef.current = stories;
    looseRef.current = loose;
    onChangedRef.current = onChanged;
  });

  const sprintId = scope.sprintId;
  const filters = sprintId === undefined ? { backlog: true } : { sprintId };

  useEffect(() => {
    let cancelled = false;

    storiesApi
      .list(slug, { ...(sprintId === undefined ? { backlog: true } : { sprintId }), perPage: PER_PAGE })
      .then((res) => {
        if (cancelled) return;

        setStories(res.data);
        setLoose(res.meta.loose ?? []);
        setPage({ current: res.meta.currentPage ?? 1, last: res.meta.lastPage ?? 1 });
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        setError(message(e, "The stories did not load."));
        setStories((now) => now ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, sprintId, refreshKey]);

  const loadMore = () => {
    if (loadingMore || page.current >= page.last) return;

    setLoadingMore(true);

    storiesApi
      .list(slug, { ...filters, perPage: PER_PAGE, page: page.current + 1 })
      .then((res) => {
        setStories((now) => [...(now ?? []), ...res.data.filter((s) => !(now ?? []).some((n) => n.id === s.id))]);
        setPage({ current: res.meta.currentPage ?? page.current + 1, last: res.meta.lastPage ?? page.last });
      })
      .catch((e: unknown) => setError(message(e, "The next stories did not load.")))
      .finally(() => setLoadingMore(false));
  };

  /** Replace one task inside whichever story holds it, recounting that story. */
  const patchTask = useCallback((taskId: string, next: (task: WorkItem) => WorkItem) => {
    setStories((now) =>
      (now ?? []).map((story) =>
        story.tasks.some((t) => t.id === taskId)
          ? recount(story, story.tasks.map((t) => (t.id === taskId ? next(t) : t)))
          : story,
      ),
    );
  }, []);

  const tick = useCallback(
    async (task: WorkItem, done: boolean) => {
      if (!task.can.move) {
        setError("Only whoever it is assigned to, or somebody who manages the board, can tick this.");

        return;
      }

      const target = done ? completionStatus(setup.statuses) : defaultStatus(setup.statuses);
      const before = task;

      patchTask(task.id, (t) => ({ ...t, isComplete: done, status: target ?? t.status }));
      setError(null);

      try {
        const saved = await itemsApi.complete(task.id, done);

        /* Keep `can` from the row we had if the answer came back without it. */
        patchTask(task.id, (t) => ({ ...t, ...saved, can: saved.can ?? t.can }));
        onChangedRef.current?.();
      } catch (e) {
        patchTask(task.id, () => before);
        setError(message(e, done ? "That task was not marked done." : "That task was not reopened."));
      }
    },
    [patchTask, setup.statuses],
  );

  const assign = useCallback(
    async (task: WorkItem, assigneeId: string | null) => {
      const before = task;
      const person = assigneeId === null ? null : setup.assignees.find((a) => a.id === assigneeId);

      patchTask(task.id, (t) => ({
        ...t,
        assignee: assigneeId === null ? null : { id: assigneeId, name: person?.name ?? null },
      }));
      setError(null);

      try {
        const saved = await itemsApi.update(task.id, { assigneeId });

        patchTask(task.id, (t) => ({ ...t, ...saved, can: saved.can ?? t.can }));
      } catch (e) {
        /* A plain member giving work to a colleague: the API's own sentence says what to do. */
        patchTask(task.id, () => before);
        setError(message(e, "That task was not reassigned."));
      }
    },
    [patchTask, setup.assignees],
  );

  const addTask = useCallback(
    async (story: StoryRow, input: { title: string; assigneeId: string | null }) => {
      setError(null);

      try {
        /* No sprintId: a task under a story takes the story's sprint, server-side. */
        const made = await itemsApi.create(slug, {
          title: input.title,
          type: "task",
          parentId: story.id,
          assigneeId: input.assigneeId,
        });

        setStories((now) =>
          (now ?? []).map((s) => (s.id === story.id ? recount(s, [...s.tasks, made]) : s)),
        );
        onChangedRef.current?.();

        return true;
      } catch (e) {
        setError(message(e, "That task was not added."));

        return false;
      }
    },
    [slug],
  );

  /** A drag on the board, for a story card or a loose one. */
  const moveStatus = useCallback(
    async (id: string, statusId: string) => {
      const story = (storiesRef.current ?? []).find((s) => s.id === id);
      const item: WorkItem | undefined = story ?? looseRef.current.find((i) => i.id === id);

      if (item === undefined || item.status?.id === statusId) return;

      if (!item.can.move) {
        setError("That is not yours to move. Ask whoever it is assigned to, or a manager.");

        return;
      }

      const target = setup.statuses.find((s) => s.id === statusId);
      const moved = { status: target, isComplete: target?.countsAsComplete ?? false };

      if (story !== undefined) {
        setStories((now) => (now ?? []).map((s) => (s.id === id ? { ...s, ...moved } : s)));
      } else {
        setLoose((now) => now.map((i) => (i.id === id ? { ...i, ...moved } : i)));
      }
      setError(null);

      try {
        const saved = await itemsApi.move(id, { statusId });

        /*
          Merge rather than replace for a story: the move answers with the
          plain item, and the story's tasks, epic and progress are not in it.
        */
        if (story !== undefined) {
          setStories((now) => (now ?? []).map((s) => (s.id === id ? { ...s, ...saved, can: saved.can ?? s.can } : s)));
        } else {
          setLoose((now) => now.map((i) => (i.id === id ? saved : i)));
        }
        onChangedRef.current?.();
      } catch (e) {
        /* Put it back, exactly, and say why. */
        if (story !== undefined) {
          setStories((now) => (now ?? []).map((s) => (s.id === id ? { ...s, status: story.status, isComplete: story.isComplete } : s)));
        } else {
          setLoose((now) => now.map((i) => (i.id === id ? item : i)));
        }
        setError(message(e, "That move did not save."));
      }
    },
    [setup.statuses],
  );

  /**
   * Schedule a story. Its unfinished tasks follow it server-side, so the whole
   * story leaves this scope — optimistically, and back if refused.
   */
  const moveToSprint = useCallback(async (story: StoryRow, target: string | null) => {
    if ((story.sprintId ?? null) === target) return;

    const index = (storiesRef.current ?? []).findIndex((s) => s.id === story.id);

    setStories((now) => (now ?? []).filter((s) => s.id !== story.id));
    setError(null);

    try {
      await itemsApi.move(story.id, { sprintId: target });
      onChangedRef.current?.();
    } catch (e) {
      setStories((now) => {
        const list = [...(now ?? [])];
        list.splice(Math.max(0, Math.min(index, list.length)), 0, story);

        return list;
      });
      setError(message(e, "That story was not moved."));
    }
  }, []);

  return {
    stories,
    loose,
    hasMore: page.current < page.last,
    loadingMore,
    error,
    setError,
    loadMore,
    tick,
    assign,
    addTask,
    moveStatus,
    moveToSprint,
  };
}
