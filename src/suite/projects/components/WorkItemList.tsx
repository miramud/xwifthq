"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Flag, Link2, ListChecks, Timer } from "lucide-react";
import {
  Button,
  Chip,
  Empty,
  PersonAvatar,
  PriorityChip,
  SearchField,
  cx,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { HUE } from "@/components/workspace/modules";
import {
  ApiError,
  workItems as itemsApi,
  type BoardSetup,
  type Project,
  type WorkItem,
  type WorkItemType,
} from "@/lib/api/projects-client";
import {
  IconTile,
  ItemRef,
  Notice,
  StatusChip,
  TYPE_META,
  TabSkeleton,
  TypeChip,
  priorityName,
  smallInputCls,
} from "./ui/pkit";

/**
 * The backlog as a table, or as cards, or a list; the view is remembered.
 *
 * The board answers "what is happening"; a thousand-row product backlog needs
 * "what is in here, and in what order". Five columns of cards cannot be
 * scanned, sorted or read at that size.
 *
 * **Filtering and sorting happen server-side here**, unlike the board. The
 * board holds one sprint, around 120 items, already loaded, so filtering it
 * in the browser is free. A backlog is paginated, and filtering only the
 * current page would quietly answer a different question from the one asked.
 *
 * **The coverage line is the point of the footer.** A backlog of 400 items
 * showing "1,240h" invites somebody to plan against it. "1,240h across 96 of
 * 400 estimated" does not.
 */

const TYPES: { value: "" | WorkItemType; label: string }[] = [
  { value: "", label: "Any type" },
  { value: "story", label: "User story" },
  { value: "task", label: "Task" },
  { value: "bug", label: "Bug" },
  { value: "epic", label: "Epic" },
  { value: "spike", label: "Spike" },
];

export default function WorkItemList({
  project,
  setup,
  sprintId,
  refreshKey = 0,
  onOpen,
  viewSwitch,
}: {
  project: Project;
  setup: BoardSetup;
  /** Undefined is the product backlog. */
  sprintId?: string;
  refreshKey?: number;
  onOpen?: (item: WorkItem) => void;
  /** Board / List / Items, drawn at the end of this toolbar. */
  viewSwitch?: React.ReactNode;
}) {
  const [items, setItems] = useState<WorkItem[] | null>(null);
  const [meta, setMeta] = useState<{ total: number; currentPage: number; lastPage: number }>({
    total: 0,
    currentPage: 1,
    lastPage: 1,
  });
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [type, setType] = useState<"" | WorkItemType>("");
  const [statusId, setStatusId] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  /**
   * Estimating in bulk.
   *
   * **The path somebody actually takes with a hundred unestimated tasks.** The
   * backlog this module was built against had 118 of them and not one
   * estimate; a dialog per item is a hundred dialogs, and cost reporting stays
   * blank until somebody does it. So the Est. column becomes editable in
   * place, and one Save sends the lot.
   *
   * Held as strings rather than numbers, so an emptied box is distinguishable
   * from a zero, the first means "not estimated" and the second, if it were
   * stored, would be a wrong number summed as a fact.
   */
  const [estimating, setEstimating] = useState(false);
  /*
    A local reload, separate from the parent's `refreshKey`: saving estimates
    from this table has to re-read this table, and the parent has no reason to
    know a number in a cell changed.
  */
  const [reloads, setReloads] = useState(0);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  /* Debounced, because every keystroke here is a round trip. */
  const [debounced, setDebounced] = useState("");

  /*
    Every filter change returns to page one, done in the handler rather than
    an effect: page 4 of a narrower result set is usually empty, and an empty
    page reads as "no results" rather than "wrong page".
  */
  const onFilter = <T,>(set: (v: T) => void) => (value: T) => {
    set(value);
    setPage(1);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    itemsApi
      .list(project.slug, {
        ...(sprintId === undefined ? { backlog: true } : { sprintId }),
        ...(debounced.trim() === "" ? {} : { q: debounced.trim() }),
        ...(type === "" ? {} : { type }),
        ...(statusId === "" ? {} : { statusId }),
        ...(disciplineId === "" ? {} : { disciplineId }),
        ...(assigneeId === "" ? {} : { assigneeId }),
        page,
        perPage: 50,
      })
      .then((result) => {
        if (cancelled) return;

        setItems(result.data);
        setMeta(result.meta);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        setError(e instanceof ApiError ? e.message : "That did not load.");
        setItems([]);
      });

    return () => {
      cancelled = true;
    };
  }, [project.slug, sprintId, debounced, type, statusId, disciplineId, assigneeId, page, refreshKey, reloads]);

  /*
    Coverage for the page in hand, and said so. Totalling the whole backlog
    would need the API to sum it, and a number labelled "total" that only
    covered 50 rows would be worse than no number.
  */
  const coverage = useMemo(() => {
    const rows = items ?? [];
    const estimated = rows.filter((i) => i.estimateHours !== null);
    const hours = estimated.reduce((sum, i) => sum + (i.estimateHours ?? 0), 0);

    return { hours: Math.round(hours * 100) / 100, estimated: estimated.length, count: rows.length };
  }, [items]);

  /*
    Estimating is a board operation - it changes what the project is forecast
    to cost - so it follows `manageBoard` rather than `update`.
  */
  const canEstimate = project.can.estimate ?? project.can.manageBoard;

  const unestimated = (items ?? []).filter((item) => item.estimateHours === null).length;

  const saveEstimates = async () => {
    setSaving(true);
    setError(null);

    try {
      await itemsApi.estimate(
        project.slug,
        Object.entries(draft).map(([id, value]) => ({
          id,
          /*
            An emptied box and a zero both mean "not estimated", and both are
            sent as null. A stored zero would be a wrong number rather than an
            absent one, and every total downstream would repeat it as fact.
          */
          hours: value.trim() === "" || Number.parseFloat(value) <= 0
            ? null
            : Number.parseFloat(value),
        })),
      );

      setDraft({});
      setEstimating(false);
      setReloads((n) => n + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Those estimates did not save.");
    } finally {
      setSaving(false);
    }
  };

  if (items === null) {
    return <TabSkeleton stats={0} />;
  }

  /* Absent, never zero, as everywhere else in the module. */
  const estimateCell = (item: WorkItem) =>
    estimating ? (
      <input
        type="number"
        step="0.25"
        min="0"
        value={draft[item.id] ?? item.estimateHours ?? ""}
        onChange={(e) => setDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Estimate for ${item.title}`}
        className={cx(smallInputCls, "w-24 text-right tabular-nums")}
      />
    ) : (
      <span className="inline-flex items-center gap-1 tabular-nums text-neutral-700" title={item.estimateHours === null ? "Not estimated" : undefined}>
        {item.estimateHours === null ? "-" : `${item.estimateHours}h`}
      </span>
    );

  const assigneeCell = (item: WorkItem) =>
    item.assignee != null ? (
      <span className="inline-flex min-w-0 items-center gap-2">
        <PersonAvatar name={item.assignee.name ?? "Unnamed"} size={24} />
        <span className="truncate text-neutral-700">{item.assignee.name ?? "Unnamed"}</span>
      </span>
    ) : (
      <span className="text-neutral-500">Nobody yet</span>
    );

  const columns: Column<WorkItem>[] = [
    {
      key: "title",
      header: "Title",
      primary: true,
      value: (item) => item.title,
      /*
        Capped tighter below 2xl so the seven columns fit a 1440px screen
        without scrolling sideways to reach "Est." (P24); the title truncates,
        with the whole of it one click away.
      */
      className: "max-w-[300px] 2xl:max-w-[420px]",
      render: (item) => (
        <span className="flex min-w-0 items-center gap-2" title={item.title}>
          <span className="shrink-0 whitespace-nowrap">
            <ItemRef value={item.externalRef} />
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen?.(item);
            }}
            className="block min-w-0 cursor-pointer truncate text-left font-semibold text-neutral-900 outline-none hover:text-primary-700 focus-visible:underline"
          >
            {item.title}
          </button>
          {item.isMilestone && <Flag size={13} className="shrink-0 text-grape-600" aria-label="Milestone" />}
        </span>
      ),
    },
    { key: "type", header: "Type", value: (i) => i.typeLabel, render: (i) => <TypeChip type={i.type} label={i.typeLabel} /> },
    { key: "status", header: "Column", value: (i) => i.status?.label, render: (i) => <StatusChip status={i.status} /> },
    {
      key: "priority",
      header: "Priority",
      value: (i) => priorityName(i.priority),
      render: (i) => <PriorityChip priority={priorityName(i.priority) || null} />,
      hideOnMobile: true,
    },
    { key: "discipline", header: "Job title", value: (i) => i.discipline?.label, hideOnMobile: true },
    { key: "assignee", header: "Assignee", value: (i) => i.assignee?.name, render: assigneeCell },
    { key: "estimate", header: "Est.", align: "right", render: estimateCell },
  ];

  const renderCard = (item: WorkItem) => {
    const hue = TYPE_META[item.type]?.hue ?? "slate";

    return (
      <div className="relative flex h-full flex-col gap-3 overflow-hidden p-5">
        <span className={cx("absolute inset-y-0 left-0 w-1", HUE[hue].bar)} aria-hidden />
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeChip type={item.type} label={item.typeLabel} />
          <ItemRef value={item.externalRef} />
          <span className="ml-auto">
            <StatusChip status={item.status} />
          </span>
        </div>
        <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-neutral-900">{item.title}</p>
        {item.type === "bug" && item.foundIn != null && (
          <p className="flex min-w-0 items-center gap-1 text-xs text-rose-700">
            <Link2 size={12} className="shrink-0" aria-hidden />
            <span className="truncate">Found in {item.foundIn.externalRef ?? item.foundIn.title}</span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityChip priority={priorityName(item.priority) || null} />
          {item.discipline != null && <Chip hue="slate">{item.discipline.label}</Chip>}
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-neutral-100 pt-3 text-sm">
          {assigneeCell(item)}
          {estimateCell(item)}
        </div>
      </div>
    );
  };

  const renderListItem = (item: WorkItem) => (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
      <TypeChip type={item.type} label={item.typeLabel} />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-neutral-900">
          <ItemRef value={item.externalRef} />
          <span className="truncate">{item.title}</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-neutral-500">
          {item.status?.label ?? "No column"}
          {item.discipline != null ? ` · ${item.discipline.label}` : ""}
          {item.assignee != null ? ` · ${item.assignee.name ?? "Unnamed"}` : ""}
        </p>
      </div>
      <PriorityChip priority={priorityName(item.priority) || null} />
      {estimateCell(item)}
    </div>
  );

  /* The organisation's job titles; `disciplines` is the same list under its old name. */
  const jobTitles = setup.jobTitles ?? setup.disciplines;

  return (
    <div className="space-y-4">
      {error !== null && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchField
          value={search}
          onChange={setSearch}
          label="Search the backlog"
          placeholder="Search titles…"
          className="w-full lg:max-w-xs"
        />

        <div className="flex flex-wrap items-center gap-2">
          <SearchableSelect
            value={type}
            onChange={(value) => onFilter(setType)(value as "" | WorkItemType)}
            aria-label="Filter by type"
            size="sm"
            className="w-36"
            options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />

          <SearchableSelect
            value={statusId}
            onChange={onFilter(setStatusId)}
            aria-label="Filter by column"
            size="sm"
            className="w-40"
            searchPlaceholder="Search columns"
            options={[
              { value: "", label: "Any column" },
              ...setup.statuses.map((s) => ({ value: s.id, label: s.label })),
            ]}
          />

          {jobTitles.length > 0 && (
            <SearchableSelect
              value={disciplineId}
              onChange={onFilter(setDisciplineId)}
              aria-label="Filter by job title"
              size="sm"
              className="w-44"
              searchPlaceholder="Search job titles"
              options={[
                { value: "", label: "Any job title" },
                ...jobTitles.map((d) => ({ value: d.id, label: d.label })),
              ]}
            />
          )}

          {setup.assignees.length > 0 && (
            <SearchableSelect
              value={assigneeId}
              onChange={onFilter(setAssigneeId)}
              aria-label="Filter by assignee"
              size="sm"
              className="w-44"
              searchPlaceholder="Search people"
              options={[
                { value: "", label: "Anyone" },
                ...setup.assignees.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          )}
        </div>
        {viewSwitch !== undefined && <div className="shrink-0 lg:ml-auto">{viewSwitch}</div>}
      </div>

      {canEstimate && items.length > 0 && (
        <div
          className={cx(
            "flex flex-wrap items-center gap-3 rounded-[1.25rem] border px-4 py-3",
            estimating ? "border-primary-200 bg-primary-50/60" : "border-neutral-200/80 bg-white",
          )}
        >
          <IconTile icon={Timer} hue={unestimated === 0 ? "mint" : "sun"} size={34} />
          {estimating ? (
            <>
              <span className="min-w-0 flex-1 text-sm text-neutral-700">
                Type hours into the Est. column. Empty means not estimated.
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void saveEstimates()}
                disabled={saving || Object.keys(draft).length === 0}
              >
                {saving
                  ? "Saving…"
                  : `Save ${Object.keys(draft).length} ${Object.keys(draft).length === 1 ? "estimate" : "estimates"}`}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEstimating(false);
                  setDraft({});
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1 text-sm text-neutral-700">
                {unestimated === 0
                  ? "Everything on this page is estimated."
                  : `${unestimated} of ${items.length} on this page have no estimate. Cost and forecast are built on these.`}
              </span>
              <Button size="sm" icon={Timer} onClick={() => setEstimating(true)}>
                Estimate these
              </Button>
            </>
          )}
        </div>
      )}

      <DataView
        rows={items}
        columns={columns}
        rowKey={(item) => item.id}
        storageKey="projects.backlog"
        caption="Work items"
        /*
          Searching, filtering and paging are the server's here (see the class
          docblock), so the view's own client-side search is off: it would
          search only the page in hand and answer a different question.
        */
        searchable={false}
        /* The row opens the panel; while estimating, the cells are for typing. */
        onRowClick={estimating ? undefined : (item) => onOpen?.(item)}
        renderCard={renderCard}
        renderListItem={renderListItem}
        toolbar={
          /* Never a bare total. See the class docblock. */
          <Chip hue={coverage.estimated === 0 ? "slate" : "sky"} icon={Clock}>
            {coverage.estimated === 0
              ? "None on this page estimated"
              : `${coverage.hours}h across ${coverage.estimated} of ${coverage.count} on this page`}
          </Chip>
        }
        empty={
          <Empty
            icon={ListChecks}
            title={meta.total === 0 ? "Nothing here yet" : "Nothing matches those filters"}
            hint={
              meta.total === 0
                ? "Add an item and it shows here and on the board."
                : "Widen a filter, or clear the search."
            }
          />
        }
      />

      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
        <span className="font-semibold text-neutral-700">
          {meta.total} item{meta.total === 1 ? "" : "s"} in all
        </span>

        {meta.lastPage > 1 && (
          <span className="ml-auto flex items-center gap-2">
            <Button size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Back
            </Button>
            <span className="tabular-nums">
              Page {meta.currentPage} of {meta.lastPage}
            </span>
            <Button size="sm" disabled={page >= meta.lastPage} onClick={() => setPage((p) => p + 1)}>
              Next
              <ChevronRight size={15} aria-hidden />
            </Button>
          </span>
        )}
      </div>
    </div>
  );
}
