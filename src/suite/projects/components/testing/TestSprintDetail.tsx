"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bug,
  CheckCircle2,
  ChevronDown,
  FileText,
  Gauge,
  ListPlus,
  Lock,
  Pencil,
  Play,
  ShieldAlert,
  Target,
  Trash2,
} from "lucide-react";
import { Button, Card, Chip, PersonAvatar, Segmented, StatCard, StatGrid, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import {
  ApiError,
  testCases as casesApi,
  testRuns as runsApi,
  testSprints as testSprintsApi,
  workItems as itemsApi,
  type BoardSetup,
  type Project,
  type Sprint,
  type TestCase,
  type TestRun,
  type TestRunStatus,
  type TestSprint,
  type TestSprintReport,
  type WorkItem,
} from "@/lib/api/projects-client";
import { Modal, Notice, TabSkeleton, fmtDateTime, fmtRange, labelCls, plural } from "../ui/pkit";
import { useAuth } from "@/lib/auth-store";
import FindingDialog from "./FindingDialog";
import TestSprintDialog from "./TestSprintDialog";
import {
  ApiLine,
  CaseCategoryChip,
  LevelChip,
  RUN_META,
  RunChip,
  RunStrip,
  SEVERITY_ORDER,
  SeverityChip,
  SeverityTiles,
} from "./testingUi";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";
import { isRichBlank } from "@/lib/richText";

type Filter = "all" | TestRunStatus;

/**
 * One test sprint: its plan, its results and its report.
 *
 * The run list is where a tester spends the sprint. Each case opens in
 * place with its steps beside the result, and the outcome is one press -
 * passed, failed, blocked, skipped - because a tester running forty cases
 * should not open a form forty times. A failure becomes a finding from the
 * same row.
 */
export default function TestSprintDetail({
  project,
  sprints,
  setup,
  testSprintId,
  onBack,
  onOpenItem,
  onChanged,
}: {
  project: Project;
  sprints: Sprint[];
  setup: BoardSetup | null;
  testSprintId: string;
  onBack: () => void;
  onOpenItem: (item: WorkItem) => void;
  onChanged: () => void;
}) {
  const confirm = useConfirm();
  const [sprint, setSprint] = useState<TestSprint | null>(null);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [report, setReport] = useState<TestSprintReport | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [closing, setClosing] = useState(false);
  const [raising, setRaising] = useState<TestRun | "standalone" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = project.can.manageTesting === true;
  /* Somebody asked to run a case records its result without a tester's authority. */
  const viewerId = useAuth().user?.id;

  const load = useCallback(async () => {
    try {
      const res = await testSprintsApi.get(testSprintId);
      setSprint(res.data);
      setRuns(res.meta.runs);
      setReport(res.meta.report);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The test sprint did not load.");
    }
  }, [testSprintId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  const shown = useMemo(() => (filter === "all" ? runs : runs.filter((r) => r.status === filter)), [runs, filter]);

  if (sprint === null || report === null) {
    return error ? <Notice tone="error">{error}</Notice> : <TabSkeleton stats={4} />;
  }

  const planning = sprint.status === "planning";
  const active = sprint.status === "active";
  const closed = sprint.status === "closed";
  const openFindings = report.findingsNow?.open ?? report.findings.open;
  const severityNow = report.findingsNow ?? report.findings;

  const record = (run: TestRun, input: Record<string, unknown>) =>
    act(async () => {
      const updated = await runsApi.update(run.id, input);
      setRuns((all) => all.map((r) => (r.id === updated.id ? updated : r)));
    });

  return (
    <div className="space-y-6">
      {/* --------------------------- header --------------------------- */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 lg:flex-1">
            <button
              type="button"
              onClick={onBack}
              className="mb-2 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg text-[13px] font-semibold text-neutral-500 hover:text-neutral-900"
            >
              <ArrowLeft size={15} aria-hidden /> All test sprints
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight text-neutral-900">{sprint.name}</h3>
              <Chip hue={active ? "mint" : closed ? "slate" : "sky"} dot icon={closed ? Lock : undefined}>
                {sprint.statusLabel}
              </Chip>
              <Chip hue={sprint.focus === "security" ? "rose" : "grape"} icon={sprint.focus === "security" ? ShieldAlert : undefined}>
                {sprint.focusLabel}
              </Chip>
            </div>
            {sprint.goal && <RichTextView value={sprint.goal} size="sm" className="mt-1.5 max-w-2xl text-neutral-600" />}
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-neutral-600">
              <div className="flex gap-1.5">
                <dt className="text-neutral-500">Dates</dt>
                <dd className="font-medium text-neutral-800">{fmtRange(sprint.startsOn, sprint.endsOn)}</dd>
              </div>
              {sprint.targetSprint && (
                <div className="flex gap-1.5">
                  <dt className="text-neutral-500">Testing</dt>
                  <dd className="font-medium text-neutral-800">{sprint.targetSprint.name}</dd>
                </div>
              )}
              {sprint.environment && (
                <div className="flex gap-1.5">
                  <dt className="text-neutral-500">Environment</dt>
                  <dd className="font-medium text-neutral-800">{sprint.environment}</dd>
                </div>
              )}
              {sprint.lead && (
                <div className="flex items-center gap-1.5">
                  <dt className="text-neutral-500">Led by</dt>
                  <dd className="flex items-center gap-1.5 font-medium text-neutral-800">
                    <PersonAvatar name={sprint.lead.name} size={20} />
                    {sprint.lead.name}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {canManage && !closed && (
            <div className="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">
              <Button size="sm" icon={Pencil} onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button size="sm" icon={ListPlus} onClick={() => setAdding(true)}>
                Add cases
              </Button>
              {active && (
                <Button size="sm" icon={Bug} onClick={() => setRaising("standalone")}>
                  Report a finding
                </Button>
              )}
              {planning && (
                <Button
                  size="sm"
                  variant="primary"
                  icon={Play}
                  disabled={busy || runs.length === 0}
                  onClick={() => void act(() => testSprintsApi.start(sprint.id))}
                >
                  Start test sprint
                </Button>
              )}
              {active && (
                <Button size="sm" variant="primary" icon={Lock} disabled={busy} onClick={() => setClosing(true)}>
                  Close with a report
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {error !== null && <Notice tone="error">{error}</Notice>}
      {planning && runs.length === 0 && canManage && (
        <Notice tone="info">Add the cases to run, then start the test sprint. Results can be recorded once it is running.</Notice>
      )}
      {planning && runs.length > 0 && (
        <Notice tone="info">Planned. Start it to record results.</Notice>
      )}

      {/* --------------------------- report --------------------------- */}
      <StatGrid cols={4}>
        <StatCard
          featured
          label="Pass rate"
          value={report.passRate === null ? "—" : report.passRate}
          unit={report.passRate === null ? undefined : "%"}
          icon={Gauge}
          hint={report.passRate === null ? "Nothing judged yet" : `of ${plural(report.runs.executed, "case")} judged`}
        />
        <StatCard
          label="Executed"
          value={`${report.runs.executed}/${report.runs.total}`}
          icon={CheckCircle2}
          hue="mint"
          hint={report.executionRate === null ? "No cases planned" : `${report.executionRate}% of the plan`}
        />
        <StatCard
          label={closed ? "Findings still open" : "Open findings"}
          value={openFindings}
          icon={Bug}
          hue="rose"
          hint={`${plural(report.findings.total, "finding")} raised`}
        />
        <StatCard
          label="Story coverage"
          value={report.coverage && report.coverage.items > 0 ? `${report.coverage.covered}/${report.coverage.items}` : "—"}
          icon={Target}
          hue="sky"
          hint={
            report.coverage === null
              ? "Tests no particular sprint"
              : report.coverage.items === 0
                ? "That sprint has no stories"
                : "stories with a case here"
          }
        />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[15px] font-semibold text-neutral-900">The plan, as it stands</p>
            {report.frozen && (
              <Chip hue="slate" icon={Lock}>
                Frozen at close
              </Chip>
            )}
          </div>
          <RunStrip counts={report.runs} total={report.runs.total} />
          {report.coverage && report.coverage.uncovered.length > 0 && (
            <div className="mt-4 rounded-xl bg-sun-50 px-4 py-3 text-sm text-sun-700">
              <p className="font-semibold">
                {plural(report.coverage.uncovered.length, "story has", "stories have")} no case in this sprint
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {report.coverage.uncovered.slice(0, 6).map((u) => (
                  <li key={u.id}>{u.title}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        <Card className="p-5">
          <p className="text-[15px] font-semibold text-neutral-900">Findings by severity</p>
          <p className="mb-3 text-xs text-neutral-500">{closed ? "Still open today" : "Open now"}</p>
          <SeverityTiles counts={Object.fromEntries(SEVERITY_ORDER.map((s) => [s, severityNow.bySeverity[s]?.open ?? 0]))} />
        </Card>
      </div>

      {(closed || sprint.summary || sprint.recommendations) && (
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-neutral-500" aria-hidden />
            <p className="text-[15px] font-semibold text-neutral-900">Test report</p>
          </div>
          <div className="mt-3 grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Summary</p>
              {sprint.summary ? <RichTextView value={sprint.summary} size="sm" className="mt-1" /> : <p className="mt-1 text-sm text-neutral-500">Not written.</p>}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Recommendations</p>
              {sprint.recommendations ? <RichTextView value={sprint.recommendations} size="sm" className="mt-1" /> : <p className="mt-1 text-sm text-neutral-500">Not written.</p>}
            </div>
          </div>
        </Card>
      )}

      {/* ---------------------------- runs ---------------------------- */}
      <div>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="text-[15px] font-semibold text-neutral-900">
            Cases <span className="font-normal text-neutral-500">· {runs.length}</span>
          </h4>
          <Segmented<Filter>
            label="Show cases"
            value={filter}
            onChange={setFilter}
            options={[
              { key: "all", label: "All" },
              { key: "not_run", label: `Not run ${report.runs.not_run}` },
              { key: "failed", label: `Failed ${report.runs.failed}` },
              { key: "blocked", label: `Blocked ${report.runs.blocked}` },
              { key: "passed", label: `Passed ${report.runs.passed}` },
            ]}
          />
        </div>

        {shown.length === 0 ? (
          <Card>
            <p className="px-6 py-10 text-center text-sm text-neutral-500">
              {runs.length === 0 ? "No cases planned yet." : "No cases with that outcome."}
            </p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {shown.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                open={open === run.id}
                onToggle={() => setOpen(open === run.id ? null : run.id)}
                canRecord={active && (canManage || (viewerId !== undefined && run.assignee?.id === viewerId))}
                canManage={canManage && !closed}
                assignees={setup?.assignees ?? []}
                busy={busy}
                onRecord={(input) => void record(run, input)}
                onRaise={() => setRaising(run)}
                onOpenFinding={(id) =>
                  void itemsApi
                    .get(id)
                    .then(onOpenItem)
                    .catch(() => setError("Could not open that finding."))
                }
                onRemove={async () => {
                  const ok = await confirm({
                    title: `Take ${run.testCase?.reference ?? "this case"} out of the plan?`,
                    body: "It stays in the library. Only a case nobody has run yet can be taken out.",
                    confirmLabel: "Take out",
                  });
                  if (ok) void act(() => runsApi.remove(run.id));
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <TestSprintDialog
          project={project}
          sprints={sprints}
          setup={setup}
          testSprint={sprint}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      )}

      {adding && (
        <AddCasesDialog
          project={project}
          sprint={sprint}
          inSprint={new Set(runs.map((r) => r.testCaseId))}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            void load();
          }}
        />
      )}

      {closing && (
        <CloseDialog
          sprint={sprint}
          report={report}
          onClose={() => setClosing(false)}
          onClosed={() => {
            setClosing(false);
            void load();
            onChanged();
          }}
        />
      )}

      {raising !== null && (
        <FindingDialog
          project={project}
          run={raising === "standalone" ? null : raising}
          testSprint={sprint}
          onClose={() => setRaising(null)}
          onRaised={() => {
            setRaising(null);
            void load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const OUTCOMES: Exclude<TestRunStatus, "not_run">[] = ["passed", "failed", "blocked", "skipped"];

function RunRow({
  run,
  open,
  onToggle,
  canRecord,
  canManage,
  assignees,
  busy,
  onRecord,
  onRaise,
  onOpenFinding,
  onRemove,
}: {
  run: TestRun;
  open: boolean;
  onToggle: () => void;
  canRecord: boolean;
  canManage: boolean;
  assignees: { id: string; name: string }[];
  busy: boolean;
  onRecord: (input: Record<string, unknown>) => void;
  onRaise: () => void;
  onOpenFinding: (id: string) => void;
  onRemove: () => void;
}) {
  const c = run.testCase;
  const [actual, setActual] = useState(run.actualResult ?? "");
  const [notes, setNotes] = useState(run.notes ?? "");
  const dirty = actual !== (run.actualResult ?? "") || notes !== (run.notes ?? "");
  const panelId = `run-${run.id}`;
  const meta = RUN_META[run.status];

  return (
    <li className="ws-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50/70"
      >
        <span className={cx("h-8 w-1 shrink-0 rounded-full", run.status === "not_run" ? "ws-hatch" : meta.bar)} aria-hidden />
        <span className="w-14 shrink-0 font-mono text-xs font-semibold text-neutral-500">{c?.reference}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-neutral-900">{c?.title ?? "A deleted case"}</span>
          <span className="block truncate text-xs text-neutral-500">{c?.workItem?.title ?? "No particular story"}</span>
        </span>
        <span className="hidden items-center gap-1.5 md:flex">
          {c && <LevelChip level={c.level} />}
          {c && <CaseCategoryChip category={c.category} />}
        </span>
        {run.finding && <SeverityChip severity={run.finding.severity} />}
        <RunChip status={run.status} />
        <ChevronDown size={16} className={cx("shrink-0 text-neutral-400 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && c && (
        <div id={panelId} className="grid gap-6 border-t border-neutral-100 bg-neutral-50/40 px-4 py-5 lg:grid-cols-2">
          {/* The case */}
          <div className="space-y-3 text-sm text-neutral-700">
            {c.acceptanceCriterion && (
              <p>
                <span className="font-semibold text-neutral-900">Proves: </span>
                {c.acceptanceCriterion}
              </p>
            )}
            {c.preconditions && (
              <div>
                <span className="font-semibold text-neutral-900">Before you start</span>
                <RichTextView value={c.preconditions} size="sm" className="mt-0.5" />
              </div>
            )}
            {c.level === "api" && <ApiLine method={c.apiMethod} path={c.apiPath} status={c.expectedStatus} />}
            {c.steps.length > 0 && (
              <ol className="list-decimal space-y-1 pl-5">
                {c.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            )}
            {c.testData && <p className="whitespace-pre-wrap rounded-lg bg-white px-3 py-2 font-mono text-xs ring-1 ring-neutral-200">{c.testData}</p>}
            <p className="flex items-start gap-2 rounded-lg bg-mint-50 px-3 py-2 text-mint-700">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="font-semibold">Expected</span>
                <RichTextView value={c.expectedResult} size="sm" className="mt-0.5 text-mint-800" />
              </span>
            </p>
          </div>

          {/* The result */}
          <div className="space-y-4">
            {canRecord ? (
              <>
                <fieldset>
                  <legend className={labelCls}>Outcome</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {OUTCOMES.map((o) => {
                      const m = RUN_META[o];
                      const on = run.status === o;
                      return (
                        <button
                          key={o}
                          type="button"
                          aria-pressed={on}
                          disabled={busy}
                          onClick={() => onRecord({ status: on ? "not_run" : o })}
                          className={cx(
                            "flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border text-[13px] font-semibold transition disabled:opacity-50",
                            on ? "border-transparent bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                          )}
                        >
                          <m.icon size={15} aria-hidden />
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-500">Press the chosen outcome again to set it back to not run.</p>
                </fieldset>

                <div>
                  <label htmlFor={`${panelId}-actual`} className={labelCls}>
                    What happened
                  </label>
                  <RichTextEditor id={`${panelId}-actual`} minHeight={80} value={actual} onChange={setActual} />
                </div>
                <div>
                  <label htmlFor={`${panelId}-notes`} className={labelCls}>
                    Notes
                  </label>
                  <RichTextEditor id={`${panelId}-notes`} minHeight={64} value={notes} onChange={setNotes} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    disabled={!dirty || busy}
                    onClick={() => onRecord({ actualResult: isRichBlank(actual) ? null : actual, notes: isRichBlank(notes) ? null : notes })}
                  >
                    Save notes
                  </Button>
                  {canManage && run.status === "failed" && !run.finding && (
                    <Button size="sm" variant="primary" icon={Bug} onClick={onRaise}>
                      Raise a finding
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-2 text-sm text-neutral-700">
                <RunChip status={run.status} />
                <RichTextView value={run.actualResult} size="sm" />
                <RichTextView value={run.notes} size="sm" className="text-neutral-500" />
              </div>
            )}

            {run.finding && (
              <button
                type="button"
                onClick={() => onOpenFinding(run.finding!.id)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2.5 text-left text-sm hover:bg-rose-50"
              >
                <Bug size={16} className="shrink-0 text-rose-600" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium text-neutral-900">{run.finding.title}</span>
                <Chip hue={run.finding.isComplete ? "mint" : "slate"}>{run.finding.isComplete ? "Fixed: retest" : "Open"}</Chip>
              </button>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-neutral-200/70 pt-3 text-xs text-neutral-500">
              {run.executedAt && (
                <span>
                  {run.statusLabel} by {run.executedBy?.name ?? "someone"} · {fmtDateTime(run.executedAt)}
                  {run.attempts > 1 ? ` · attempt ${run.attempts}` : ""}
                </span>
              )}
              {canManage && (
                <span className="flex items-center gap-2">
                  <span id={`${panelId}-who`}>Run by</span>
                  <SearchableSelect
                    aria-labelledby={`${panelId}-who`}
                    size="sm"
                    className="w-40"
                    value={run.assignee?.id ?? ""}
                    onChange={(v) => onRecord({ assigneeId: v === "" ? null : v })}
                    options={[{ value: "", label: "Anyone" }, ...assignees.map((a) => ({ value: a.id, label: a.name }))]}
                  />
                </span>
              )}
              {canManage && run.status === "not_run" && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="ml-auto inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg px-2 font-semibold text-error-700 hover:bg-error-50"
                >
                  <Trash2 size={14} aria-hidden /> Take out of the plan
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */

function AddCasesDialog({
  project,
  sprint,
  inSprint,
  onClose,
  onAdded,
}: {
  project: Project;
  sprint: TestSprint;
  inSprint: Set<string>;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [cases, setCases] = useState<TestCase[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void casesApi
      .list(project.slug)
      .then((res) => setCases(res.data.filter((c) => !inSprint.has(c.id))))
      .catch(() => setError("The library did not load."));
  }, [project.slug, inSprint]);

  const visible = (cases ?? []).filter((c) =>
    q.trim() === "" ? true : `${c.reference} ${c.title} ${c.workItem?.title ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  const add = async (input: { caseIds?: string[]; fromTargetSprint?: boolean }) => {
    setSaving(true);
    setError(null);
    try {
      await testSprintsApi.addRuns(sprint.id, input);
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The cases were not added.");
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Add cases to run"
      subtitle={sprint.name}
      icon={ListPlus}
      hue="grape"
      width="lg"
      onClose={onClose}
      bodyClassName="space-y-4 px-6 py-5"
      footer={
        <>
          {sprint.targetSprint && (
            <Button disabled={saving} onClick={() => void add({ fromTargetSprint: true })}>
              Every case for {sprint.targetSprint.name}
            </Button>
          )}
          <Button className="ml-auto" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={saving || chosen.size === 0} onClick={() => void add({ caseIds: [...chosen] })}>
            {saving ? "Adding…" : `Add ${plural(chosen.size, "case")}`}
          </Button>
        </>
      }
    >
      {error !== null && <Notice tone="error">{error}</Notice>}
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the library"
        aria-label="Search the library"
        className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
      />
      {cases === null ? (
        <p className="text-sm text-neutral-500">Loading the library…</p>
      ) : visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-500">
          {cases.length === 0 ? "Every case in the library is already in this sprint." : "No case matches."}
        </p>
      ) : (
        <ul className="max-h-[50dvh] space-y-1 overflow-y-auto">
          {visible.map((c) => (
            <li key={c.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-neutral-50">
                <input
                  type="checkbox"
                  checked={chosen.has(c.id)}
                  onChange={(e) => {
                    const next = new Set(chosen);
                    if (e.target.checked) next.add(c.id);
                    else next.delete(c.id);
                    setChosen(next);
                  }}
                  className="h-5 w-5 rounded border-neutral-300 text-primary-600"
                />
                <span className="w-12 shrink-0 font-mono text-xs font-semibold text-neutral-500">{c.reference}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-neutral-900">{c.title}</span>
                  <span className="block truncate text-xs text-neutral-500">{c.workItem?.title ?? "No particular story"}</span>
                </span>
                <LevelChip level={c.level} />
              </label>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function CloseDialog({
  sprint,
  report,
  onClose,
  onClosed,
}: {
  sprint: TestSprint;
  report: TestSprintReport;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [summary, setSummary] = useState(
    sprint.summary ??
      `${report.runs.executed} of ${report.runs.total} cases run; ${report.runs.passed} passed, ${report.runs.failed} failed, ${report.runs.blocked} blocked. ${report.findings.total} findings raised, ${report.findings.open} still open.`,
  );
  const [recommendations, setRecommendations] = useState(sprint.recommendations ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await testSprintsApi.close(sprint.id, { summary: summary.trim() || null, recommendations: recommendations.trim() || null });
      onClosed();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The test sprint was not closed.");
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Close ${sprint.name}`}
      subtitle="Freezes the report"
      icon={Lock}
      hue="slate"
      width="lg"
      onClose={onClose}
      onSubmit={submit}
      bodyClassName="space-y-5 px-6 py-5"
      footer={
        <>
          <Button className="ml-auto" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Closing…" : "Close and freeze the report"}
          </Button>
        </>
      }
    >
      <Notice tone="warn">
        Results can no longer change once it closes. {report.runs.not_run > 0 && `${plural(report.runs.not_run, "case")} not run will be recorded as not run.`}
      </Notice>
      {error !== null && <Notice tone="error">{error}</Notice>}
      <div>
        <label htmlFor="cl-summary" className={labelCls}>
          Summary
        </label>
        <RichTextEditor id="cl-summary" variant="full" minHeight={140} value={summary} onChange={setSummary} />
      </div>
      <div>
        <label htmlFor="cl-rec" className={labelCls}>
          Recommendations
        </label>
        <RichTextEditor
          id="cl-rec"
          variant="full"
          minHeight={160}
          value={recommendations}
          onChange={setRecommendations}
          placeholder="Fix the two critical findings before release; add rate limiting to sign-in; retest leave approvals next sprint"
        />
      </div>
    </Modal>
  );
}
