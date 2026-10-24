"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, ListChecks, Plus, UserRound } from "lucide-react";
import { Empty, SearchField, buttonClass, cx } from "@/components/workspace/kit";
import { HUE, type Hue } from "@/components/workspace/modules";
import type { BoardSetup, Project, Sprint, StoryRow, WorkItem, WorkItemType } from "@/lib/api/projects-client";
import { LooseCard, StoryCard } from "./StoryCard";
import StoryDrawer from "./StoryDrawer";
import { useStories } from "./useStories";
import { Notice, statusVisual } from "./ui/pkit";

/** A column's wash, in the hue its status is drawn in. */
const COLUMN_BG: Record<Hue, string> = {
  blue: "bg-primary-50/70",
  coral: "bg-coral-50/70",
  mint: "bg-mint-50/70",
  grape: "bg-grape-50/70",
  sun: "bg-sun-50/80",
  sky: "bg-sky-50/80",
  rose: "bg-rose-50/70",
  slate: "bg-neutral-100/80",
};

/**
 * The board, one card per user story.
 *
 * **A story's column is its own status**, moved by dragging the story card,
 * never inferred from its tasks. Tasks are ticked inside the story; the story
 * moves when somebody decides it has moved. (Fixed in the batch contract, and
 * the reason there is no "auto-advance" here.)
 *
 * **Loose work still shows.** A bug raised on its own or a spike is real work
 * with a real status, so it sits in its column as a compact card labelled
 * "Not in a story", hiding it would make the board lie about what is going on.
 *
 * Drag and drop is the same native HTML5 mechanism the task board used, with
 * the same promise: the card moves at once, and a refusal puts it back and
 * says why. For keyboards, Alt+← / Alt+→ on a focused card moves it one
 * column, and the move is announced.
 */
