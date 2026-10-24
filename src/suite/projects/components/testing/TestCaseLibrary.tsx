"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, Sparkles } from "lucide-react";
import { Button, Card, Empty } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import {
  ApiError,
  testCases as casesApi,
  type Project,
  type Sprint,
  type TestCase,
  type TestCaseCategory,
  type TestLevel,
} from "@/lib/api/projects-client";
import { Notice, TabSkeleton, plural } from "../ui/pkit";
import CaseDrawer from "./CaseDrawer";
import TestCaseDrafter from "./TestCaseDrafter";
import { CASE_CATEGORY_LABEL, CaseCategoryChip, LevelChip, RunChip } from "./testingUi";

/**
 * The project's test-case library: written by hand, or drafted with AI from a
 * sprint's stories and reviewed before it lands. Every case is run in as
 * many test sprints as need it.
 */
export default function TestCaseLibrary({
  project,
  sprints,
  refreshKey,
}: {
  project: Project;
  sprints: Sprint[];
  refreshKey: number;
}) {
  const [cases, setCases] = useState<TestCase[] | null>(null);
  const [meta, setMeta] = useState<{ canManage: boolean; canGenerate: boolean; provider: { provider: string; model: string } | null } | null>(null);
  const [sprintId, setSprintId] = useState("");
  const [level, setLevel] = useState<TestLevel | "">("");
  const [category, setCategory] = useState<TestCaseCategory | "">("");
  const [open, setOpen] = useState<TestCase | "new" | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchCases = useCallback(
    () =>
      casesApi.list(project.slug, {
        sprintId: sprintId || undefined,
        level: level || undefined,
        category: category || undefined,
      }),
    [project.slug, sprintId, level, category],
  );

  const apply = (res: Awaited<ReturnType<typeof casesApi.list>>) => {
    setCases(res.data);
    setMeta(res.meta);
    setError(null);
  };

  const failed = (e: unknown) => setError(e instanceof ApiError ? e.message : "The test cases did not load.");

  const load = () => fetchCases().then(apply).catch(failed);

  useEffect(() => {
    let live = true;
    fetchCases()
      .then((res) => live && apply(res))
      .catch((e) => live && failed(e));
    return () => {
      live = false;
    };
  }, [fetchCases, refreshKey]);

  const columns: Column<TestCase>[] = useMemo(
    () => [
      {
        key: "ref",
        header: "Ref",
        value: (c) => c.number,
        render: (c) => <span className="font-mono text-xs font-semibold text-neutral-600">{c.reference}</span>,
        sortable: true,
      },
      {
        key: "title",
        header: "Case",
        primary: true,
        value: (c) => `${c.title} ${c.workItem?.title ?? ""}`,
        render: (c) => (
          <div className="min-w-0">
            <p className="font-semibold text-neutral-900">{c.title}</p>
            <p className="mt-0.5 truncate text-xs text-neutral-500">{c.workItem ? c.workItem.title : "No particular story"}</p>
          </div>
        ),
        sortable: true,
      },
      {
        key: "level",
        header: "Level",
        value: (c) => c.level,
        render: (c) => <LevelChip level={c.level} />,
        sortable: true,
      },
      {
        key: "category",
        header: "Kind",
        value: (c) => c.categoryLabel,
        render: (c) => <CaseCategoryChip category={c.category} />,
        sortable: true,
        hideOnMobile: true,
      },
      {
        key: "priority",
        header: "Priority",
        value: (c) => c.priority,
        render: (c) => <span className="text-neutral-700">{["", "High", "Medium", "Low", "Lowest"][c.priority] ?? "Medium"}</span>,
        sortable: true,
        hideOnMobile: true,
      },
      {
        key: "last",
        header: "Last run",
        value: (c) => c.lastRun?.status ?? "",
        render: (c) => (c.lastRun ? <RunChip status={c.lastRun.status} /> : <span className="text-neutral-500">Never run</span>),
        sortable: true,
      },
    ],
    [],
  );

  if (drafting) {
    return (
      <TestCaseDrafter
        project={project}
        sprints={sprints}
        provider={meta?.provider ?? null}
        onClose={() => setDrafting(false)}
        onCommitted={(created) => {
          setDrafting(false);
          setNotice(`${plural(created, "case")} added to the library.`);
          void load();
        }}
      />
    );
  }

  if (cases === null || meta === null) {
    return error ? <Notice tone="error">{error}</Notice> : <TabSkeleton stats={0} />;
  }

  const filtersOn = sprintId !== "" || level !== "" || category !== "";

  return (
    <div className="space-y-4">
      {notice !== null && <Notice tone="success">{notice}</Notice>}
      {error !== null && <Notice tone="error">{error}</Notice>}

      {cases.length === 0 && !filtersOn ? (
        <Card>
          <Empty
            icon={ClipboardList}
            hue="grape"
            title="No test cases yet"
            hint="Draft them from a sprint's stories with AI, or write one by hand. You can run each case in as many test sprints as you need."
            action={
              meta.canManage || meta.canGenerate ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {meta.canManage && (
                    <Button size="sm" icon={Plus} onClick={() => setOpen("new")}>
                      Write a case
                    </Button>
                  )}
                  {meta.canGenerate && (
                    <Button size="sm" variant="primary" icon={Sparkles} onClick={() => setDrafting(true)}>
                      Draft from a sprint
                    </Button>
                  )}
                </div>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <DataView
          rows={cases}
          columns={columns}
          rowKey={(c) => c.id}
          storageKey="projects-test-cases"
          views={["table", "list"]}
          onRowClick={(c) => setOpen(c)}
          caption="Test cases"
          searchPlaceholder="Search cases"
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <SearchableSelect
                aria-label="Sprint"
                size="sm"
                className="w-44"
                value={sprintId}
                onChange={setSprintId}
                options={[{ value: "", label: "Every sprint" }, ...sprints.map((s) => ({ value: s.id, label: s.name }))]}
              />
              <SearchableSelect
                aria-label="Level"
                size="sm"
                className="w-32"
                value={level}
                onChange={(v) => setLevel(v as TestLevel | "")}
                options={[
                  { value: "", label: "API and UI" },
                  { value: "api", label: "API" },
                  { value: "ui", label: "UI" },
                ]}
              />
              <SearchableSelect
                aria-label="Kind"
                size="sm"
                className="w-40"
                value={category}
                onChange={(v) => setCategory(v as TestCaseCategory | "")}
                options={[
                  { value: "", label: "Every kind" },
                  ...Object.entries(CASE_CATEGORY_LABEL).map(([value, label]) => ({ value, label })),
                ]}
              />
              {meta.canManage && (
                <Button size="sm" icon={Plus} onClick={() => setOpen("new")}>
                  Write a case
                </Button>
              )}
              {meta.canGenerate && (
                <Button size="sm" variant="primary" icon={Sparkles} onClick={() => setDrafting(true)}>
                  Draft with AI
                </Button>
              )}
            </div>
          }
          empty={<p className="px-6 py-10 text-center text-sm text-neutral-500">No cases match these filters.</p>}
        />
      )}

      {open !== null && (
        <CaseDrawer
          project={project}
          testCase={open === "new" ? null : open}
          canManage={meta.canManage}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
