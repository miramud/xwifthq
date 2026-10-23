"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Clock, FileSpreadsheet, Layers, PanelRightOpen, Plus } from "lucide-react";
import { AvatarStack, Button, Empty, SearchField, cx } from "@/components/workspace/kit";
import type { BoardSetup, Project, Sprint, StoryRow, WorkItem, WorkItemType } from "@/lib/api/projects-client";
import { PointsChip, StoryProgress, fmtHours, shortSpan, storyPoints, storyRollup } from "./StoryCard";
import StoryDrawer, { StoryTaskList } from "./StoryDrawer";
import { useStories } from "./useStories";
import { ItemRef, NameAvatar, Notice, StatusChip, TabSkeleton, TypeChip, plural } from "./ui/pkit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";

/**
 * A backlog read as stories: grouped under their epics, each row a story with
 * its progress, opening in place to show its tasks.
 *
 * This is the planning view. The board says what is moving; this says what is
 * in here and what goes next — so the one action on a row is **Move to
 * sprint**, and the server carries the story's unfinished tasks with it (the
 * sprint linking rule in the batch contract), which is why there is no
 * per-task scheduling here to get out of step.
 *
 * Work under no story is listed last as "Not in a story": still real work,
 * still schedulable one item at a time from its own panel.
 *
 * The flat item table (WorkItemList) is still one click away as "Items" —
 * it is the right tool for estimating eighty tasks in one sitting.
 */