export default function StoryBoard({
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
  /** The item panel is open over the drawer: Escape is its, not the drawer's. */
  itemPanelOpen?: boolean;
  /** Open the full item panel. */
  onOpenItem: (item: WorkItem) => void;
  /** Start a new item: in a column, of a type, or under a story. */
  onNewItem?: (defaults: { statusId?: string; type?: WorkItemType; parentId?: string }) => void;
  onChanged?: () => void;
}) {
  const data = useStories({ slug: project.slug, scope: { sprintId }, setup, refreshKey, onChanged });
  const { stories, loose, error, setError } = data;

  const [openId, setOpenId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [announce, setAnnounce] = useState("");

  const statuses = useMemo(() => [...setup.statuses].sort((a, b) => a.position - b.position), [setup.statuses]);

  const term = search.trim().toLowerCase();

  /* Filtered in the browser: one sprint is already loaded, as on the task board. */
  const shownStories = useMemo(
    () =>
      (stories ?? []).filter((s) => {
        if (
          term !== "" &&
          !s.title.toLowerCase().includes(term) &&
          !(s.epic?.title.toLowerCase().includes(term) ?? false) &&
          !s.tasks.some((t) => t.title.toLowerCase().includes(term))
        )
          return false;
        if (mineOnly && !s.assignees.some((a) => a.id === viewerId)) return false;

        return true;
      }),
    [stories, term, mineOnly, viewerId],
  );

  const shownLoose = useMemo(
    () =>
      loose.filter((i) => {
        if (term !== "" && !i.title.toLowerCase().includes(term)) return false;
        if (mineOnly && i.assignee?.id !== viewerId) return false;

        return true;
      }),
    [loose, term, mineOnly, viewerId],
  );

  const hidden = (stories ?? []).length + loose.length - shownStories.length - shownLoose.length;

  const byColumn = useMemo(() => {
    const map = new Map<string, { stories: StoryRow[]; loose: WorkItem[] }>();

    for (const s of statuses) map.set(s.id, { stories: [], loose: [] });
    for (const s of shownStories) map.get(s.status?.id ?? "")?.stories.push(s);
    for (const i of shownLoose) map.get(i.status?.id ?? "")?.loose.push(i);

    return map;
  }, [statuses, shownStories, shownLoose]);

  const drop = (id: string, statusId: string) => {
    setDragging(null);
    setOver(null);
    void data.moveStatus(id, statusId);
  };

  /** Keyboard move: one column left or right, said out loud. */
  const step = (item: WorkItem, dir: -1 | 1) => {
    const at = statuses.findIndex((s) => s.id === item.status?.id);
    const target = statuses[at + dir];

    if (at === -1 || target === undefined) return;

    setAnnounce(`Moved “${item.title}” to ${target.label}`);
    void data.moveStatus(item.id, target.id);
  };

  const dragProps = (item: WorkItem) => ({
    onDragStart: (e: React.DragEvent) => {
      setDragging(item.id);
      e.dataTransfer.setData("text/plain", item.id);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragEnd: () => setDragging(null),
    onStep: item.can.move ? (dir: -1 | 1) => step(item, dir) : undefined,
  });

  const open = openId === null ? null : ((stories ?? []).find((s) => s.id === openId) ?? null);

  if (stories === null) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2" aria-busy="true" aria-label="Loading the board">
        {statuses.map((s) => (
          <div key={s.id} className="h-72 w-[300px] shrink-0 animate-pulse rounded-[1.125rem] bg-neutral-100/70" />
        ))}
      </div>
    );
  }

  const nothing = stories.length === 0 && loose.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchField
          value={search}
          onChange={setSearch}
          label="Search stories and tasks"
          placeholder="Search stories and tasks…"
          className="w-full lg:max-w-xs"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label
            className={cx(
              "inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[13px] font-semibold transition focus-within:ring-2 focus-within:ring-primary-200",
              mineOnly
                ? "border-primary-200 bg-primary-50 text-primary-700"
                : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
            )}
          >
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary-600"
            />
            <UserRound size={14} aria-hidden />
            Mine
          </label>
          {hidden > 0 && (
            <span className="rounded-full bg-sun-50 px-2.5 py-1 text-xs font-semibold text-sun-700">
              {hidden} hidden by filters
            </span>
          )}
          <span className="hidden text-xs text-neutral-500 xl:inline">
            Drag a story to move it, or focus it and press Alt+← / Alt+→.
          </span>
        </div>
        {viewSwitch !== undefined && <div className="shrink-0 lg:ml-auto">{viewSwitch}</div>}
      </div>

      {error !== null && open === null && <Notice tone="error">{error}</Notice>}

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {nothing ? (
        <div className="ws-card">
          <Empty
            icon={FileSpreadsheet}
            title={sprintId === undefined ? "No stories in the product backlog" : "No stories in this sprint"}
            hint={
              sprintId === undefined
                ? "Import a backlog sheet under Import (stories and their tasks arrive together), or add a story here."
                : "Move stories in from the product backlog, import a sheet into this sprint, or add a story here."
            }
            action={
              onNewItem !== undefined ? (
                <button
                  type="button"
                  onClick={() => onNewItem({ type: "story" })}
                  className={buttonClass("primary")}
                >
                  <Plus size={17} aria-hidden />
                  Add a story
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-3">
          {statuses.map((status) => {
            const column = byColumn.get(status.id) ?? { stories: [], loose: [] };
            const count = column.stories.length + column.loose.length;
            const isOver = over === status.id;
            const { icon: StatusIcon, hue } = statusVisual(status);

            return (
              <section
                key={status.id}
                aria-label={`${status.label}: ${count}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(status.id);
                }}
                onDragLeave={() => setOver((c) => (c === status.id ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();

                  const id = e.dataTransfer.getData("text/plain") || dragging;

                  if (id) drop(id, status.id);
                }}
                className={cx(
                  "flex w-[min(300px,85vw)] shrink-0 flex-col rounded-[1.25rem] p-3 transition-colors",
                  isOver ? "bg-primary-50 ring-2 ring-primary-300" : COLUMN_BG[hue],
                )}
              >
                <header className="mb-3 flex items-center gap-2 px-1">
                  <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm", HUE[hue].text)}>
                    <StatusIcon size={15} aria-hidden />
                  </span>
                  <h3 className={cx("min-w-0 truncate text-sm font-bold", HUE[hue].text)}>{status.label}</h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-neutral-600 shadow-sm">
                    {count}
                  </span>
                  {onNewItem !== undefined && (
                    <button
                      type="button"
                      onClick={() => onNewItem({ statusId: status.id, type: "story" })}
                      aria-label={`Add a story to ${status.label}`}
                      title={`Add a story to ${status.label}`}
                      className="ml-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                    >
                      <Plus size={16} aria-hidden />
                    </button>
                  )}
                </header>

                <ul className="min-h-[120px] flex-1 space-y-3">
                  {column.stories.map((story) => (
                    <li key={story.id}>
                      <StoryCard story={story} onOpen={() => setOpenId(story.id)} {...dragProps(story)} />
                    </li>
                  ))}

                  {column.loose.length > 0 && (
                    <li className="space-y-2">
                      {column.stories.length > 0 && (
                        <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                          Not in a story
                        </p>
                      )}
                      <ul className="space-y-2">
                        {column.loose.map((item) => (
                          <li key={item.id}>
                            <LooseCard item={item} onOpen={() => onOpenItem(item)} {...dragProps(item)} />
                          </li>
                        ))}
                      </ul>
                    </li>
                  )}

                  {count === 0 && (
                    <li className="ws-hatch flex flex-col items-center gap-1 rounded-xl px-3 py-6 text-center text-xs font-medium text-neutral-600">
                      <ListChecks size={16} className="text-neutral-400" aria-hidden />
                      No stories here
                      {dragging !== null && <span className="text-neutral-500">Drop one to move it</span>}
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
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
