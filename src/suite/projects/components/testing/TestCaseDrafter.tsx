"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button, Card, Chip, Segmented, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import {
  ApiError,
  testCases as casesApi,
  type DraftCase,
  type DraftSource,
  type Project,
  type Sprint,
  type TestCaseDraft,
  type TestSprintFocus,
} from "@/lib/api/projects-client";
import { Notice, TYPE_META, labelCls, plural } from "../ui/pkit";
import { ApiLine, CaseCategoryChip, FOCUS_META, LevelChip } from "./testingUi";

type SourceState = "waiting" | "drafting" | "done" | "failed";

/**
 * Test cases from a sprint's stories, drafted by the organisation's AI key.
 *
 * Three moves, the same as every AI screen in this module: choose what to
 * draft from, read what came back and untick what is wrong, add the rest.
 * Each story is its own call, run one after another, so a sprint of twelve
 * stories shows its cases as they arrive and a failure costs one retry, not
 * the whole sprint.
 */
export default function TestCaseDrafter({
  project,
  sprints,
  provider,
  onClose,
  onCommitted,
}: {
  project: Project;
  sprints: Sprint[];
  provider: { provider: string; model: string } | null;
  onClose: () => void;
  onCommitted: (created: number) => void;
}) {
  const confirm = useConfirm();
  const defaultSprint =
    sprints.find((s) => s.status === "active") ?? sprints.filter((s) => s.status === "closed").at(-1) ?? sprints[0];
  const [sprintId, setSprintId] = useState(defaultSprint?.id ?? "");
  const [focus, setFocus] = useState<TestSprintFocus>("full");
  const [draft, setDraft] = useState<TestCaseDraft | null>(null);
  const [states, setStates] = useState<Record<number, SourceState>>({});
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Survives re-renders; stops the queue if the screen closes mid-way. */
  const alive = useRef(true);

  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  /* An open draft from earlier is offered back rather than started again. */
  useEffect(() => {
    void casesApi
      .drafts(project.slug)
      .then(async (list) => {
        const resumable = list.find((d) => d.isOpen);
        if (resumable && alive.current) {
          const full = await casesApi.getDraft(project.slug, resumable.id);
          if (!alive.current) return;
          setDraft(full);
          setStates(
            Object.fromEntries((full.sources ?? []).map((s, i) => [i, s.generated ? "done" : s.error ? "failed" : "waiting"])),
          );
        }
      })
      .catch(() => undefined);
  }, [project.slug]);

  const runQueue = useCallback(
    async (start: TestCaseDraft, only?: number[]) => {
      const sources = start.sources ?? [];
      const indexes = only ?? sources.map((_, i) => i).filter((i) => !sources[i].generated);
      let latest = start;

      for (const index of indexes) {
        if (!alive.current) return;
        setStates((s) => ({ ...s, [index]: "drafting" }));
        try {
          latest = await casesApi.draftSource(project.slug, start.id, index);
          if (!alive.current) return;
          setDraft(latest);
          setStates((s) => ({ ...s, [index]: "done" }));
        } catch (e) {
          if (!alive.current) return;
          setStates((s) => ({ ...s, [index]: "failed" }));
          setError(e instanceof ApiError ? e.message : "One story did not draft. Retry it below.");
        }
      }
    },
    [project.slug],
  );

  const begin = async () => {
    if (busy || sprintId === "") return;
    setBusy(true);
    setError(null);
    try {
      const created = await casesApi.startDraft(project.slug, { sprintId, focus });
      setDraft(created);
      setStates(Object.fromEntries((created.sources ?? []).map((_, i) => [i, "waiting"])));
      setBusy(false);
      await runQueue(created);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The draft did not start.");
      setBusy(false);
    }
  };

  const revise = async (changes: Parameters<typeof casesApi.reviseDraft>[2]) => {
    if (!draft) return;
    try {
      setDraft(await casesApi.reviseDraft(project.slug, draft.id, changes));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That change was not saved.");
    }
  };

  const commit = async () => {
    if (!draft || busy) return;
    setBusy(true);
    setError(null);
    try {
      const done = await casesApi.commitDraft(project.slug, draft.id);
      onCommitted(done.createdCount);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The cases were not added.");
      setBusy(false);
    }
  };

  const discard = async () => {
    if (!draft) return;
    const ok = await confirm({
      title: "Discard this draft?",
      body: "None of its cases reach the library. The record that it ran is kept.",
      confirmLabel: "Discard draft",
    });
    if (!ok) return;
    alive.current = false;
    await casesApi.discardDraft(project.slug, draft.id).catch(() => undefined);
    alive.current = true;
    setDraft(null);
    setStates({});
  };

  const sources = draft?.sources ?? [];
  const running = Object.values(states).some((s) => s === "drafting" || s === "waiting") && sources.some((s) => !s.generated);
  const doneCount = sources.filter((s) => s.generated).length;

  /* ------------------------------ choose ----------------------------- */

  if (draft === null) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-grape-50 text-grape-700">
            <Sparkles size={20} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-neutral-900">Draft test cases from a sprint</h3>
            <p className="mt-1 max-w-2xl text-sm text-neutral-600">
              Every story in the sprint, with its tasks, becomes acceptance criteria and the cases that prove them: positive,
              negative and boundary, at API and user level, and the security cases that matter. Nothing reaches the library
              until you add it.
            </p>
          </div>
        </div>

        {provider === null ? (
          <Notice tone="warn" className="mt-5">
            No AI provider is set up for this organisation. A delivery lead adds one under Projects → AI.
          </Notice>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="dr-sprint" className={labelCls}>
                Sprint
              </label>
              <SearchableSelect
                id="dr-sprint"
                value={sprintId}
                onChange={setSprintId}
                options={sprints.map((s) => ({
                  value: s.id,
                  label: `${s.name}`,
                  hint: s.statusLabel,
                }))}
                noOptionsText="Plan a sprint first"
              />
            </div>
            <div>
              <span className={labelCls}>What to cover</span>
              <Segmented<TestSprintFocus>
                label="What to cover"
                value={focus}
                onChange={setFocus}
                options={[
                  { key: "full", label: "Both" },
                  { key: "functional", label: "Functional" },
                  { key: "security", label: "Security" },
                  { key: "regression", label: "Regression" },
                ]}
              />
            </div>
            <p className="text-xs text-neutral-500 md:col-span-2">
              {FOCUS_META[focus].hint} Uses {provider.model}; one call per story.
            </p>
          </div>
        )}

        {error !== null && (
          <Notice tone="error" className="mt-4">
            {error}
          </Notice>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={onClose}>Back to the library</Button>
          <Button
            variant="primary"
            icon={Sparkles}
            onClick={() => void begin()}
            disabled={busy || sprintId === "" || provider === null}
          >
            {busy ? "Starting…" : "Draft test cases"}
          </Button>
        </div>
      </Card>
    );
  }

  /* ------------------------------ review ----------------------------- */

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-grape-700">AI draft</p>
            <h3 className="mt-0.5 text-[15px] font-semibold text-neutral-900">{draft.summary}</h3>
            <p className="mt-1 text-sm text-neutral-600" aria-live="polite">
              {running
                ? `Drafting ${doneCount + 1} of ${sources.length}…`
                : `${plural(doneCount, "story", "stories")} drafted · ${plural(draft.keptCount, "case")} ticked to add`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void discard()} disabled={busy}>
              Discard draft
            </Button>
            <Button
              variant="primary"
              icon={CheckCircle2}
              onClick={() => void commit()}
              disabled={busy || running || draft.keptCount === 0}
            >
              {busy ? "Adding…" : `Add ${plural(draft.keptCount, "case")} to the library`}
            </Button>
          </div>
        </div>
        <div
          className="ws-hatch mt-4 h-2 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Stories drafted"
          aria-valuemin={0}
          aria-valuemax={sources.length}
          aria-valuenow={doneCount}
        >
          <span className="block h-full rounded-full bg-grape-500 transition-[width]" style={{ width: `${(doneCount / Math.max(1, sources.length)) * 100}%` }} />
        </div>
      </Card>

      {error !== null && <Notice tone="error">{error}</Notice>}

      <ul className="space-y-3">
        {sources.map((source, index) => (
          <SourceCard
            key={source.itemId}
            source={source}
            index={index}
            state={states[index] ?? (source.generated ? "done" : "waiting")}
            open={open === index}
            onToggle={() => setOpen(open === index ? null : index)}
            onRetry={() => {
              setError(null);
              void runQueue(draft, [index]);
            }}
            onKeepSource={(keep) => void revise([{ path: String(index), keep }])}
            onKeepCase={(caseIndex, keep) => void revise([{ path: `${index}.${caseIndex}`, keep }])}
          />
        ))}
      </ul>
    </div>
  );
}

