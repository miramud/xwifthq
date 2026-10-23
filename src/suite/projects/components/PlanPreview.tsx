"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarCheck2, CheckCircle2, Layers, Loader2 } from "lucide-react";
import { Button, Panel, Progress, cx } from "@/components/workspace/kit";
import {
  ApiError,
  generate as generateApi,
  planEpics,
  type AiGeneration,
  type BacklogPlan,
  type PlanChange,
  type PlanEpic,
  type Project,
} from "@/lib/api/projects-client";
import { BriefQuestions } from "./AiParts";
import PlanProgress from "./PlanProgress";
import PlanTree, { fmtHours, isKept, keptCounts, shortRange, sumHours, type EpicRun } from "./PlanTree";
import { Notice, plural } from "./ui/pkit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

/**
 * Reviewing a drafted delivery plan, while its tasks are still arriving.
 *
 * **Two phases, one screen.** The plan call returns epics and stories; tasks
 * come one epic at a time, because the whole tree in one call outruns the
 * provider's time limit. The loop runs in the background of the review, not
 * in front of it — a reader can untick an epic while the third one is still
 * being broken down.
 *
 * The loop is deliberately fragile-tolerant:
 * - a failed epic stays failed *on that epic*, with its own Retry, and the
 *   loop moves on — one bad answer does not cost the other five;
 * - Stop lets the request in flight finish (it is already spent), then stops;
 * - it only starts by itself for a plan drafted in this visit (`autoStart`).
 *   A plan somebody left half broken down offers "Continue breaking down"
 *   instead: spending on their behalf because they opened a tab is not ours
 *   to decide.
 *
 * Keep toggles are optimistic — the tick moves at once — and roll back with
 * a notice when the server refuses, because a checkbox that lies is worse
 * than one that is slow.
 */
