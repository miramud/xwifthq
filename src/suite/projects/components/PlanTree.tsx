"use client";

import { useId, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck2,
  ChevronRight,
  Clock3,
  Inbox,
  Layers,
  Loader2,
  RotateCcw,
  Split,
} from "lucide-react";
import { Button, Chip, PriorityChip, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import type {
  BacklogPlan,
  PlanChange,
  PlanEpic,
  PlanSlot,
  PlanStory,
  PlanTask,
  PlanTeamMember,
} from "@/lib/api/projects-client";
import { AssumedChip, JobTitleChip } from "./AiParts";
import { IconTile, fmtDate, plural, priorityName } from "./ui/pkit";

/**
 * The drafted delivery plan as a tree: epics › stories › tasks.
 *
 * **Read top-down, decided bottom-up.** An epic row says how big it is and
 * when it lands; a story says whether it fits the first sprint and what
 * "done" means; a task says who does it and for how long. The dates and the
 * sprint fit come from the server's scheduler (`plan.paths`), never worked
 * out here, so the preview and the commit cannot disagree.
 *
 * Unticking a parent greys its subtree rather than unticking every child:
 * `keep:false` skips a subtree, it does not delete it, so ticking the epic
 * again brings back exactly what was there.
 */

/** How one epic's breakdown is going, as the preview's loop sees it. */
export type EpicRun = { state: "queued" | "running" | "failed"; error?: string };

const POINTS = [1, 2, 3, 5, 8, 13];

export default function PlanTree({
  epics,
  plan,
  runs,
  disabled = false,
  onChange,
  onBreakdown,
}: {
  epics: PlanEpic[];
  plan?: BacklogPlan;
  runs: Record<number, EpicRun | undefined>;
  /** While committing or discarding: nothing may change under the button. */
  disabled?: boolean;
  onChange: (change: PlanChange) => void;
  onBreakdown: (epicIndex: number) => void;
}) {
  /* The first epic open: it is the one the model puts first for a reason. */
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]));

  const toggle = (index: number) =>
    setOpen((was) => {
      const next = new Set(was);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  return (
    <ol className="space-y-3" aria-label="Drafted plan">
      {epics.map((epic, e) => (
        <EpicNode
          key={e}
          epic={epic}
          index={e}
          plan={plan}
          run={runs[e]}
          open={open.has(e)}
          disabled={disabled}
          onToggle={() => toggle(e)}
          onChange={onChange}
          onBreakdown={() => onBreakdown(e)}
        />
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */

function EpicNode({
  epic,
  index,
  plan,
  run,
  open,
  disabled,
  onToggle,
  onChange,
  onBreakdown,
}: {
  epic: PlanEpic;
  index: number;
  plan?: BacklogPlan;
  run: EpicRun | undefined;
  open: boolean;
  disabled: boolean;
  onToggle: () => void;
  onChange: (change: PlanChange) => void;
  onBreakdown: () => void;
}) {
  const bodyId = useId();
  const kept = epic.keep !== false;
  const path = String(index);
  const slot = plan?.paths[path];
  const hours = slot?.hours ?? sumHours(epic.stories.filter(isKept).flatMap((s) => s.tasks.filter(isKept)));
  const taskCount = epic.stories.reduce((n, s) => n + s.tasks.length, 0);

  return (
    <li
      className={cx(
        "rounded-2xl border bg-white transition-colors",
        kept ? "border-neutral-200/80" : "border-dashed border-neutral-200 bg-neutral-50/60",
      )}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 p-3.5 sm:p-4">
        <KeepBox
          checked={kept}
          disabled={disabled}
          label={`Keep epic "${epic.title}"`}
          onChange={(keep) => onChange({ path, keep })}
        />

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="group -m-1 flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 rounded-xl p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          <ChevronRight
            size={18}
            aria-hidden
            className={cx(
              "mt-2 shrink-0 text-neutral-400 transition-transform duration-200 group-hover:text-neutral-700",
              open && "rotate-90",
            )}
          />
          <span className="hidden sm:block">
            <IconTile icon={Layers} hue={kept ? "grape" : "slate"} size={34} />
          </span>
          <span className={cx("min-w-0 flex-1", !kept && "opacity-60")}>
            <span className="block text-[15px] font-semibold leading-snug text-neutral-900">
              <span className={cx(!kept && "line-through decoration-neutral-400")}>{epic.title}</span>
              {epic.assumed === true && <AssumedChip className="ml-2" />}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
              <span>{plural(epic.stories.length, "story", "stories")}</span>
              {epic.brokenDown && (
                <>
                  <Dot />
                  <span>{plural(taskCount, "task")}</span>
                </>
              )}
              {hours !== null && (
                <>
                  <Dot />
                  <span className="tabular-nums">{fmtHours(hours)}</span>
                </>
              )}
              {slot !== undefined && kept && (
                <>
                  <Dot />
                  <span className="tabular-nums">{shortRange(slot.startsOn, slot.dueOn)}</span>
                </>
              )}
            </span>
          </span>
        </button>

        <EpicStatus epic={epic} run={run} disabled={disabled} onBreakdown={onBreakdown} />
      </div>

      {open && (
        <div
          id={bodyId}
          className={cx("border-t border-neutral-100 px-3.5 pb-4 pt-3 sm:px-4", !kept && "opacity-50")}
        >
          {epic.description && (
            <p className="mb-3 max-w-[72ch] text-[13px] leading-relaxed text-neutral-600 sm:pl-[4.5rem]">
              {epic.description}
            </p>
          )}

          {!kept && (
            <p className="mb-3 text-xs font-medium text-neutral-600 sm:pl-[4.5rem]">
              Skipped with its epic. Tick the epic to bring these back.
            </p>
          )}

          {/* The spine: a hairline that says "these belong to the epic above". */}
          <ol className="space-y-2.5 sm:ml-[1.35rem] sm:border-l-2 sm:border-neutral-100 sm:pl-5">
            {epic.stories.map((story, s) => (
              <StoryNode
                key={s}
                story={story}
                path={`${index}.${s}`}
                plan={plan}
                parentKept={kept}
                brokenDown={epic.brokenDown}
                disabled={disabled}
                onChange={onChange}
              />
            ))}
          </ol>
        </div>
      )}
    </li>
  );
}

function EpicStatus({
  epic,
  run,
  disabled,
  onBreakdown,
}: {
  epic: PlanEpic;
  run: EpicRun | undefined;
  disabled: boolean;
  onBreakdown: () => void;
}) {
  if (run?.state === "running") {
    return (
      <Chip hue="blue" icon={Loader2} className="ml-auto self-center !py-1 [&>svg]:animate-spin">
        Breaking down…
      </Chip>
    );
  }

  if (run?.state === "queued") {
    return (
      <Chip hue="slate" className="ml-auto self-center">
        Waiting its turn
      </Chip>
    );
  }

  if (run?.state === "failed") {
    return (
      <div className="flex w-full flex-wrap items-center gap-2 rounded-xl bg-error-50 px-3 py-2 sm:ml-auto sm:w-auto sm:max-w-sm">
        <p role="alert" className="flex min-w-0 flex-1 items-start gap-1.5 text-xs font-medium text-error-700">
          <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden />
          <span>{run.error ?? "The tasks for this epic did not come back."}</span>
        </p>
        <Button
          size="sm"
          icon={RotateCcw}
          onClick={onBreakdown}
          disabled={disabled}
          aria-label={`Retry "${epic.title}"`}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!epic.brokenDown) {
    return (
      <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
        <span className="flex-1 text-xs text-neutral-500 sm:flex-none">Not broken down yet</span>
        <Button
          size="sm"
          icon={Split}
          onClick={onBreakdown}
          disabled={disabled}
          aria-label={`Break down "${epic.title}"`}
        >
          Break down
        </Button>
      </div>
    );
  }

  return null;
}

/* ------------------------------------------------------------------ */

function StoryNode({
  story,
  path,
  plan,
  parentKept,
  brokenDown,
  disabled,
  onChange,
}: {
  story: PlanStory;
  path: string;
  plan?: BacklogPlan;
  parentKept: boolean;
  brokenDown: boolean;
  disabled: boolean;
  onChange: (change: PlanChange) => void;
}) {
  const kept = story.keep !== false;
  const live = kept && parentKept;
  const slot = plan?.paths[path];
  const keptTasks = story.tasks.filter(isKept);
  const hours = slot?.hours ?? sumHours(keptTasks);
  const criteria = acceptanceLines(story.expectedOutcome);

  return (
    <li
      className={cx(
        "rounded-xl p-3 transition-colors sm:p-3.5",
        live ? "bg-neutral-50/70 ring-1 ring-neutral-100" : "bg-neutral-50/40",
      )}
    >
      <div className="flex items-start gap-3">
        <KeepBox
          checked={kept}
          disabled={disabled || !parentKept}
          label={`Keep story "${story.title}"`}
          onChange={(keep) => onChange({ path, keep })}
        />

        <div className={cx("min-w-0 flex-1", !live && "opacity-60")}>
          <p className="text-sm font-semibold leading-snug text-neutral-900">
            <span className={cx(!kept && "line-through decoration-neutral-400")}>{story.title}</span>
            {story.assumed === true && <AssumedChip className="ml-2" />}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <PointsPicker
              points={story.points ?? null}
              title={story.title}
              disabled={disabled || !live}
              onChange={(points) => onChange({ path, points })}
            />
            {story.priority !== null && story.priority !== undefined && priorityName(story.priority) !== "" && (
              <PriorityChip priority={priorityName(story.priority)} />
            )}
            <Chip hue="slate" icon={Clock3}>
              {hours === null ? (brokenDown ? "No estimate" : "Hours once broken down") : fmtHours(hours)}
            </Chip>
            {slot !== undefined && live && (
              <span className="whitespace-nowrap px-1 text-xs tabular-nums text-neutral-600">
                {shortRange(slot.startsOn, slot.dueOn)}
              </span>
            )}
            {slot !== undefined && live && <SprintBadge slot={slot} plan={plan} />}
          </div>

          {story.description && (
            <p className="mt-2 max-w-[72ch] text-[13px] leading-relaxed text-neutral-600">{story.description}</p>
          )}

          {criteria.length > 0 && (
            <div className="mt-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Acceptance criteria</p>
              {criteria.length === 1 ? (
                <p className="mt-1 max-w-[72ch] text-[13px] leading-relaxed text-neutral-700">{criteria[0]}</p>
              ) : (
                <ul className="mt-1 max-w-[72ch] space-y-1">
                  {criteria.map((line, i) => (
                    <li key={i} className="relative pl-4 text-[13px] leading-relaxed text-neutral-700">
                      <span aria-hidden className="absolute left-0.5 top-[0.6em] h-1.5 w-1.5 rounded-full bg-mint-500" />
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {story.possibleBlockers && <Blockers text={story.possibleBlockers} className="mt-2.5" />}

          {story.tasks.length > 0 && (
            <ul className="mt-3 divide-y divide-neutral-100 overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200/70" aria-label={`Tasks for "${story.title}"`}>
              {story.tasks.map((task, t) => (
                <TaskRow
                  key={t}
                  task={task}
                  path={`${path}.${t}`}
                  slot={plan?.paths[`${path}.${t}`]}
                  team={plan?.team}
                  parentKept={live}
                  disabled={disabled}
                  onChange={onChange}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

function TaskRow({
  task,
  path,
  slot,
  team,
  parentKept,
  disabled,
  onChange,
}: {
  task: PlanTask;
  path: string;
  slot: PlanSlot | undefined;
  team: PlanTeamMember[] | undefined;
  parentKept: boolean;
  disabled: boolean;
  onChange: (change: PlanChange) => void;
}) {
  const kept = task.keep !== false;
  const live = kept && parentKept;

  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <KeepBox
        checked={kept}
        disabled={disabled || !parentKept}
        label={`Keep task "${task.title}"`}
        onChange={(keep) => onChange({ path, keep })}
      />
      <div className={cx("flex min-w-0 flex-1 flex-wrap items-start gap-x-3 gap-y-1.5", !live && "opacity-60")}>
        <div className="min-w-0 flex-1 basis-[12rem]">
          <p className={cx("text-[13px] font-medium leading-snug text-neutral-900", !kept && "line-through decoration-neutral-400")}>
            {task.title}
          </p>
          {task.expectedOutcome && (
            <p className="mt-0.5 text-xs leading-snug text-neutral-500">
              <span className="font-semibold text-neutral-600">Done when</span> {task.expectedOutcome}
            </p>
          )}
          {task.possibleBlockers && <Blockers text={task.possibleBlockers} compact className="mt-1" />}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <JobTitleChip item={task} />
          {team !== undefined && team.length > 0 && live && (
            <AssigneePicker
              task={task}
              slot={slot}
              team={team}
              disabled={disabled}
              onChange={(assigneeId) => onChange({ path, assigneeId })}
            />
          )}
          <HoursField
            hours={task.estimateHours ?? null}
            title={task.title}
            disabled={disabled || !live}
            onChange={(estimateHours) => onChange({ path, estimateHours })}
          />
          {slot !== undefined && live && (
            <span className="whitespace-nowrap text-xs tabular-nums text-neutral-500">
              {shortRange(slot.startsOn, slot.dueOn)}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Who the task goes to.
 *
 * Left alone, the scheduler picks: the member of its job title free soonest,
 * shown as "Auto · name" so it reads as a suggestion, not a decision somebody
 * made. Picking a person pins it; "Auto" hands it back.
 */
function AssigneePicker({
  task,
  slot,
  team,
  disabled,
  onChange,
}: {
  task: PlanTask;
  slot: PlanSlot | undefined;
  team: PlanTeamMember[];
  disabled: boolean;
  onChange: (assigneeId: string | null) => void;
}) {
  const pinned = task.assigneeId ?? null;
  const auto = pinned === null ? (slot?.assigneeId ?? null) : null;
  const autoName = team.find((m) => m.userId === auto)?.name;

  return (
    <SearchableSelect
      value={pinned ?? ""}
      onChange={(value) => onChange(value === "" ? null : value)}
      disabled={disabled}
      size="sm"
      aria-label={`Assign "${task.title}"`}
      searchPlaceholder="Search the team"
      className="w-44"
      options={[
        {
          value: "",
          label: autoName !== undefined ? `Auto · ${autoName}` : "Unassigned",
          hint:
            autoName !== undefined
              ? "Whoever of this job title is free soonest"
              : "Nobody on the team has this job title",
        },
        ...team.map((m) => ({ value: m.userId, label: m.name, hint: m.jobTitle ?? "No job title", group: "Team" })),
      ]}
    />
  );
}

/* ------------------------------------------------------------------ */

function SprintBadge({ slot, plan }: { slot: PlanSlot; plan?: BacklogPlan }) {
  if (slot.inSprint) {
    return (
      <Chip hue="mint" icon={CalendarCheck2}>
        {`In ${plan?.window.sprintName ?? "the first sprint"}`}
      </Chip>
    );
  }

  return (
    <Chip hue="slate" icon={Inbox}>
      Product backlog
    </Chip>
  );
}

/**
 * A risk to plan around, in the warning hue with its own icon, so it never
 * reads as one more acceptance criterion, and never as "blocked now".
 */
function Blockers({ text, compact = false, className }: { text: string; compact?: boolean; className?: string }) {
  const lines = acceptanceLines(text);

  return (
    <div
      className={cx(
        "flex items-start gap-2 rounded-lg border-l-[3px] border-sun-400 bg-sun-50 text-sun-700",
        compact ? "px-2 py-1 text-xs" : "px-2.5 py-2 text-[13px]",
        className,
      )}
    >
      <AlertTriangle size={compact ? 12 : 14} className="mt-[3px] shrink-0" aria-hidden />
      <div className="min-w-0 leading-snug">
        <span className="font-semibold">Possible blockers</span>
        {lines.length <= 1 ? (
          <span>: {lines[0] ?? text}</span>
        ) : (
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
            {lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function KeepBox({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (keep: boolean) => void;
}) {
  return (
    /* A 44px hit area around a 16px box: the tree is dense, thumbs are not. */
    <label className="-m-3.5 flex shrink-0 cursor-pointer items-start p-3.5 has-[:disabled]:cursor-not-allowed">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-neutral-300 accent-primary-600 disabled:cursor-not-allowed"
      />
    </label>
  );
}

/** Points as a chip that is also a select: sizing is a one-tap correction. */
function PointsPicker({
  points,
  title,
  disabled,
  onChange,
}: {
  points: number | null;
  title: string;
  disabled: boolean;
  onChange: (points: number | null) => void;
}) {
  return (
    <SearchableSelect
      value={points === null ? "" : String(points)}
      disabled={disabled}
      onChange={(value) => onChange(value === "" ? null : Number(value))}
      aria-label={`Story points for "${title}"`}
      size="sm"
      className="w-28 shrink-0"
      searchPlaceholder="Search points"
      options={[
        { value: "", label: "Unsized" },
        ...POINTS.map((p) => ({ value: String(p), label: `${p} ${p === 1 ? "pt" : "pts"}` })),
      ]}
    />
  );
}

/**
 * Hours as a small field that saves on blur or Enter. Empty or zero means
 * "not estimated", null, never 0.
 */
function HoursField({
  hours,
  title,
  disabled,
  onChange,
}: {
  hours: number | null;
  title: string;
  disabled: boolean;
  onChange: (hours: number | null) => void;
}) {
  const [draft, setDraft] = useState(hours === null ? "" : String(hours));
  const [seen, setSeen] = useState(hours);

  /* A fresh plan from the server (or a rollback) wins over a stale draft. */
  if (seen !== hours) {
    setSeen(hours);
    setDraft(hours === null ? "" : String(hours));
  }

  const save = () => {
    const n = Number(draft);
    const next = draft.trim() === "" || !Number.isFinite(n) || n <= 0 ? null : Math.round(n * 10) / 10;

    if (next !== hours) onChange(next);
    else setDraft(hours === null ? "" : String(hours));
  };

  return (
    <span className="inline-flex items-center gap-1 text-xs text-neutral-600">
      <input
        type="number"
        inputMode="decimal"
        min={0}
        max={999}
        step={0.5}
        value={draft}
        disabled={disabled}
        placeholder="-"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        aria-label={`Hours for "${title}"`}
        className="h-7 w-14 rounded-lg border border-neutral-200 bg-white px-1.5 text-right text-xs tabular-nums text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50"
      />
      <span aria-hidden>h</span>
    </span>
  );
}

function Dot() {
  return <span aria-hidden className="h-1 w-1 rounded-full bg-neutral-300" />;
}

/* ------------------------------------------------------------------ */
/*  Helpers, exported for the preview and the tests                    */
/* ------------------------------------------------------------------ */

export function isKept(node: { keep?: boolean }): boolean {
  return node.keep !== false;
}

/** Sum of estimated hours, or null when nothing is estimated (never 0). */
export function sumHours(tasks: PlanTask[]): number | null {
  const estimated = tasks.filter((t) => t.estimateHours !== null && t.estimateHours !== undefined && t.estimateHours > 0);

  return estimated.length === 0 ? null : estimated.reduce((n, t) => n + (t.estimateHours ?? 0), 0);
}

export function fmtHours(hours: number): string {
  return `${Math.round(hours * 10) / 10}h`;
}

/** "25 Sep to 1 Oct"; one day reads as one date. */
export function shortRange(from: string | null | undefined, to: string | null | undefined): string {
  if (!from && !to) return "Not scheduled";
  if (!from || !to || from === to) return fmtDate(from ?? to, false);

  return `${fmtDate(from, false)} to ${fmtDate(to, false)}`;
}

/**
 * Acceptance criteria as lines: one per newline, bullets and numbering
 * stripped, blanks dropped, so "- Given…\n- When…" reads as a list.
 */
export function acceptanceLines(text: string | null | undefined): string[] {
  if (!text) return [];

  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•\u2013]|\d+[.)])\s+/, "").trim())
    .filter((line) => line !== "");
}

/** What committing would create: kept nodes under kept parents. */
export function keptCounts(epics: PlanEpic[]): { epics: number; stories: number; tasks: number } {
  let e = 0;
  let s = 0;
  let t = 0;

  for (const epic of epics.filter(isKept)) {
    e++;
    for (const story of epic.stories.filter(isKept)) {
      s++;
      t += story.tasks.filter(isKept).length;
    }
  }

  return { epics: e, stories: s, tasks: t };
}
