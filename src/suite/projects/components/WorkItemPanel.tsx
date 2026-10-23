"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bug, CalendarDays, Layers, Link2, ListChecks, RotateCcw, Trash2 } from "lucide-react";
import { Button, Chip, PriorityChip, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { JobTitlePicker } from "@/components/workspace/JobTitlePicker";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import {
  ApiError,
  workItems as itemsApi,
  type BoardSetup,
  type Project,
  type Sprint,
  type WorkItem,
  type WorkItemType,
} from "@/lib/api/projects-client";
import ItemDependencies from "./ItemDependencies";
import { FINDING_CATEGORY_LABEL, SEVERITY_META, SEVERITY_ORDER } from "./testing/testingUi";
import { fmtHours } from "./StoryCard";
import {
  CheckRow,
  Drawer,
  FieldError,
  ItemRef,
  Notice,
  StatusChip,
  TYPE_META,
  TYPE_ORDER,
  fmtRange,
  hintCls,
  inputCls,
  invalidCls,
  labelCls,
  priorityName,
} from "./ui/pkit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/** Types that may sit under a user story (WorkItemType::accepts on the API). */
const STORY_CHILD: WorkItemType[] = ["task", "bug", "spike"];

/**
 * The points a story may be sized in. Fibonacci, because the gaps grow with the
 * uncertainty: nobody can tell a 6 from a 7, and the scale should not pretend.
 */
const POINTS = [1, 2, 3, 5, 8, 13];

/** A candidate for "found in": any piece of work on the project that is not itself a bug. */
type FoundInOption = {
  id: string;
  title: string;
  externalRef: string | null;
  type: WorkItemType;
  /** A link whose item could not be fetched: its type is not known, so none is claimed. */
  unknown?: boolean;
};

/**
 * One work item, created or edited.
 *
 * **Only a title is required**, and that is not laziness. The real backlog
 * this module was designed against had 118 tasks, one filled "expected
 * outcome" and *zero* estimates — a form that insists on an estimate gets a
 * made-up estimate, and a made-up estimate is worse than an absent one because
 * every cost and forecast figure downstream treats it as real.
 *
 * So the estimate field says what leaving it empty means, rather than nagging.
 *
 * Assignees come from the project's own members. Assigning work to somebody
 * who cannot open the board is how a ticket is lost silently.
 *
 * **Giving work to somebody else is a board manager's power** — the engineering
 * lead, the delivery lead, a project or product manager — and the server says
 * so in `project.can.manageBoard` (see `WorkItemController::assertMayAssign`).
 * Anybody else may take work themselves or leave it open, so for them the
 * picker offers exactly that rather than a list of colleagues it would then
 * refuse.
 */
export default function WorkItemPanel({
  project,
  setup,
  item,
  sprint,
  sprints = [],
  initialStatusId,
  initialType,
  initialParentId,
  viewerId,
  onClose,
  onSaved,
  onScheduleChanged,
}: {
  project: Project;
  setup: BoardSetup;
  /** Null creates a new one. */
  item: WorkItem | null;
  /** When creating from a sprint board, the item lands in that sprint. */
  sprint?: Sprint | null;
  /** Sprints this item may be scheduled into. Closed ones are excluded. */
  sprints?: Sprint[];
  /** Creating from a board lane's "Add task": the column it starts in. */
  initialStatusId?: string;
  /** Creating: the type to start as ("Add a story" starts a story). */
  initialType?: WorkItemType;
  /** Creating from a story's drawer: the story it goes under. */
  initialParentId?: string;
  /**
   * The signed-in person. Only used to offer somebody without `manageBoard`
   * themselves as an assignee; unknown means the full list is offered and the
   * server has the last word, as it always does.
   */
  viewerId?: string;
  onClose: () => void;
  onSaved: () => void;
  /**
   * A dependency was added or removed.
   *
   * Not `onSaved`, which closes this panel: dependencies write themselves
   * immediately and the form around them has not been submitted, so
   * borrowing that callback would shut the panel under somebody in the
   * middle of linking three items.
   */
  onScheduleChanged?: () => void;
}) {
  const creating = item === null;
  /*
    The server's answer to "may this person save it" (`item.can.update`). The
    panel used to offer every field and a live Save to people it would then
    refuse - an engineer opening a colleague's ticket typed a change and lost it
    to a 403. Read-only here means shown, not hidden: they still need to read it.
  */
  const readOnly = item !== null && item.can?.update === false;
  /* Read once, so the memos below depend on exactly what they use. */
  const itemParent = item?.parent;

  const [title, setTitle] = useState(item?.title ?? "");
  const [type, setType] = useState<WorkItemType>(item?.type ?? initialType ?? "task");
  const [description, setDescription] = useState(item?.description ?? "");
  const [expectedOutcome, setExpectedOutcome] = useState(item?.expectedOutcome ?? "");
  /* What the test cases prove; one condition per line. */
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(item?.acceptanceCriteria ?? "");
  /* A finding's fields (bugs). Assigned, dated and sprinted like any work. */
  const [severity, setSeverity] = useState<string>(item?.severity ?? "");
  const [findingCategory, setFindingCategory] = useState<string>(item?.findingCategory ?? "");
  const [stepsToReproduce, setStepsToReproduce] = useState(item?.stepsToReproduce ?? "");
  const [recommendation, setRecommendation] = useState(item?.recommendation ?? "");
  const [statusId, setStatusId] = useState(
    item?.status?.id ??
      (initialStatusId !== undefined && setup.statuses.some((s) => s.id === initialStatusId)
        ? initialStatusId
        : undefined) ??
      setup.statuses.find((s) => s.isDefault)?.id ??
      setup.statuses[0]?.id ??
      "",
  );
  const [disciplineId, setDisciplineId] = useState(item?.discipline?.id ?? "");
  const [assigneeId, setAssigneeId] = useState(item?.assignee?.id ?? "");
  const [estimateHours, setEstimateHours] = useState(
    item?.estimateHours === null || item?.estimateHours === undefined
      ? ""
      : String(item.estimateHours),
  );
  const [blockedReason, setBlockedReason] = useState(item?.blockedReason ?? "");
  const [isMilestone, setIsMilestone] = useState(item?.isMilestone ?? false);
  /* What the client link calls this milestone; blank means its title (P13). */
  const [clientTitle, setClientTitle] = useState(item?.clientTitle ?? "");
  const [sprintId, setSprintId] = useState(item?.sprintId ?? "");
  const [foundInId, setFoundInId] = useState(item?.foundIn?.id ?? item?.foundInItemId ?? "");
  const [parentId, setParentId] = useState(item?.parentId ?? initialParentId ?? "");

  /*
    The plan fields. The AI planner fills all of these; every one of them is
    also settable here, by hand, because a plan nobody can correct is a plan
    nobody trusts.
  */
  const [startsOn, setStartsOn] = useState(item?.startsOn ?? "");
  const [dueOn, setDueOn] = useState(item?.dueOn ?? "");
  const [dateError, setDateError] = useState<string | null>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const [points, setPoints] = useState<number | null>(item?.estimatePoints ?? null);
  const [possibleBlockers, setPossibleBlockers] = useState(item?.possibleBlockers ?? "");

  /*
    A story's epic. Separate from `parentId` (a task's story) so that re-typing
    a task as a story never offers its old story as an epic, or the reverse.
  */
  const originalEpic = item?.type === "story" ? (item.parentId ?? "") : "";
  const [epicId, setEpicId] = useState(
    item !== null ? originalEpic : initialType === "story" ? (initialParentId ?? "") : "",
  );
  const [epicOptions, setEpicOptions] = useState<{ id: string; title: string; externalRef: string | null }[] | null>(
    null,
  );
  const takesEpic = type === "story";

  useEffect(() => {
    if (!takesEpic || epicOptions !== null) return;

    let live = true;

    itemsApi
      .list(project.slug, { type: "epic", perPage: 250 })
      .then((page) => {
        if (!live) return;

        setEpicOptions(
          (page?.data ?? [])
            .filter((i) => i.type === "epic")
            .map((i) => ({ id: i.id, title: i.title, externalRef: i.externalRef })),
        );
      })
      .catch(() => {
        if (live) setEpicOptions([]);
      });

    return () => {
      live = false;
    };
  }, [takesEpic, epicOptions, project.slug]);

  /* The current epic stays offered even when it is not in the page fetched. */
  const epicChoices = useMemo(() => {
    const list = epicOptions ?? [];

    if (epicId === "" || list.some((o) => o.id === epicId)) return list;

    const title = itemParent != null && itemParent.id === epicId ? itemParent.title : "The epic it is in";

    return [{ id: epicId, title, externalRef: null }, ...list];
  }, [epicOptions, epicId, itemParent]);

  /* Both dates, in order. Bare ISO dates compare correctly as strings. */
  const datesOutOfOrder = startsOn !== "" && dueOn !== "" && startsOn > dueOn;
  const dateMessage = datesOutOfOrder ? "The start date is after the due date. Move one of them." : dateError;

  /*
    The stories a task, bug or spike may sit under. Fetched lazily like the
    "found in" list, and only for the types that can have a story parent — an
    epic or a story never asks. A story's own tasks inherit its sprint on the
    server, which is why picking one here is all the scheduling a task needs.
  */
  const [storyOptions, setStoryOptions] = useState<{ id: string; title: string; externalRef: string | null }[] | null>(null);
  const takesStory = STORY_CHILD.includes(type);

  useEffect(() => {
    if (!takesStory || storyOptions !== null) return;

    let live = true;

    itemsApi
      .list(project.slug, { type: "story", perPage: 250 })
      .then((page) => {
        if (!live) return;

        setStoryOptions(
          (page?.data ?? [])
            .filter((i) => i.type === "story")
            .map((i) => ({ id: i.id, title: i.title, externalRef: i.externalRef })),
        );
      })
      .catch(() => {
        if (live) setStoryOptions([]);
      });

    return () => {
      live = false;
    };
  }, [takesStory, storyOptions, project.slug]);

  /* The current story stays offered even when it is not in the page fetched. */
  const storyChoices = useMemo(() => {
    const list = storyOptions ?? [];
    const current =
      itemParent != null && itemParent.type === "story"
        ? { id: itemParent.id, title: itemParent.title, externalRef: null }
        : parentId !== "" && !list.some((o) => o.id === parentId)
          ? { id: parentId, title: "The story it is in", externalRef: null }
          : null;
    /* The dropdown searches; no separate filter box. */
    return current !== null && !list.some((o) => o.id === current.id) ? [current, ...list] : list;
  }, [storyOptions, itemParent, parentId]);

  /* The parent as it was when the panel opened: only a change is sent on edit. */
  const originalParent = item?.parentId ?? "";

  /*
    The work a bug could have been found in. Fetched only once somebody is
    actually filing a bug — most items are not, and a 250-row request per panel
    opened would be paid for nothing.
  */
  const [foundInOptions, setFoundInOptions] = useState<FoundInOption[] | null>(null);
  const [foundInError, setFoundInError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (type !== "bug" || foundInOptions !== null) return;

    let live = true;

    itemsApi
      .list(project.slug, { perPage: 250 })
      .then((page) => {
        if (!live) return;

        setFoundInOptions(
          page.data
            .filter((i) => i.type !== "bug" && i.id !== item?.id)
            .map((i) => ({ id: i.id, title: i.title, externalRef: i.externalRef, type: i.type })),
        );
      })
      .catch((e: unknown) => {
        if (!live) return;

        setFoundInError(e instanceof ApiError ? e.message : "The project's work did not load.");
        setFoundInOptions([]);
      });

    return () => {
      live = false;
    };
  }, [type, foundInOptions, project.slug, item?.id]);

  /*
    The item's current link stays offered even when it is not in the page just
    fetched, so re-saving a bug never silently drops where it was found.
  */
  /*
    The linked item itself, fetched when the panel was opened with only its id
    (`foundInItemId`, no `foundIn`) and it is not among the 250 just listed -
    on a big project it usually is not. Without it the select showed
    "Select…" for a link that was still there.
  */
  const [linkedFoundIn, setLinkedFoundIn] = useState<FoundInOption | null>(null);
  const linkedId = item?.foundIn == null ? (item?.foundInItemId ?? null) : null;
  const linkedMissing =
    type === "bug" &&
    foundInOptions !== null &&
    linkedId !== null &&
    linkedFoundIn?.id !== linkedId &&
    !foundInOptions.some((o) => o.id === linkedId);

  useEffect(() => {
    if (!linkedMissing || linkedId === null) return;

    let live = true;

    itemsApi
      .get(linkedId)
      .then((found) => {
        if (live) setLinkedFoundIn({ id: found.id, title: found.title, externalRef: found.externalRef, type: found.type });
      })
      /* Gone or not visible: the generic label below still keeps the id offered. */
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, [linkedMissing, linkedId]);

  const foundInChoices = useMemo(() => {
    const list = foundInOptions ?? [];
    const current: FoundInOption | null =
      item?.foundIn ??
      (linkedId === null
        ? null
        : linkedFoundIn?.id === linkedId
          ? linkedFoundIn
          : { id: linkedId, title: "The work it was found in", externalRef: null, type: "task", unknown: true });

    return current != null && !list.some((o) => o.id === current.id) ? [current, ...list] : list;
  }, [foundInOptions, item?.foundIn, linkedId, linkedFoundIn]);

  /*
    Whom this viewer may give the work to. `manageBoard` is the server's answer;
    missing (or an unknown viewer) offers everybody and lets the API decide.
  */
  const assignsOthers = project.can?.manageBoard !== false || viewerId === undefined;
  const people = useMemo(() => {
    const onTeam = assignsOthers
      ? setup.assignees
      : setup.assignees.filter((a) => a.id === viewerId || a.id === item?.assignee?.id);
    const current = item?.assignee;

    /*
      Somebody since taken off the team is still who it is assigned to. Shown
      as such, rather than the select quietly falling back to its first option
      and reassigning the work on the next save.
    */
    return current != null && !setup.assignees.some((a) => a.id === current.id)
      ? [...onTeam, { id: current.id, name: `${current.name ?? "Unnamed"} (not on the team now)` }]
      : onTeam;
  }, [assignsOthers, setup.assignees, viewerId, item?.assignee]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (saving || readOnly || title.trim() === "") return;

    /* Caught here rather than by a 422: the fix is one field away. */
    if (datesOutOfOrder) {
      startRef.current?.focus();
      return;
    }

    setSaving(true);
    setError(null);
    setDateError(null);

    /*
      An empty estimate is sent as null, never as 0. They mean different
      things — "nobody has estimated this" and "this takes no time" — and the
      coverage figures beside every total depend on telling them apart.
    */
    const payload = {
      title: title.trim(),
      type,
      description: description.trim() === "" ? null : description.trim(),
      expectedOutcome: expectedOutcome.trim() === "" ? null : expectedOutcome.trim(),
      acceptanceCriteria: acceptanceCriteria.trim() === "" ? null : acceptanceCriteria.trim(),
      /* A finding's fields travel with bugs only. */
      ...(type === "bug"
        ? {
            severity: severity === "" ? null : severity,
            findingCategory: findingCategory === "" ? null : findingCategory,
            stepsToReproduce: stepsToReproduce.trim() === "" ? null : stepsToReproduce.trim(),
            recommendation: recommendation.trim() === "" ? null : recommendation.trim(),
          }
        : {}),
      statusId,
      disciplineId: disciplineId === "" ? null : disciplineId,
      assigneeId: assigneeId === "" ? null : assigneeId,
      estimateHours: estimateHours.trim() === "" ? null : Number(estimateHours),
      blockedReason: blockedReason.trim() === "" ? null : blockedReason.trim(),
      possibleBlockers: possibleBlockers.trim() === "" ? null : possibleBlockers.trim(),
      startsOn: startsOn === "" ? null : startsOn,
      dueOn: dueOn === "" ? null : dueOn,
      /* Points size stories. Other types keep whatever they carry, untouched. */
      ...(type === "story" ? { estimatePoints: points } : {}),
      isMilestone,
      /* Kept when the flag is off, so ticking it again brings the wording back. */
      clientTitle: clientTitle.trim() === "" ? null : clientTitle.trim(),
      /*
        Bugs only: the API refuses a link on anything else. Left out entirely
        for other types, and the server clears a stale link itself when a bug
        is re-typed as something that cannot have one.
      */
      ...(type === "bug" ? { foundInItemId: foundInId === "" ? null : foundInId } : {}),
      /*
        The story it sits under. On create, sent when chosen; on edit, only
        when changed — re-sending the same parent would re-take the story's
        sprint and pull a finished task out of the sprint it was finished in.
      */
      ...(takesStory && (creating ? parentId !== "" : parentId !== originalParent)
        ? { parentId: parentId === "" ? null : parentId }
        : {}),
      /*
        A story's epic, by the same rule. One exception: an item re-typed as a
        story whose parent was a story must lose that parent, so it is sent
        even when the epic field was left alone.
      */
      ...(takesEpic &&
      (creating
        ? epicId !== ""
        : epicId !== originalEpic || (item.type !== "story" && (item.parentId ?? "") !== ""))
        ? { parentId: epicId === "" ? null : epicId }
        : {}),
    };

    /* Under a story, the sprint is the story's; the server sets it. */
    const underStory = takesStory && parentId !== "";

    try {
      if (creating) {
        const made = await itemsApi.create(project.slug, payload);

        if (sprint != null && !underStory) {
          await itemsApi.move(made.id, { sprintId: sprint.id });
        }
      } else {
        await itemsApi.update(item.id, payload);

        /*
          Scheduling is a `move`, not an `update`: it carries a different
          permission and different bookkeeping, and the API refuses to put
          work into a closed sprint. Only sent when it actually changed, so
          editing a title does not re-assert the sprint.
        */
        if (!underStory && sprintId !== (item.sprintId ?? "")) {
          await itemsApi.move(item.id, { sprintId: sprintId === "" ? null : sprintId });
        }
      }

      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");

      /* The API's date refusal belongs under the dates, not only at the top. */
      const refused = e instanceof ApiError ? (e.errors?.startsOn?.[0] ?? e.errors?.dueOn?.[0]) : undefined;

      if (refused !== undefined) setDateError(refused);

      setSaving(false);
    }
  };

  const remove = async () => {
    if (item === null) return;

    const ok = await confirm({
      title: item.title ? `Remove “${item.title}”?` : "Remove this item?",
      body: "It comes off the board and out of its sprint. It moves to the organisation's recycle bin, where an admin can restore it.",
      confirmLabel: "Remove item",
      recoverable: true,
    });
    if (!ok) return;

    setSaving(true);
    setError(null);

    try {
      await itemsApi.remove(item.id);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That could not be removed.");
      setSaving(false);
    }
  };

  const meta = TYPE_META[type];

  return (
    <Drawer
      title={creating ? "New item" : readOnly ? "Item" : "Edit item"}
      titleId="wi-title"
      subtitle={
        <>
          {project.name}
          {sprint != null && creating ? ` · into ${sprint.name}` : ""}
          {item?.externalRef != null ? ` · ${item.externalRef}` : ""}
        </>
      }
      icon={meta.icon}
      hue={meta.hue}
      width="lg"
      onClose={onClose}
      onSubmit={submit}
      bodyClassName="space-y-5 px-6 py-5"
      footer={
        <>
          {!creating &&
            item.can.delete &&
            (
              <button
                type="button"
                disabled={saving}
                onClick={() => void remove()}
                aria-label="Remove this item"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-error-50 hover:text-error-700 disabled:opacity-50"
              >
                <Trash2 size={17} aria-hidden />
              </button>
            )}

          {readOnly ? (
            <Button className="ml-auto" onClick={onClose}>
              Close
            </Button>
          ) : (
            <>
              <Button className="ml-auto" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving || title.trim() === ""}>
                {saving ? "Saving…" : creating ? "Add item" : "Save"}
              </Button>
            </>
          )}
        </>
      }
    >
      {error !== null && <Notice tone="error">{error}</Notice>}

      {/* Where the item stands, read at a glance before any field. */}
      {!creating && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-neutral-50 p-3">
          <StatusChip status={item.status} />
          <PriorityChip priority={priorityName(item.priority) || null} />
          <ItemRef value={item.externalRef} />
          {item.bounceBacks > 0 && (
            <Chip hue="sun" icon={RotateCcw} className="!px-2 !py-0.5 text-[11px]">
              Sent back {item.bounceBacks} time{item.bounceBacks === 1 ? "" : "s"}
            </Chip>
          )}
          {item.foundIn != null && (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-neutral-600">
              <Link2 size={13} className="shrink-0 text-neutral-400" aria-hidden />
              Found in
              <span className="truncate font-semibold text-neutral-800">
                {item.foundIn.externalRef ? `${item.foundIn.externalRef} · ` : ""}
                {item.foundIn.title}
              </span>
            </span>
          )}
        </div>
      )}

      {readOnly && (
        <Notice tone="info">
          You can read this item but not change it. Whoever it is assigned to, or somebody who manages the
          board, can edit it.
        </Notice>
      )}

      {/*
        One disabled fieldset rather than a flag on every field: it disables
        every input, textarea and button-driven picker inside it natively.
      */}
      <fieldset disabled={readOnly} className="m-0 min-w-0 space-y-5 border-0 p-0">
      <div>
        <label htmlFor="wi-name" className={labelCls}>
          Title
        </label>
        <input
          id="wi-name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={240}
          autoFocus={!readOnly}
          className={inputCls}
        />
      </div>

      <fieldset>
        <legend className={labelCls}>Type</legend>
        <div className="flex flex-wrap gap-2">
          {TYPE_ORDER.map((value) => {
            const t = TYPE_META[value];
            const on = type === value;

            return (
              <label
                key={value}
                className={cx(
                  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition focus-within:ring-2 focus-within:ring-primary-200",
                  on
                    ? cx("border-transparent", HUE[t.hue].soft)
                    : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
                )}
              >
                <input
                  type="radio"
                  name="wi-type"
                  value={value}
                  checked={on}
                  onChange={() => setType(value)}
                  className="sr-only"
                />
                <t.icon size={14} aria-hidden />
                {t.label}
              </label>
            );
          })}
        </div>
        {type === "spike" && (
          /* Time bought to learn something. Counting it as delivery
             would flatter velocity with research. */
          <p className={hintCls}>Excluded from velocity; its hours still count towards cost.</p>
        )}
      </fieldset>

      {/*
        Bugs only, and optional: a bug found in production often belongs to no
        single task, and a required link would be filled in with whichever
        task was nearest — worse than no link. The engineer whose finished work
        it names sees the count on their own performance page, and nobody else.
      */}
      {type === "bug" && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
          <label htmlFor="wi-found-in" className={cx(labelCls, "flex items-center gap-1.5")}>
            <Bug size={14} className="text-rose-600" aria-hidden />
            Found in
          </label>
          <SearchableSelect
            id="wi-found-in"
            value={foundInId}
            onChange={setFoundInId}
            disabled={foundInOptions === null}
            aria-describedby="wi-found-in-hint"
            searchPlaceholder="Search the project's work"
            options={[
              { value: "", label: foundInOptions === null ? "Loading the project's work…" : "Not linked to other work" },
              ...foundInChoices.map((o) => ({
                value: o.id,
                label: `${o.externalRef ? `${o.externalRef}: ` : ""}${o.title}`,
                hint: o.unknown ? undefined : (TYPE_META[o.type]?.label ?? o.type),
              })),
            ]}
          />
          <p id="wi-found-in-hint" className={hintCls}>
            The finished work this bug turned up in, if there is one. Leave it
            open when it belongs to no single piece of work.
          </p>
          {foundInError !== null && <p className="mt-1.5 text-xs font-medium text-error-700">{foundInError}</p>}

          {/*
            The finding's own fields (5 Oct 2026). A bug raised by QA or a
            security analyst arrives with them; one raised from the board
            can be classified here. Severity is the tester's judgement of
            impact - priority, above, stays the team's call about order.
          */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="wi-severity" className={labelCls}>
                Severity
              </label>
              <SearchableSelect
                id="wi-severity"
                value={severity}
                onChange={setSeverity}
                options={[
                  { value: "", label: "Not classified" },
                  ...SEVERITY_ORDER.map((s) => ({ value: s, label: SEVERITY_META[s].label, hint: SEVERITY_META[s].hint })),
                ]}
              />
            </div>
            <div>
              <label htmlFor="wi-finding-category" className={labelCls}>
                Kind of finding
              </label>
              <SearchableSelect
                id="wi-finding-category"
                value={findingCategory}
                onChange={setFindingCategory}
                options={[
                  { value: "", label: "Not classified" },
                  ...Object.entries(FINDING_CATEGORY_LABEL).map(([value, label]) => ({ value, label })),
                ]}
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="wi-steps" className={labelCls}>
              Steps to reproduce
            </label>
            <RichTextEditor
              id="wi-steps"
              value={stepsToReproduce}
              onChange={setStepsToReproduce}
              placeholder="A numbered list, from a signed-out browser"
              disabled={readOnly}
            />
          </div>

          <div className="mt-4">
            <label htmlFor="wi-recommendation" className={labelCls}>
              Recommended remediation
            </label>
            <RichTextEditor
              id="wi-recommendation"
              value={recommendation}
              onChange={setRecommendation}
              placeholder="What the fix should do, so the retest knows what to check"
              disabled={readOnly}
            />
          </div>

          {(item?.testCase || item?.testSprint) && (
            <p className={hintCls}>
              Found
              {item?.testCase && (
                <>
                  {" "}by <span className="font-semibold text-neutral-700">{item.testCase.reference}</span>
                </>
              )}
              {item?.testSprint && (
                <>
                  {" "}in <span className="font-semibold text-neutral-700">{item.testSprint.name}</span>
                </>
              )}
              .
            </p>
          )}
        </div>
      )}

      {takesStory && (
        <div className="rounded-2xl border border-primary-100 bg-primary-50/40 p-4">
          <label htmlFor="wi-story" className={cx(labelCls, "flex items-center gap-1.5")}>
            <ListChecks size={14} className="text-primary-600" aria-hidden />
            Part of story
          </label>
          <SearchableSelect
            id="wi-story"
            value={parentId}
            onChange={setParentId}
            disabled={storyOptions === null}
            aria-describedby="wi-story-hint"
            searchPlaceholder="Search stories"
            options={[
              { value: "", label: storyOptions === null ? "Loading the stories…" : "Not in a story" },
              ...storyChoices.map((o) => ({
                value: o.id,
                label: `${o.externalRef ? `${o.externalRef}: ` : ""}${o.title}`,
              })),
            ]}
          />
          <p id="wi-story-hint" className={hintCls}>
            A task in a story shows inside it on the board and moves sprint with it. Leave it out for a
            one-off bug or spike.
          </p>
        </div>
      )}

      {takesEpic && (
        <div className="rounded-2xl border border-grape-100 bg-grape-50/40 p-4">
          <label htmlFor="wi-epic" className={cx(labelCls, "flex items-center gap-1.5")}>
            <Layers size={14} className="text-grape-600" aria-hidden />
            Part of epic
          </label>
          <SearchableSelect
            id="wi-epic"
            value={epicId}
            onChange={setEpicId}
            disabled={epicOptions === null}
            aria-describedby="wi-epic-hint"
            searchPlaceholder="Search epics"
            options={[
              { value: "", label: epicOptions === null ? "Loading the epics…" : "Not in an epic" },
              ...epicChoices.map((o) => ({
                value: o.id,
                label: `${o.externalRef ? `${o.externalRef}: ` : ""}${o.title}`,
              })),
            ]}
          />
          <p id="wi-epic-hint" className={hintCls}>
            {epicOptions !== null && epicOptions.length === 0
              ? "This project has no epics yet. Add one as an item of type Epic, then group stories under it."
              : "The larger piece of the product this story belongs to. The backlog groups stories by it."}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="wi-status" className={labelCls}>
            Column
          </label>
          <SearchableSelect
            id="wi-status"
            value={statusId}
            onChange={setStatusId}
            searchPlaceholder="Search columns"
            options={setup.statuses.map((s) => ({ value: s.id, label: s.label }))}
          />
        </div>

        <div>
          <label htmlFor="wi-discipline" className={labelCls}>
            Job title
          </label>
          {/* The organisation's job titles — who this work is for, and what its hours cost at. */}
          <JobTitlePicker
            id="wi-discipline"
            mode="id"
            value={disciplineId}
            onChange={(value) => setDisciplineId(value)}
            clearable
            placeholder={
              disciplineId !== "" && disciplineId === item?.discipline?.id ? item.discipline.label : "No job title"
            }
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="wi-assignee" className={labelCls}>
            Assignee
          </label>
          <SearchableSelect
            id="wi-assignee"
            value={assigneeId}
            onChange={setAssigneeId}
            aria-describedby="wi-assignee-hint"
            searchPlaceholder="Search people"
            options={[{ value: "", label: "Nobody yet" }, ...people.map((a) => ({ value: a.id, label: a.name }))]}
          />
          {/* Only people on the project — see BoardController. */}
          <div id="wi-assignee-hint" className={hintCls}>
            <p>People on this project.</p>
            {setup.assignees.length === 0 ? (
              <p>Nobody is on it yet. Add people under Team, then give them work here.</p>
            ) : project.can?.manageBoard === true ? (
              <p>You manage this board, so you can give this to anyone on it.</p>
            ) : !assignsOthers ? (
              <p>Take it yourself or leave it open; somebody who manages the board gives work to others.</p>
            ) : null}
          </div>
        </div>
      </div>

      {!creating && (
        <div>
          <label htmlFor="wi-sprint" className={labelCls}>
            Sprint
          </label>
          {/* Unscheduled *is* the product backlog - not an absence. */}
          <SearchableSelect
            id="wi-sprint"
            value={sprintId}
            onChange={setSprintId}
            disabled={takesStory && parentId !== ""}
            aria-describedby="wi-sprint-hint"
            searchPlaceholder="Search sprints"
            options={[
              { value: "", label: "Product backlog" },
              ...sprints
                .filter((s) => s.acceptsChanges || s.id === item.sprintId)
                .map((s) => ({ value: s.id, label: s.name, hint: fmtRange(s.startsOn, s.endsOn) })),
            ]}
          />
          <p id="wi-sprint-hint" className={hintCls}>
            {takesStory && parentId !== ""
              ? "It follows its story. Move the story to change the sprint, or take this out of the story first."
              : "Moving it out sends it back to the product backlog. A closed sprint will not take it."}
          </p>
        </div>
      )}

      {/* When it runs. Native date pickers: nothing to learn, and they work on a phone. */}
      <fieldset>
        <legend className={cx(labelCls, "flex items-center gap-1.5")}>
          <CalendarDays size={14} className="text-neutral-500" aria-hidden />
          Dates
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="wi-starts" className="mb-1 block text-xs font-medium text-neutral-600">
              Start date
            </label>
            <input
              ref={startRef}
              id="wi-starts"
              type="date"
              value={startsOn}
              onChange={(e) => {
                setStartsOn(e.target.value);
                setDateError(null);
              }}
              aria-invalid={dateMessage != null ? true : undefined}
              aria-describedby={dateMessage != null ? "wi-dates-error" : undefined}
              className={cx(inputCls, dateMessage != null && invalidCls)}
            />
          </div>
          <div>
            <label htmlFor="wi-due" className="mb-1 block text-xs font-medium text-neutral-600">
              Due date
            </label>
            <input
              id="wi-due"
              type="date"
              value={dueOn}
              onChange={(e) => {
                setDueOn(e.target.value);
                setDateError(null);
              }}
              aria-invalid={datesOutOfOrder ? true : undefined}
              aria-describedby={dateMessage != null ? "wi-dates-error" : undefined}
              className={cx(inputCls, datesOutOfOrder && invalidCls)}
            />
          </div>
        </div>
        <FieldError id="wi-dates-error" message={dateMessage} />
      </fieldset>

      {type === "story" && (
        <fieldset>
          <legend id="wi-points-label" className={labelCls}>
            Story points
          </legend>
          {/*
            Native radios drawn as chips: arrow keys move between them and a
            screen reader announces a radio group without any ARIA of ours.
            "None" is how the size is cleared - unpointed is a real answer.
          */}
          <div role="radiogroup" aria-labelledby="wi-points-label" className="flex flex-wrap gap-2">
            {[null, ...POINTS, ...(points !== null && !POINTS.includes(points) ? [points] : [])].map((value) => {
              const on = points === value;

              return (
                <label
                  key={value ?? "none"}
                  className={cx(
                    "inline-flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-semibold tabular-nums transition focus-within:ring-2 focus-within:ring-primary-300",
                    on
                      ? value === null
                        ? "border-neutral-300 bg-neutral-100 text-neutral-800"
                        : "border-transparent bg-primary-600 text-white"
                      : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
                  )}
                >
                  <input
                    type="radio"
                    name="wi-points"
                    value={value ?? ""}
                    checked={on}
                    onChange={() => setPoints(value)}
                    aria-label={value === null ? "No points" : `${value} point${value === 1 ? "" : "s"}`}
                    className="sr-only"
                  />
                  <span aria-hidden>{value ?? "None"}</span>
                </label>
              );
            })}
          </div>
          <p className={hintCls}>Size relative to other stories, not time. Hours belong on its tasks.</p>
        </fieldset>
      )}

      <div>
        <label htmlFor="wi-estimate" className={labelCls}>
          Estimate (hours)
        </label>
        <input
          id="wi-estimate"
          type="number"
          min={0}
          step="0.25"
          value={estimateHours}
          onChange={(e) => setEstimateHours(e.target.value)}
          placeholder="Leave empty if nobody has estimated it"
          aria-describedby="wi-estimate-hint"
          className={inputCls}
        />
        <p id="wi-estimate-hint" className={hintCls}>
          Empty is honest. Cost and forecast report how much of a total was
          estimated, so a guessed number does more harm than a missing one.
        </p>
        {/* Read-only: what the story's own tasks add up to. */}
        {!creating && item.type === "story" && type === "story" && item.rollup != null && (
          <p className="mt-2 rounded-xl bg-neutral-50 px-3 py-2 text-[13px] text-neutral-600">
            {item.rollup.total === 0 ? (
              "No tasks in this story yet."
            ) : item.rollup.hours === null ? (
              "No tasks estimated yet."
            ) : (
              <>
                From tasks:{" "}
                <span className="font-semibold tabular-nums text-neutral-900">{fmtHours(item.rollup.hours)}</span>{" "}
                across {item.rollup.estimated} of {item.rollup.total} estimated
              </>
            )}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="wi-desc" className={labelCls}>
          Description
        </label>
        <RichTextEditor
          id="wi-desc"
          variant="full"
          minHeight={200}
          value={description}
          onChange={setDescription}
          placeholder="What it is, who it is for, and anything the team should know"
          disabled={readOnly}
        />
      </div>

      <div>
        <label htmlFor="wi-outcome" className={labelCls}>
          Expected outcome
        </label>
        <RichTextEditor
          id="wi-outcome"
          minHeight={64}
          value={expectedOutcome}
          onChange={setExpectedOutcome}
          placeholder="How somebody will know this is done"
          disabled={readOnly}
        />
      </div>

      {type !== "bug" && (
        <div>
          <label htmlFor="wi-criteria" className={labelCls}>
            Acceptance criteria
          </label>
          <RichTextEditor
            id="wi-criteria"
            value={acceptanceCriteria}
            onChange={setAcceptanceCriteria}
            placeholder="A list, one condition each, e.g. An end date before the start date is refused"
            describedBy="wi-criteria-hint"
            disabled={readOnly}
          />
          <p id="wi-criteria-hint" className={hintCls}>
            What the test cases prove. Left empty, the test-case draft writes them from the story.
          </p>
        </div>
      )}

      {/*
        A flag, not a different kind of item: everything else about it —
        status, sprint, dependencies, its place on the critical path —
        keeps working exactly as before. It earns its place in two screens,
        the Gantt and the client link, and nowhere else.
      */}
      <CheckRow
        checked={isMilestone}
        onChange={setIsMilestone}
        title="This is a milestone"
        hint="Shown as a marker on the schedule, and as the progress line on any client link. Any item can be one."
      />

      {isMilestone && (
        <div>
          <label htmlFor="wi-client-title" className={labelCls}>
            Title on the client link
          </label>
          <input
            id="wi-client-title"
            value={clientTitle}
            onChange={(e) => setClientTitle(e.target.value)}
            maxLength={240}
            placeholder={title.trim() === "" ? "Optional" : title.trim()}
            aria-describedby="wi-client-title-hint"
            className={inputCls}
          />
          <p id="wi-client-title-hint" className={hintCls}>
            Optional. What a client reads on the shared status page; leave it blank to show the title above.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="wi-blocked" className={labelCls}>
          Blocked by
        </label>
        <input
          id="wi-blocked"
          value={blockedReason}
          onChange={(e) => setBlockedReason(e.target.value)}
          placeholder="A note, not a link"
          aria-describedby="wi-blocked-hint"
          className={inputCls}
        />
        {/*
          Deliberately still free text, alongside real dependencies rather
          than replaced by them. "Waiting on the client to confirm the
          schema" is a sentence about the world that no edge can express,
          and nothing can compute with it; a dependency is an edge between
          two pieces of work that the schedule is derived from. A team
          needs both, and collapsing them loses either the prose or the
          arithmetic.
        */}
        <p id="wi-blocked-hint" className={hintCls}>
          What has stopped it now, from outside this board. Work that waits on another item goes below.
        </p>
      </div>

      {/*
        Not the same field twice. "Blocked by" is a fact about today and
        raises the board's flag; this is a forecast the plan should route
        around, and merging them would show every risk as if it had happened.
      */}
      <div className="rounded-2xl border border-dashed border-sun-400 bg-sun-50/50 p-4">
        <label htmlFor="wi-risks" className={cx(labelCls, "flex items-center gap-1.5")}>
          <AlertTriangle size={14} className="text-sun-600" aria-hidden />
          Possible blockers
        </label>
        <RichTextEditor
          id="wi-risks"
          minHeight={64}
          value={possibleBlockers}
          onChange={setPossibleBlockers}
          placeholder="e.g. Waiting on the client's SSO details; UAT window not agreed"
          describedBy="wi-risks-hint"
          disabled={readOnly}
        />
        <p id="wi-risks-hint" className={hintCls}>
          Risks to plan around. Nothing is stopped yet. When one of them does stop the work, put it
          under Blocked by.
        </p>
      </div>

      </fieldset>

      {/*
        Only once the item exists: an edge needs two ends, and there is no
        id to link to until it is saved. Outside the fieldset: dependencies
        save themselves and ask the server who may change them.
      */}
      {!creating && (
        <div className="rounded-2xl border border-neutral-200/80 p-4">
          <ItemDependencies slug={project.slug} itemId={item.id} onChanged={onScheduleChanged} />
        </div>
      )}
    </Drawer>
  );
}