export default function StoryBacklog({
  project,
  setup,
  sprintId,
  sprints = [],
  refreshKey = 0,
  viewerId,
  itemPanelOpen = false,
  onOpenItem,
  onNewItem,
  onChanged,
  viewSwitch,
}: {
  project: Project;
  setup: BoardSetup;
  /** Undefined is the product backlog. */
  sprintId?: string;
  sprints?: Sprint[];
  refreshKey?: number;
  /** Board / List / Items, drawn at the end of this toolbar. */
  viewSwitch?: React.ReactNode;
  viewerId?: string;
  itemPanelOpen?: boolean;
  onOpenItem: (item: WorkItem) => void;
  onNewItem?: (defaults: { statusId?: string; type?: WorkItemType; parentId?: string }) => void;
  onChanged?: () => void;
}) {
  const data = useStories({ slug: project.slug, scope: { sprintId }, setup, refreshKey, onChanged });
  const { stories, loose, error, setError } = data;

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [byEpic, setByEpic] = useState(true);

  const term = search.trim().toLowerCase();

  const shown = useMemo(
    () =>
      (stories ?? []).filter(
        (s) =>
          term === "" ||
          s.title.toLowerCase().includes(term) ||
          (s.epic?.title.toLowerCase().includes(term) ?? false) ||
          s.tasks.some((t) => t.title.toLowerCase().includes(term)),
      ),
    [stories, term],
  );

  const shownLoose = useMemo(
    () => loose.filter((i) => term === "" || i.title.toLowerCase().includes(term)),
    [loose, term],
  );

  const hasEpics = (stories ?? []).some((s) => s.epic != null);

  /* Epics in the order their first story appears — the order the team set. */
  const groups = useMemo(() => {
    if (!byEpic || !hasEpics) return [{ key: "all", title: null as string | null, stories: shown }];

    const map = new Map<string, { key: string; title: string | null; stories: StoryRow[] }>();

    for (const s of shown) {
      const key = s.epic?.id ?? "none";

      if (!map.has(key)) map.set(key, { key, title: s.epic?.title ?? null, stories: [] });
      map.get(key)?.stories.push(s);
    }

    /* "No epic" last: the named ones are the plan. */
    return [...map.values()].sort((a, b) => (a.key === "none" ? 1 : 0) - (b.key === "none" ? 1 : 0));
  }, [byEpic, hasEpics, shown]);

  /*
    Where a story may go. Closed sprints take nothing; the one it is already
    in is not a destination. Offered only to whoever manages the board — the
    same people the API lets schedule.
  */
  const destinations = sprints.filter((s) => s.status !== "closed" && s.id !== sprintId);
  const canSchedule = project.can?.manageBoard === true && (destinations.length > 0 || sprintId !== undefined);

  const toggle = (id: string) =>
    setExpanded((now) => {
      const next = new Set(now);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });

  const open = openId === null ? null : ((stories ?? []).find((s) => s.id === openId) ?? null);

  if (stories === null) return <TabSkeleton stats={0} />;

  const nothing = stories.length === 0 && loose.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          value={search}
          onChange={setSearch}
          label="Search stories and tasks"
          placeholder="Search stories and tasks…"
          className="w-full sm:max-w-xs"
        />
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {hasEpics && (
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-600 transition hover:bg-neutral-50 focus-within:ring-2 focus-within:ring-primary-200">
              <input
                type="checkbox"
                checked={byEpic}
                onChange={(e) => setByEpic(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary-600"
              />
              <Layers size={14} aria-hidden />
              Group by epic
            </label>
          )}
          <span className="text-xs tabular-nums text-neutral-500">
            {plural(stories.length, "story", "stories")}
            {loose.length > 0 ? ` · ${loose.length} not in a story` : ""}
          </span>
          {viewSwitch !== undefined && <div className="shrink-0">{viewSwitch}</div>}
        </div>
      </div>

      {error !== null && open === null && <Notice tone="error">{error}</Notice>}

      {nothing ? (
        <div className="ws-card">
          <Empty
            icon={FileSpreadsheet}
            title={sprintId === undefined ? "The product backlog is empty" : "No stories in this sprint yet"}
            hint={
              sprintId === undefined
                ? "Import a backlog sheet under Import (epics, stories and their tasks arrive already linked), or add a story."
                : "Move stories here from the product backlog, or add one."
            }
            action={
              onNewItem !== undefined ? (
                <Button variant="primary" icon={Plus} onClick={() => onNewItem({ type: "story" })}>
                  Add a story
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) =>
            group.stories.length === 0 ? null : (
              <section key={group.key} aria-label={group.title ?? (group.key === "none" ? "No epic" : "Stories")}>
                {group.key !== "all" && (
                  <h3 className="mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold text-neutral-700">
                    <span
                      className={cx(
                        "flex h-6 w-6 items-center justify-center rounded-lg",
                        group.title ? "bg-grape-50 text-grape-700" : "bg-neutral-100 text-neutral-500",
                      )}
                    >
                      <Layers size={13} aria-hidden />
                    </span>
                    {group.title ?? "No epic"}
                    <span className="text-xs font-medium text-neutral-500">{group.stories.length}</span>
                  </h3>
                )}

                <ul className="ws-card divide-y divide-neutral-100 overflow-hidden">
                  {group.stories.map((story) => {
                    const isOpen = expanded.has(story.id);
                    const panelId = `sb-tasks-${story.id}`;
                    const hours = storyRollup(story)?.hours ?? null;
                    const span = shortSpan(story.startsOn, story.dueOn);

                    return (
                      <li key={story.id}>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 sm:flex-nowrap sm:px-4">
                          <button
                            type="button"
                            onClick={() => toggle(story.id)}
                            aria-expanded={isOpen}
                            aria-controls={panelId}
                            className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                          >
                            <ChevronRight
                              size={17}
                              aria-hidden
                              className={cx("shrink-0 text-neutral-400 transition-transform", isOpen && "rotate-90")}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-1.5">
                                <ItemRef value={story.externalRef} />
                                {(!byEpic || !hasEpics) && story.epic != null && (
                                  <span className="rounded-full bg-grape-50 px-2 py-0.5 text-[11px] font-semibold text-grape-700">
                                    {story.epic.title}
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 block text-sm font-semibold leading-snug text-neutral-900">
                                {story.title}
                              </span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-neutral-500">
                                <span>
                                  {plural(story.progress.total - story.bugCount, "task")}
                                  {story.bugCount > 0 ? ` · ${plural(story.bugCount, "bug")}` : ""}
                                </span>
                                {/* The plan facts, each only when it exists. */}
                                <PointsChip {...storyPoints(story)} />
                                {hours !== null && (
                                  <span className="inline-flex items-center gap-1 tabular-nums">
                                    <Clock size={11} aria-hidden />
                                    {fmtHours(hours)}
                                  </span>
                                )}
                                {span !== null && (
                                  <span className="inline-flex items-center gap-1 tabular-nums">
                                    <CalendarDays size={11} aria-hidden />
                                    {span}
                                  </span>
                                )}
                              </span>
                            </span>
                          </button>

                          <div className="ml-8 flex w-full items-center gap-3 sm:ml-0 sm:w-auto">
                            <StatusChip status={story.status} />
                            <StoryProgress
                              done={story.progress.done}
                              total={story.progress.total}
                              label={`Progress of ${story.title}`}
                              className="w-32 sm:w-36"
                            />
                            {story.assignees.length > 0 && (
                              <span className="hidden md:block">
                                <AvatarStack
                                  people={story.assignees.map((a) => ({ name: a.name ?? "Unnamed" }))}
                                  max={3}
                                  size={24}
                                />
                              </span>
                            )}
                          </div>

                          {canSchedule && (
                            <SearchableSelect
                              value=""
                              onChange={(v) => {
                                if (v !== "") void data.moveToSprint(story, v === "backlog" ? null : v);
                              }}
                              aria-label={`Move “${story.title}” to a sprint`}
                              placeholder="Move to sprint…"
                              size="sm"
                              className="ml-8 w-auto sm:ml-0 sm:w-40"
                              searchPlaceholder="Search sprints"
                              options={[
                                ...(sprintId !== undefined ? [{ value: "backlog", label: "Product backlog" }] : []),
                                ...destinations.map((s) => ({
                                  value: s.id,
                                  label: s.name,
                                  hint: s.status === "active" ? "Running" : undefined,
                                })),
                              ]}
                            />
                          )}
                        </div>

                        {isOpen && (
                          <div id={panelId} className="space-y-3 bg-neutral-50/60 px-3 pb-4 pt-1 sm:pl-12 sm:pr-4">
                            <StoryTaskList
                              story={story}
                              project={project}
                              setup={setup}
                              viewerId={viewerId}
                              onTick={(task, done) => void data.tick(task, done)}
                              onOpenTask={onOpenItem}
                              compact
                            />
                            <Button size="sm" icon={PanelRightOpen} onClick={() => setOpenId(story.id)}>
                              Open story
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ),
          )}

          {shownLoose.length > 0 && (
            <section aria-label="Not in a story">
              <h3 className="mb-2 px-1 text-[13px] font-semibold text-neutral-700">
                Not in a story <span className="text-xs font-medium text-neutral-500">{shownLoose.length}</span>
              </h3>
              <ul className="ws-card divide-y divide-neutral-100 overflow-hidden">
                {shownLoose.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onOpenItem(item)}
                      className="flex min-h-11 w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-left outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300"
                    >
                      <TypeChip type={item.type} label={item.typeLabel} />
                      <span
                        className={cx(
                          "min-w-0 flex-1 text-sm",
                          item.isComplete ? "text-neutral-500 line-through" : "font-medium text-neutral-900",
                        )}
                      >
                        {item.title}
                      </span>
                      <StatusChip status={item.status} />
                      <span className="flex items-center gap-1.5 text-xs text-neutral-600">
                        <NameAvatar name={item.assignee?.name ?? null} size={22} />
                        {item.assignee?.name ?? "Unassigned"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.hasMore && (
            <div className="flex justify-center">
              <Button onClick={data.loadMore} disabled={data.loadingMore}>
                {data.loadingMore ? "Loading…" : "Show more stories"}
              </Button>
            </div>
          )}
        </div>
      )}

      {open !== null && (
        <StoryDrawer
          story={open}
          project={project}
          setup={setup}
          sprints={sprints}
          viewerId={viewerId}
          error={error}
          onDismissError={() => setError(null)}
          onTick={(task, done) => void data.tick(task, done)}
          onAssign={(task, who) => void data.assign(task, who)}
          onAddTask={(input) => data.addTask(open, input)}
          onOpenTask={onOpenItem}
          onNewTask={onNewItem ? () => onNewItem({ type: "task", parentId: open.id }) : undefined}
          onEditStory={() => onOpenItem(open)}
          closeOnEscape={!itemPanelOpen}
          onClose={() => {
            setOpenId(null);
            setError(null);
          }}
        />
      )}
    </div>
  );
}
