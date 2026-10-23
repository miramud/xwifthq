"use client";

import { useEffect, useState } from "react";
import { Bug, ClipboardList, FlaskConical, Lock, Plus, ShieldAlert } from "lucide-react";
import { Button, Card, Chip, Empty, PersonAvatar, Segmented, cx } from "@/components/workspace/kit";
import {
  ApiError,
  testSprints as testSprintsApi,
  type BoardSetup,
  type Project,
  type Sprint,
  type TestSprint,
  type WorkItem,
} from "@/lib/api/projects-client";
import { Notice, TabSkeleton, fmtRange, plural } from "../ui/pkit";
import TestBacklog from "./TestBacklog";
import TestCaseLibrary from "./TestCaseLibrary";
import TestSprintDetail from "./TestSprintDetail";
import TestSprintDialog from "./TestSprintDialog";
import { RunStrip } from "./testingUi";
import { richExcerpt } from "@/lib/richText";

type View = "sprints" | "cases" | "backlog";

/**
 * The project's Testing tab (5 Oct 2026): test sprints run by the QA and
 * security analysts, the test-case library they run, and the test backlog of
 * what they found.
 *
 * Findings are bugs on the ordinary work-item table, so opening one opens the
 * same item panel as the board - where it is assigned, dated, weighted and
 * put in a sprint like any other work.
 */
export default function TestingWorkspace({
  project,
  sprints,
  setup,
  refreshKey,
  onOpenItem,
  onChanged,
}: {
  project: Project;
  sprints: Sprint[];
  setup: BoardSetup | null;
  /** Bumped when the item panel saves, so the test backlog re-reads. */
  refreshKey: number;
  onOpenItem: (item: WorkItem) => void;
  onChanged: () => void;
}) {
  const [view, setView] = useState<View>("sprints");
  const [selected, setSelected] = useState<string | null>(null);
  /* Pressing a view again returns to its start (the library from the AI drafter, say). */
  const [visit, setVisit] = useState(0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented<View>
          label="Testing"
          value={view}
          onChange={(v) => {
            setView(v);
            setSelected(null);
            setVisit((n) => n + 1);
          }}
          options={[
            { key: "sprints", label: "Test sprints" },
            { key: "cases", label: "Test cases" },
            { key: "backlog", label: "Test backlog" },
          ]}
        />
        <p className="text-xs text-neutral-500">
          {project.can.manageTesting
            ? "You manage this project's testing."
            : "Read only: the QA and security analysts and the managers run testing."}
        </p>
      </div>

      {view === "sprints" ? (
        selected !== null ? (
          <TestSprintDetail
            project={project}
            sprints={sprints}
            setup={setup}
            testSprintId={selected}
            onBack={() => setSelected(null)}
            onOpenItem={onOpenItem}
            onChanged={onChanged}
          />
        ) : (
          <TestSprintList project={project} sprints={sprints} setup={setup} onOpen={setSelected} />
        )
      ) : view === "cases" ? (
        <TestCaseLibrary key={visit} project={project} sprints={sprints} refreshKey={refreshKey} />
      ) : (
        <TestBacklog project={project} refreshKey={refreshKey} onOpenItem={onOpenItem} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TestSprintList({
  project,
  sprints,
  setup,
  onOpen,
}: {
  project: Project;
  sprints: Sprint[];
  setup: BoardSetup | null;
  onOpen: (id: string) => void;
}) {
  const [list, setList] = useState<TestSprint[] | null>(null);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    testSprintsApi
      .list(project.slug)
      .then((rows) => {
        if (!live) return;
        setList(rows);
        setError(null);
      })
      .catch((e) => live && setError(e instanceof ApiError ? e.message : "The test sprints did not load."));
    return () => {
      live = false;
    };
  }, [project.slug]);

  if (list === null) return error ? <Notice tone="error">{error}</Notice> : <TabSkeleton stats={0} />;

  const canManage = project.can.manageTesting === true;
  /* Newest first: the running and planned ones are what a tester opens. */
  const ordered = [...list].sort((a, b) => b.sequence - a.sequence);

  return (
    <div className="space-y-4">
      {error !== null && <Notice tone="error">{error}</Notice>}

      {ordered.length === 0 ? (
        <Card>
          <Empty
            icon={FlaskConical}
            hue="grape"
            title="No test sprints yet"
            hint="Plan one for the sprint the team is delivering: its test cases come with it, and what fails becomes a finding in the test backlog."
            action={
              canManage ? (
                <Button size="sm" variant="primary" icon={Plus} onClick={() => setPlanning(true)}>
                  Plan a test sprint
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          {canManage && (
            <div className="flex justify-end">
              <Button size="sm" variant="primary" icon={Plus} onClick={() => setPlanning(true)}>
                Plan a test sprint
              </Button>
            </div>
          )}
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ordered.map((s) => (
              <li key={s.id}>
                <TestSprintCard sprint={s} onOpen={() => onOpen(s.id)} />
              </li>
            ))}
          </ul>
        </>
      )}

      {planning && (
        <TestSprintDialog
          project={project}
          sprints={sprints}
          setup={setup}
          testSprint={null}
          onClose={() => setPlanning(false)}
          onSaved={(saved) => {
            setPlanning(false);
            onOpen(saved.id);
          }}
        />
      )}
    </div>
  );
}

function TestSprintCard({ sprint, onOpen }: { sprint: TestSprint; onOpen: () => void }) {
  const security = sprint.focus === "security";
  const closed = sprint.status === "closed";
  const active = sprint.status === "active";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        "ws-card flex h-full w-full cursor-pointer flex-col gap-4 p-5 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
        active && "ring-2 ring-mint-500/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            security ? "bg-rose-50 text-rose-700" : "bg-grape-50 text-grape-700",
          )}
        >
          {security ? <ShieldAlert size={18} aria-hidden /> : <FlaskConical size={18} aria-hidden />}
        </span>
        <Chip hue={active ? "mint" : closed ? "slate" : "sky"} dot icon={closed ? Lock : undefined}>
          {sprint.statusLabel}
        </Chip>
      </div>

      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-neutral-900">{sprint.name}</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {sprint.focusLabel}
          {sprint.targetSprint ? ` · testing ${sprint.targetSprint.name}` : ""}
        </p>
        {sprint.goal && <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{richExcerpt(sprint.goal, 200)}</p>}
      </div>

      {sprint.runCounts && (sprint.runCount ?? 0) > 0 && (
        <RunStrip counts={sprint.runCounts} total={sprint.runCount ?? 0} size="sm" showLegend={false} />
      )}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
        <span>{fmtRange(sprint.startsOn, sprint.endsOn)}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <ClipboardList size={13} aria-hidden />
            {plural(sprint.runCount ?? 0, "case")}
          </span>
          <span className="flex items-center gap-1">
            <Bug size={13} aria-hidden />
            {plural(sprint.findingCount ?? 0, "finding")}
          </span>
          {sprint.lead && <PersonAvatar name={sprint.lead.name} size={22} />}
        </span>
      </div>
    </button>
  );
}