export default function PlanPreview({
  project,
  generation,
  autoStart,
  busy,
  onChange,
  onRun,
  onCommitted,
  onBreakdownProgress,
}: {
  project: Project;
  generation: AiGeneration;
  /** Start breaking down every epic as soon as this mounts. */
  autoStart: boolean;
  busy: string | null;
  onChange: (generation: AiGeneration) => void;
  onRun: <T>(key: string, action: () => Promise<T>) => Promise<T | null>;
  onCommitted: () => void;
  /** Where the epic-by-epic breakdown has got to, for a progress report beside it. */
  onBreakdownProgress?: (p: { total: number; done: number; current: string | null; failed: number; running: boolean }) => void;
}) {
  const confirm = useConfirm();
  const epics = planEpics(generation);
  const plan = generation.plan;

  const [runs, setRuns] = useState<Record<number, EpicRun | undefined>>({});
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [reviseError, setReviseError] = useState<string | null>(null);

  /*
    Refs, not state, for what the loop reads between awaits: the loop is one
    long-lived async function and would otherwise see the render it started in.
  */
  const latest = useRef(generation);
  const queue = useRef<number[]>([]);
  const working = useRef(false);
  const stopAsked = useRef(false);
  const mounted = useRef(true);
  /** Bumped by every edit, so a breakdown that raced one knows to re-read. */
  const edits = useRef(0);

  useEffect(() => {
    latest.current = generation;
  }, [generation]);

  useEffect(() => {
    mounted.current = true;

    return () => {
      /* Leaving the tab ends the loop after the request in flight. */
      mounted.current = false;
    };
  }, []);

  const apply = useCallback(
    (next: AiGeneration) => {
      latest.current = next;
      onChange(next);
    },
    [onChange],
  );

  const work = useCallback(async () => {
    if (working.current) return;

    working.current = true;
    stopAsked.current = false;
    setRunning(true);
    setStopping(false);

    while (queue.current.length > 0 && !stopAsked.current && mounted.current) {
      const index = queue.current.shift() as number;
      const editsBefore = edits.current;

      setRuns((r) => ({ ...r, [index]: { state: "running" } }));

      try {
        const next = await generateApi.breakdown(project.slug, latest.current.id, index);

        if (!mounted.current) break;

        apply(next);
        setRuns((r) => ({ ...r, [index]: undefined }));

        /*
          An edit landed while this epic was being broken down; the answer may
          predate it. Re-read rather than show a tick the server has lost.
        */
        if (edits.current !== editsBefore) {
          const fresh = await generateApi.get(project.slug, latest.current.id).catch(() => null);

          if (fresh !== null && mounted.current) apply(fresh);
        }
      } catch (e) {
        if (!mounted.current) break;

        setRuns((r) => ({
          ...r,
          [index]: {
            state: "failed",
            error: e instanceof ApiError ? e.message : "The tasks for this epic did not come back.",
          },
        }));
      }
    }

    /* Stopped or finished: whatever was still waiting goes back to "not yet". */
    const dropped = queue.current;
    queue.current = [];
    working.current = false;

    if (!mounted.current) return;

    setRuns((r) => {
      const next = { ...r };
      for (const i of dropped) if (next[i]?.state === "queued") next[i] = undefined;
      return next;
    });
    setRunning(false);
    setStopping(false);
  }, [apply, project.slug]);

  const enqueue = useCallback(
    (indices: number[]) => {
      const fresh = indices.filter((i) => !queue.current.includes(i));

      if (fresh.length === 0) return;

      queue.current.push(...fresh);
      setRuns((r) => {
        const next = { ...r };
        for (const i of fresh) if (next[i]?.state !== "running") next[i] = { state: "queued" };
        return next;
      });
      void work();
    },
    [work],
  );

  const unbroken = (list: PlanEpic[]) =>
    list.flatMap((epic, i) => (epic.brokenDown || runs[i]?.state === "running" ? [] : [i]));

  /* Reported whenever an epic starts, lands or fails. */
  const report = useRef(onBreakdownProgress);
  useEffect(() => {
    report.current = onBreakdownProgress;
  }, [onBreakdownProgress]);

  useEffect(() => {
    const active = Object.entries(runs).find(([, r]) => r?.state === "running");
    report.current?.({
      total: epics.length,
      done: epics.filter((e) => e.brokenDown).length,
      current: active ? (epics[Number(active[0])]?.title ?? null) : null,
      failed: Object.values(runs).filter((r) => r?.state === "failed").length,
      running,
    });
  }, [runs, running, epics]);

  /* Once per drafted plan: StrictMode's second effect run finds it started. */
  const started = useRef(false);

  useEffect(() => {
    if (!autoStart || started.current) return;

    started.current = true;
    enqueue(planEpics(latest.current).flatMap((epic, i) => (epic.brokenDown ? [] : [i])));
  }, [autoStart, enqueue]);

  const change = async (c: PlanChange) => {
    const before = latest.current;
    const undo = snapshot(planEpics(before), c);

    edits.current++;
    setReviseError(null);
    apply({ ...before, items: patch(planEpics(before), c) });

    try {
      const next = await generateApi.reviseTree(project.slug, before.id, [c]);

      if (mounted.current) apply(next);
    } catch (e) {
      if (!mounted.current) return;

      /* Undo only this node: a breakdown may have landed since. */
      apply({ ...latest.current, items: patch(planEpics(latest.current), undo) });
      setReviseError(
        `That change did not save${e instanceof ApiError ? `: ${e.message}` : "."} It has been put back.`,
      );
    }
  };

  const counts = keptCounts(epics);
  const assumed = epics.flatMap((e) => [e, ...e.stories]).filter((n) => n.assumed === true).length;
  const missing = epics.filter((e) => isKept(e) && !e.brokenDown).length;
  const committing = busy === "commit" || busy === "discard";

  const commitLabel =
    counts.tasks > 0
      ? `Add ${plural(counts.stories, "story", "stories")} and ${plural(counts.tasks, "task")}`
      : `Add ${plural(counts.stories, "story", "stories")}`;

  return (
    <Panel
      title="Drafted delivery plan"
      subtitle={`${generation.model} · ${generation.totalTokens.toLocaleString()} tokens`}
      icon={Layers}
      hue="grape"
    >
      <div className="space-y-4">
        <Summary epics={epics} plan={plan} />

        {plan !== undefined && counts.stories > 0 && <SprintFit plan={plan} targetEndsOn={project.targetEndsOn} />}

        <PlanProgress
          epics={epics}
          runs={runs}
          running={running}
          stopping={stopping}
          disabled={committing}
          onStop={() => {
            stopAsked.current = true;
            setStopping(true);
          }}
          onContinue={() => enqueue(unbroken(epics))}
        />

        {/*
          The sentence that makes this screen worth having. A model invents
          plausible work; the preview is where somebody notices.
        */}
        <Notice tone="info">
          Everything is ticked. Untick anything that is wrong, invented, or
          already on the board. Nothing here exists until you add it.
          {assumed > 0 && (
            <>
              {" "}
              <strong className="font-semibold">{plural(assumed, "item")}</strong>{" "}
              {assumed === 1 ? "was" : "were"} assumed from the kind of system you described rather than written in
              your brief, so check {assumed === 1 ? "it" : "those"} first.
            </>
          )}
        </Notice>

        {(generation.questions ?? []).length > 0 && (
          <BriefQuestions
            questions={generation.questions ?? []}
            title="Questions that would sharpen this draft"
            hint="Answering these in the brief and drafting the plan again gives a backlog built on your decisions, not on a typical system."
          />
        )}

        {reviseError !== null && (
          <Notice tone="error" action={<Button size="sm" variant="ghost" onClick={() => setReviseError(null)}>Dismiss</Button>}>
            {reviseError}
          </Notice>
        )}

        <PlanTree
          epics={epics}
          plan={plan}
          runs={runs}
          disabled={committing}
          onChange={(c) => void change(c)}
          onBreakdown={(i) => enqueue([i])}
        />
      </div>

      <div className="-mx-5 -mb-5 mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50/60 px-5 py-3.5">
        {missing > 0 && !running && (
          <p className="mr-auto w-full text-xs text-neutral-600 sm:w-auto">
            {`${plural(missing, "epic")} ${missing === 1 ? "has" : "have"} no tasks yet, so ${missing === 1 ? "its" : "their"} stories go in without tasks.`}
          </p>
        )}
        {running && (
          <p className="mr-auto w-full text-xs text-neutral-600 sm:w-auto">
            Adding waits until the breakdown finishes or you stop it.
          </p>
        )}

        <Button
          onClick={async () => {
            const ok = await confirm({
              title: "Discard this plan?",
              body: "None of its epics, stories or tasks are added to the project. The plan moves to the organisation's recycle bin, where an admin can restore it.",
              confirmLabel: "Discard plan",
              recoverable: true,
            });
            if (!ok) return;
            await onRun("discard", () => generateApi.discard(project.slug, generation.id));
            onCommitted();
          }}
          disabled={busy !== null || running}
        >
          Discard
        </Button>

        <Button
          variant="primary"
          icon={busy === "commit" ? Loader2 : CheckCircle2}
          onClick={async () => {
            const done = await onRun("commit", () => generateApi.commit(project.slug, generation.id));

            if (done !== null) {
              onChange(done);
              onCommitted();
            }
          }}
          disabled={busy !== null || running || counts.stories === 0}
        >
          {busy === "commit" ? "Adding…" : commitLabel}
        </Button>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The plan's size in one line. Prefers the scheduler's totals (they are what
 * commit will use); falls back to counting the tree while a plan is missing.
 */
function Summary({ epics, plan }: { epics: PlanEpic[]; plan?: BacklogPlan }) {
  const local = keptCounts(epics);
  const keptTasks = epics
    .filter(isKept)
    .flatMap((e) => e.stories.filter(isKept))
    .flatMap((s) => s.tasks.filter(isKept));
  const localPoints = epics
    .filter(isKept)
    .flatMap((e) => e.stories.filter(isKept))
    .reduce((n, s) => n + (s.points ?? 0), 0);

  const totals = plan?.totals;
  const hours = totals !== undefined ? (totals.hours > 0 ? totals.hours : null) : sumHours(keptTasks);

  const cells: { label: string; value: string }[] = [
    { label: "Epics", value: String(totals?.epics ?? local.epics) },
    { label: "Stories", value: String(totals?.stories ?? local.stories) },
    { label: "Tasks", value: String(totals?.tasks ?? local.tasks) },
    { label: "Hours", value: hours === null ? "-" : fmtHours(hours) },
    { label: "Points", value: String(totals?.points ?? localPoints) },
  ];

  return (
    <dl
      aria-label="What you would add"
      className="grid grid-cols-3 overflow-hidden rounded-2xl bg-neutral-50 ring-1 ring-neutral-200/70 sm:grid-cols-5"
    >
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          className={cx(
            "px-4 py-3",
            i > 0 && "border-l border-neutral-200/70",
            /* On a phone the fourth cell starts a new row; it has no left neighbour. */
            i === 3 && "max-sm:border-l-0 max-sm:border-t",
            i === 4 && "max-sm:border-t",
          )}
        >
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{cell.label}</dt>
          <dd className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-neutral-900">{cell.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "Sprint 1 · 25 Sep – 8 Oct: 7 stories fit (182h of 240h capacity); 9 wait in the product backlog". */
function SprintFit({ plan, targetEndsOn }: { plan: BacklogPlan; targetEndsOn: string | null }) {
  const { window: w, totals } = plan;
  const waiting = Math.max(0, totals.stories - totals.storiesInSprint);
  const pct = totals.capacityHours > 0 ? (totals.hoursInSprint / totals.capacityHours) * 100 : 0;

  return (
    <section aria-label="First sprint" className="rounded-2xl border border-mint-100 bg-mint-50/40 px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-mint-700 ring-1 ring-mint-100" aria-hidden>
          <CalendarCheck2 size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-neutral-800">
            <span className="font-semibold text-neutral-900">{`${w.sprintName} · ${shortRange(w.startsOn, w.endsOn)}`}</span>
            {`: ${plural(totals.storiesInSprint, "story", "stories")} ${totals.storiesInSprint === 1 ? "fits" : "fit"} (${fmtHours(totals.hoursInSprint)} of ${fmtHours(totals.capacityHours)} capacity)`}
            {waiting > 0 && `; ${waiting} ${waiting === 1 ? "waits" : "wait"} in the product backlog`}
          </p>
          <p className="mt-0.5 text-xs text-neutral-600">
            {w.exists
              ? `Stories that fit go into the existing ${w.sprintName}.`
              : `${w.sprintName} does not exist yet. Adding the plan creates it.`}
          </p>
          <div className="mt-2.5 max-w-md">
            <Progress value={pct} hue="mint" size="sm" label={`${w.sprintName} capacity used`} />
          </div>
          {plan.load !== undefined && <JobTitleLoad load={plan.load} targetEndsOn={targetEndsOn} />}
        </div>
      </div>
    </section>
  );
}

/** How a job-title key reads in prose: "qa" is QA, not "Qa". */
function jobTitleName(key: string): string {
  const known: Record<string, string> = { qa: "QA", devops: "DevOps", ux: "UX", ui: "UI", unspecified: "No job title" };

  return known[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Who the plan waits on.
 *
 * Total capacity alone misleads: "76h of 216h" reads as room to spare when
 * backend work is queued behind one engineer. Each job title's hours against
 * its people, and the day its queue clears, make the bottleneck — and whether
 * it lands after the project's target — something a manager can act on
 * (another backend engineer, or less scope) before the sprint starts.
 */
function JobTitleLoad({
  load,
  targetEndsOn,
}: {
  load: NonNullable<BacklogPlan["load"]>;
  targetEndsOn: string | null;
}) {
  /*
    Ranked by work per person, not by finish date. QA always finishes last —
    it tests what the build hands it — so "latest to clear" named QA as the
    bottleneck on a plan where backend had 185h for one engineer. Hours per
    person is the queue that sets everybody else's pace.
  */
  const perPerson = (l: { hours: number; people: number }) => l.hours / Math.max(1, l.people);
  const rows = Object.entries(load)
    .filter(([, l]) => l.hours > 0)
    .sort((a, b) => perPerson(b[1]) - perPerson(a[1]));

  if (rows.length < 2) return null;

  const most = Math.max(...rows.map(([, l]) => l.hours));
  const bottleneck = rows[0][0];

  return (
    <div className="mt-3.5 border-t border-mint-100 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Who the plan waits on</p>
      <ul className="mt-2 space-y-2">
        {rows.map(([key, l]) => {
          const late = targetEndsOn !== null && l.finishesOn !== null && l.finishesOn > targetEndsOn;
          const isBottleneck = key === bottleneck;

          return (
            <li key={key} className="grid grid-cols-[5.5rem_1fr] items-center gap-x-3 gap-y-1 sm:grid-cols-[6.5rem_1fr_auto]">
              <span className="truncate text-xs font-semibold text-neutral-800">{jobTitleName(key)}</span>
              <span className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-neutral-200/80" aria-hidden>
                <span
                  className={cx("block h-full rounded-full", isBottleneck ? "bg-coral-500" : "bg-mint-500")}
                  style={{ width: `${Math.max(4, (l.hours / most) * 100)}%` }}
                />
              </span>
              <span className="col-span-2 flex flex-wrap items-center gap-1.5 text-xs tabular-nums text-neutral-600 sm:col-span-1 sm:justify-end">
                {fmtHours(l.hours)} · {plural(l.people, "person", "people")}
                {l.finishesOn !== null && <> · clear by {shortRange(l.finishesOn, l.finishesOn)}</>}
                {isBottleneck && (
                  <span className="rounded-full bg-coral-50 px-2 py-0.5 text-[11px] font-semibold text-coral-700 ring-1 ring-coral-100">
                    Bottleneck
                  </span>
                )}
                {late && (
                  <span className="rounded-full bg-sun-50 px-2 py-0.5 text-[11px] font-semibold text-sun-700 ring-1 ring-sun-100">
                    after the {shortRange(targetEndsOn, targetEndsOn)} target
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tree edits                                                         */
/* ------------------------------------------------------------------ */

type Fields = Omit<PlanChange, "path">;

/** The tree with one node's fields replaced, copying only along the path. */
export function patch(epics: PlanEpic[], change: PlanChange): PlanEpic[] {
  const [e, s, t] = change.path.split(".").map(Number);
  const { path: _path, ...fields } = change;
  void _path;

  return epics.map((epic, ei) => {
    if (ei !== e) return epic;
    if (s === undefined) return { ...epic, ...pick(fields, ["keep", "title"]) };

    return {
      ...epic,
      stories: epic.stories.map((story, si) => {
        if (si !== s) return story;
        if (t === undefined) return { ...story, ...pick(fields, ["keep", "title", "points"]) };

        return {
          ...story,
          tasks: story.tasks.map((task, ti) =>
            ti === t ? { ...task, ...pick(fields, ["keep", "title", "estimateHours", "assigneeId"]) } : task,
          ),
        };
      }),
    };
  });
}

/** The node's current values for the fields a change touches: its undo. */
function snapshot(epics: PlanEpic[], change: PlanChange): PlanChange {
  const [e, s, t] = change.path.split(".").map(Number);
  const epic = epics[e];
  const node: Record<string, unknown> | undefined =
    s === undefined
      ? (epic as unknown as Record<string, unknown>)
      : t === undefined
        ? (epic?.stories[s] as unknown as Record<string, unknown>)
        : (epic?.stories[s]?.tasks[t] as unknown as Record<string, unknown>);
  const undo: PlanChange = { path: change.path };

  for (const key of Object.keys(change) as (keyof Fields)[]) {
    if (key === ("path" as keyof Fields)) continue;
    const was = node?.[key];
    (undo as unknown as Record<string, unknown>)[key] = key === "keep" ? was !== false : (was ?? null);
  }

  return undo;
}

function pick(fields: Fields, keys: (keyof Fields)[]): Fields {
  const out: Fields = {};

  for (const key of keys) {
    if (key in fields) (out as Record<string, unknown>)[key] = fields[key];
  }

  return out;
}