function SourceCard({
  source,
  index,
  state,
  open,
  onToggle,
  onRetry,
  onKeepSource,
  onKeepCase,
}: {
  source: DraftSource;
  index: number;
  state: SourceState;
  open: boolean;
  onToggle: () => void;
  onRetry: () => void;
  onKeepSource: (keep: boolean) => void;
  onKeepCase: (caseIndex: number, keep: boolean) => void;
}) {
  const meta = TYPE_META[source.type];
  const kept = source.cases.filter((c) => c.keep).length;
  const levels = { api: source.cases.filter((c) => c.level === "api").length, ui: source.cases.filter((c) => c.level === "ui").length };
  const panelId = `draft-src-${index}`;

  return (
    <li className={cx("ws-card overflow-hidden", !source.keep && "opacity-60")}>
      <div className="flex items-center gap-3 p-4">
        <input
          type="checkbox"
          checked={source.keep}
          disabled={!source.generated}
          onChange={(e) => onKeepSource(e.target.checked)}
          aria-label={`Keep the cases for ${source.title}`}
          className="h-5 w-5 shrink-0 cursor-pointer rounded border-neutral-300 text-primary-600 focus:ring-primary-300"
        />
        <button
          type="button"
          onClick={onToggle}
          disabled={!source.generated}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 text-left disabled:cursor-default"
        >
          <meta.icon size={16} className="shrink-0 text-neutral-500" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-neutral-900">{source.title}</span>
            <span className="block text-xs text-neutral-500">
              {source.generated
                ? `${kept} of ${plural(source.cases.length, "case")} · ${levels.api} API · ${levels.ui} UI · ${plural(source.acceptanceCriteria.length, "criterion", "criteria")}${source.hadCriteria ? " (the story's own)" : " (drafted)"}`
                : meta.label}
            </span>
          </span>
          {source.generated && (
            <ChevronDown size={16} className={cx("shrink-0 text-neutral-400 transition-transform", open && "rotate-180")} aria-hidden />
          )}
        </button>
        <SourceStatus state={state} onRetry={onRetry} />
      </div>

      {open && source.generated && (
        <div id={panelId} className="border-t border-neutral-100 bg-neutral-50/50 px-4 py-4">
          {source.acceptanceCriteria.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Acceptance criteria</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-neutral-700">
                {source.acceptanceCriteria.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ol>
              {!source.hadCriteria && (
                <p className="mt-1.5 text-xs text-neutral-500">The story has none, so these are saved on it when you add the cases.</p>
              )}
            </div>
          )}
          <ul className="space-y-2">
            {source.cases.map((c, i) => (
              <DraftCaseRow key={`${i}-${c.title}`} draftCase={c} onKeep={(keep) => onKeepCase(i, keep)} />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function SourceStatus({ state, onRetry }: { state: SourceState; onRetry: () => void }) {
  if (state === "drafting")
    return (
      <Chip hue="grape" icon={Loader2} className="[&_svg]:animate-spin">
        Drafting
      </Chip>
    );
  if (state === "done")
    return (
      <Chip hue="mint" icon={CheckCircle2}>
        Drafted
      </Chip>
    );
  if (state === "failed")
    return (
      <Button size="sm" icon={RotateCcw} onClick={onRetry}>
        Retry
      </Button>
    );
  return (
    <Chip hue="slate" icon={CircleDashed}>
      Waiting
    </Chip>
  );
}

function DraftCaseRow({ draftCase: c, onKeep }: { draftCase: DraftCase; onKeep: (keep: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={cx("rounded-xl border border-neutral-200 bg-white", !c.keep && "opacity-60")}>
      <div className="flex items-start gap-3 p-3">
        <input
          type="checkbox"
          checked={c.keep}
          onChange={(e) => onKeep(e.target.checked)}
          aria-label={`Keep: ${c.title}`}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-neutral-300 text-primary-600 focus:ring-primary-300"
        />
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="min-w-0 flex-1 cursor-pointer text-left">
          <span className="block text-sm font-medium text-neutral-900">{c.title}</span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            <LevelChip level={c.level} />
            <CaseCategoryChip category={c.category} />
            {c.priority === 1 && <Chip hue="coral">High priority</Chip>}
          </span>
        </button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-neutral-100 px-3 py-3 pl-11 text-sm text-neutral-700">
          {c.criterion && (
            <p>
              <span className="font-semibold text-neutral-900">Proves: </span>
              {c.criterion}
            </p>
          )}
          {c.preconditions && (
            <p>
              <span className="font-semibold text-neutral-900">Before you start: </span>
              {c.preconditions}
            </p>
          )}
          {c.level === "api" && <ApiLine method={c.apiMethod} path={c.apiPath} status={c.expectedStatus} />}
          {c.steps.length > 0 && (
            <ol className="list-decimal space-y-1 pl-5">
              {c.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
          {c.testData && (
            <p className="whitespace-pre-wrap rounded-lg bg-neutral-50 px-3 py-2 font-mono text-xs">{c.testData}</p>
          )}
          <p className="flex items-start gap-2 rounded-lg bg-mint-50 px-3 py-2 text-mint-700">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span>{c.expectedResult}</span>
          </p>
        </div>
      )}
    </li>
  );
}

