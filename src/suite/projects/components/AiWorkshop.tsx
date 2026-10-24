"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  FileText,
  History,
  Layers,
  ListChecks,
  Loader2,
  ScrollText,
  Sparkles,
  Split,
  Upload,
  UserPlus,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { Button, Chip, Empty, Panel, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import {
  ApiError,
  generate as generateApi,
  workItems as itemsApi,
  type AiGeneration,
  type AiItem,
  type Project,
  type Sprint,
  type WorkItem,
} from "@/lib/api/projects-client";
import { AssumedChip, BriefQuestions, JobTitleChip, Estimate, withQuestions } from "./AiParts";
import PlanPreview from "./PlanPreview";
import DraftProgress, { type DraftRun } from "./DraftProgress";
import {
  IconTile,
  Notice,
  Skeleton,
  inputCls,
  labelCls,
} from "./ui/pkit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { richToPlain } from "@/lib/richText";

/**
 * Generating a backlog, and approving it before it lands.
 *
 * **Four steps, like the import**: ask, read, untick what is wrong, commit.
 * That pattern was earned against a spreadsheet, a file with a second table
 * pasted under the backlog would have created six work items whose assignee
 * was a paragraph, and a language model is a *less* reliable source than a
 * spreadsheet, not a more reliable one. It invents plausible work, duplicates
 * what is already on the board, and is equally confident either way.
 *
 * So everything arrives ticked and editable, and the commit button says how
 * many items it will create. **The whole value of generating a backlog is
 * saving the hour of typing; the whole cost of getting it wrong is the
 * afternoon of deleting.** The preview keeps the first and removes the second.
 *
 * Two things it does: **requirements into a delivery plan**, epics, stories
 * with acceptance criteria and points, tasks per job title with hours, dates
 * and the first sprint's fit (see `PlanPreview`), and **one existing story
 * into tasks across frontend, backend, devops and QA**, which is the thing
 * teams skip, and why the QA task is always missing from a hand-written
 * backlog. Older "stories" generations still resume in the flat preview.
 *
 * **The brief can be a document.** A PRD (.docx or PDF), a sheet of user
 * stories or a project sheet (.xlsx or .csv) is read on the server with its
 * headings, lists and table rows intact and planned from the same way a typed
 * brief is; anything typed beside it is sent as notes about it. Every task in
 * the plan is then given to somebody on the team, which is why **nothing can
 * be generated until the people who will do the work are on the project**,
 * and this screen says so before anybody picks a file.
 */
export default function AiWorkshop({
  project,
  sprints,
  onCommitted,
  onAddPeople,
}: {
  project: Project;
  sprints: Sprint[];
  onCommitted?: () => void;
  /** Opens the Team tab's add form. Absent for somebody who cannot add people. */
  onAddPeople?: () => void;
}) {
  const [history, setHistory] = useState<AiGeneration[] | null>(null);
  const [provider, setProvider] = useState<{ provider: string; model: string } | null>(null);
  const [canGenerate, setCanGenerate] = useState(false);
  /** People in delivery roles; null until known, so the gate never flashes. */
  const [team, setTeam] = useState<number | null>(null);

  const [current, setCurrent] = useState<AiGeneration | null>(null);
  /**
   * The plan drafted in this visit, whose breakdown starts by itself. One
   * picked up from the history waits for a "Continue" instead.
   */
  const [drafted, setDrafted] = useState<string | null>(null);
  const [stories, setStories] = useState<WorkItem[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  const [requirements, setRequirements] = useState("");
  const [brief, setBrief] = useState<File | null>(null);
  /**
   * What the model asked when the brief was too thin to draft from.
   *
   * Shown under the brief rather than as an error: nothing failed, and "try
   * again" would spend the same tokens on the same empty answer.
   */
  const [questions, setQuestions] = useState<string[] | null>(null);
  /**
   * The plan being drafted now, step by step, from the click to the last
   * epic's tasks (see `DraftProgress`). Null when nothing has been drafted
   * in this visit or the report was closed.
   */
  const [draftRun, setDraftRun] = useState<DraftRun | null>(null);
  const [storyId, setStoryId] = useState("");
  const [context, setContext] = useState("");

  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      generateApi.history(project.slug),
      /* Stories to break down. Only ones that exist, obviously. */
      itemsApi.list(project.slug, { type: "story", perPage: 100 }),
    ])
      .then(([past, items]) => {
        if (cancelled) return;

        setHistory(past.data);
        setProvider(past.meta.provider);
        setCanGenerate(past.meta.canGenerate);
        setTeam(past.meta.team?.delivery ?? null);
        setStories(items.data);
        setError(null);

        /* Pick up a preview somebody left open, as the importer does. */
        const open = past.data.find((g) => g.isOpen);

        if (open !== undefined && current === null) {
          generateApi
            .get(project.slug, open.id)
            .then((full) => {
              if (!cancelled) setCurrent(full);
            })
            .catch(() => undefined);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        setError(e instanceof ApiError ? e.message : "That did not load.");
        setHistory([]);
      });

    return () => {
      cancelled = true;
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [project.slug, reloads]);

  const run = async <T,>(key: string, action: () => Promise<T>): Promise<T | null> => {
    setBusy(key);
    setError(null);

    try {
      return await action();
    } catch (e) {
      const asked = e instanceof ApiError ? e.errors?.questions : undefined;

      if (asked !== undefined && asked.length > 0) {
        setQuestions(asked);

        return null;
      }

      setError(e instanceof ApiError ? e.message : "That did not go through.");

      return null;
    } finally {
      setBusy(null);
    }
  };

  /** Only ever touch the run this callback belongs to: a retry starts a new one. */
  const patchRun = (key: string, patch: Partial<DraftRun> | ((r: DraftRun) => Partial<DraftRun>)) =>
    setDraftRun((r) => (r === null || r.key !== key ? r : { ...r, ...(typeof patch === "function" ? patch(r) : patch) }));

  /**
   * Draft the plan with a progress report: the upload's own byte count, the
   * server's steps read every second while the request runs, then the
   * epic-by-epic breakdown the preview starts by itself.
   */
  const draftPlan = async () => {
    const key = crypto.randomUUID();
    const file = brief;

    setQuestions(null);
    setError(null);
    setDraftRun({
      key,
      fileName: file?.name ?? null,
      fileSize: file?.size ?? null,
      startedAt: Date.now(),
      upload: file ? 0 : null,
      server: null,
      phase: "drafting",
      error: null,
      breakdown: null,
      summary: null,
      finishedAt: null,
    });

    let settled = false;
    const poll = async () => {
      while (!settled) {
        const state = await generateApi.progress(project.slug, key).catch(() => null);
        if (settled) break;
        if (state !== null) patchRun(key, { server: state });
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
    };
    void poll();

    setBusy("plan");

    try {
      const made = await generateApi.backlog(project.slug, requirements, file, {
        progressKey: key,
        onUpload: file ? (fraction) => patchRun(key, { upload: fraction }) : undefined,
      });
      settled = true;

      const final = await generateApi.progress(project.slug, key).catch(() => null);
      patchRun(key, (r) => ({ server: final ?? r.server, upload: file ? 1 : null, phase: "breaking-down" }));

      setDrafted(made.id);
      setCurrent(made);
      setRequirements("");
      setBrief(null);
      reload();
    } catch (e) {
      settled = true;

      /*
        A dropped connection or a host's time limit is not the server failing:
        it carries on and saves the plan. Keep watching what it reports and
        open the plan it names, rather than calling a success a failure.
      */
      if (e instanceof ApiError && [0, 502, 504].includes(e.status)) {
        patchRun(key, {
          notice: "The connection timed out, but the server is still working on the plan. Waiting for it to finish, so keep this page open.",
        });

        const outcome = await waitForServer(key);

        if (outcome !== null && outcome.status === "done" && outcome.generationId) {
          const made = await generateApi.get(project.slug, outcome.generationId).catch(() => null);

          if (made !== null) {
            patchRun(key, { server: outcome, upload: file ? 1 : null, phase: "breaking-down", notice: null });
            setDrafted(made.id);
            setCurrent(made);
            setRequirements("");
            setBrief(null);
            reload();
            setBusy(null);
            return;
          }
        }

        if (outcome !== null && outcome.status !== "running") {
          patchRun(key, {
            server: outcome,
            phase: outcome.status === "attention" ? "attention" : "failed",
            error: outcome.error ?? e.message,
            notice: null,
            finishedAt: Date.now(),
          });
          setBusy(null);
          return;
        }
      }

      const final = await generateApi.progress(project.slug, key).catch(() => null);
      const asked = e instanceof ApiError ? e.errors?.questions : undefined;

      if (asked !== undefined && asked.length > 0) setQuestions(asked);

      /* The brief and the file stay put, so "Try again" and editing both work. */
      patchRun(key, (r) => ({
        server: final ?? r.server,
        phase: asked !== undefined && asked.length > 0 ? "attention" : "failed",
        error: e instanceof ApiError ? e.message : "The connection dropped before the plan came back. Try again.",
        notice: null,
        finishedAt: Date.now(),
      }));
    } finally {
      settled = true;
      setBusy(null);
    }
  };

  /**
   * After a dropped connection: read the server's progress every 3 s until it
   * stops running, for up to six minutes (past every limit in the chain).
   */
  const waitForServer = async (key: string) => {
    const until = Date.now() + 6 * 60 * 1000;
    let last = null as Awaited<ReturnType<typeof generateApi.progress>>;

    while (Date.now() < until) {
      last = await generateApi.progress(project.slug, key).catch(() => last);
      if (last !== null) patchRun(key, { server: last });
      if (last !== null && last.status !== "running") return last;
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
    }

    return last;
  };

  /** The preview's breakdown loop, reported into the same card until the last epic lands. */
  const onBreakdownProgress = useCallback(
    (p: { total: number; done: number; current: string | null; failed: number; running: boolean }) => {
      setDraftRun((r) => {
        if (r === null || r.phase !== "breaking-down") return r;

        const finished = p.total > 0 && !p.running && p.done + p.failed >= p.total;

        return { ...r, breakdown: p, ...(finished ? { phase: "ready" as const, finishedAt: Date.now() } : {}) };
      });
    },
    [],
  );

  /* The totals for the success card, from the plan as it now stands. */
  useEffect(() => {
    if (draftRun?.phase !== "ready" || draftRun.summary !== null || current === null || current.feature !== "backlog") return;

    const totals = current.plan?.totals;
    setDraftRun((r) =>
      r === null
        ? r
        : {
            ...r,
            summary: {
              epics: (current.items as unknown[]).length,
              stories: totals?.stories ?? current.itemCount,
              tasks: totals?.tasks ?? 0,
              hours: Math.round(totals?.hours ?? 0),
              people: current.plan?.team?.length ?? 0,
            },
          },
    );
  }, [draftRun?.phase, draftRun?.summary, current]);

  if (!canGenerate && history !== null && history.length === 0) {
    return (
      <Panel title="Generate" icon={Wand2} hue="grape" bodyClassName="p-0">
        <Empty
          icon={Sparkles}
          hue="slate"
          title="You cannot generate work on this project"
          hint="Generating adds work to everybody's board and spends your organisation's provider budget, so only the project manager and the engineering lead can do it."
        />
      </Panel>
    );
  }

  if (history === null) {
    return (
      <div className="grid gap-4 lg:grid-cols-2" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error !== null && <Notice tone="error">{error}</Notice>}

      {/*
        No provider means every button here leads to a message telling somebody
        to go to a different screen. Say so once, with the link, instead.
      */}
      {canGenerate && provider === null && (
        <Notice tone="warn">
          No AI provider is set up, so nothing can be generated.{" "}
          <Link href="/suite/projects/ai" className="font-semibold underline underline-offset-2">
            Add your own key
          </Link>
          . Generation runs on your account.
        </Notice>
      )}

      {/* ------------------------- nobody to staff ---------------------- */}

      {/*
        Every task in a plan is given to somebody on the team, so a plan drafted
        before the team exists is a plan of unassigned work. Said before anyone
        picks a file, not after the upload fails.
      */}
      {canGenerate && provider !== null && team === 0 && (current === null || !current.isOpen) && (
        <Panel title="Generate with AI" icon={Wand2} hue="grape" bodyClassName="p-0">
          <Empty
            icon={Users}
            hue="sun"
            title="Add the team before generating"
            hint="Generated tasks are assigned to the people on this project: backend, frontend, QA and the rest. Add them first, then upload a PRD or a sheet, or write the brief."
            action={
              onAddPeople ? (
                <Button variant="primary" icon={UserPlus} onClick={onAddPeople}>
                  Add people
                </Button>
              ) : (
                <p className="text-sm text-neutral-500">Ask the project manager to add them.</p>
              )
            }
          />
        </Panel>
      )}

      {draftRun !== null && (
        <DraftProgress
          run={draftRun}
          onRetry={draftRun.phase === "failed" ? () => void draftPlan() : undefined}
          onDismiss={() => setDraftRun(null)}
        />
      )}

      {/* ---------------------------- asking ---------------------------- */}

      {/*
        A drafting aid, drawn as one: two plain panels and plain buttons. The
        only primary action on this tab is the one that puts reviewed work on
        the board, because that is the decision; asking a model for a draft is
        not.
      */}
      {canGenerate && provider !== null && team !== 0 && (current === null || !current.isOpen) && (
        <div className={cx("grid gap-4", stories.length > 0 && "lg:grid-cols-2")}>
          <Panel
            title="Requirements into a delivery plan"
            subtitle="Upload a PRD or a sheet of stories, or write the brief. Epics, stories with acceptance criteria and points, tasks with hours and dates, each assigned to someone on the team. Nothing is created until you have read it."
            icon={ScrollText}
            hue="sky"
          >
            <BriefFile file={brief} disabled={busy !== null} onChange={setBrief} onError={setError} />

            <label htmlFor="ai-brief" className={cx(labelCls, "mt-4")}>
              {brief === null ? "Or write the requirements" : "Notes about the document (optional)"}
            </label>
            <RichTextEditor
              id="ai-brief"
              variant={brief === null ? "full" : "compact"}
              minHeight={questions === null ? (brief === null ? 180 : 80) : 320}
              value={requirements}
              onChange={setRequirements}
              placeholder={
                brief === null
                  ? "We need a data catalogue where users upload datasets, admins define metadata templates per dataset type, and everything is searchable…"
                  : "Phase one only; payroll is out of scope. Our stack is Laravel and Next."
              }
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                icon={busy === "plan" ? Loader2 : Wand2}
                onClick={() => void draftPlan()}
                disabled={busy !== null || (brief === null && richToPlain(requirements).length < 40)}
              >
                {busy === "plan"
                  ? brief === null
                    ? "Drafting the plan…"
                    : "Reading the document and drafting…"
                  : brief === null
                    ? "Draft the plan"
                    : "Draft the plan from the document"}
              </Button>

              <span className="text-xs text-neutral-500">
                {/* Said here so nobody wonders whose bill this is. */}
                Runs on your own {provider.provider} account · {provider.model}
              </span>
            </div>

            {questions !== null && (
              <BriefQuestions
                questions={questions}
                title="It needs a little more to go on"
                hint="The brief doesn't say enough to draft a plan without guessing. Answer these in the brief, then draft the plan again."
                onAdd={() => {
                  setRequirements((text) => withQuestions(text, questions));
                  setQuestions(null);
                  document.getElementById("ai-brief")?.focus();
                }}
                className="mt-4"
              />
            )}
          </Panel>

          {stories.length > 0 && (
            <Panel
              title="A story into tasks"
              subtitle="Across frontend, backend, devops and QA. The QA task is the one always missing."
              icon={Split}
              hue="grape"
            >
              <div className="space-y-4">
                <div>
                  <label htmlFor="ai-story" className={labelCls}>
                    Story
                  </label>
                  <SearchableSelect
                    id="ai-story"
                    value={storyId}
                    onChange={setStoryId}
                    placeholder="Choose a story"
                    searchPlaceholder="Search stories"
                    options={stories.map((story) => ({ value: story.id, label: story.title }))}
                  />
                </div>

                <div>
                  <label htmlFor="ai-context" className={labelCls}>
                    Anything else it should know
                  </label>
                  <input
                    id="ai-context"
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="We are on Laravel and Next; storage is S3"
                    className={inputCls}
                  />
                </div>
              </div>

              <Button
                className="mt-4"
                icon={busy === "tasks" ? Loader2 : Wand2}
                onClick={async () => {
                  const made = await run("tasks", () =>
                    generateApi.tasks(project.slug, storyId, {
                      context: context.trim() === "" ? undefined : context.trim(),
                    }),
                  );

                  if (made !== null) {
                    setCurrent(made);
                    setContext("");
                    reload();
                  }
                }}
                disabled={busy !== null || storyId === ""}
              >
                {busy === "tasks" ? "Breaking it down…" : "Break it down"}
              </Button>
            </Panel>
          )}
        </div>
      )}

      {/* --------------------------- the preview ------------------------ */}

      {current !== null && current.status === "committed" && (
        <Panel title="Added to the board" icon={CheckCircle2} hue="mint">
          <p className="text-sm text-neutral-700">
            {current.feature === "backlog"
              ? `${current.createdCount} work items created: epics, stories and their tasks, with dates and the first sprint filled.`
              : `${current.createdCount} ${current.feature === "tasks" ? "tasks" : "stories"} created.`}
          </p>
          <Button size="sm" className="mt-4" onClick={() => setCurrent(null)}>
            Generate something else
          </Button>
        </Panel>
      )}

      {current !== null && current.isOpen && current.feature === "backlog" && (
        <PlanPreview
          /* A different plan is a different loop: nothing carries over. */
          key={current.id}
          project={project}
          generation={current}
          autoStart={current.id === drafted}
          busy={busy}
          onChange={setCurrent}
          onRun={run}
          onBreakdownProgress={current.id === drafted ? onBreakdownProgress : undefined}
          onCommitted={() => {
            reload();
            onCommitted?.();
          }}
        />
      )}

      {current !== null && current.isOpen && current.feature !== "backlog" && (
        <Preview
          project={project}
          generation={current}
          sprints={sprints}
          busy={busy}
          onChange={setCurrent}
          onRun={run}
          onCommitted={() => {
            reload();
            onCommitted?.();
          }}
        />
      )}

      {/* --------------------------- the history ------------------------ */}

      {history.length > 0 && (
        <section aria-labelledby="ai-history-title">
          <div className="mb-3 flex items-center gap-3">
            <IconTile icon={History} hue="sun" size={36} />
            <h3 id="ai-history-title" className="text-[15px] font-semibold text-neutral-900">
              Past generations
            </h3>
          </div>

          <DataView
            rows={history}
            columns={historyColumns({
              currentId: current?.id ?? null,
              onResume: (id) =>
                void generateApi
                  .get(project.slug, id)
                  .then(setCurrent)
                  .catch(() => setError("That preview did not load.")),
            })}
            rowKey={(g) => g.id}
            storageKey="projects.generate.history"
            caption="Earlier generations on this project"
            searchable={false}
          />
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** What the server reads. The extension is only a first check; the server decides by contents. */
const BRIEF_ACCEPT = ".docx,.pdf,.xlsx,.csv,.txt,.md";
const BRIEF_MAX_BYTES = 20 * 1024 * 1024;

/**
 * A PRD, a story sheet or a project sheet, chosen or dropped.
 *
 * The obvious mistakes are caught here so nobody waits on an upload to hear
 * them: the old binary Office formats, which nothing reads, and a file over
 * the server's limit.
 */
function BriefFile({
  file,
  disabled,
  onChange,
  onError,
}: {
  file: File | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
  onError: (message: string | null) => void;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const take = (picked: File | undefined) => {
    if (picked === undefined) return;

    if (/\.(doc|xls)$/i.test(picked.name)) {
      onError(`"${picked.name}" is an old Office format. Open it and save it as .docx or .xlsx, then upload it again.`);
      return;
    }

    if (picked.size > BRIEF_MAX_BYTES) {
      onError(`"${picked.name}" is larger than 20 MB. Upload the requirements document without its attachments.`);
      return;
    }

    onError(null);
    onChange(picked);
  };

  if (file !== null) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50/60 px-4 py-3">
        <IconTile icon={FileText} hue="sky" size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">{file.name}</p>
          <p className="text-xs text-neutral-500">
            {fileSize(file.size)} · read in full, headings, lists and tables included
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            if (input.current) input.current.value = "";
          }}
          disabled={disabled}
          aria-label={`Remove ${file.name}`}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition hover:bg-white hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) take(e.dataTransfer.files?.[0]);
      }}
      className={cx(
        "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-5 text-center transition",
        over
          ? "border-primary-400 bg-primary-50/60"
          : "border-neutral-200 bg-white hover:border-primary-300 hover:bg-primary-50/40",
        "focus-within:border-primary-400 focus-within:ring-4 focus-within:ring-primary-100",
        disabled && "pointer-events-none opacity-70",
      )}
    >
      <Upload size={20} className="text-primary-600" aria-hidden />
      <span className="text-sm font-semibold text-neutral-800">Upload a PRD or a sheet of user stories</span>
      <span className="text-xs text-neutral-500">
        Word (.docx), PDF, Excel (.xlsx) or CSV. Drop it here or choose a file
      </span>
      <input
        ref={input}
        type="file"
        accept={BRIEF_ACCEPT}
        aria-label="PRD or sheet to plan from"
        disabled={disabled}
        onChange={(e) => take(e.target.files?.[0])}
        className="sr-only"
      />
    </label>
  );
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */

const FEATURE = {
  stories: { label: "User stories", icon: ScrollText, hue: "sky" },
  tasks: { label: "Tasks", icon: Split, hue: "grape" },
  backlog: { label: "Delivery plan", icon: Layers, hue: "grape" },
} as const;

function historyColumns({
  currentId,
  onResume,
}: {
  currentId: string | null;
  onResume: (id: string) => void;
}): Column<AiGeneration>[] {
  return [
    {
      key: "what",
      header: "Generated",
      primary: true,
      value: (g) => FEATURE[g.feature].label,
      render: (g) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <IconTile icon={FEATURE[g.feature].icon} hue={FEATURE[g.feature].hue} size={30} />
          <span className="min-w-0">
            <span className="block font-medium text-neutral-900">
              {FEATURE[g.feature].label}
            </span>
            {g.parentItem !== null && (
              <span className="block truncate text-xs text-neutral-500">{g.parentItem}</span>
            )}
          </span>
        </span>
      ),
    },
    {
      key: "tokens",
      header: "Tokens",
      align: "right",
      value: (g) => g.totalTokens,
      sortable: true,
      render: (g) => (
        <span className="text-[13px] tabular-nums text-neutral-600">{`${g.totalTokens.toLocaleString()} tokens`}</span>
      ),
    },
    {
      key: "result",
      header: "Result",
      value: (g) => (g.status === "committed" ? `${g.createdCount} created` : g.statusLabel),
      render: (g) =>
        g.status === "committed" ? (
          <Chip hue="mint" icon={CheckCircle2}>{`${g.createdCount} created`}</Chip>
        ) : (
          <Chip hue={g.isOpen ? "sun" : "slate"} icon={g.isOpen ? Clock3 : undefined}>
            {g.statusLabel}
          </Chip>
        ),
    },
    {
      key: "action",
      header: "",
      align: "right",
      render: (g) =>
        g.isOpen && g.id !== currentId ? (
          <Button size="sm" onClick={() => onResume(g.id)}>
            Resume
          </Button>
        ) : null,
    },
  ];
}

type Revise = (
  index: number,
  change: { keep?: boolean; title?: string; estimateHours?: number | null },
) => Promise<void>;

interface Suggested {
  item: AiItem;
  index: number;
}

function Preview({
  project,
  generation,
  sprints,
  busy,
  onChange,
  onRun,
  onCommitted,
}: {
  project: Project;
  generation: AiGeneration;
  sprints: Sprint[];
  busy: string | null;
  onChange: (generation: AiGeneration) => void;
  onRun: <T>(key: string, action: () => Promise<T>) => Promise<T | null>;
  onCommitted: () => void;
}) {
  const confirm = useConfirm();
  /* The flat features only; a backlog plan has its own preview. */
  const items = (generation.items ?? []) as AiItem[];
  const kept = items.filter((item) => item.keep !== false).length;
  const assumed = items.filter((item) => item.assumed === true).length;
  const showEstimate = generation.feature === "tasks";
  const open = sprints.filter((s) => s.acceptsChanges);

  const revise: Revise = async (index, change) => {
    const updated = await onRun(`revise-${index}`, () =>
      generateApi.revise(project.slug, generation.id, { items: [{ index, ...change }] }),
    );

    if (updated !== null) onChange(updated);
  };

  const rows: Suggested[] = items.map((item, index) => ({ item, index }));

  const columns: Column<Suggested>[] = [
    {
      key: "keep",
      header: "Keep",
      tableOnly: true,
      render: ({ item, index }) => (
        <KeepBox item={item} index={index} busy={busy !== null} onRevise={revise} />
      ),
    },
    {
      key: "title",
      header: generation.feature === "tasks" ? "Task" : "Story",
      primary: true,
      value: ({ item }) => item.title,
      render: ({ item }) => <ItemText item={item} />,
    },
    {
      key: "discipline",
      header: "Job title",
      value: ({ item }) => item.discipline ?? null,
      render: ({ item }) => <JobTitleChip item={item} />,
    },
    ...(showEstimate
      ? [
          {
            key: "estimate",
            header: "Estimate",
            align: "right" as const,
            value: ({ item }: Suggested) => item.estimateHours ?? null,
            render: ({ item }: Suggested) => <Estimate hours={item.estimateHours} />,
          },
        ]
      : []),
  ];

  return (
    <Panel
      title={generation.feature === "tasks" ? "Suggested tasks" : "Suggested stories"}
      subtitle={
        generation.parentItem !== null
          ? `Breaking down "${generation.parentItem}" · ${generation.model}`
          : `${generation.model} · ${generation.totalTokens.toLocaleString()} tokens`
      }
      icon={ListChecks}
      hue="grape"
    >
      {/*
        The sentence that makes this screen worth having. A model invents
        plausible work; the preview is where somebody notices.
      */}
      <Notice tone="info" className="mb-4">
        Everything is ticked. Untick anything that is wrong, invented, or
        already on the board. Nothing here exists until you add it.
        {assumed > 0 && (
          <>
            {" "}
            <strong className="font-semibold">
              {assumed === items.length ? "All" : `${assumed} of ${items.length}`}
            </strong>{" "}
            {assumed === 1 ? "was" : "were"} assumed from the kind of system you described rather than written in
            your brief, so check {assumed === 1 ? "it" : "those"} first.
          </>
        )}
      </Notice>

      {(generation.questions ?? []).length > 0 && (
        <BriefQuestions
          questions={generation.questions ?? []}
          title="Questions that would sharpen this draft"
          hint="Answering these in the brief and writing the stories again gives a backlog built on your decisions, not on a typical system."
          className="mb-4"
        />
      )}

      <DataView
        rows={rows}
        columns={columns}
        rowKey={({ item, index }) => `${index}-${item.title}`}
        storageKey="projects.generate.preview"
        caption="Suggested work items"
        searchable={false}
        views={["table", "list", "grid"]}
        renderCard={({ item, index }) => (
          <div className={cx("flex h-full flex-col gap-3 p-5", item.keep === false && "opacity-60")}>
            <div className="flex items-start gap-3">
              <KeepBox item={item} index={index} busy={busy !== null} onRevise={revise} />
              <ItemText item={item} />
            </div>
            <div className="mt-auto flex items-center justify-between gap-2">
              <JobTitleChip item={item} />
              {showEstimate && <Estimate hours={item.estimateHours} />}
            </div>
          </div>
        )}
        renderListItem={({ item, index }) => (
          <div className={cx("flex flex-wrap items-start gap-3 px-5 py-3.5", item.keep === false && "opacity-60")}>
            <KeepBox item={item} index={index} busy={busy !== null} onRevise={revise} />
            <div className="min-w-0 flex-1">
              <ItemText item={item} />
            </div>
            <JobTitleChip item={item} />
            {showEstimate && <Estimate hours={item.estimateHours} />}
          </div>
        )}
      />

      <div className="-mx-5 -mb-5 mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50/60 px-5 py-3.5">
        {open.length > 0 && generation.feature === "tasks" && (
          <SearchableSelect
            value={generation.sprintId ?? ""}
            onChange={async (value) => {
              const updated = await onRun("sprint", () =>
                generateApi.revise(project.slug, generation.id, {
                  items: [],
                  sprintId: value === "" ? null : value,
                }),
              );

              if (updated !== null) onChange(updated);
            }}
            aria-label="Where the tasks go"
            size="sm"
            className="mr-auto w-48"
            options={[
              { value: "", label: "Product backlog" },
              ...open.map((s) => ({ value: s.id, label: `Sprint ${s.sequence}` })),
            ]}
          />
        )}

        <Button
          onClick={async () => {
            const ok = await confirm({
              title: "Discard this draft?",
              /* Marked discarded and kept (AiGenerationController::discard); it is not deleted, so not binned either. */
              body: "Nothing it drafted is added to the project. The draft is kept as a discarded record.",
              confirmLabel: "Discard draft",
            });
            if (!ok) return;
            await onRun("discard", () => generateApi.discard(project.slug, generation.id));
            onCommitted();
          }}
          disabled={busy !== null}
        >
          Discard
        </Button>

        <Button
          variant="primary"
          icon={busy === "commit" ? Loader2 : CheckCircle2}
          onClick={async () => {
            const done = await onRun("commit", () =>
              generateApi.commit(project.slug, generation.id),
            );

            if (done !== null) {
              onChange(done);
              onCommitted();
            }
          }}
          disabled={busy !== null || kept === 0}
        >
          {busy === "commit" ? "Adding…" : `Add ${kept} to the board`}
        </Button>
      </div>
    </Panel>
  );
}

function KeepBox({
  item,
  index,
  busy,
  onRevise,
}: {
  item: AiItem;
  index: number;
  busy: boolean;
  onRevise: Revise;
}) {
  return (
    <input
      type="checkbox"
      checked={item.keep !== false}
      disabled={busy}
      onChange={(e) => void onRevise(index, { keep: e.target.checked })}
      aria-label={`Keep "${item.title}"`}
      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-neutral-300 accent-primary-600"
    />
  );
}

function ItemText({ item }: { item: AiItem }) {
  const kept = item.keep !== false;

  return (
    <div className={cx("min-w-0 max-w-[36rem]", !kept && "opacity-50")}>
      <p className={cx("text-sm font-medium", kept ? "text-neutral-900" : "text-neutral-600 line-through")}>
        {item.title}
        {item.assumed === true && <AssumedChip className="ml-2" />}
      </p>

      {item.description !== null && item.description !== undefined && (
        <p className="mt-0.5 text-xs leading-snug text-neutral-500">{item.description}</p>
      )}

      {item.expectedOutcome !== null && item.expectedOutcome !== undefined && (
        <p className="mt-0.5 text-[11px] italic leading-snug text-neutral-500">
          {item.expectedOutcome}
        </p>
      )}
    </div>
  );
}
